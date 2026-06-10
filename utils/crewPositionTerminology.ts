export interface CrewPositionTerminologyEntry {
  id: string;
  genericName: string;
  label: string;
}

export interface CrewPositionTerminology {
  positions: CrewPositionTerminologyEntry[];
}

export const DEFAULT_CREW_POSITION_TERMINOLOGY: CrewPositionTerminology = {
  positions: [
    { id: 'pilot', genericName: 'Pilot', label: 'Pilot' },
    { id: 'combat-systems-operator', genericName: 'Combat Systems Operator', label: 'Combat Systems Operator' },
    { id: 'airborne-mission-commander', genericName: 'Airborne Mission Commander', label: 'Airborne Mission Commander' },
    { id: 'flight-engineer', genericName: 'Flight Engineer', label: 'Flight Engineer' },
    { id: 'loadmaster', genericName: 'Loadmaster', label: 'Loadmaster' },
    { id: 'crew', genericName: 'Crew', label: 'Crew' },
  ],
};

const makeCrewPositionId = (genericName: string, index: number): string => {
  const slug = String(genericName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `crew-position-${index + 1}`;
};

const normaliseEntry = (entry: any, index: number): CrewPositionTerminologyEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  const fallback = DEFAULT_CREW_POSITION_TERMINOLOGY.positions[index];
  const rawGenericName = String(entry.genericName || entry.generic || entry.name || fallback?.genericName || '');
  const genericName = rawGenericName.trim() ? rawGenericName : String(fallback?.genericName || '').trim();
  if (!genericName.trim()) return null;
  const rawLabel = String(entry.label || entry.displayName || '');
  const label = rawLabel.trim() ? rawLabel : genericName;
  return {
    id: String(entry.id || makeCrewPositionId(genericName, index)).trim() || makeCrewPositionId(genericName, index),
    genericName,
    label,
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

  const positions = [
    ...DEFAULT_CREW_POSITION_TERMINOLOGY.positions,
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

  return { positions: Array.from(byGenericName.values()) };
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
): string[] => {
  const options = normaliseCrewPositionTerminology(terminology).positions.map((entry) => entry.genericName);
  extraValues.forEach((value) => {
    const trimmed = String(value || '').trim();
    if (trimmed && !options.some((option) => option.toUpperCase() === trimmed.toUpperCase())) {
      options.push(trimmed);
    }
  });
  return options;
};
