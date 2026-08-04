import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();

// GET /api/flight-log — fetch entries, optionally filtered
// Query params: traineeId, personnelId, personName, scheduleEventId, eventCode, fromDate, toDate
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traineeId       = searchParams.get('traineeId');
    const personnelId     = searchParams.get('personnelId');
    const personName      = searchParams.get('personName');
    const scheduleEventId = searchParams.get('scheduleEventId');
    const eventCode       = searchParams.get('eventCode');
    const fromDate        = searchParams.get('fromDate');
    const toDate          = searchParams.get('toDate');

    const where: any = {};
    if (traineeId)       where.traineeId       = traineeId;
    if (personnelId)     where.personnelId     = personnelId;
    if (personName)      where.personName      = { contains: personName, mode: 'insensitive' };
    if (scheduleEventId) where.scheduleEventId = scheduleEventId;
    if (eventCode)       where.eventCode       = eventCode;
    if (fromDate || toDate) {
      where.eventDate = {};
      if (fromDate) where.eventDate.gte = fromDate;
      if (toDate)   where.eventDate.lte = toDate;
    }

    const entries = await (prisma as any).flightLogEntry.findMany({
      where,
      orderBy: [{ eventDate: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ entries, count: entries.length });
  } catch (error) {
    console.error('[FlightLog GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flight log entries' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/flight-log — upsert a flight log entry
// Uses scheduleEventId + personRole + personName as the natural upsert key
// so re-saving the same post-flight form overwrites rather than duplicates.
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('training:manage');

    const body = await request.json();

    const {
      scheduleEventId,
      eventCode,
      eventDate,
      eventType       = 'flight',
      traineeId,
      personnelId,
      personName,
      personRole,      // "trainee" | "instructor"
      aircraftNumber,
      fromIcao,
      toIcao,
      duty,
      isSolo          = false,
      isDual          = false,
      isFlightLog     = true,
      isFtdLog        = false,
      takeoffTime,
      landTime,
      totalTime,
      captainTime,
      instructorTime,
      nightTime,
      ifActualTime,
      ifSimTime,
      ineffectiveTime,
      ilsCount        = 0,
      rnpCount        = 0,
      tacanCount      = 0,
      vorCount        = 0,
      recordedBy,
      notes,
      // Logbook snapshot fields — full captain/crew log row as JSON
      captainLogSnapshot,
      crewLogSnapshot,
    } = body;

    // ── DETAILED API TRACKING ──────────────────────────────────────────────
    console.log('[FlightLog POST] Received:', JSON.stringify({
      scheduleEventId, eventCode, eventDate, eventType,
      personName, personRole,
      aircraftNumber, fromIcao, toIcao, duty,
      isSolo, isDual, isFlightLog, isFtdLog,
      takeoffTime, landTime,
      totalTime, captainTime, instructorTime,
      nightTime, ifActualTime, ifSimTime, ineffectiveTime,
      ilsCount, rnpCount, tacanCount, vorCount,
      hasCaptainLogSnapshot: !!captainLogSnapshot,
      hasCrewLogSnapshot:    !!crewLogSnapshot,
    }, null, 2));
    // ── END API TRACKING ────────────────────────────────────────────────────

    // Validate required fields
    if (!scheduleEventId || !eventCode || !eventDate || !personName || !personRole) {
      console.warn('[FlightLog POST] Validation FAILED:', { scheduleEventId: !scheduleEventId, eventCode: !eventCode, eventDate: !eventDate, personName: !personName, personRole: !personRole });
      return NextResponse.json(
        { error: 'Missing required fields: scheduleEventId, eventCode, eventDate, personName, personRole' },
        { status: 400 }
      );
    }

    // Upsert: find existing row for this sortie + person, then update or create.
    // Fixed Crew events can have multiple staff in the same broad role, so personName
    // must be part of the natural key.
    const existing = await (prisma as any).flightLogEntry.findFirst({
      where: { scheduleEventId, personRole, personName },
    });

    const data: any = {
      scheduleEventId,
      eventCode,
      eventDate,
      eventType,
      traineeId:       traineeId   || null,
      personnelId:     personnelId || null,
      personName,
      personRole,
      aircraftNumber:  aircraftNumber  || null,
      fromIcao:        fromIcao        || null,
      toIcao:          toIcao          || null,
      duty:            duty            || null,
      isSolo:          !!isSolo,
      isDual:          !!isDual,
      isFlightLog:     !!isFlightLog,
      isFtdLog:        !!isFtdLog,
      takeoffTime:     takeoffTime     || null,
      landTime:        landTime        || null,
      totalTime:       totalTime       != null ? Number(totalTime)       : null,
      captainTime:     captainTime     != null ? Number(captainTime)     : null,
      instructorTime:  instructorTime  != null ? Number(instructorTime)  : null,
      nightTime:       nightTime       != null ? Number(nightTime)       : null,
      ifActualTime:    ifActualTime    != null ? Number(ifActualTime)    : null,
      ifSimTime:       ifSimTime       != null ? Number(ifSimTime)       : null,
      ineffectiveTime: ineffectiveTime != null ? Number(ineffectiveTime) : null,
      ilsCount:        Number(ilsCount   || 0),
      rnpCount:        Number(rnpCount   || 0),
      tacanCount:      Number(tacanCount || 0),
      vorCount:        Number(vorCount   || 0),
      recordedBy:      recordedBy || null,
      notes:           notes      || null,
      // Logbook snapshots — full row data including all manual overrides
      captainLogSnapshot: captainLogSnapshot ?? null,
      crewLogSnapshot:    crewLogSnapshot    ?? null,
    };

    let entry;
    let created = false;

    if (existing) {
      entry = await (prisma as any).flightLogEntry.update({
        where: { id: existing.id },
        data,
      });
      console.log(`[FlightLog] ✅ UPDATED ${personRole} entry for ${personName} — ${eventCode} on ${eventDate}`);
      console.log('[FlightLog] Data written to DB:', JSON.stringify(data, null, 2));
    } else {
      entry = await (prisma as any).flightLogEntry.create({ data });
      created = true;
      console.log(`[FlightLog] ✅ CREATED ${personRole} entry for ${personName} — ${eventCode} on ${eventDate}`);
      console.log('[FlightLog] Data written to DB:', JSON.stringify(data, null, 2));
    }

    return NextResponse.json({ entry, created }, { status: created ? 201 : 200 });
  } catch (error: any) {
    console.error('[FlightLog POST] Error:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to save flight log entries' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to save flight log entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
