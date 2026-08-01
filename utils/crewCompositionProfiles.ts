import { normaliseOperationalModel, type OperationalModelCode } from './platformConfigService';

export interface CrewCompositionRoleRequirement {
  role: string;
  count: number;
}

export interface AlternateCrewCompositionProfile {
  id: string;
  code: string;
  unitCode?: string;
  compositeUnitCode?: string;
  compositeProfileId?: string;
  aircraftTypeCode: string;
  name: string;
  description?: string;
  operationalModels: OperationalModelCode[];
  roleRequirements: CrewCompositionRoleRequirement[];
  status?: string;
}

export interface CurrencyProfile {
  id: string;
  unitCode?: string;
  compositeUnitCode?: string;
  compositeProfileId?: string;
  aircraftTypeCode?: string;
  name: string;
  code: string;
  crew: string;
  config: string;
  acceptableAircraftConfigs?: string[];
  currency: string;
  dayNight?: 'Day' | 'Night' | 'Day/Night';
  flightType?: 'Solo' | 'Dual';
  aircraftCount: number;
  status?: string;
}

export interface CrewCompositionSettings {
  alternateCompositions: AlternateCrewCompositionProfile[];
  currencyProfiles: CurrencyProfile[];
}

const SUPPORTED_MODELS: OperationalModelCode[] = ['air_combat', 'fixed_crew', 'pooled_crew'];

const normaliseCode = (value: unknown, fallback: string): string => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]+/g, '')
    .slice(0, 3);
  return token || fallback.slice(0, 3);
};

const nextAvailableThreeLetterCode = (baseCode: string, usedCodes: Set<string>): string => {
  if (!usedCodes.has(baseCode)) return baseCode;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefix = (baseCode.slice(0, 2) || 'AL').padEnd(2, 'A');
  for (const letter of alphabet) {
    const candidate = `${prefix}${letter}`;
    if (!usedCodes.has(candidate)) return candidate;
  }
  return baseCode;
};

const normaliseRoleRequirements = (value: unknown): CrewCompositionRoleRequirement[] => {
  const rows = Array.isArray(value) ? value : [];
  const merged = new Map<string, CrewCompositionRoleRequirement>();
  rows.forEach((row: any) => {
    const role = String(row?.role || '').trim();
    if (!role) return;
    const key = role.toUpperCase();
    const count = Math.max(1, Math.min(24, Math.round(Number(row?.count) || 1)));
    const current = merged.get(key);
    merged.set(key, {
      role: current?.role || role,
      count: Math.min(24, (current?.count || 0) + count),
    });
  });
  return Array.from(merged.values());
};

const normaliseCurrencyProfileCode = (value: unknown, fallback: string): string => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (token) return token;
  return String(fallback || 'CURR')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'CURR';
};

const normaliseAircraftCount = (value: unknown): number => (
  Math.max(1, Math.min(24, Math.round(Number(value) || 1)))
);

const normaliseDayNight = (value: unknown): 'Day' | 'Night' | 'Day/Night' => {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'night') return 'Night';
  if (text === 'day/night' || text === 'daynight' || text === 'day and night') return 'Day/Night';
  return 'Day';
};

const normaliseFlightType = (value: unknown): 'Solo' | 'Dual' => (
  String(value || '').trim().toLowerCase() === 'solo' ? 'Solo' : 'Dual'
);

const normaliseAcceptableConfigs = (value: unknown, fallback: string): string[] => {
  const rows = Array.isArray(value) ? value : [];
  const values = rows.map(item => String(item || '').trim()).filter(Boolean);
  const next = values.length > 0 ? values : [fallback || 'ANY'];
  return Array.from(new Set(next));
};

