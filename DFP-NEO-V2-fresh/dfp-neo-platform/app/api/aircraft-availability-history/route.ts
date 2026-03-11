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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    const records = await prisma.aircraftAvailabilityHistory.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ records }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error fetching aircraft availability history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft availability history' },
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
        { status: 400 }
      );
    }

    // Check if record exists for this date
    const existingRecord = await prisma.aircraftAvailabilityHistory.findUnique({
      where: { date },
    });

    let record;

    if (existingRecord) {
      // Update existing record
      record = await prisma.aircraftAvailabilityHistory.update({
        where: { date },
        data: {
          dailyAverage,
          plannedCount,
          actualCount,
          totalAircraft,
          availabilityPct,
          recordedBy,
          notes,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new record
      record = await prisma.aircraftAvailabilityHistory.create({
        data: {
          date,
          dailyAverage: dailyAverage ?? 0,
          plannedCount: plannedCount ?? 0,
          actualCount,
          totalAircraft: totalAircraft ?? 0,
          availabilityPct: availabilityPct ?? 0,
          recordedBy,
          notes,
        },
      });
    }

    return NextResponse.json({ 
      success: true,
      record 
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error saving aircraft availability history:', error);
    return NextResponse.json(
      { error: 'Failed to save aircraft availability history' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}