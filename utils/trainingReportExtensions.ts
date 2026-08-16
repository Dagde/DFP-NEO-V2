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
