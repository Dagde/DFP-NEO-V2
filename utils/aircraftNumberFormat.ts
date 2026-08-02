export interface AircraftNumberSettings {
  usePrefix: boolean;
  prefixes: string[];
  defaultPrefix: string;
}

export const DEFAULT_AIRCRAFT_NUMBER_SETTINGS: AircraftNumberSettings = {
  usePrefix: false,
  prefixes: [],
  defaultPrefix: '',
};

const cleanToken = (value: unknown): string => (
  typeof value === 'string' ? value.trim() : ''
);

const uniqueNonEmpty = (values: unknown[]): string[] => (
  Array.from(new Set(values.map(cleanToken).filter(Boolean)))
);

export const normaliseAircraftNumberSettings = (settings?: Record<string, any> | null): AircraftNumberSettings => {
  const hasExplicitPrefixes = Array.isArray(settings?.aircraftNumberPrefixes);
  const prefixes = uniqueNonEmpty(hasExplicitPrefixes
    ? settings?.aircraftNumberPrefixes
    : DEFAULT_AIRCRAFT_NUMBER_SETTINGS.prefixes);
  const savedDefaultPrefix = cleanToken(settings?.aircraftNumberDefaultPrefix);
  const defaultPrefix = hasExplicitPrefixes && prefixes.length === 0
    ? ''
    : savedDefaultPrefix || prefixes[0] || DEFAULT_AIRCRAFT_NUMBER_SETTINGS.defaultPrefix;
  const nextPrefixes = !defaultPrefix || prefixes.includes(defaultPrefix) || (hasExplicitPrefixes && prefixes.length === 0)
    ? prefixes
    : [defaultPrefix, ...prefixes];

  return {
    usePrefix: settings?.aircraftNumberUsePrefix === undefined
      ? DEFAULT_AIRCRAFT_NUMBER_SETTINGS.usePrefix
      : settings.aircraftNumberUsePrefix !== false,
    prefixes: nextPrefixes,
    defaultPrefix,
  };
};

export const parseAircraftNumber = (
  value: unknown,
  settings: AircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
): { prefix: string; number: string } => {
  const raw = cleanToken(value);
  const prefix = settings.defaultPrefix || settings.prefixes[0] || '';
  if (!raw) return { prefix, number: '' };

  for (const candidate of settings.prefixes) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = raw.match(new RegExp(`^${escaped}(?:\\s+|-)?(.+)$`, 'i'));
    if (match) return { prefix: candidate, number: cleanToken(match[1]) };
  }

  const legacyMatch = raw.match(/^A54(?:\s+|-)?(.+)$/i);
  if (legacyMatch) return { prefix: settings.prefixes.includes('A54') ? 'A54' : prefix, number: cleanToken(legacyMatch[1]) };

  return { prefix, number: raw };
};

export const formatAircraftNumber = (
  number: unknown,
  prefix: unknown,
  settings: AircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
): string => {
  const parsed = parseAircraftNumber(number, settings);
  const cleanNumber = parsed.number || cleanToken(number);
  if (!cleanNumber) return '';
  if (!settings.usePrefix) return cleanNumber;

  const cleanPrefix = cleanToken(prefix) || parsed.prefix || settings.defaultPrefix || settings.prefixes[0] || '';
  return cleanPrefix ? `${cleanPrefix} ${cleanNumber}` : cleanNumber;
};
