import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/aircraft - Get all aircraft with optional filtering
export async function GET(request: NextRequest) {
  try {
    // Allow access from iframe - authentication is handled by the parent app
    // const session = await auth();
    
    // if (!session?.user) {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   );
    // }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // ESL or PEA
    const status = searchParams.get('status'); // available or unavailable

    // Build where clause
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (status === 'available') {
      where.status = 'available';
    } else if (status === 'unavailable') {
      where.status = 'unavailable';
    }

    const aircraft = await prisma.aircraft.findMany({
      where,
      orderBy: { aircraftNumber: 'asc' },
    });

    return NextResponse.json({ aircraft });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft' },
      { status: 500 }
    );
  }
}