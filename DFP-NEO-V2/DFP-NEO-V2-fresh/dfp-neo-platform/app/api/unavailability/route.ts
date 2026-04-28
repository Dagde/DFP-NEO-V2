import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/unavailability - Get all personnel with availability data
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
    const role = searchParams.get('role'); // instructor or trainee
    const hasUnavailability = searchParams.get('hasUnavailability'); // 'true' to get only those with unavailability

    // Build where clause
    const where: any = {};

    if (role) {
      where.role = role;
    }

    const personnel = await prisma.personnel.findMany({
      where,
      select: {
        id: true,
        name: true,
        rank: true,
        role: true,
        availability: true,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    // Filter by unavailability if requested
    let filteredPersonnel = personnel;
    if (hasUnavailability === 'true') {
      filteredPersonnel = personnel.filter(p => 
        p.availability && 
        typeof p.availability === 'object' && 
        !Array.isArray(p.availability) &&
        Object.keys(p.availability as object).length > 0
      );
    }

    return NextResponse.json({ personnel: filteredPersonnel });
  } catch (error) {
    console.error('Error fetching unavailability records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unavailability records' },
      { status: 500 }
    );
  }
}

// POST /api/unavailability - Update personnel availability
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { personnelId, availability } = body;

    if (!personnelId || !availability) {
      return NextResponse.json(
        { error: 'personnelId and availability are required' },
        { status: 400 }
      );
    }

    const personnel = await prisma.personnel.update({
      where: { id: personnelId },
      data: {
        availability,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true,
      personnel 
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    return NextResponse.json(
      { error: 'Failed to update availability' },
      { status: 500 }
    );
  }
}