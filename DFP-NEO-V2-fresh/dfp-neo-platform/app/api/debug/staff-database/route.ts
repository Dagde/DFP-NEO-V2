import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [DEBUG] Querying Railway PostgreSQL Database...');

    // Get all personnel
    const allPersonnel = await prisma.personnel.findMany({
      orderBy: { name: 'asc' }
    });

    // Get real database staff (with userId)
    const realStaff = await prisma.personnel.findMany({
      where: {
        userId: { not: null }
      },
      orderBy: { name: 'asc' }
    });

    // Get mockdata (without userId)
    const mockData = await prisma.personnel.findMany({
      where: {
        userId: null
      },
      orderBy: { name: 'asc' }
    });

    const result = {
      summary: {
        totalRecords: allPersonnel.length,
        realStaffCount: realStaff.length,
        mockDataCount: mockData.length
      },
      realStaff: realStaff.map(staff => ({
        id: staff.id,
        name: staff.name,
        rank: staff.rank,
        unit: staff.unit,
        idNumber: staff.idNumber,
        role: staff.role,
        category: staff.category,
        userId: staff.userId,
        isActive: staff.isActive,
        createdAt: staff.createdAt
      })),
      sampleMockData: mockData.slice(0, 10).map(staff => ({
        id: staff.id,
        name: staff.name,
        rank: staff.rank,
        unit: staff.unit,
        idNumber: staff.idNumber,
        role: staff.role,
        category: staff.category
      }))
    };

    console.log('✅ [DEBUG] Database query successful');
    console.log(`📊 [DEBUG] Total: ${result.summary.totalRecords}, Real Staff: ${result.summary.realStaffCount}, Mockdata: ${result.summary.mockDataCount}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [DEBUG] Error querying database:', error);
    return NextResponse.json(
      { error: 'Failed to query database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}