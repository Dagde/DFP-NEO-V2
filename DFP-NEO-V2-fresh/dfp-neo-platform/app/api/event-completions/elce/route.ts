/**
 * /api/event-completions/elce
 *
 * ELCE (Effective Last Completed Event) lookup endpoint.
 *
 * This endpoint is the primary integration point between the EventCompletion
 * DCO-tracking table and the DFP build algorithm.
 *
 * GET  /api/event-completions/elce
 *        ?traineeFullName=<name>&buildDate=<YYYY-MM-DD>
 *        → Single ELCE for one trainee
 *
 * POST /api/event-completions/elce
 *        body: { traineeFullNames: string[], buildDate: string }
 *        → Bulk ELCE for multiple trainees (one DB round-trip)
 *
 * ─── How ELCE works ──────────────────────────────────────────────────────────
 *
 * Problem it solves:
 *   A trainee flew BGF2 today and finished at 11:00.  The post-flight paperwork
 *   (PT-051 Score record) has not been entered yet, so the IndividualLMP still
 *   shows their last completed event as BGF1.  When building tomorrow's program,
 *   the scheduler should treat BGF2 as completed and schedule BGF3.
 *
 * How the EventCompletion table solves this:
 *   When the post-flight form is submitted (PostFlightView → save), the app
 *   immediately writes an EventCompletion record with dcoResult=DCO/DPCO and
 *   isCountedAsElce=true.  The build algorithm queries this table BEFORE it
 *   calls computeNextEventsForTrainee, adds any ELCE event codes to the
 *   trainee's completed-event set, and then computes the next event correctly.
 *
 * DNCO events:
 *   When dcoResult=DNCO, isCountedAsElce is set to false by the service layer.
 *   DNCO records are excluded from ELCE queries so that unsuccessful sorties
 *   do NOT advance the trainee's next-event pointer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getElceForTrainee,
  getBulkElceForTrainees,
} from '../../../../lib/eventCompletionService';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// ─── GET /api/event-completions/elce ─────────────────────────────────────────
/**
 * Single-trainee ELCE lookup.
 *
 * Query parameters:
 *   - traineeFullName   (required) Full name of the trainee
 *   - buildDate         (required) ISO date YYYY-MM-DD of the day being built
 *
 * Response:
 *   {
 *     elce: ElceResult | null,
 *     traineeFullName: string,
 *     buildDate: string
 *   }
 *
 * `elce` is null when the trainee has no qualifying EventCompletion records
 * before the build date (e.g. brand-new trainee, or all prior events were DNCO).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traineeFullName = searchParams.get('traineeFullName');
    const buildDate       = searchParams.get('buildDate');

    if (!traineeFullName || !buildDate) {
      return NextResponse.json(
        { error: 'Both traineeFullName and buildDate query parameters are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Basic date format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(buildDate)) {
      return NextResponse.json(
        { error: 'buildDate must be in YYYY-MM-DD format' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const elce = await getElceForTrainee(traineeFullName, buildDate);

    return NextResponse.json(
      { elce, traineeFullName, buildDate },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[ELCE GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ELCE' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

// ─── POST /api/event-completions/elce ────────────────────────────────────────
/**
 * Bulk ELCE lookup — one DB round-trip for all trainees.
 *
 * This is the endpoint the build algorithm should call at the start of a
 * program build, before it compiles next-event lists.
 *
 * Request body:
 *   {
 *     traineeFullNames: string[],   // array of full names
 *     buildDate:        string      // YYYY-MM-DD
 *   }
 *
 * Response:
 *   {
 *     elceMap: Record<traineeFullName, ElceResult | null>,
 *     buildDate: string,
 *     count: number   // number of trainees with a non-null ELCE
 *   }
 *
 * The `elceMap` object maps each requested traineeFullName to their ELCE
 * (or null if no qualifying completion exists).
 *
 * Usage in the build algorithm (TypeScript pseudocode):
 * ```ts
 * const { elceMap } = await fetch('/api/event-completions/elce', {
 *   method: 'POST',
 *   body: JSON.stringify({ traineeFullNames: activeTrainees.map(t => t.fullName), buildDate })
 * }).then(r => r.json());
 *
 * activeTrainees.forEach(trainee => {
 *   const elce = elceMap[trainee.fullName];
 *   const nextEvents = computeNextEventsForTrainee(trainee, traineeLMPs, scores, syllabus, elce);
 *   traineeNextEventMap.set(trainee.fullName, nextEvents);
 * });
 * ```
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { traineeFullNames, buildDate } = body as {
      traineeFullNames: string[];
      buildDate: string;
    };

    // ── Validate ──────────────────────────────────────────────────────────
    if (!Array.isArray(traineeFullNames) || traineeFullNames.length === 0) {
      return NextResponse.json(
        { error: 'traineeFullNames must be a non-empty array of strings' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (!buildDate || !/^\d{4}-\d{2}-\d{2}$/.test(buildDate)) {
      return NextResponse.json(
        { error: 'buildDate is required and must be in YYYY-MM-DD format' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (traineeFullNames.length > 500) {
      return NextResponse.json(
        { error: 'traineeFullNames may contain at most 500 entries per request' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // ── Bulk query ────────────────────────────────────────────────────────
    const elceMapRaw = await getBulkElceForTrainees(traineeFullNames, buildDate);

    // Serialise Map → plain object for JSON
    const elceMap: Record<string, any> = {};
    let count = 0;
    elceMapRaw.forEach((elce, name) => {
      elceMap[name] = elce;
      if (elce !== null) count++;
    });

    return NextResponse.json(
      { elceMap, buildDate, count },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('[ELCE POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bulk ELCE data' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}