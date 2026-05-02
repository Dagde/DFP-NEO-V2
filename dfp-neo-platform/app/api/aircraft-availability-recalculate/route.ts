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
 * Body: { date, flyingWindowStart, flyingWindowEnd, recordedBy, clientLocalHour?, clientLocalMinute? }
 *
 * NOTE: The server may be in UTC while clients are in AEDT (UTC+11) or similar.
 * The 'date' field is always the client's local YYYY-MM-DD date string.
 * We use clientLocalHour/clientLocalMinute to determine if 'date' is today on the client.
 * Timestamps stored in the DB are UTC; we use the UTC offset inferred from client local time
 * to convert DB timestamps to local minutes for the time-weighted average calculation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, flyingWindowStart, flyingWindowEnd, recordedBy, clientLocalHour, clientLocalMinute, clientTimezoneOffsetHours } = body;

    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400, headers: CORS_HEADERS });
    }

    // Determine if this date is "today" on the client.
    // Strategy: The client sends clientLocalHour/clientLocalMinute.
    // We compare the date against the server's UTC date AND infer client-local date.
    // The safest approach: always recalculate for the most recent date (client's today).
    // We trust the client's date string — if they say date="2025-05-27", that's their today.
    // 
    // To determine isToday without relying on server timezone:
    // - Server UTC date: new Date().toISOString().split('T')[0]
    // - But client may be ahead (AEDT = UTC+11), so their "today" could be server's "tomorrow"
    // - If clientLocalHour is provided, we can infer the client's UTC offset:
    //   clientOffset (hours) = clientLocalHour - serverUTCHour (approx, ignoring minutes)
    // - Then client's today = server UTC date + offset adjustment
    //
    // Simplest reliable approach: treat the provided date as potentially "today" if it's
    // within ±1 day of server UTC date. Always recalculate for today (no skip).
    const serverUtcDateStr = new Date().toISOString().split('T')[0];
    const serverUtcDate = new Date(serverUtcDateStr);
    const clientDate = new Date(date + 'T00:00:00Z');
    const diffDays = Math.round((clientDate.getTime() - serverUtcDate.getTime()) / (1000 * 60 * 60 * 24));
    // Consider "today" if within 1 day (handles timezone differences up to UTC+24)
    const isToday = diffDays >= -1 && diffDays <= 1;

    // Check for existing summary
    const existing = await prisma.aircraftAvailabilityHistory.findUnique({ where: { date } });
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    // Only skip for clearly past dates (not today or adjacent)
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

    // Convert a DB timestamp to client-local minutes.
    // The timestamps are stored as UTC. We need to convert them to the client's local time.
    // Strategy: infer UTC offset from clientLocalHour vs server UTC hour at time of request.
    // If clientLocalHour not provided, fall back to UTC (may be slightly off for cross-timezone setups).
    let clientUtcOffsetHours = 0;
    if (typeof clientTimezoneOffsetHours === 'number') {
      clientUtcOffsetHours = clientTimezoneOffsetHours;
    } else if (typeof clientLocalHour === 'number') {
      const serverUtcHour = new Date().getUTCHours();
      clientUtcOffsetHours = clientLocalHour - serverUtcHour;
      // Normalize to [-12, 14] range
      if (clientUtcOffsetHours > 14) clientUtcOffsetHours -= 24;
      if (clientUtcOffsetHours < -12) clientUtcOffsetHours += 24;
    }

    const toLocalMinutes = (ts: Date): number => {
      const utcHours = new Date(ts).getUTCHours();
      const utcMinutes = new Date(ts).getUTCMinutes();
      const utcSeconds = new Date(ts).getUTCSeconds();
      const localTotalMinutes = utcHours * 60 + utcMinutes + utcSeconds / 60 + clientUtcOffsetHours * 60;
      // Normalize to [0, 1440)
      return ((localTotalMinutes % 1440) + 1440) % 1440;
    };

    const now = new Date();
    const currentLocalMinutes = ((now.getUTCHours() * 60 + now.getUTCMinutes() + clientUtcOffsetHours * 60) % 1440 + 1440) % 1440;
    const localNow = new Date(now.getTime() + clientUtcOffsetHours * 60 * 60 * 1000);
    const localToday = `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, '0')}-${String(localNow.getUTCDate()).padStart(2, '0')}`;
    const effectiveEndMin = date === localToday
      ? Math.min(Math.max(currentLocalMinutes, windowStartMin), windowEndMin)
      : windowEndMin;
    const effectiveWindowMinutes = effectiveEndMin - windowStartMin;

    if (effectiveWindowMinutes <= 0) {
      return NextResponse.json({ skipped: true, reason: 'before_flying_window' }, { headers: CORS_HEADERS });
    }

    const timeline = events
      .map((event: any) => ({ event, minutes: toLocalMinutes(event.timestamp) }))
      .sort((a: any, b: any) => a.minutes - b.minutes);
    let weightedSum = 0;
    let coveredMinutes = 0;
    let currentAvailability = timeline[0].event.availableCount;
    let segmentStart = windowStartMin;

    for (const item of timeline) {
      if (item.minutes <= windowStartMin) {
        currentAvailability = item.event.availableCount;
        continue;
      }
      if (item.minutes >= effectiveEndMin) break;
      if (item.minutes > segmentStart) {
        weightedSum += currentAvailability * (item.minutes - segmentStart);
        coveredMinutes += item.minutes - segmentStart;
      }
      currentAvailability = item.event.availableCount;
      segmentStart = item.minutes;
    }

    if (segmentStart < effectiveEndMin) {
      weightedSum += currentAvailability * (effectiveEndMin - segmentStart);
      coveredMinutes += effectiveEndMin - segmentStart;
    }

    if (coveredMinutes < effectiveWindowMinutes) {
      weightedSum += currentAvailability * (effectiveWindowMinutes - coveredMinutes);
    }

    const dailyAverage = effectiveWindowMinutes > 0 ? weightedSum / effectiveWindowMinutes : 0;
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

    const effectiveEndTime = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(Math.floor(effectiveEndMin % 60)).padStart(2, '0')}`;
    const summary = { ...record, dailyAverage, effectiveEndTime };

    // Return both 'record' and 'summary' so both old and new callers work
    return NextResponse.json({ success: true, record: summary, summary }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[AV-RECALC] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to recalculate', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
