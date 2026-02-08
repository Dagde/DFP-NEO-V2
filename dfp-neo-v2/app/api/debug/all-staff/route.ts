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

    // Get all personnel with key fields
    const allStaff = await prisma.personnel.findMany({
      select: {
        id: true,
        idNumber: true,
        name: true,
        rank: true,
        role: true,
        unit: true,
        isQFI: true,
        isOFI: true,
        isSIM_IP: true
      },
      orderBy: { unit: 'asc' }
    });

    // Group by unit
    const byUnit = allStaff.reduce((acc, staff) => {
      const unit = staff.unit || 'Unassigned';
      if (!acc[unit]) {
        acc[unit] = [];
      }
      acc[unit].push(staff);
      return acc;
    }, {} as Record<string, typeof allStaff>);

    // Count QFIs by unit
    const qfiCounts = await prisma.personnel.groupBy({
      by: ['unit'],
      where: {
        OR: [
          { role: 'QFI' },
          { isQFI: true }
        ]
      },
      _count: { id: true },
      orderBy: { unit: 'asc' }
    });

    return NextResponse.json({
      totalStaff: allStaff.length,
      staffByUnit: byUnit,
      qfiCountsByUnit: qfiCounts.map(u => ({
        unit: u.unit,
        qfiCount: u._count.id
      })),
      allStaffList: allStaff.map(s => ({
        idNumber: s.idNumber,
        name: s.name,
        rank: s.rank,
        role: s.role,
        unit: s.unit,
        isQFI: s.isQFI,
        isOFI: s.isOFI,
        isSIM_IP: s.isSIM_IP
      }))
    });
  } catch (error) {
    console.error('Error fetching all staff:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}