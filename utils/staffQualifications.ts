import {
  DEFAULT_OPERATIONAL_MODEL,
  OPERATIONAL_MODEL_OPTIONS,
  normaliseOperationalModel,
  type OperationalModelCode,
} from './platformConfigService';

export interface StaffQualificationDefinition {
  id: string;
  name: string;
  code: string;
  operationalModels: OperationalModelCode[];
  roleRestrictions?: string[];
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface StaffQualificationCatalogue {
  qualifications: StaffQualificationDefinition[];
}

export const DEFAULT_STAFF_QUALIFICATIONS: StaffQualificationCatalogue = {
  qualifications: [
    {
      id: 'pic',
      name: 'PIC',
      code: 'PIC',
      operationalModels: ['flight_school', 'air_combat', 'fixed_crew', 'air_mobility'],
      roleRestrictions: ['Pilot'],
      status: 'ACTIVE',
    },
    {
      id: 'crew-commander',
      name: 'Crew Commander',
      code: 'Crew Commander',
      operationalModels: ['fixed_crew', 'air_mobility'],
      roleRestrictions: ['Pilot'],
      status: 'ACTIVE',
    },
    {
      id: 'operational-captain',
      name: 'Operational Captain',
      code: 'Operational Captain',
      operationalModels: ['fixed_crew', 'air_mobility'],
      roleRestrictions: ['Pilot'],
      status: 'ACTIVE',
    },
  ],
};

const makeQualificationId = (source: string, index: number): string => {
  const token = String(source || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return token || `qualification-${index + 1}`;
};

const normaliseStringList = (source: unknown): string[] => {
  if (Array.isArray(source)) {
    return source.map(value => String(value || '').trim()).filter(Boolean);
  }
  return String(source || '')
    .split(/\r?\n|;|,/)
    .map(value => value.trim())
    .filter(Boolean);
};

const normaliseOperationalModels = (source: unknown): OperationalModelCode[] => {
  const values = normaliseStringList(source);
  if (values.length === 0) return [DEFAULT_OPERATIONAL_MODEL];
  return Array.from(new Set(values.map(value => normaliseOperationalModel(value))));
};

const normaliseQualification = (entry: any, index: number): StaffQualificationDefinition | null => {
  const name = String(entry?.name || entry?.label || entry?.code || '').trim();
  const code = String(entry?.code || entry?.abbreviation || name).trim();
  if (!name && !code) return null;
  const displayName = name || code;
  return {
    id: String(entry?.id || makeQualificationId(code || displayName, index)).trim() || makeQualificationId(displayName, index),
    name: displayName,
    code: code || displayName,
    operationalModels: normaliseOperationalModels(entry?.operationalModels || entry?.models),
    roleRestrictions: normaliseStringList(entry?.roleRestrictions || entry?.roles),
    status: String(entry?.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
};

export const normaliseStaffQualificationCatalogue = (source?: any): StaffQualificationCatalogue => {
  const configured = Array.isArray(source?.qualifications)
    ? source.qualifications
    : DEFAULT_STAFF_QUALIFICATIONS.qualifications;
  const configuredDefinitions = configured
    .map(normaliseQualification)
    .filter((entry): entry is StaffQualificationDefinition => Boolean(entry));
  const byKey = new Map<string, StaffQualificationDefinition>();
  configuredDefinitions.forEach((entry, index) => {
    const normalised = normaliseQualification(entry, index);
    if (!normalised) return;
    const key = normaliseQualificationToken(normalised.id || normalised.code || normalised.name);
    byKey.set(key, normalised);
  });
  return { qualifications: Array.from(byKey.values()) };
};

export const normaliseQualificationToken = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
);

export const qualificationMatches = (
  assignedValue: unknown,
  definition: StaffQualificationDefinition,
): boolean => {
  const token = normaliseQualificationToken(assignedValue);
  if (!token) return false;
  return [
    definition.id,
    definition.code,
    definition.name,
  ].some(value => normaliseQualificationToken(value) === token);
};

export const normaliseAssignedQualificationIds = (
  source: unknown,
  catalogue?: StaffQualificationCatalogue,
  preserveUnknown = true,
): string[] => {
  const values = normaliseStringList(source);
  const definitions = normaliseStaffQualificationCatalogue(catalogue).qualifications;
  const result: string[] = [];
  values.forEach(value => {
    const match = definitions.find(definition => qualificationMatches(value, definition));
    if (!match && !preserveUnknown) return;
    const id = match?.id || String(value || '').trim();
    if (id && !result.includes(id)) result.push(id);
  });
  return result;
};

export const getQualificationsForOperationalModel = (
  catalogue: StaffQualificationCatalogue | undefined,
  operationalModel?: unknown,
): StaffQualificationDefinition[] => {
  const model = normaliseOperationalModel(operationalModel);
  return normaliseStaffQualificationCatalogue(catalogue).qualifications
    .filter(qualification => qualification.status !== 'INACTIVE')
    .filter(qualification => {
      const models = qualification.operationalModels?.length
        ? qualification.operationalModels
        : OPERATIONAL_MODEL_OPTIONS.map(option => option.value);
      return models.includes(model);
    });
};
