import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/debug/user-personnel-linkage - Check linkage between User and Personnel
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [DEBUG] Checking User-Personnel linkage for:', session.user.userId);

    // Get the User record
    const user = await prisma.user.findFirst({
      where: {
        userId: session.user.userId
      }
    });

    if (!user) {
      return NextResponse.json({
        error: 'User not found',
        sessionUserId: session.user.userId
      });
    }

    // Get all Personnel records
    const allPersonnel = await prisma.personnel.findMany({
      take: 10
    });

    // Try to find Personnel by userId (direct link)
    const personnelByUserId = await prisma.personnel.findFirst({
      where: {
        userId: session.user.userId
      }
    });

    // Try to find Personnel by idNumber (PMKEYS match)
    const personnelByIdNumber = await prisma.personnel.findFirst({
      where: {
        idNumber: parseInt(session.user.userId)
      }
    });

    return NextResponse.json({
      sessionUserId: session.user.userId,
      
      user: {
        id: user.id,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      
      personnelByUserId: personnelByUserId ? {
        id: personnelByUserId.id,
        name: personnelByUserId.name,
        rank: personnelByUserId.rank,
        userId: personnelByUserId.userId,
        idNumber: personnelByUserId.idNumber
      } : null,
      
      personnelByIdNumber: personnelByIdNumber ? {
        id: personnelByIdNumber.id,
        name: personnelByIdNumber.name,
        rank: personnelByIdNumber.rank,
        userId: personnelByIdNumber.userId,
        idNumber: personnelByIdNumber.idNumber
      } : null,
      
      samplePersonnel: allPersonnel.map(p => ({
        id: p.id,
        name: p.name,
        rank: p.rank,
        userId: p.userId,
        idNumber: p.idNumber
      }))
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check linkage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}