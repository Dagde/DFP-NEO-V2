/**
 * EventCompletion Service
 *
 * Central service for all EventCompletion database operations.
 * Used by the API routes and can be imported directly in server-side
 * Next.js code (e.g. server actions, route handlers).
 *
 * Design decisions:
 *  - Uses the shared singleton Prisma client from lib/db/prisma.ts to
 *    avoid connection pool exhaustion under Railway's free-tier limits.
 *  - `isCountedAsElce` is always derived from `dcoResult` to keep the
 *    invariant "DNCO events never advance the next-event pointer" enforced
 *    at the data layer, not left to the caller.
 *  - All date parameters are plain ISO strings (YYYY-MM-DD) to stay
 *    consistent with the rest of the codebase.
 */

import { prisma } from './db/prisma';
import {
  CreateEventCompletionPayload,
  UpdateEventCompletionPayload,
  EventCompletionFilters,
  ElceResult,
  dcoResultIsElce,
  DcoResult,
} from '../types/EventCompletion';

// ─── Type alias for the Prisma EventCompletion shape ─────────────────────────
// We use `any` cast via the prisma client because Prisma generates types only
// after `prisma generate` is run; this keeps the service portable even when
// the generated client hasn't been regenerated yet.
type PrismaEventCompletion = any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive `isCountedAsElce` from a DCO result.
 * DNCO (unsuccessful) events must never advance the trainee's next-event
 * pointer, so they are excluded from ELCE queries.
 */
const deriveIsCountedAsElce = (dcoResult: DcoResult): boolean =>
  dcoResultIsElce(dcoResult);

/**
 * Build a Prisma `where` clause from the public filter type.
 */