export const normaliseCrewCompositionSettings = (value: unknown): CrewCompositionSettings => {
  const source = (value && typeof value === 'object') ? value as any : {};
  const rows = Array.isArray(source.alternateCompositions) ? source.alternateCompositions : [];
  const usedCodesByScope = new Map<string, Set<string>>();
  const alternateCompositions = rows.map((row: any, index: number) => {
    const fallbackCode = `ALT-${index + 1}`;
    const unitCode = String(row?.unitCode || '').trim().toUpperCase();
    const compositeUnitCode = String(row?.compositeUnitCode || '').trim().toUpperCase();
    const codeScope = unitCode || compositeUnitCode || 'GLOBAL';
    const usedCodes = usedCodesByScope.get(codeScope) || new Set<string>();
    usedCodesByScope.set(codeScope, usedCodes);
    let code = normaliseCode(row?.code || row?.name, fallbackCode);
    code = nextAvailableThreeLetterCode(code, usedCodes);
    usedCodes.add(code);

    const operationalModels = Array.isArray(row?.operationalModels)
      ? Array.from(new Set(row.operationalModels
        .map((model: unknown) => normaliseOperationalModel(model))
        .filter((model: OperationalModelCode) => SUPPORTED_MODELS.includes(model))))
      : SUPPORTED_MODELS;

    return {
      id: String(row?.id || `alternate-crew-${index + 1}`),
      code,
      unitCode,
      compositeUnitCode,
      compositeProfileId: String(row?.compositeProfileId || '').trim(),
      aircraftTypeCode: String(row?.aircraftTypeCode || row?.aircraftType || '').trim().toUpperCase(),
      name: String(row?.name || '').trim() ? String(row?.name || '') : code,
      description: String(row?.description || ''),
      operationalModels: operationalModels.length > 0 ? operationalModels : SUPPORTED_MODELS,
      roleRequirements: normaliseRoleRequirements(row?.roleRequirements),
      status: String(row?.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };
  });

  const currencyRows = Array.isArray(source.currencyProfiles) ? source.currencyProfiles : [];
  const currencyProfiles = currencyRows.map((row: any, index: number): CurrencyProfile => {
    const rawName = String(row?.name || row?.profileName || row?.label || '');
    const fallbackName = String(row?.currency || row?.event || `Currency Event ${index + 1}`).trim();
    const name = rawName.length > 0 ? rawName : fallbackName;
    const config = String(row?.config || row?.aircraftConfigId || 'ANY').trim() || 'ANY';
    return {
      id: String(row?.id || `currency-profile-${index + 1}`),
      unitCode: String(row?.unitCode || '').trim().toUpperCase(),
      compositeUnitCode: String(row?.compositeUnitCode || '').trim().toUpperCase(),
      compositeProfileId: String(row?.compositeProfileId || '').trim(),
      aircraftTypeCode: String(row?.aircraftTypeCode || row?.aircraftType || '').trim().toUpperCase(),
      name,
      code: normaliseCurrencyProfileCode(row?.code || row?.eventCode || row?.shortCode, name || fallbackName),
      crew: String(row?.crew || ''),
      config,
      acceptableAircraftConfigs: normaliseAcceptableConfigs(row?.acceptableAircraftConfigs, config),
      currency: String(row?.currency || row?.event || `Currency ${index + 1}`).trim(),
      dayNight: normaliseDayNight(row?.dayNight),
      flightType: normaliseFlightType(row?.flightType || row?.soloOrDual),
      aircraftCount: normaliseAircraftCount(row?.aircraftCount ?? row?.numberOfAircraft ?? row?.aircraft),
      status: String(row?.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };
  }).filter((profile) => profile.currency);

  return { alternateCompositions, currencyProfiles };
};

export const createAlternateCrewCompositionCode = (
  existingProfiles: AlternateCrewCompositionProfile[],
  name: string,
): string => {
  const usedCodes = new Set(existingProfiles.map((profile) => profile.code.toUpperCase()));
  const base = normaliseCode(name, `ALT-${existingProfiles.length + 1}`);
  return nextAvailableThreeLetterCode(base, usedCodes);
};
