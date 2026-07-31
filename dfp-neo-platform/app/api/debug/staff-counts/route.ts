import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unitFilter = searchParams
      .getAll('unit')
      .flatMap(value => value.split(','))
      .map(value => value.trim())
      .filter(Boolean);

    const where = unitFilter.length > 0
      ? { unit: { in: unitFilter } }
      : {};

    // Count staff by configured unit and role
    const staffCounts = await prisma.personnel.groupBy({
      by: ['unit', 'role'],
      where,
      _count: {
        id: true
      },
      orderBy: [
        { unit: 'asc' },
        { role: 'asc' }
      ]
    });

    // Count total by unit
    const unitTotals = await prisma.personnel.groupBy({
      by: ['unit'],
      where,
      _count: {
        id: true
      }
    });

    // Format the results
    const formattedCounts = staffCounts.map(item => ({
      unit: item.unit,
      role: item.role,
      count: item._count.id
    }));

    const formattedTotals = unitTotals.map(item => ({
      unit: item.unit,
      total: item._count.id
    }));

    return NextResponse.json({
      staffByUnitAndRole: formattedCounts,
      totalsByUnit: formattedTotals,
      message: 'Database staff counts retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching staff counts:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while fetching staff counts' },
      { status: 500 }
    );
  }
}
