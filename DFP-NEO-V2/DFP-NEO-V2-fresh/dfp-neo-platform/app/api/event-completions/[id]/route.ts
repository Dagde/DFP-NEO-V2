/**
 * /api/event-completions/[id]
 *
 * Single-record endpoint for EventCompletion.
 *
 * GET    /api/event-completions/[id]   — fetch one record
 * PATCH  /api/event-completions/[id]   — partial update
 * DELETE /api/event-completions/[id]   — hard delete
 *
 * [id] may be either:
 *   - The EventCompletion primary-key (cuid)
 *   - The scheduleEventId (prefixed with "evt_" convention, or detected by
 *     the presence of a non-cuid format)
 *
 * In practice the frontend always uses the primary-key cuid returned from
 * GET/POST responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import {
  getEventCompletionById,
  getEventCompletionByScheduleEventId,
  updateEventCompletion,
  deleteEventCompletion,
} from '../../../../lib/eventCompletionService';
import {
  UpdateEventCompletionPayload,
  DcoResult,
} from '../../../../types/EventCompletion';


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// ─── Resolve record by id or scheduleEventId ─────────────────────────────────
async function resolveCompletion(id: string) {
  // Try primary key first
  let completion = await getEventCompletionById(id);
  // Fall back to scheduleEventId lookup
  if (!completion) {
    completion = await getEventCompletionByScheduleEventId(id);
  }
  return completion;
}

// ─── GET /api/event-completions/[id] ─────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const completion = await resolveCompletion(params.id);

    if (!completion) {
      return NextResponse.json(
        { error: 'EventCompletion not found' },
        { status: 404, headers: getCorsHeaders(request) },
      );
    }

    return NextResponse.json({ completion }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[EventCompletion GET /id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event completion' },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

// ─── PATCH /api/event-completions/[id] ───────────────────────────────────────
/**
 * Partial update.  All fields are optional.
 *
 * If `dcoResult` is included, `isCountedAsElce` is automatically re-derived
 * by the service layer — callers must NOT pass `isCountedAsElce` directly.
 *
 * Common use case: correcting a post-flight form after the initial submission,
 * e.g. changing result from DCO → DNCO when a debrief reveals the sortie
 * was unsuccessful.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Resolve actual DB id first
    const existing = await resolveCompletion(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'EventCompletion not found' },
        { status: 404, headers: getCorsHeaders(request) },
      );
    }

    const body = await request.json() as UpdateEventCompletionPayload & {
      isCountedAsElce?: never; // explicitly reject caller-supplied value
    };

    // ── Validate dcoResult if provided ────────────────────────────────────
    if (body.dcoResult !== undefined) {
      const validDcoResults: DcoResult[] = ['DCO', 'DPCO', 'DNCO'];
      if (!validDcoResults.includes(body.dcoResult)) {
        return NextResponse.json(
          { error: `Invalid dcoResult "${body.dcoResult}". Must be one of: DCO, DPCO, DNCO` },
          { status: 400, headers: getCorsHeaders(request) },
        );
      }
    }

    // Strip any caller-supplied isCountedAsElce — it is always derived
    const { isCountedAsElce: _ignored, ...safePayload } = body as any;
    const completion = await updateEventCompletion(existing.id, safePayload);

    return NextResponse.json({ completion }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[EventCompletion PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update event completion' },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}

// ─── DELETE /api/event-completions/[id] ──────────────────────────────────────
/**
 * Hard delete.  Use with caution — prefer correcting via PATCH if the
 * intent is to change the DCO result after a form re-submission.
 *
 * Requires the caller to send `{ confirm: true }` in the request body to
 * prevent accidental deletions from misfired requests.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Safety guard
    let confirm = false;
    try {
      const body = await request.json();
      confirm = body?.confirm === true;
    } catch {
      // body may be empty — treat as unconfirmed
    }

    if (!confirm) {
      return NextResponse.json(
        { error: 'Deletion requires { "confirm": true } in request body' },
        { status: 400, headers: getCorsHeaders(request) },
      );
    }

    const existing = await resolveCompletion(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'EventCompletion not found' },
        { status: 404, headers: getCorsHeaders(request) },
      );
    }

    const result = await deleteEventCompletion(existing.id);
    return NextResponse.json(
      { success: true, id: result.id },
      { headers: getCorsHeaders(request) },
    );
  } catch (error) {
    console.error('[EventCompletion DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete event completion' },
      { status: 500, headers: getCorsHeaders(request) },
    );
  }
}