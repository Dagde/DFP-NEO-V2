export const DEFAULT_DISPATCH_RATE_WINDOW_MINUTES = 60;
export const MIN_DISPATCH_RATE_WINDOW_MINUTES = 5;
export const MAX_DISPATCH_RATE_WINDOW_MINUTES = 240;
export const DISPATCH_RATE_WINDOW_STEP_MINUTES = 5;

export const normaliseDispatchRateWindowMinutes = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_DISPATCH_RATE_WINDOW_MINUTES;
  const clamped = Math.min(
    MAX_DISPATCH_RATE_WINDOW_MINUTES,
    Math.max(MIN_DISPATCH_RATE_WINDOW_MINUTES, numeric),
  );
  return Math.round(clamped / DISPATCH_RATE_WINDOW_STEP_MINUTES) * DISPATCH_RATE_WINDOW_STEP_MINUTES;
};

