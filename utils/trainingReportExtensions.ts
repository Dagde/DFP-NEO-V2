export interface ReplaceTrainingReportExtensionInput {
  extensionKey: string;
  requestedExtension: number;
  flightOrSimHours: number;
  duration: number;
  totalEventHours: number;
  extensionLedger?: Record<string, unknown> | null;
}

const roundHours = (value: number): number => Math.round(value * 100) / 100;

const normaliseHours = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const resolveCurrentTrainingReportExtensionHours = (
  extensionLedger?: Record<string, unknown> | null,
  lastExtensionKey?: unknown,
): number => {
  const entries = Object.entries(extensionLedger || {})
    .map(([key, value]) => [String(key || '').trim(), normaliseHours(value)] as const)
    .filter(([key, hours]) => key && hours > 0);
  if (entries.length === 0) return 0;

  const preferredKey = String(lastExtensionKey || '').trim();
  const preferredEntry = preferredKey
    ? entries.find(([key]) => key === preferredKey)
    : null;
  return roundHours(preferredEntry?.[1] ?? entries[entries.length - 1][1]);
};

export const resolveTotalTrainingReportExtensionHours = (
  extensionLedger?: Record<string, unknown> | null,
): number => (
  roundHours(Object.values(extensionLedger || {})
    .map(normaliseHours)
    .reduce((total, hours) => total + hours, 0))
);

const hasTrainingReportExtensionMetadata = (item?: Record<string, any> | null): boolean => (
  Boolean(item?.trainingReportLastExtendedByAssessmentId) ||
  (Array.isArray(item?.trainingReportExtensionAssessmentIds) && item.trainingReportExtensionAssessmentIds.length > 0) ||
  Object.keys((item?.trainingReportNextEventExtensions || {}) as Record<string, unknown>).length > 0
);

const timingBase = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const normaliseTrainingReportExtendedTiming = <T extends Record<string, any>>(
  existingItem: T | undefined | null,
  masterItem: T | undefined | null,
): Partial<T> => {
  if (!existingItem || !masterItem || !hasTrainingReportExtensionMetadata(existingItem)) return {};
  const existingType = String(existingItem.type || masterItem.type || '').trim().toLowerCase();
  if (existingType !== 'flight' && existingType !== 'ftd') return {};

  const extensionHours = resolveCurrentTrainingReportExtensionHours(
    existingItem.trainingReportNextEventExtensions,
    existingItem.trainingReportLastExtendedByAssessmentId,
  );
  const masterDuration = timingBase(masterItem.duration, 1);
  const masterFlightOrSimHours = timingBase(masterItem.flightOrSimHours, masterDuration);
  const masterTotalEventHours = timingBase(masterItem.totalEventHours, masterDuration);

  return {
    flightOrSimHours: roundHours(masterFlightOrSimHours + extensionHours),
    duration: roundHours(masterDuration + extensionHours),
    totalEventHours: roundHours(masterTotalEventHours + extensionHours),
  } as Partial<T>;
};

export const replaceTrainingReportNextEventExtension = ({
  extensionKey,
  requestedExtension,
  flightOrSimHours,
  duration,
  totalEventHours,
  extensionLedger,
}: ReplaceTrainingReportExtensionInput) => {
  const existingLedger = Object.entries(extensionLedger || {}).reduce<Record<string, number>>((ledger, [key, value]) => {
    const hours = normaliseHours(value);
    if (key.trim() && hours > 0) ledger[key] = hours;
    return ledger;
  }, {});
  const trackedExtensionTotal = Object.values(existingLedger).reduce((total, hours) => total + hours, 0);
  const key = String(extensionKey || '').trim();
  const nextExtension = normaliseHours(requestedExtension);
  const nextLedger = key && nextExtension > 0 ? { [key]: nextExtension } : {};

  const replaceHours = (currentValue: number) => roundHours(
    Math.max(0, normaliseHours(currentValue) - trackedExtensionTotal) + nextExtension
  );
  const nextFlightOrSimHours = replaceHours(flightOrSimHours);
  const nextDuration = replaceHours(duration);
  const nextTotalEventHours = replaceHours(totalEventHours);
  const replacedExtensionKeys = Object.keys(existingLedger).filter(existingKey => existingKey !== key);
  const previousExtension = key ? normaliseHours(existingLedger[key]) : 0;
  const changed = nextFlightOrSimHours !== roundHours(normaliseHours(flightOrSimHours))
    || nextDuration !== roundHours(normaliseHours(duration))
    || nextTotalEventHours !== roundHours(normaliseHours(totalEventHours))
    || JSON.stringify(existingLedger) !== JSON.stringify(nextLedger);

  return {
    flightOrSimHours: nextFlightOrSimHours,
    duration: nextDuration,
    totalEventHours: nextTotalEventHours,
    extensionLedger: nextLedger,
    trackedExtensionTotal: roundHours(trackedExtensionTotal),
    previousExtension,
    appliedDelta: roundHours(nextDuration - normaliseHours(duration)),
    replacedExtensionKeys,
    changed,
  };
};

export const forfeitTrainingReportFollowUpForRpl = <T extends Record<string, any>>(item: T): T => {
  const extensionHours = resolveTotalTrainingReportExtensionHours(item.trainingReportNextEventExtensions);
  const removeExtensionHours = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return value;
    return roundHours(Math.max(0, parsed - extensionHours));
  };
  const baseNotes = typeof item.trainingReportBaseNotes === 'string'
    ? item.trainingReportBaseNotes
    : item.notes;

  return {
    ...item,
    flightOrSimHours: extensionHours > 0 ? removeExtensionHours(item.flightOrSimHours) : item.flightOrSimHours,
    duration: extensionHours > 0 ? removeExtensionHours(item.duration) : item.duration,
    totalEventHours: extensionHours > 0 ? removeExtensionHours(item.totalEventHours) : item.totalEventHours,
    notes: typeof baseNotes === 'string' ? baseNotes : item.notes,
    trainingReportNextEventExtensions: undefined,
    trainingReportExtensionAssessmentIds: undefined,
    trainingReportLastExtendedByAssessmentId: undefined,
    trainingReportForwardedNotes: undefined,
    trainingReportLastForwardedNotesAssessmentId: undefined,
    trainingReportBaseNotes: undefined,
  };
};
