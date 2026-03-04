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

    // Get all personnel (staff/instructors)
    const personnelWhere: any = {
      isActive: true,
      OR: [
        { role: 'INSTRUCTOR' },
        { role: 'OFI' },
        { role: 'QFI' },
      ],
    };

    if (search) {
      personnelWhere.OR = [
        ...personnelWhere.OR,
        { name: { contains: search, mode: 'insensitive' } },
        { idNumber: { equals: parseInt(search) } },
        { rank: { contains: search, mode: 'insensitive' } },
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
        { idNumber: { equals: parseInt(search) } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }

    const trainees = await prisma.trainee.findMany({
      where: traineeWhere,
      orderBy: [
        { name: 'asc' },
      ],
    });

    // Transform personnel data
    const transformedPersonnel = personnel.map(p => {
      // Map category to service
      const serviceMap: Record<string, string> = {
        'A': 'RAAF',
        'B': 'RAAF',
        'D': 'RAAF',
        'UnCat': 'N/A',
      };
      
      // Map flight to unit
      const unitMap: Record<string, string> = {
        'A': '1FTS',
        'B': '1FTS',
        'C': '1FTS',
        'D': '1FTS',
      };
      
      return {
        id: p.id,
        name: p.name,
        pmkeysId: p.idNumber ? p.idNumber.toString() : 'N/A',
        role: p.role || 'STAFF',
        createdAt: p.createdAt.toISOString().split('T')[0],
        rank: p.rank,
        service: serviceMap[p.category || ''] || p.category || 'RAAF',
        unit: unitMap[p.flight || ''] || p.flight || 'N/A',
        userType: 'STAFF' as const,
        personnelId: p.id,
        email: p.email || 'N/A',
      };
    });

    // Transform trainee data
    const transformedTrainees = trainees.map(t => {
      return {
        id: t.id,
        name: t.name,
        pmkeysId: t.idNumber ? t.idNumber.toString() : 'N/A',
        role: 'TRAINEE',
        createdAt: t.createdAt ? t.createdAt.toISOString().split('T')[0] : 'N/A',
        rank: t.rank,
        service: t.service || 'RAAF',
        unit: t.course || 'N/A',
        userType: 'TRAINEE' as const,
        personnelId: t.id,
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
