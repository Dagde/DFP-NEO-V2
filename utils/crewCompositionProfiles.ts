import type { OperationalModelCode } from './platformConfigService';

export interface CrewCompositionRoleRequirement {
  role: string;
  count: number;
}

export interface AlternateCrewCompositionProfile {
  id: string;
  code: string;
  aircraftTypeCode: string;
  name: string;
  description?: string;
  operationalModels: OperationalModelCode[];
  roleRequirements: CrewCompositionRoleRequirement[];
  status?: string;
}

export interface CrewCompositionSettings {
  alternateCompositions: AlternateCrewCompositionProfile[];
}

const SUPPORTED_MODELS: OperationalModelCode[] = ['air_combat', 'fixed_crew', 'air_mobility'];

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

export const normaliseCrewCompositionSettings = (value: unknown): CrewCompositionSettings => {
  const source = (value && typeof value === 'object') ? value as any : {};
  const rows = Array.isArray(source.alternateCompositions) ? source.alternateCompositions : [];
  const usedCodes = new Set<string>();
  const alternateCompositions = rows.map((row: any, index: number) => {
    const fallbackCode = `ALT-${index + 1}`;
    let code = normaliseCode(row?.code || row?.name, fallbackCode);
    code = nextAvailableThreeLetterCode(code, usedCodes);
    usedCodes.add(code);

    const operationalModels = Array.isArray(row?.operationalModels)
      ? row.operationalModels.filter((model: unknown): model is OperationalModelCode => (
        SUPPORTED_MODELS.includes(model as OperationalModelCode)
      ))
      : SUPPORTED_MODELS;

    return {
      id: String(row?.id || `alternate-crew-${index + 1}`),
      code,
      aircraftTypeCode: String(row?.aircraftTypeCode || row?.aircraftType || '').trim().toUpperCase(),
      name: String(row?.name || code).trim() || code,
      description: String(row?.description || '').trim(),
      operationalModels: operationalModels.length > 0 ? operationalModels : SUPPORTED_MODELS,
      roleRequirements: normaliseRoleRequirements(row?.roleRequirements),
      status: String(row?.status || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };
  });

  return { alternateCompositions };
};

export const createAlternateCrewCompositionCode = (
  existingProfiles: AlternateCrewCompositionProfile[],
  name: string,
): string => {
  const usedCodes = new Set(existingProfiles.map((profile) => profile.code.toUpperCase()));
  const base = normaliseCode(name, `ALT-${existingProfiles.length + 1}`);
  return nextAvailableThreeLetterCode(base, usedCodes);
};
