import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/user/[userId]/personnel - Get Personnel record for a User
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { userId } = await params;
    console.log('🔍 [iOS APP] Fetching Personnel for User:', userId);

    // Get the User record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        personnel: true
      }
    });

    if (!user) {
      console.log('❌ [iOS APP] User not found:', userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ [iOS APP] User found:', user.username);

    if (!user.personnel) {
      console.log('⚠️  [iOS APP] No linked Personnel record for User:', userId);
      return NextResponse.json(
        { 
          error: 'Personnel record not linked',
          userId: userId,
          username: user.username,
          message: 'User exists but is not linked to any Personnel record'
        },
        { status: 404 }
      );
    }

    console.log('✅ [iOS APP] Personnel record found:', user.personnel.name);
    console.log(`📊 [iOS APP] User: ${user.username} → Personnel: ${user.personnel.name} (${user.personnel.idNumber})`);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        userId: user.userId,
        displayName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username,
        role: user.role
      },
      personnel: user.personnel
    });
  } catch (error) {
    console.error('❌ [iOS APP] Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}