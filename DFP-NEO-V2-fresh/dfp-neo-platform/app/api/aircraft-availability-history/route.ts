import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/aircraft-availability-history - Get availability records
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate'); // YYYY-MM-DD
    const endDate = searchParams.get('endDate');     // YYYY-MM-DD

    // For string date fields, Prisma string comparison works correctly with gte/lte
    // since dates in YYYY-MM-DD format sort lexicographically
    const where: any = {};

    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    } else if (startDate) {
      where.date = { gte: startDate };
    } else if (endDate) {
      where.date = { lte: endDate };
    }

    const records = await prisma.aircraftAvailabilityHistory.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ records }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error fetching aircraft availability history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft availability history', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/aircraft-availability-history - Create or update an availability record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date,
      dailyAverage,
      plannedCount,
      actualCount,
      totalAircraft,
      availabilityPct,
      recordedBy,
      notes
    } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Upsert - create or update based on unique date
    const record = await prisma.aircraftAvailabilityHistory.upsert({
      where: { date },
      update: {
        dailyAverage: dailyAverage ?? 0,
        plannedCount: plannedCount ?? 0,
        actualCount: actualCount ?? null,
        totalAircraft: totalAircraft ?? 0,
        availabilityPct: availabilityPct ?? 0,
        recordedBy: recordedBy ?? null,
        notes: notes ?? null,
      },
      create: {
        date,
        dailyAverage: dailyAverage ?? 0,
        plannedCount: plannedCount ?? 0,
        actualCount: actualCount ?? null,
        totalAircraft: totalAircraft ?? 0,
        availabilityPct: availabilityPct ?? 0,
        recordedBy: recordedBy ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      record
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error saving aircraft availability history:', error);
    return NextResponse.json(
      { error: 'Failed to save aircraft availability history', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}