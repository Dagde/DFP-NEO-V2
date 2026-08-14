/**
 * Compatibility boundary for training-report records created before the
 * terminology cleanup. Do not change these persisted identifiers without a
 * database and browser-storage migration.
 */
const LEGACY_SUPPRESSED_TRAINING_REPORT_EVENT_IDS_STORAGE_KEY =
  'dfp_dashboard_suppressed_pt051_event_ids_v1';

const normaliseSuppressedEventIds = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
);

export const loadSuppressedTrainingReportEventIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    return normaliseSuppressedEventIds(
      JSON.parse(window.localStorage.getItem(LEGACY_SUPPRESSED_TRAINING_REPORT_EVENT_IDS_STORAGE_KEY) || '[]'),
    );
  } catch {
    return [];
  }
};

export const saveSuppressedTrainingReportEventIds = (eventIds: string[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LEGACY_SUPPRESSED_TRAINING_REPORT_EVENT_IDS_STORAGE_KEY,
      JSON.stringify(normaliseSuppressedEventIds(eventIds)),
    );
  } catch {
    // Best effort only; in-memory state still governs this session.
  }
};
