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
 * GET /api/aircraft-availability-events?date=YYYY-MM-DD
 * Returns all events for a given date (or date range).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (date) {
      where.date = date;
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const events = await prisma.aircraftAvailabilityEvent.findMany({
      where,
      orderBy: { timestamp: 'asc' },
    });

    return NextResponse.json({ events }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[AV-EVENTS] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * POST /api/aircraft-availability-events
 * Inserts a new availability event.
 * Deduplication: skips insert if last event for the day has same availableCount
 * UNLESS changeType is window_start, window_end, startup, or reset (boundary events always inserted).
 *
 * Body: { timestamp, date, availableCount, totalAircraft, changeType, recordedBy, notes,
 *         flyingWindowStart, flyingWindowEnd }
 *
 * After inserting, triggers recalculation of the daily summary.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      timestamp,
      date,
      availableCount,
      totalAircraft,
      changeType,
      recordedBy,
      notes,
      flyingWindowStart,
      flyingWindowEnd,
    } = body;

    if (!date || availableCount === undefined || availableCount === null) {
      return NextResponse.json(
        { error: 'date and availableCount are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const BOUNDARY_TYPES = ['window_start', 'window_end', 'startup', 'reset', 'shutdown'];
    const isBoundary = BOUNDARY_TYPES.includes(changeType);

    // --- Deduplication ---
    // For non-boundary events: skip if last event for the day has same availableCount
    if (!isBoundary) {
      const lastEvent = await prisma.aircraftAvailabilityEvent.findFirst({
        where: { date },
        orderBy: { timestamp: 'desc' },
      });
      if (lastEvent && lastEvent.availableCount === availableCount) {
        console.log(
          `[AV-EVENTS] Skipping duplicate event for ${date}: ` +
          `availableCount=${availableCount} unchanged since last event (${lastEvent.changeType} @ ${lastEvent.timestamp.toISOString()})`
        );
        // Still recalculate summary in case it's missing
        const summary = await recalculateDailySummary(date, flyingWindowStart, flyingWindowEnd, recordedBy);
        return NextResponse.json(
          { skipped: true, reason: 'no_change', summary },
          { headers: CORS_HEADERS }
        );
      }
    }

    // --- Insert event ---
    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
    const event = await prisma.aircraftAvailabilityEvent.create({
      data: {
        timestamp: eventTimestamp,
        date,
        availableCount,
        totalAircraft,
        changeType: changeType || 'change',
        recordedBy: recordedBy ?? null,
        notes: notes ?? null,
      },
    });

    console.log(
      `[AV-EVENTS] ✅ Event inserted: date=${date} type=${changeType} ` +
      `available=${availableCount}/${totalAircraft} by=${recordedBy ?? 'unknown'} ` +
      `ts=${eventTimestamp.toISOString()}`
    );

    // --- Recalculate daily summary ---
    const summary = await recalculateDailySummary(date, flyingWindowStart, flyingWindowEnd, recordedBy);

    return NextResponse.json(
      { success: true, event, summary },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[AV-EVENTS] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to insert event', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Recalculates the time-weighted daily average for a given date
 * using all events in AircraftAvailabilityEvent for that day.
 *
 * Algorithm:
 *  1. Get all events for the date, sorted by timestamp ascending.
 *  2. Clip the timeline to [flyingWindowStart, flyingWindowEnd].
 *  3. For each interval [eventTime, nextEventTime], count minutes within the flying window.
 *  4. dailyAverage = sum(availableCount × minutesActive) / totalFlyingWindowMinutes
 */
async function recalculateDailySummary(
  date: string,
  flyingWindowStart?: string, // "0800" or "08:00" format
  flyingWindowEnd?: string,   // "1700" or "17:00" format
  recordedBy?: string | null
): Promise<any> {
  try {
    // Parse flying window (default 0800-1700)
    const parseWindowTime = (s: string | undefined, defaultHour: number): number => {
      if (!s) return defaultHour * 60;
      const clean = s.replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10);
      const m = parseInt(clean.slice(-2), 10);
      return h * 60 + m;
    };

    const windowStartMin = parseWindowTime(flyingWindowStart, 8);  // 480 = 08:00
    const windowEndMin   = parseWindowTime(flyingWindowEnd, 17);   // 1020 = 17:00
    const totalWindowMinutes = windowEndMin - windowStartMin;

    if (totalWindowMinutes <= 0) {
      console.warn(`[AV-EVENTS] Invalid flying window: ${flyingWindowStart}-${flyingWindowEnd}`);
      return null;
    }

    // Get all events for the date
    const events = await prisma.aircraftAvailabilityEvent.findMany({
      where: { date },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) {
      console.log(`[AV-EVENTS] No events for ${date}, skipping summary recalculation`);
      return null;
    }

    // Convert event timestamps to minutes-since-midnight
    const toMinutes = (ts: Date): number => {
      const h = ts.getHours();
      const m = ts.getMinutes();
      const s = ts.getSeconds();
      return h * 60 + m + s / 60;
    };

    // Build timeline segments
    let weightedSum = 0;
    let coveredMinutes = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evMinutes = toMinutes(ev.timestamp);
      const nextMinutes = i + 1 < events.length
        ? toMinutes(events[i + 1].timestamp)
        : windowEndMin; // assume last value persists until end of window

      // Clip segment to flying window
      const segStart = Math.max(evMinutes, windowStartMin);
      const segEnd   = Math.min(nextMinutes, windowEndMin);

      if (segEnd > segStart) {
        const duration = segEnd - segStart;
        weightedSum += ev.availableCount * duration;
        coveredMinutes += duration;
        console.log(
          `[AV-EVENTS] Segment [${segStart.toFixed(0)}-${segEnd.toFixed(0)}min]: ` +
          `${ev.availableCount} ac × ${duration.toFixed(1)} min`
        );
      }
    }

    // If no coverage (all events outside window), use the last known value
    if (coveredMinutes === 0 && events.length > 0) {
      // Find last event at or before window start
      const lastBeforeWindow = [...events]
        .reverse()
        .find(e => toMinutes(e.timestamp) <= windowStartMin);
      const fallbackCount = lastBeforeWindow
        ? lastBeforeWindow.availableCount
        : events[0].availableCount;

      weightedSum = fallbackCount * totalWindowMinutes;
      coveredMinutes = totalWindowMinutes;
      console.log(
        `[AV-EVENTS] No events inside window for ${date}. ` +
        `Using fallback count=${fallbackCount} for full window.`
      );
    }

    // Fill remaining window time with last known value
    if (coveredMinutes < totalWindowMinutes) {
      const uncoveredMinutes = totalWindowMinutes - coveredMinutes;
      const lastEvent = events[events.length - 1];
      weightedSum += lastEvent.availableCount * uncoveredMinutes;
      console.log(
        `[AV-EVENTS] Filling ${uncoveredMinutes.toFixed(1)} uncovered window minutes ` +
        `with last known count=${lastEvent.availableCount}`
      );
    }

    const dailyAverage = totalWindowMinutes > 0 ? weightedSum / totalWindowMinutes : 0;
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const totalAircraft = Math.max(...events.map(e => e.totalAircraft));
    const plannedCount = firstEvent.availableCount;
    const actualCount = lastEvent.availableCount;
    const availabilityPct = totalAircraft > 0 ? (dailyAverage / totalAircraft) * 100 : 0;

    console.log(
      `[AV-EVENTS] 📊 Daily summary for ${date}: ` +
      `dailyAverage=${dailyAverage.toFixed(3)} ` +
      `(${events.length} events, window ${windowStartMin}-${windowEndMin} min, ` +
      `total ${totalWindowMinutes} min) ` +
      `availPct=${availabilityPct.toFixed(1)}%`
    );

    // Upsert daily summary
    const summary = await prisma.aircraftAvailabilityHistory.upsert({
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

    console.log(`[AV-EVENTS] ✅ Daily summary upserted for ${date}`);
    return summary;
  } catch (err) {
    console.error(`[AV-EVENTS] ❌ Failed to recalculate summary for ${date}:`, err);
    return null;
  }
}