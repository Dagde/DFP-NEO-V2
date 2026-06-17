import {
  DEFAULT_OPERATIONAL_MODEL,
  OPERATIONAL_MODEL_OPTIONS,
  normaliseOperationalModel,
  type OperationalModelCode,
} from './platformConfigService';

export interface CrewPositionTerminologyEntry {
  id: string;
  genericName: string;
  label: string;
  operationalModels?: OperationalModelCode[];
}

export interface CrewPositionTerminology {
  positions: CrewPositionTerminologyEntry[];
  deletedDefaultIds?: string[];
}

export const DEFAULT_CREW_POSITION_TERMINOLOGY: CrewPositionTerminology = {
  positions: [
    { id: 'pilot', genericName: 'Pilot', label: 'Pilot', operationalModels: ['flight_school', 'air_combat', 'fixed_crew', 'air_mobility'] },
    { id: 'combat-systems-operator', genericName: 'Combat Systems Operator', label: 'Combat Systems Operator', operationalModels: ['air_combat'] },
    { id: 'airborne-mission-commander', genericName: 'Airborne Mission Commander', label: 'Airborne Mission Commander', operationalModels: ['fixed_crew', 'air_mobility'] },
    { id: 'flight-engineer', genericName: 'Flight Engineer', label: 'Flight Engineer', operationalModels: ['fixed_crew', 'air_mobility'] },
    { id: 'loadmaster', genericName: 'Loadmaster', label: 'Loadmaster', operationalModels: ['air_mobility'] },
    { id: 'crew', genericName: 'Crew', label: 'Crew', operationalModels: ['flight_school', 'air_combat', 'fixed_crew', 'air_mobility'] },
  ],
};

const ALL_OPERATIONAL_MODEL_CODES = OPERATIONAL_MODEL_OPTIONS.map((option) => option.value);

const makeCrewPositionId = (genericName: string, index: number): string => {
  const slug = String(genericName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `crew-position-${index + 1}`;
};

const normaliseOperationalModelList = (source: unknown, fallback: OperationalModelCode[] = ALL_OPERATIONAL_MODEL_CODES): OperationalModelCode[] => {
  const rawValues = Array.isArray(source) ? source : [];
  const models = rawValues
    .map((value) => normaliseOperationalModel(value))
    .filter((model, index, list) => list.indexOf(model) === index);
  return models.length > 0 ? models : [...fallback];
};

const getFallbackEntry = (entry: any, index: number): CrewPositionTerminologyEntry | undefined => {
  const id = String(entry?.id || '').trim();
  const genericName = String(entry?.genericName || entry?.generic || entry?.name || '').trim();
  return DEFAULT_CREW_POSITION_TERMINOLOGY.positions.find((position) => (
    (!!id && position.id === id)
    || (!!genericName && position.genericName.trim().toUpperCase() === genericName.toUpperCase())
  )) || DEFAULT_CREW_POSITION_TERMINOLOGY.positions[index];
};

const normaliseEntry = (entry: any, index: number): CrewPositionTerminologyEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  const fallback = getFallbackEntry(entry, index);
  const rawGenericName = String(entry.genericName || entry.generic || entry.name || fallback?.genericName || '');
  const genericName = rawGenericName.trim() ? rawGenericName : String(fallback?.genericName || '').trim();
  if (!genericName.trim()) return null;
  const rawLabel = String(entry.label || entry.displayName || '');
  const label = rawLabel.trim() ? rawLabel : genericName;
  const operationalModels = normaliseOperationalModelList(
    entry.operationalModels || entry.models || entry.modelCodes,
    fallback?.operationalModels || ALL_OPERATIONAL_MODEL_CODES,
  );
  return {
    id: String(entry.id || makeCrewPositionId(genericName, index)).trim() || makeCrewPositionId(genericName, index),
    genericName,
    label,
    operationalModels,
  };
};

export const normaliseCrewPositionTerminology = (source?: any): CrewPositionTerminology => {
  let sourcePositions: any[] = [];
  if (Array.isArray(source)) {
    sourcePositions = source;
  } else if (Array.isArray(source?.positions)) {
    sourcePositions = source.positions;
  } else if (source && typeof source === 'object') {
    sourcePositions = Object.entries(source).map(([genericName, label]) => ({ genericName, label }));
  }

  const deletedDefaultIds = new Set(
    Array.isArray(source?.deletedDefaultIds)
      ? source.deletedDefaultIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : []
  );
  const positions = [
    ...DEFAULT_CREW_POSITION_TERMINOLOGY.positions.filter((entry) => !deletedDefaultIds.has(entry.id)),
    ...sourcePositions,
  ]
    .map(normaliseEntry)
    .filter((entry): entry is CrewPositionTerminologyEntry => Boolean(entry));

  const byGenericName = new Map<string, CrewPositionTerminologyEntry>();
  positions.forEach((entry) => {
    const key = entry.genericName.trim().toUpperCase();
    if (!key) return;
    byGenericName.set(key, entry);
  });

  return {
    positions: Array.from(byGenericName.values()),
    deletedDefaultIds: Array.from(deletedDefaultIds),
  };
};

