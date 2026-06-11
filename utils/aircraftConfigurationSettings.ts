import type { PlatformResourcePool } from './platformConfigService';

export const ANY_AIRCRAFT_CONFIG = 'ANY';
export const BASE_AIRCRAFT_CONFIG = {
  id: 'CONFIG-0',
  label: 'CONFIG 0',
  definition: 'Clean',
};

export interface AircraftConfigurationDefinition {
  id: string;
  label: string;
  definition: string;
}

const normaliseConfigId = (value: unknown, fallback: string): string => {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  return cleaned || fallback;
};

const normaliseConfigValue = (value: unknown): string => (
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^CONFIG\s+(\d+)$/, 'CONFIG-$1')
    .replace(/^C\s*(\d+)$/, 'CONFIG-$1')
);

const formatConfigLabel = (id: string, fallbackIndex: number): string => {
  const match = id.match(/^CONFIG-(\d+)$/);
  if (!match) return `CONFIG ${fallbackIndex + 1}`;
  const configNumber = Number(match[1]);
  return `CONFIG ${configNumber}`;
};

export const normaliseAircraftConfigurationDefinitions = (
  definitions?: unknown,
): AircraftConfigurationDefinition[] => {
  if (!Array.isArray(definitions)) return [BASE_AIRCRAFT_CONFIG];

  const userDefinitions = definitions
    .map((definition, index) => {
      const item = definition && typeof definition === 'object' ? definition as Record<string, any> : {};
      const fallbackId = `CONFIG-${index + 1}`;
      const id = normaliseConfigId(item.id || item.label || fallbackId, fallbackId);
      return {
        id,
        label: formatConfigLabel(id, index),
        definition: String(item.definition || item.description || ''),
      };
    })
    .filter((definition) => definition.id !== BASE_AIRCRAFT_CONFIG.id)
    .filter((definition, index, all) => (
      all.findIndex(candidate => candidate.id === definition.id) === index
    ));

  return [BASE_AIRCRAFT_CONFIG, ...userDefinitions];
};

export const getAircraftConfigurationDefinitions = (
  resourcePool?: PlatformResourcePool | null,
): AircraftConfigurationDefinition[] => (
  normaliseAircraftConfigurationDefinitions(resourcePool?.settings?.aircraftConfigurations)
);

export const normaliseSelectedAircraftConfigurations = (
  selected?: unknown,
  definitions: AircraftConfigurationDefinition[] = [],
): string[] => {
  if (!Array.isArray(selected) || selected.length === 0) return [ANY_AIRCRAFT_CONFIG];

  const validIds = new Set(definitions.map(definition => definition.id));
  const cleaned = selected
    .map(normaliseConfigValue)
    .filter(Boolean);

  if (cleaned.includes(ANY_AIRCRAFT_CONFIG)) return [ANY_AIRCRAFT_CONFIG];

  const filtered = cleaned.filter(value => validIds.has(value));
  return filtered.length > 0 ? Array.from(new Set(filtered)) : [ANY_AIRCRAFT_CONFIG];
};

export const formatAircraftConfigurationSummary = (
  selected?: unknown,
  definitions: AircraftConfigurationDefinition[] = [],
): string => {
  const normalised = normaliseSelectedAircraftConfigurations(selected, definitions);
  if (normalised.includes(ANY_AIRCRAFT_CONFIG)) return 'ANY';

  const definitionMap = new Map(definitions.map(definition => [definition.id, definition.label]));
  return normalised.map(id => definitionMap.get(id) || id).join(', ') || 'ANY';
};