const buildWhereClause = (filters: EventCompletionFilters): Record<string, any> => {
  const where: Record<string, any> = {};

  if (filters.traineeId)       where.traineeId       = filters.traineeId;
  if (filters.traineeFullName) where.traineeFullName = filters.traineeFullName;
  if (filters.eventCode)       where.eventCode       = filters.eventCode;
  if (filters.scheduleEventId) where.scheduleEventId = filters.scheduleEventId;
  if (filters.dcoResult)       where.dcoResult       = filters.dcoResult;
  if (filters.source)          where.source          = filters.source;
  if (filters.isCountedAsElce !== undefined)
    where.isCountedAsElce = filters.isCountedAsElce;

  if (filters.eventDate) {
    where.eventDate = filters.eventDate;
  }

  // Date range filter
  if (filters.eventDateFrom || filters.eventDateTo) {
    where.eventDate = {};
    if (filters.eventDateFrom) where.eventDate.gte = filters.eventDateFrom;
    if (filters.eventDateTo)   where.eventDate.lte = filters.eventDateTo;
  }

  return where;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new EventCompletion record.
 *
 * Automatically sets `isCountedAsElce` from `dcoResult` — callers do not
 * need to (and should not) set this field directly.
 *
 * @throws if `scheduleEventId` is already present (unique constraint).
 */
export async function createEventCompletion(
  payload: CreateEventCompletionPayload,
): Promise<PrismaEventCompletion> {
  const isCountedAsElce = deriveIsCountedAsElce(payload.dcoResult);

  return (prisma as any).eventCompletion.create({
    data: {
      scheduleEventId: payload.scheduleEventId,
      eventCode:       payload.eventCode,
      eventDate:       payload.eventDate,
      eventType:       payload.eventType       ?? 'flight',
      startTime:       payload.startTime       ?? 0,
      duration:        payload.duration        ?? 0,
      traineeId:       payload.traineeId       ?? null,
      traineeFullName: payload.traineeFullName,
      instructorName:  payload.instructorName  ?? null,
      dcoResult:       payload.dcoResult,
      overallGrade:    payload.overallGrade    ?? null,
      overallResult:   payload.overallResult   ?? null,
      aircraftNumber:  payload.aircraftNumber  ?? null,
      takeoffTime:     payload.takeoffTime     ?? null,
      landTime:        payload.landTime        ?? null,
      totalFlightTime: payload.totalFlightTime ?? null,
      isSolo:          payload.isSolo          ?? false,
      isDual:          payload.isDual          ?? false,
      isCountedAsElce,
      recordedBy:      payload.recordedBy      ?? null,
      source:          payload.source          ?? 'post_flight',
      notes:           payload.notes           ?? null,
    },
  });
}

/**
 * Upsert an EventCompletion record by `scheduleEventId`.
 *
 * If a record already exists for the given `scheduleEventId` it is updated;
 * otherwise a new record is created.  This is the preferred write path when
 * re-submitting a post-flight form.
 */
export async function upsertEventCompletion(
  payload: CreateEventCompletionPayload,
): Promise<PrismaEventCompletion> {
  const isCountedAsElce = deriveIsCountedAsElce(payload.dcoResult);

  const data = {
    eventCode:       payload.eventCode,
    eventDate:       payload.eventDate,
    eventType:       payload.eventType       ?? 'flight',
    startTime:       payload.startTime       ?? 0,
    duration:        payload.duration        ?? 0,
    traineeId:       payload.traineeId       ?? null,
    traineeFullName: payload.traineeFullName,
    instructorName:  payload.instructorName  ?? null,
    dcoResult:       payload.dcoResult,
    overallGrade:    payload.overallGrade    ?? null,
    overallResult:   payload.overallResult   ?? null,
    aircraftNumber:  payload.aircraftNumber  ?? null,
    takeoffTime:     payload.takeoffTime     ?? null,
    landTime:        payload.landTime        ?? null,
    totalFlightTime: payload.totalFlightTime ?? null,
    isSolo:          payload.isSolo          ?? false,
    isDual:          payload.isDual          ?? false,
    isCountedAsElce,
    recordedBy:      payload.recordedBy      ?? null,
    source:          payload.source          ?? 'post_flight',
    notes:           payload.notes           ?? null,
  };

  return (prisma as any).eventCompletion.upsert({
    where:  { scheduleEventId: payload.scheduleEventId },
    update: { ...data, updatedAt: new Date() },
    create: { scheduleEventId: payload.scheduleEventId, ...data },
  });
}

/**
 * Get a single EventCompletion by its primary key.
 */
export async function getEventCompletionById(
  id: string,
): Promise<PrismaEventCompletion | null> {
  return (prisma as any).eventCompletion.findUnique({ where: { id } });
}

/**
 * Get a single EventCompletion by the unique `scheduleEventId`.
 */
export async function getEventCompletionByScheduleEventId(
  scheduleEventId: string,
): Promise<PrismaEventCompletion | null> {
  return (prisma as any).eventCompletion.findUnique({
    where: { scheduleEventId },
  });
}

/**
 * List EventCompletion records with optional filtering and pagination.
 *
 * Results are ordered by eventDate DESC, startTime DESC so that the most
 * recent completion appears first — this matches the ELCE query pattern.
 */
export async function listEventCompletions(
  filters: EventCompletionFilters = {},
): Promise<{ completions: PrismaEventCompletion[]; total: number }> {
  const where = buildWhereClause(filters);
  const take  = filters.limit  ?? 100;
  const skip  = filters.offset ?? 0;

  const [completions, total] = await Promise.all([
    (prisma as any).eventCompletion.findMany({
      where,
      orderBy: [{ eventDate: 'desc' }, { startTime: 'desc' }],
      take,
      skip,
    }),
    (prisma as any).eventCompletion.count({ where }),
  ]);

  return { completions, total };
}

/**
 * Update specific fields of an existing EventCompletion by primary key.
 *
 * If `dcoResult` is provided in the update payload, `isCountedAsElce` is
 * automatically re-derived to maintain consistency.
 */
export async function updateEventCompletion(
  id: string,
  payload: UpdateEventCompletionPayload,
): Promise<PrismaEventCompletion> {
  const updateData: Record<string, any> = { ...payload, updatedAt: new Date() };

  // Re-derive isCountedAsElce if dcoResult is being changed
  if (payload.dcoResult !== undefined) {
    updateData.isCountedAsElce = deriveIsCountedAsElce(payload.dcoResult);
  }

  return (prisma as any).eventCompletion.update({
    where: { id },
    data:  updateData,
  });
}

/**
 * Delete a single EventCompletion record by primary key.
 *
 * This is a hard delete — use with caution.  Soft-deletion (setting a
 * `deletedAt` flag) was intentionally not implemented as EventCompletion
 * records are short-lived operational data, not long-term audit records
 * (use AuditLog for audit purposes).
 */
export async function deleteEventCompletion(id: string): Promise<{ id: string }> {
  await (prisma as any).eventCompletion.delete({ where: { id } });
  return { id };
}

// ─── ELCE query ───────────────────────────────────────────────────────────────

/**
 * Get the Effective Last Completed Event (ELCE) for a trainee as of a given
 * build date.
 *
 * The ELCE is the most recent EventCompletion record where:
 *  - traineeFullName matches (case-insensitive)
 *  - eventDate is strictly before `buildDate`  (i.e. ≤ day before build day)
 *  - isCountedAsElce is true  (DNCO records are excluded)
 *
 * Returns null when no qualifying completion exists (trainee has no history).
 *
 * Usage in the build algorithm:
 * ```ts
 * const elce = await getElceForTrainee(trainee.fullName, buildDate);
 * if (elce) completedEventIds.add(elce.eventCode);
 * ```
 *
 * @param traineeFullName  Full name of the trainee (must match stored value)
 * @param buildDate        ISO date string YYYY-MM-DD of the day being built
 */
export async function getElceForTrainee(
  traineeFullName: string,
  buildDate: string,
): Promise<ElceResult | null> {
  // Events that finished BEFORE the build date are eligible.
  // "Before" means eventDate < buildDate in lexicographic ISO comparison.
  const completion = await (prisma as any).eventCompletion.findFirst({
    where: {
      traineeFullName: {
        // Case-insensitive match to tolerate minor name-casing inconsistencies
        equals: traineeFullName,
        mode: 'insensitive',
      },
      eventDate: {
        lt: buildDate,   // strictly before build date
      },
      isCountedAsElce: true,
    },
    orderBy: [
      { eventDate: 'desc' },
      { startTime: 'desc' },
    ],
  });

  if (!completion) return null;

  return {
    eventCode:    completion.eventCode    as string,
    eventDate:    completion.eventDate    as string,
    startTime:    completion.startTime    as number,
    dcoResult:    completion.dcoResult    as DcoResult,
    completionId: completion.id           as string,
  };
}

/**
 * Get ELCE records for multiple trainees in a single database round-trip.
 *
 * Returns a Map<traineeFullName, ElceResult | null>.
 * Trainees with no eligible completions will map to null.
 *
 * This is the preferred method for the build algorithm, which needs ELCE
 * data for every active trainee before it can compile next-event lists.
 *
 * @param traineeFullNames  Array of trainee full names
 * @param buildDate         ISO date YYYY-MM-DD of the day being built
 */
export async function getBulkElceForTrainees(
  traineeFullNames: string[],
  buildDate: string,
): Promise<Map<string, ElceResult | null>> {
  if (traineeFullNames.length === 0) {
    return new Map();
  }

  // Fetch the most-recent eligible completion for each trainee in ONE query
  // using a raw SQL approach via Prisma's groupBy + findMany.
  //
  // Strategy: fetch all eligible records for the listed trainees, then pick
  // the most-recent one per trainee in JavaScript.  This avoids complex SQL
  // DISTINCT ON syntax that Prisma doesn't expose through its fluent API.
  const completions: PrismaEventCompletion[] = await (prisma as any).eventCompletion.findMany({
    where: {
      traineeFullName: {
        in: traineeFullNames,
        // Note: Prisma `in` filter is case-sensitive; names are expected to
        // match exactly.  Use getElceForTrainee for case-insensitive lookup.
      },
      eventDate: { lt: buildDate },
      isCountedAsElce: true,
    },
    orderBy: [
      { traineeFullName: 'asc' },
      { eventDate: 'desc' },
      { startTime: 'desc' },
    ],
  });

  // Group by traineeFullName, keeping only the first (most-recent) record per trainee
  const result = new Map<string, ElceResult | null>();

  // Initialise all requested trainees to null
  traineeFullNames.forEach((name) => result.set(name, null));

  completions.forEach((completion) => {
    const name = completion.traineeFullName as string;
    // Only store the first (most-recent) record per trainee
    if (!result.get(name)) {
      result.set(name, {
        eventCode:    completion.eventCode    as string,
        eventDate:    completion.eventDate    as string,
        startTime:    completion.startTime    as number,
        dcoResult:    completion.dcoResult    as DcoResult,
        completionId: completion.id           as string,
      });
    }
  });

  return result;
}

/**
 * Get the full completion history for a single trainee, ordered chronologically.
 *
 * Useful for the trainee profile flyout and the IndividualLMP progress view.
 *
 * @param traineeFullName  Full name of the trainee
 * @param limit            Maximum records to return (default: 200)
 */
export async function getCompletionHistoryForTrainee(
  traineeFullName: string,
  limit = 200,
): Promise<PrismaEventCompletion[]> {
  return (prisma as any).eventCompletion.findMany({
    where: {
      traineeFullName: {
        equals: traineeFullName,
        mode: 'insensitive',
      },
    },
    orderBy: [
      { eventDate: 'asc' },
      { startTime: 'asc' },
    ],
    take: limit,
  });
}

/**
 * Count completion records grouped by DCO result for a trainee.
 *
 * Returns { DCO: number, DPCO: number, DNCO: number }.
 * Useful for the trainee progress dashboard.
 */
export async function getDcoResultCountsForTrainee(
  traineeFullName: string,
): Promise<{ DCO: number; DPCO: number; DNCO: number }> {
  const groups = await (prisma as any).eventCompletion.groupBy({
    by: ['dcoResult'],
    where: {
      traineeFullName: {
        equals: traineeFullName,
        mode: 'insensitive',
      },
    },
    _count: { dcoResult: true },
  });

  const counts = { DCO: 0, DPCO: 0, DNCO: 0 };
  groups.forEach((g: any) => {
    const key = g.dcoResult as 'DCO' | 'DPCO' | 'DNCO';
    if (key in counts) counts[key] = g._count.dcoResult as number;
  });

  return counts;
}

/**
 * Check whether an EventCompletion already exists for a given scheduleEventId.
 *
 * Useful before creating a new record to provide a meaningful error message
 * instead of hitting the unique-constraint exception.
 */
export async function eventCompletionExistsForScheduleEvent(
  scheduleEventId: string,
): Promise<boolean> {
  const count = await (prisma as any).eventCompletion.count({
    where: { scheduleEventId },
  });
  return count > 0;
}
