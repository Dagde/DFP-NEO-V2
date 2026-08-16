type DragBoard = 'DFP' | 'NEO Build Schedule';

type DragSession = {
  sessionId: string;
  board: DragBoard;
  startedAt: string;
  endedAt: string | null;
  eventId: string;
  eventType: string | null;
  flightNumber: string | null;
  resourceId: string | null;
  draggedTileCount: number;
  eventCount: number;
  resourceCount: number;
  zoomLevel: number;
  moveCount: number;
  skippedDuplicateCount: number;
  flushCount: number;
  totalUpdateCount: number;
  maxPointerGapMs: number;
  maxTotalMoveMs: number;
  maxConflictMs: number;
  maxFlushDelayMs: number;
  samples: any[];
  flushSamples: any[];
};

type DragDiagnosticsReport = {
  reportType: 'dfp-drag-diagnostics';
  generatedAt: string;
  version: number;
  activeSessionId: string | null;
  sessions: DragSession[];
};

const REPORT_KEY = '__dfpDragDiagnostics';
const STORAGE_KEY = 'dfp_drag_diagnostics_report';
const SESSION_LIMIT = 20;
const SAMPLE_LIMIT = 80;

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const getReport = (): DragDiagnosticsReport => {
  const existing = typeof window !== 'undefined' ? (window as any)[REPORT_KEY] : null;
  if (existing?.reportType === 'dfp-drag-diagnostics') return existing;
  const report: DragDiagnosticsReport = {
    reportType: 'dfp-drag-diagnostics',
    generatedAt: new Date().toISOString(),
    version: 1,
    activeSessionId: null,
    sessions: [],
  };
  if (typeof window !== 'undefined') {
    (window as any)[REPORT_KEY] = report;
  }
  return report;
};

const persistReport = (report: DragDiagnosticsReport) => {
  report.generatedAt = new Date().toISOString();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Diagnostics must never affect scheduling.
  }
};

const getSession = (sessionId: string | null): DragSession | null => {
  if (!sessionId) return null;
  return getReport().sessions.find(session => session.sessionId === sessionId) || null;
};

const pushLimited = <T,>(items: T[], item: T, limit = SAMPLE_LIMIT): T[] => {
  const next = [...items, item];
  if (next.length <= limit) return next;
  return next.slice(next.length - limit);
};

export const startDfpDragDiagnostic = (details: {
  board: DragBoard;
  eventId: string;
  eventType?: string | null;
  flightNumber?: string | null;
  resourceId?: string | null;
  draggedTileCount: number;
  eventCount: number;
  resourceCount: number;
  zoomLevel: number;
}): string | null => {
  if (typeof window === 'undefined') return null;
  const report = getReport();
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: DragSession = {
    sessionId,
    board: details.board,
    startedAt: new Date().toISOString(),
    endedAt: null,
    eventId: details.eventId,
    eventType: details.eventType || null,
    flightNumber: details.flightNumber || null,
    resourceId: details.resourceId || null,
    draggedTileCount: details.draggedTileCount,
    eventCount: details.eventCount,
    resourceCount: details.resourceCount,
    zoomLevel: details.zoomLevel,
    moveCount: 0,
    skippedDuplicateCount: 0,
    flushCount: 0,
    totalUpdateCount: 0,
    maxPointerGapMs: 0,
    maxTotalMoveMs: 0,
    maxConflictMs: 0,
    maxFlushDelayMs: 0,
    samples: [],
    flushSamples: [],
  };
  report.activeSessionId = sessionId;
  report.sessions = [...report.sessions, session].slice(-SESSION_LIMIT);
  persistReport(report);
  return sessionId;
};

export const recordDfpDragMoveDiagnostic = (sessionId: string | null, sample: {
  xInGrid: number;
  yInGrid: number;
  updateCount: number;
  duplicateSkipped: boolean;
  totalMoveMs: number;
  geometryMs: number;
  buildUpdatesMs: number;
  conflictMs: number;
  signature: string;
}) => {
  const session = getSession(sessionId);
  if (!session) return;
  session.moveCount += 1;
  if (sample.duplicateSkipped) session.skippedDuplicateCount += 1;
  session.totalUpdateCount += sample.updateCount;
  session.maxTotalMoveMs = Math.max(session.maxTotalMoveMs, sample.totalMoveMs);
  session.maxConflictMs = Math.max(session.maxConflictMs, sample.conflictMs);
  const previous = session.samples[session.samples.length - 1];
  const pointerGapMs = previous?.recordedAtMs ? nowMs() - previous.recordedAtMs : 0;
  session.maxPointerGapMs = Math.max(session.maxPointerGapMs, pointerGapMs);
  const compactSample = {
    recordedAt: new Date().toISOString(),
    recordedAtMs: nowMs(),
    xInGrid: Number(sample.xInGrid.toFixed(1)),
    yInGrid: Number(sample.yInGrid.toFixed(1)),
    updateCount: sample.updateCount,
    duplicateSkipped: sample.duplicateSkipped,
    pointerGapMs: Number(pointerGapMs.toFixed(1)),
    totalMoveMs: Number(sample.totalMoveMs.toFixed(2)),
    geometryMs: Number(sample.geometryMs.toFixed(2)),
    buildUpdatesMs: Number(sample.buildUpdatesMs.toFixed(2)),
    conflictMs: Number(sample.conflictMs.toFixed(2)),
    signature: sample.signature.slice(0, 260),
  };
  if (session.samples.length < 20 || compactSample.totalMoveMs >= 8 || compactSample.pointerGapMs >= 80) {
    session.samples = pushLimited(session.samples, compactSample);
  }
  persistReport(getReport());
};

export const recordDfpDragFlushDiagnostic = (sessionId: string | null, sample: {
  queuedAtMs: number;
  updateCount: number;
  signature: string;
}) => {
  const session = getSession(sessionId);
  if (!session) return;
  const flushDelayMs = nowMs() - sample.queuedAtMs;
  session.flushCount += 1;
  session.maxFlushDelayMs = Math.max(session.maxFlushDelayMs, flushDelayMs);
  session.flushSamples = pushLimited(session.flushSamples, {
    flushedAt: new Date().toISOString(),
    updateCount: sample.updateCount,
    flushDelayMs: Number(flushDelayMs.toFixed(2)),
    signature: sample.signature.slice(0, 260),
  }, 40);
  persistReport(getReport());
};

export const endDfpDragDiagnostic = (sessionId: string | null) => {
  const report = getReport();
  const session = getSession(sessionId);
  if (!session) return;
  session.endedAt = new Date().toISOString();
  if (report.activeSessionId === sessionId) report.activeSessionId = null;
  persistReport(report);
};

export const getDfpDragDiagnosticReport = (): DragDiagnosticsReport => getReport();
