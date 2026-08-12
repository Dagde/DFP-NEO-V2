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
    const search = (searchParams.get('search') || '').trim();
    const numericSearch = /^\d+$/.test(search) ? Number(search) : null;

    // Get all active personnel and trainees without legacy role or unit assumptions.
    const personnelWhere: any = {
      isActive: true,
    };

    if (search) {
      personnelWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
        ...(numericSearch !== null ? [{ idNumber: { equals: numericSearch } }] : []),
      ];
    }

    const personnel = await prisma.personnel.findMany({
      where: personnelWhere,
      orderBy: [
        { name: 'asc' },
      ],
    });

    // Get all trainees
    const traineeWhere: any = {};

    if (search) {
      traineeWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
        ...(numericSearch !== null ? [{ idNumber: { equals: numericSearch } }] : []),
      ];
    }

    const trainees = await prisma.trainee.findMany({
      where: traineeWhere,
      orderBy: [
        { name: 'asc' },
      ],
    });

    const transformedPersonnel = personnel.map(p => {
      return {
        id: p.id,
        name: p.name,
        personnelId: p.idNumber ? p.idNumber.toString() : 'N/A',
        role: p.role || 'STAFF',
        createdAt: p.createdAt.toISOString().split('T')[0],
        rank: p.rank,
        service: p.service || p.category || 'N/A',
        unit: p.unit || p.flight || 'N/A',
        userType: 'STAFF' as const,
        profileId: p.id,
        email: p.email || 'N/A',
      };
    });

    // Transform trainee data
    const transformedTrainees = trainees.map(t => {
      return {
        id: t.id,
        name: t.name,
        personnelId: t.idNumber ? t.idNumber.toString() : 'N/A',
        role: 'TRAINEE',
        createdAt: t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A',
        rank: t.rank,
        service: t.service || 'N/A',
        unit: t.unit || t.course || 'N/A',
        userType: 'TRAINEE' as const,
        profileId: t.id,
        email: 'N/A',
      };
    });

    // Combine both lists
    const allUsers = [...transformedPersonnel, ...transformedTrainees];
    
    // Sort alphabetically by name
    allUsers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
