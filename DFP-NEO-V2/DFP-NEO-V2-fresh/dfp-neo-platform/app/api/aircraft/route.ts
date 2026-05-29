import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/aircraft - Get all aircraft with optional filtering
// Note: Auth check removed - page-level auth (login page) protects access
export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({ aircraft }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  } finally {
    await prisma.$disconnect();
  }
}