export const getCrewPositionLabelMap = (terminology?: CrewPositionTerminology): Record<string, string> => (
  normaliseCrewPositionTerminology(terminology).positions.reduce((labels, entry) => ({
    ...labels,
    [entry.genericName]: entry.label,
  }), {} as Record<string, string>)
);

export const getCrewPositionOptions = (
  terminology?: CrewPositionTerminology,
  extraValues: string[] = [],
  operationalModel?: unknown,
): string[] => {
  const model = operationalModel ? normaliseOperationalModel(operationalModel) : null;
  const positions = normaliseCrewPositionTerminology(terminology).positions;
  const modelPositions = model
    ? positions.filter((entry) => isCrewPositionAvailableForOperationalModel(entry, model))
    : positions;
  const options = (modelPositions.length > 0 ? modelPositions : positions).map((entry) => entry.genericName);
  extraValues.forEach((value) => {
    const trimmed = String(value || '').trim();
    if (trimmed && !options.some((option) => option.toUpperCase() === trimmed.toUpperCase())) {
      options.push(trimmed);
    }
  });
  return options;
};

export const isCrewPositionAvailableForOperationalModel = (
  entry: CrewPositionTerminologyEntry,
  operationalModel?: unknown,
): boolean => {
  if (!operationalModel) return true;
  const model = normaliseOperationalModel(operationalModel || DEFAULT_OPERATIONAL_MODEL);
  const models = normaliseOperationalModelList(entry.operationalModels, ALL_OPERATIONAL_MODEL_CODES);
  return models.includes(model);
};

const normaliseCrewPositionToken = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
);

const getAcronymToken = (value: unknown): string => (
  String(value || '')
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .toLowerCase()
);

const getSortedToken = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .split('')
    .sort()
    .join('')
);

const getCrewPositionMatchTokens = (entry: CrewPositionTerminologyEntry): string[] => ([
  normaliseCrewPositionToken(entry.id),
  normaliseCrewPositionToken(entry.genericName),
  normaliseCrewPositionToken(entry.label),
  getAcronymToken(entry.genericName),
  getAcronymToken(entry.label),
  getSortedToken(getAcronymToken(entry.genericName)),
  getSortedToken(getAcronymToken(entry.label)),
  getSortedToken(entry.id),
  getSortedToken(entry.label),
].filter(Boolean));

export const findCrewPositionEntry = (
  value: unknown,
  terminology?: CrewPositionTerminology,
): CrewPositionTerminologyEntry | null => {
  const token = normaliseCrewPositionToken(value);
  const acronym = getAcronymToken(value);
  if (!token && !acronym) return null;

  return normaliseCrewPositionTerminology(terminology).positions.find(entry => {
    const tokens = getCrewPositionMatchTokens(entry);
    return tokens.includes(token) || (!!acronym && tokens.includes(acronym));
  }) || null;
};

export const crewPositionValuesMatch = (
  requiredPosition: unknown,
  staffPosition: unknown,
  terminology?: CrewPositionTerminology,
): boolean => {
  const requiredEntry = findCrewPositionEntry(requiredPosition, terminology);
  const staffEntry = findCrewPositionEntry(staffPosition, terminology);
  if (requiredEntry && staffEntry) return requiredEntry.genericName.trim().toUpperCase() === staffEntry.genericName.trim().toUpperCase();
  const requiredToken = normaliseCrewPositionToken(requiredPosition);
  const staffToken = normaliseCrewPositionToken(staffPosition);
  if (requiredToken === staffToken) return true;
  const requiredAcronym = getAcronymToken(requiredPosition);
  const staffAcronym = getAcronymToken(staffPosition);
  const requiredTokens = [
    requiredToken,
    requiredAcronym,
    getSortedToken(requiredAcronym),
    getSortedToken(requiredPosition),
  ].filter(Boolean);
  const staffTokens = new Set([
    staffToken,
    staffAcronym,
    getSortedToken(staffAcronym),
    getSortedToken(staffPosition),
  ].filter(Boolean));
  return requiredTokens.some(token => staffTokens.has(token));
};

export const isPilotCrewPosition = (
  value: unknown,
  terminology?: CrewPositionTerminology,
): boolean => {
  const entry = findCrewPositionEntry(value, terminology);
  return normaliseCrewPositionToken(entry?.genericName || value) === normaliseCrewPositionToken('Pilot');
};
