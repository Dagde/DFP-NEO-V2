import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/users - Get all Staff and Trainee users
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
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { idNumber: { equals: parseInt(search) } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get all personnel (staff and trainees)
    const personnel = await prisma.personnel.findMany({
      where: {
        ...where,
        isActive: true,
      },
      orderBy: [
        { name: 'asc' },
      ],
    });

    // Transform to match expected format
    const transformedUsers = personnel.map(p => {
      // Determine if this is staff or trainee based on role
      const userType = (p.role === 'TRAINEE' || p.role === 'CADET') ? 'TRAINEE' : 'STAFF';
      
      return {
        id: p.id,
        name: p.name,
        pmkeysId: p.idNumber ? p.idNumber.toString() : 'N/A',
        role: p.role || 'STAFF',
        createdAt: p.createdAt.toISOString().split('T')[0],
        rank: p.rank,
        service: p.category, // Using category as service for now
        unit: p.flight || 'N/A', // Using flight as unit for now
        userType: userType,
        personnelId: p.id,
        email: p.email || 'N/A',
      };
    });

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
