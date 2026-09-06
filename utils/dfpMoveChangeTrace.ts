import { ScheduleEvent } from '../types';

const TRACE_KEY = 'dfp_move_change_bar_trace';
const WATCH_KEY = '__dfpMoveChangeTraceWatchIds';
const ENTRY_LIMIT = 500;

type TraceEntry = {
  ts: string;
  perfMs: number | null;
  stage: string;
  details: Record<string, unknown>;
};

const perfNow = (): number | null => {
  if (typeof performance === 'undefined' || typeof performance.now !== 'function') return null;
  return Math.round(performance.now());
};

const readEntries = (): TraceEntry[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(TRACE_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

export const summariseDfpMoveEvent = (event: Partial<ScheduleEvent> | null | undefined): Record<string, unknown> | null => {
  if (!event) return null;
  return {
    id: event.id || null,
    date: event.date || null,
    type: event.type || null,
    flightNumber: event.flightNumber || null,
    resourceId: event.resourceId || null,
    startTime: typeof event.startTime === 'number' ? event.startTime : null,
    duration: typeof event.duration === 'number' ? event.duration : null,
    instructor: event.instructor || null,
    student: event.student || null,
    pilot: event.pilot || null,
    aircraftNumber: event.aircraftNumber || null,
    formationId: event.formationId || null,
    area: event.area || null,
  };
};

export const appendDfpMoveChangeTrace = (stage: string, details: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const entry: TraceEntry = {
    ts: new Date().toISOString(),
    perfMs: perfNow(),
    stage,
    details,
  };
  try {
    const next = [...readEntries(), entry].slice(-ENTRY_LIMIT);
    window.localStorage.setItem(TRACE_KEY, JSON.stringify(next));
    (window as any).dfpMoveChangeBarTrace = next;
  } catch {
    try {
      window.localStorage.setItem(TRACE_KEY, JSON.stringify([entry]));
      (window as any).dfpMoveChangeBarTrace = [entry];
    } catch {
      // Diagnostics must never affect DFP operation.
    }
  }
};

export const watchDfpMoveChangeEvents = (eventIds: Array<string | null | undefined>, durationMs = 15000) => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const watchMap = ((window as any)[WATCH_KEY] || {}) as Record<string, number>;
  eventIds
    .map((eventId) => String(eventId || '').trim())
    .filter(Boolean)
    .forEach((eventId) => {
      watchMap[eventId] = now + durationMs;
    });
  Object.keys(watchMap).forEach((eventId) => {
    if (watchMap[eventId] <= now) delete watchMap[eventId];
  });
  (window as any)[WATCH_KEY] = watchMap;
};

export const isWatchingDfpMoveChangeEvent = (eventId: string | null | undefined): boolean => {
  if (typeof window === 'undefined') return false;
  const id = String(eventId || '').trim();
  if (!id) return false;
  const watchMap = ((window as any)[WATCH_KEY] || {}) as Record<string, number>;
  const expiresAt = watchMap[id] || 0;
  if (expiresAt <= Date.now()) {
    delete watchMap[id];
    (window as any)[WATCH_KEY] = watchMap;
    return false;
  }
  return true;
};

const readJsonStorage = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const downloadDfpMoveChangeTrace = (context: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const entries = readEntries();
  const enrichedEntries = entries.map((entry, index) => {
    const previous = index > 0 ? entries[index - 1] : null;
    return {
      index,
      sincePreviousMs: typeof entry.perfMs === 'number' && typeof previous?.perfMs === 'number'
        ? entry.perfMs - previous.perfMs
        : null,
      ...entry,
    };
  });
  const report = {
    reportType: 'DFP_MOVE_CHANGE_BAR_TRACE',
    generatedAt: new Date().toISOString(),
    context,
    entryCount: enrichedEntries.length,
    entries: enrichedEntries,
    dragDiagnostics: readJsonStorage('dfp_drag_diagnostics_report'),
    dfpDataDiagnostics: readJsonStorage('neo_dfp_data_diag'),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeUser = String(context.currentUserName || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'user';
  const safeDate = String(context.date || 'no-date').replace(/[^0-9-]/g, '') || 'no-date';
  const link = document.createElement('a');
  link.href = url;
  link.download = `dfp-move-change-bar-trace-${safeUser}-${safeDate}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
