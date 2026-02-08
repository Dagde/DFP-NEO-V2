import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/admin/users/[id]/find-personnel - Find Personnel by User's PMKEYS
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get User
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        personnel: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('🔍 [FIND-PERSONNEL] Finding Personnel for User:', user.username);

    // Check if already linked
    if (user.personnel) {
      console.log('✅ [FIND-PERSONNEL] User already linked to Personnel:', user.personnel.name);
      return NextResponse.json({
        success: true,
        alreadyLinked: true,
        user: {
          id: user.id,
          username: user.username,
          userId: user.userId,
          displayName: `${user.firstName} ${user.lastName}`.trim() || user.username
        },
        personnel: user.personnel
      });
    }

    // Find Personnel by PMKEYS
    if (!user.userId) {
      return NextResponse.json(
        { 
          error: 'User does not have a PMKEYS',
          user: {
            id: user.id,
            username: user.username
          }
        },
        { status: 400 }
      );
    }

    const personnelList = await prisma.personnel.findMany({
      where: { 
        idNumber: parseInt(user.userId) || 0
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 [FIND-PERSONNEL] Found ${personnelList.length} Personnel record(s) for PMKEYS:`, user.userId);

    return NextResponse.json({
      success: true,
      alreadyLinked: false,
      user: {
        id: user.id,
        username: user.username,
        userId: user.userId,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.username,
        pmkeys: user.userId
      },
      personnelCount: personnelList.length,
      personnel: personnelList.map(p => ({
        id: p.id,
        name: p.name,
        rank: p.rank,
        unit: p.unit,
        idNumber: p.idNumber,
        role: p.role,
        category: p.category,
        isActive: p.isActive,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ [FIND-PERSONNEL] Error finding personnel:', error);
    return NextResponse.json(
      { error: 'Failed to find personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}