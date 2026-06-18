export interface DispatchStaggerSettings {
  flightMinutes: number;
  simulatorMinutes: number;
  flightNoMinimum: boolean;
  simulatorNoMinimum: boolean;
}

export const DEFAULT_DISPATCH_STAGGER_SETTINGS: DispatchStaggerSettings = {
  flightMinutes: 5,
  simulatorMinutes: 0,
  flightNoMinimum: false,
  simulatorNoMinimum: true,
};

const normaliseMinutes = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.min(120, Math.round(numeric));
};

export const normaliseDispatchStaggerSettings = (settings?: Partial<DispatchStaggerSettings> | null): DispatchStaggerSettings => {
  const flightNoMinimum = Boolean(settings?.flightNoMinimum);
  const simulatorNoMinimum = settings?.simulatorNoMinimum == null
    ? DEFAULT_DISPATCH_STAGGER_SETTINGS.simulatorNoMinimum
    : Boolean(settings.simulatorNoMinimum);
  return {
    flightMinutes: normaliseMinutes(settings?.flightMinutes, DEFAULT_DISPATCH_STAGGER_SETTINGS.flightMinutes),
    simulatorMinutes: normaliseMinutes(settings?.simulatorMinutes, DEFAULT_DISPATCH_STAGGER_SETTINGS.simulatorMinutes),
    flightNoMinimum,
    simulatorNoMinimum,
  };
};

export const getEffectiveDispatchStaggerMinutes = (
  settings: Partial<DispatchStaggerSettings> | undefined | null,
  eventType: string | undefined | null,
): number => {
  const normalised = normaliseDispatchStaggerSettings(settings);
  const type = String(eventType || '').trim().toLowerCase();
  const isSimulator = type === 'ftd' || type === 'sim' || type === 'simulator' || type === 'cpt';
  if (isSimulator) return normalised.simulatorNoMinimum ? 0 : normalised.simulatorMinutes;
  if (type === 'flight') return normalised.flightNoMinimum ? 0 : normalised.flightMinutes;
  return 0;
};
