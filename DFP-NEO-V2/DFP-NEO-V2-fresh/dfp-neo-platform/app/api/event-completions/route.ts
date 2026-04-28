/**
 * /api/event-completions
 *
 * Collection-level endpoint for EventCompletion records.
 *
 * GET  /api/event-completions          — list with optional filters
 * POST /api/event-completions          — create or upsert a new completion
 *
 * DCO-based tracking: every call to POST carries at minimum a `dcoResult`
 * field ('DCO' | 'DPCO' | 'DNCO').  The service layer automatically derives
 * `isCountedAsElce` from the result so that DNCO events never advance a
 * trainee's next-event pointer in the build algorithm.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listEventCompletions,
  upsertEventCompletion,
  eventCompletionExistsForScheduleEvent,
} from '../../../lib/eventCompletionService';
import {
  CreateEventCompletionPayload,
  EventCompletionFilters,
  DcoResult,
  EventCompletionSource,
  EventCompletionType,
} from '../../../types/EventCompletion';

// ─── CORS headers (match existing pattern in the repo) ───────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ─── GET /api/event-completions ───────────────────────────────────────────────
/**
 * Query parameters (all optional):
 *  - traineeId           string
 *  - traineeFullName     string
 *  - eventCode           string
 *  - dcoResult           'DCO' | 'DPCO' | 'DNCO'
 *  - eventDateFrom       YYYY-MM-DD
 *  - eventDateTo         YYYY-MM-DD
 *  - isCountedAsElce     'true' | 'false'
 *  - source              'post_flight' | 'manual' | 'import'
 *  - limit               number  (default 100)
 *  - offset              number  (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters: EventCompletionFilters = {};

    const traineeId       = searchParams.get('traineeId');
    const traineeFullName = searchParams.get('traineeFullName');
    const scheduleEventId = searchParams.get('scheduleEventId');
    const eventCode       = searchParams.get('eventCode');
    const dcoResult       = searchParams.get('dcoResult') as DcoResult | null;
    const eventDateFrom   = searchParams.get('eventDateFrom');
    const eventDateTo     = searchParams.get('eventDateTo');
    const isCountedAsElce = searchParams.get('isCountedAsElce');
    const source          = searchParams.get('source') as EventCompletionSource | null;
    const limit           = searchParams.get('limit');
    const offset          = searchParams.get('offset');

    if (traineeId)       filters.traineeId       = traineeId;
    if (traineeFullName) filters.traineeFullName  = traineeFullName;
    if (scheduleEventId) filters.scheduleEventId  = scheduleEventId;
    if (eventCode)       filters.eventCode        = eventCode;
    if (dcoResult)       filters.dcoResult        = dcoResult;
    if (eventDateFrom)   filters.eventDateFrom    = eventDateFrom;
    if (eventDateTo)     filters.eventDateTo      = eventDateTo;
    if (source)          filters.source           = source;
    if (isCountedAsElce !== null)
      filters.isCountedAsElce = isCountedAsElce === 'true';
    if (limit)           filters.limit            = parseInt(limit,  10);
    if (offset)          filters.offset           = parseInt(offset, 10);

    const { completions, total } = await listEventCompletions(filters);

    return NextResponse.json(
      { completions, count: completions.length, total },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[EventCompletion GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event completions' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ─── POST /api/event-completions ──────────────────────────────────────────────
/**
 * Create or upsert an EventCompletion record.
 *
 * Required body fields:
 *  - scheduleEventId   string  (unique per sortie — used for upsert)
 *  - traineeFullName   string
 *  - eventCode         string  (syllabus code, e.g. "BGF2")
 *  - eventDate         string  (YYYY-MM-DD)
 *  - dcoResult         'DCO' | 'DPCO' | 'DNCO'
 *
 * Optional body fields: see CreateEventCompletionPayload type.
 *
 * Uses upsert semantics so that re-submitting a post-flight form for the
 * same event updates the existing record rather than throwing a unique error.
 *
 * Returns 200 if an existing record was updated, 201 if a new one was created.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateEventCompletionPayload;

    // ── Validate required fields ──────────────────────────────────────────
    const missing: string[] = [];
    if (!body.scheduleEventId) missing.push('scheduleEventId');
    if (!body.traineeFullName) missing.push('traineeFullName');
    if (!body.eventCode)       missing.push('eventCode');
    if (!body.eventDate)       missing.push('eventDate');
    if (!body.dcoResult)       missing.push('dcoResult');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // ── Validate dcoResult enum ───────────────────────────────────────────
    const validDcoResults: DcoResult[] = ['DCO', 'DPCO', 'DNCO'];
    if (!validDcoResults.includes(body.dcoResult)) {
      return NextResponse.json(
        { error: `Invalid dcoResult "${body.dcoResult}". Must be one of: DCO, DPCO, DNCO` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // ── Validate eventType enum if provided ───────────────────────────────
    if (body.eventType) {
      const validTypes: EventCompletionType[] = ['flight', 'ftd', 'cpt', 'ground'];
      if (!validTypes.includes(body.eventType)) {
        return NextResponse.json(
          { error: `Invalid eventType "${body.eventType}". Must be one of: flight, ftd, cpt, ground` },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    }

    // ── Check if this is a create or an update ────────────────────────────
    const isUpdate = await eventCompletionExistsForScheduleEvent(body.scheduleEventId);

    const completion = await upsertEventCompletion(body);

    return NextResponse.json(
      { completion, created: !isUpdate, updated: isUpdate },
      { status: isUpdate ? 200 : 201, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[EventCompletion POST] Error:', error);

    // Surface unique-constraint violations clearly
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('Unique constraint') || errMsg.includes('unique constraint')) {
      return NextResponse.json(
        { error: 'An EventCompletion record already exists for this scheduleEventId' },
        { status: 409, headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      { error: 'Failed to save event completion', details: errMsg },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}