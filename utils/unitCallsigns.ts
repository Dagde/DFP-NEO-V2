export interface UnitCallsignEntry {
  id: string;
  unitCode: string;
  callsign: string;
  isDefault?: boolean;
}

export interface UnitCallsignSettings {
  entries: UnitCallsignEntry[];
}

const makeUnitCallsignId = (unitCode: string, callsign: string, index: number): string => {
  const token = `${unitCode}-${callsign}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token ? `unit-callsign-${token}` : `unit-callsign-${index + 1}`;
};

export const normaliseUnitCallsignSettings = (source: unknown): UnitCallsignSettings => {
  const rawEntries = Array.isArray((source as any)?.entries)
    ? (source as any).entries
    : Array.isArray(source)
      ? source
      : [];

  const entries = rawEntries
    .map((entry: any, index: number): UnitCallsignEntry | null => {
      const unitCode = String(entry?.unitCode || entry?.unit || '').trim().toUpperCase();
      const callsign = String(entry?.callsign || entry?.name || entry?.code || '').trim();
      if (!unitCode || !callsign) return null;
      return {
        id: String(entry?.id || makeUnitCallsignId(unitCode, callsign, index)),
        unitCode,
        callsign,
        isDefault: entry?.isDefault === true,
      };
    })
    .filter(Boolean) as UnitCallsignEntry[];

  const seen = new Set<string>();
  const uniqueEntries = entries.filter((entry) => {
    const key = `${entry.unitCode}::${entry.callsign.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const defaultsByUnit = new Set<string>();
  return {
    entries: uniqueEntries.map((entry) => {
      if (!entry.isDefault) return entry;
      if (defaultsByUnit.has(entry.unitCode)) return { ...entry, isDefault: false };
      defaultsByUnit.add(entry.unitCode);
      return entry;
    }),
  };
};

export const getUnitCallsignEntries = (
  settings: UnitCallsignSettings | undefined,
  unitCode?: unknown,
): UnitCallsignEntry[] => {
  const unit = String(unitCode || '').trim().toUpperCase();
  if (!unit) return [];
  return normaliseUnitCallsignSettings(settings).entries
    .filter(entry => entry.unitCode === unit)
    .sort((left, right) => left.callsign.localeCompare(right.callsign, undefined, { sensitivity: 'base' }));
};

export const getDefaultUnitCallsign = (
  settings: UnitCallsignSettings | undefined,
  unitCode?: unknown,
): string => {
  const entries = getUnitCallsignEntries(settings, unitCode);
  return entries.find(entry => entry.isDefault)?.callsign || entries[0]?.callsign || '';
};

export const formatUnitCallsignNumber = (value: unknown): string => {
  const number = Math.min(100, Math.max(0, Math.floor(Number(value) || 0)));
  return String(number).padStart(3, '0');
};

export const buildUnitEventCallsign = (base: unknown, number: unknown): string => {
  const callsign = String(base || '').trim();
  if (!callsign) return '';
  return `${callsign} ${formatUnitCallsignNumber(number)}`;
};
