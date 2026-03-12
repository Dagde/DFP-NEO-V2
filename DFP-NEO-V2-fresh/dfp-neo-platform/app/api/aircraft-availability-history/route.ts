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

/**
 * GET /api/aircraft-availability-history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Returns daily summary records for the given date range (used by AC History page).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate   = searchParams.get('endDate');

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
    console.error('[AV-HISTORY] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/aircraft-availability-history
 * Recovery/sync endpoint. Recalculates daily summary for a date from raw events.
 * Body: { date, flyingWindowStart, flyingWindowEnd, recordedBy }
 *
 * Also used on startup to check if today's summary is missing and rebuild it.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, flyingWindowStart, flyingWindowEnd, recordedBy } = body;

    if (!date) {
      return NextResponse.json(
        { error: 'date is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Check if summary already exists and is recent (within last 10 minutes) - skip recalc
    const existing = await prisma.aircraftAvailabilityHistory.findUnique({
      where: { date },
    });
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (existing && existing.lastCalculatedAt > tenMinutesAgo) {
      console.log(`[AV-HISTORY] Summary for ${date} is recent, skipping recalculation`);
      return NextResponse.json(
        { skipped: true, reason: 'recent', record: existing },
        { headers: CORS_HEADERS }
      );
    }

    // Get all events for the date
    const events = await prisma.aircraftAvailabilityEvent.findMany({
      where: { date },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      console.log(`[AV-HISTORY] No events for ${date}, cannot rebuild summary`);
      return NextResponse.json(
        { skipped: true, reason: 'no_events' },
        { headers: CORS_HEADERS }
      );
    }

    // Parse flying window
    const parseWindowTime = (s: string | undefined, defaultHour: number): number => {
      if (!s) return defaultHour * 60;
      const clean = s.replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10);
      const m = parseInt(clean.slice(-2), 10);
      return h * 60 + m;
    };

    const windowStartMin = parseWindowTime(flyingWindowStart, 8);
    const windowEndMin   = parseWindowTime(flyingWindowEnd, 17);
    const totalWindowMinutes = windowEndMin - windowStartMin;

    const toMinutes = (ts: Date): number => {
      return ts.getHours() * 60 + ts.getMinutes() + ts.getSeconds() / 60;
    };

    let weightedSum = 0;
    let coveredMinutes = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evMinutes = toMinutes(ev.timestamp);
      const nextMinutes = i + 1 < events.length
        ? toMinutes(events[i + 1].timestamp)
        : windowEndMin;

      const segStart = Math.max(evMinutes, windowStartMin);
      const segEnd   = Math.min(nextMinutes, windowEndMin);

      if (segEnd > segStart) {
        const duration = segEnd - segStart;
        weightedSum += ev.availableCount * duration;
        coveredMinutes += duration;
      }
    }

    if (coveredMinutes === 0 && events.length > 0) {
      const toMin = (ts: Date) => ts.getHours() * 60 + ts.getMinutes();
      const lastBeforeWindow = [...events].reverse().find(e => toMin(e.timestamp) <= windowStartMin);
      const fallbackCount = lastBeforeWindow ? lastBeforeWindow.availableCount : events[0].availableCount;
      weightedSum = fallbackCount * totalWindowMinutes;
      coveredMinutes = totalWindowMinutes;
    }

    if (coveredMinutes < totalWindowMinutes) {
      const uncoveredMinutes = totalWindowMinutes - coveredMinutes;
      const lastEvent = events[events.length - 1];
      weightedSum += lastEvent.availableCount * uncoveredMinutes;
    }

    const dailyAverage = totalWindowMinutes > 0 ? weightedSum / totalWindowMinutes : 0;
    const totalAircraft = Math.max(...events.map(e => e.totalAircraft));
    const plannedCount = events[0].availableCount;
    const actualCount = events[events.length - 1].availableCount;
    const availabilityPct = totalAircraft > 0 ? (dailyAverage / totalAircraft) * 100 : 0;

    console.log(
      `[AV-HISTORY] 🔄 Recovery recalculation for ${date}: ` +
      `dailyAverage=${dailyAverage.toFixed(3)} from ${events.length} events`
    );

    const record = await prisma.aircraftAvailabilityHistory.upsert({
      where: { date },
      update: {
        dailyAverage,
        plannedCount,
        actualCount,
        totalAircraft,
        availabilityPct,
        flyingWindowStart: flyingWindowStart ?? null,
        flyingWindowEnd:   flyingWindowEnd ?? null,
        recordedBy: recordedBy ?? null,
        lastCalculatedAt: new Date(),
      },
      create: {
        date,
        dailyAverage,
        plannedCount,
        actualCount,
        totalAircraft,
        availabilityPct,
        flyingWindowStart: flyingWindowStart ?? null,
        flyingWindowEnd:   flyingWindowEnd ?? null,
        recordedBy: recordedBy ?? null,
        lastCalculatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, record },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[AV-HISTORY] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate summary', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}