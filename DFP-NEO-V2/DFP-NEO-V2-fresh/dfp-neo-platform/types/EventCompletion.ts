/**
 * EventCompletion — TypeScript types for DCO-based event tracking
 *
 * These types mirror the Prisma model and are shared between:
 *   - API route handlers  (app/api/event-completions/)
 *   - The EventCompletion service  (lib/eventCompletionService.ts)
 *   - The frontend build-algorithm integration
 */

// ─── Core enums ──────────────────────────────────────────────────────────────

/** Primary completion outcome recorded on the post-flight form. */
export type DcoResult = 'DCO' | 'DPCO' | 'DNCO';

/**
 * DCO  = Duty Carry Out          — sortie completed successfully.
 *        isCountedAsElce = true
 * DPCO = Duty Partially Carry Out — sortie partially completed.
 *        isCountedAsElce = true  (still advances the trainee's next-event pointer)
 * DNCO = Duty Not Carry Out      — sortie was not completed / unsuccessful.
 *        isCountedAsElce = false (does NOT advance the trainee's next-event pointer)
 */
export const DCO_RESULT_LABELS: Record<DcoResult, string> = {
  DCO: 'Duty Carry Out',
  DPCO: 'Duty Partially Carry Out',
  DNCO: 'Duty Not Carry Out',
};

/** Whether a given DCO result should count towards ELCE (next-event advancement). */
export const dcoResultIsElce = (result: DcoResult): boolean =>
  result === 'DCO' || result === 'DPCO';

export type EventCompletionSource = 'post_flight' | 'manual' | 'import';
export type EventCompletionType   = 'flight' | 'ftd' | 'cpt' | 'ground';

// ─── Full record (matches Prisma model) ──────────────────────────────────────

export interface EventCompletion {
  id:              string;

  // Event identity
  scheduleEventId: string;
  eventCode:       string;
  eventDate:       string;         // YYYY-MM-DD
  eventType:       EventCompletionType;
  startTime:       number;         // decimal hours
  duration:        number;         // decimal hours

  // Personnel
  traineeId:       string | null;
  traineeFullName: string;
  instructorName:  string | null;

  // DCO result (core)
  dcoResult:       DcoResult;
  overallGrade:    number | null;  // 0-5
  overallResult:   'P' | 'F' | null;

  // Flight log
  aircraftNumber:  string | null;
  takeoffTime:     string | null;  // "HH:MM"
  landTime:        string | null;  // "HH:MM"
  totalFlightTime: number | null;  // decimal hours
  isSolo:          boolean;
  isDual:          boolean;

  // ELCE flag
  isCountedAsElce: boolean;

  // Audit
  recordedBy:      string | null;
  source:          EventCompletionSource;
  notes:           string | null;

  // Timestamps
  createdAt:       string;         // ISO string from JSON serialisation
  updatedAt:       string;
}

// ─── Create payload ───────────────────────────────────────────────────────────

/**
 * Payload sent from the frontend (or the PostFlightView save handler) to
 * POST /api/event-completions.
 *
 * `id`, `createdAt`, `updatedAt` are generated server-side.
 * `isCountedAsElce` is derived server-side from `dcoResult`.
 */
export interface CreateEventCompletionPayload {
  scheduleEventId: string;
  eventCode:       string;
  eventDate:       string;
  eventType?:      EventCompletionType;
  startTime?:      number;
  duration?:       number;

  traineeId?:      string;
  traineeFullName: string;
  instructorName?: string;

  dcoResult:       DcoResult;
  overallGrade?:   number | null;
  overallResult?:  'P' | 'F' | null;

  aircraftNumber?: string;
  takeoffTime?:    string;
  landTime?:       string;
  totalFlightTime?: number;
  isSolo?:         boolean;
  isDual?:         boolean;

  recordedBy?:     string;
  source?:         EventCompletionSource;
  notes?:          string;
}

// ─── Update payload ───────────────────────────────────────────────────────────

/**
 * Payload for PATCH /api/event-completions/[id].
 * All fields are optional — only provided fields are updated.
 */
export type UpdateEventCompletionPayload = Partial<
  Omit<CreateEventCompletionPayload, 'scheduleEventId' | 'traineeFullName'>
>;

// ─── Query / filter types ─────────────────────────────────────────────────────

export interface EventCompletionFilters {
  traineeId?:       string;
  traineeFullName?: string;
  eventCode?:       string;
  scheduleEventId?: string;
  dcoResult?:       DcoResult;
  eventDateFrom?:   string;   // YYYY-MM-DD inclusive
  eventDateTo?:     string;   // YYYY-MM-DD inclusive
  isCountedAsElce?: boolean;
  source?:          EventCompletionSource;
  /** Limit result count (default: 100) */
  limit?:           number;
  /** Offset for pagination */
  offset?:          number;
}

// ─── ELCE result ─────────────────────────────────────────────────────────────

/**
 * The Effective Last Completed Event for a trainee as of a given build date.
 * Returned by the ELCE query helper.
 */
export interface ElceResult {
  /** Syllabus event code of the last completed (DCO/DPCO) event */
  eventCode:       string;
  /** ISO date of that event */
  eventDate:       string;
  /** Start time (decimal hours) */
  startTime:       number;
  /** The DCO result (DCO or DPCO — never DNCO, since DNCO is excluded) */
  dcoResult:       DcoResult;
  /** The EventCompletion.id for reference */
  completionId:    string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface EventCompletionListResponse {
  completions: EventCompletion[];
  count:       number;
  total?:      number;
}

export interface EventCompletionSingleResponse {
  completion: EventCompletion;
}

export interface EventCompletionElceResponse {
  elce:            ElceResult | null;
  traineeFullName: string;
  buildDate:       string;
}

export interface EventCompletionDeleteResponse {
  success: boolean;
  id:      string;
}