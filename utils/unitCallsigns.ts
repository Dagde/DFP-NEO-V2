export interface UnitCallsignEntry {
  id: string;
  unitCode: string;
  callsign: string;
  isDefault?: boolean;
}

export type UnitCallsignAllocationMethod = 'permanent' | 'per-flight' | 'user-choice';

export interface UnitCallsignPolicy {
  unitCode: string;
  allocationMethod: UnitCallsignAllocationMethod;
}

export interface UnitCallsignSettings {
  entries: UnitCallsignEntry[];
  policies: UnitCallsignPolicy[];
}

export const UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS: Record<UnitCallsignAllocationMethod, string> = {
  permanent: 'Permanent',
  'per-flight': 'Per Flight',
  'user-choice': 'User Choice',
};

export const UNIT_CALLSIGN_ALLOCATION_METHODS = Object.keys(
  UNIT_CALLSIGN_ALLOCATION_METHOD_LABELS,
) as UnitCallsignAllocationMethod[];

const makeUnitCallsignId = (unitCode: string, callsign: string, index: number): string => {
  const token = `${unitCode}-${callsign}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token ? `unit-callsign-${token}` : `unit-callsign-${index + 1}`;
};

const normaliseAllocationMethod = (value: unknown): UnitCallsignAllocationMethod => {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (raw === 'permanent') return 'permanent';
  if (raw === 'user-choice' || raw === 'choice') return 'user-choice';
  return 'per-flight';
};

const isPlaceholderUnitCallsign = (value: unknown): boolean => {
  const token = String(value || '').trim();
  if (!token) return true;
  if (token.toLowerCase() === 'default') return true;
  return /^callsign\s*\d*$/i.test(token);
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
  const rawPolicies = Array.isArray((source as any)?.policies)
    ? (source as any).policies
    : [];
  const policiesByUnit = new Map<string, UnitCallsignPolicy>();

  rawPolicies.forEach((policy: any) => {
    const unitCode = String(policy?.unitCode || policy?.unit || '').trim().toUpperCase();
    if (!unitCode) return;
    policiesByUnit.set(unitCode, {
      unitCode,
      allocationMethod: normaliseAllocationMethod(policy?.allocationMethod || policy?.method),
    });
  });

  return {
    entries: uniqueEntries.map((entry) => {
      if (!entry.isDefault) return entry;
      if (defaultsByUnit.has(entry.unitCode)) return { ...entry, isDefault: false };
      defaultsByUnit.add(entry.unitCode);
      return entry;
    }),
    policies: Array.from(policiesByUnit.values())
      .sort((left, right) => left.unitCode.localeCompare(right.unitCode, undefined, { sensitivity: 'base' })),
  };
};

export const getUnitCallsignPolicy = (
  settings: UnitCallsignSettings | undefined,
  unitCode?: unknown,
): UnitCallsignPolicy => {
  const unit = String(unitCode || '').trim().toUpperCase();
  const policy = normaliseUnitCallsignSettings(settings).policies.find((entry) => entry.unitCode === unit);
  return {
    unitCode: unit,
    allocationMethod: policy?.allocationMethod || 'per-flight',
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
  const usableEntries = entries.filter(entry => !isPlaceholderUnitCallsign(entry.callsign));
  return usableEntries.find(entry => entry.isDefault)?.callsign || usableEntries[0]?.callsign || '';
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
