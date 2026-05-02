import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

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
 * POST /api/aircraft-availability-recalculate
 * Recalculates (or skips if recent) the daily summary for a given date.
 * Body: { date, flyingWindowStart, flyingWindowEnd, recordedBy }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, flyingWindowStart, flyingWindowEnd, recordedBy } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400, headers: CORS_HEADERS });
    }

    // Check for existing summary
    const existing = await prisma.aircraftAvailabilityHistory.findUnique({ where: { date } });
    // Only skip for past dates (not today) — today's data changes throughout the day
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    if (!isToday && existing && existing.lastCalculatedAt > oneMinuteAgo) {
      return NextResponse.json({ skipped: true, reason: 'recent', record: existing, summary: existing }, { headers: CORS_HEADERS });
    }

    // Get all events for the date
    const events = await prisma.aircraftAvailabilityEvent.findMany({
      where: { date },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no_events' }, { headers: CORS_HEADERS });
    }

    const parseWindowTime = (s: string | undefined, defaultHour: number): number => {
      if (!s) return defaultHour * 60;
      const clean = s.replace(':', '');
      return parseInt(clean.slice(0, -2), 10) * 60 + parseInt(clean.slice(-2), 10);
    };

    const windowStartMin = parseWindowTime(flyingWindowStart, 8);
    const windowEndMin = parseWindowTime(flyingWindowEnd, 17);
    const totalWindowMinutes = windowEndMin - windowStartMin;

    const toMinutes = (ts: Date): number =>
      new Date(ts).getHours() * 60 + new Date(ts).getMinutes() + new Date(ts).getSeconds() / 60;

    let weightedSum = 0;
    let coveredMinutes = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evMinutes = toMinutes(ev.timestamp);
      const nextMinutes = i + 1 < events.length ? toMinutes(events[i + 1].timestamp) : windowEndMin;
      const segStart = Math.max(evMinutes, windowStartMin);
      const segEnd = Math.min(nextMinutes, windowEndMin);
      if (segEnd > segStart) {
        weightedSum += ev.availableCount * (segEnd - segStart);
        coveredMinutes += segEnd - segStart;
      }
    }

    if (coveredMinutes === 0) {
      const fallback = events[0].availableCount;
      weightedSum = fallback * totalWindowMinutes;
      coveredMinutes = totalWindowMinutes;
    }

    if (coveredMinutes < totalWindowMinutes) {
      const uncovered = totalWindowMinutes - coveredMinutes;
      weightedSum += events[events.length - 1].availableCount * uncovered;
    }

    const dailyAverage = totalWindowMinutes > 0 ? weightedSum / totalWindowMinutes : 0;
    const totalAircraft = Math.max(...events.map((e: any) => e.totalAircraft));
    const availabilityPct = totalAircraft > 0 ? (dailyAverage / totalAircraft) * 100 : 0;

    const record = await prisma.aircraftAvailabilityHistory.upsert({
      where: { date },
      update: {
        dailyAverage,
        plannedCount: events[0].availableCount,
        actualCount: events[events.length - 1].availableCount,
        totalAircraft,
        availabilityPct,
        flyingWindowStart: flyingWindowStart ?? null,
        flyingWindowEnd: flyingWindowEnd ?? null,
        recordedBy: recordedBy ?? null,
        lastCalculatedAt: new Date(),
      },
      create: {
        date,
        dailyAverage,
        plannedCount: events[0].availableCount,
        actualCount: events[events.length - 1].availableCount,
        totalAircraft,
        availabilityPct,
        flyingWindowStart: flyingWindowStart ?? null,
        flyingWindowEnd: flyingWindowEnd ?? null,
        recordedBy: recordedBy ?? null,
        lastCalculatedAt: new Date(),
      },
    });

    // Return both 'record' and 'summary' so both old and new callers work
    return NextResponse.json({ success: true, record, summary: record }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[AV-RECALC] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}