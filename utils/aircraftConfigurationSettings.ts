import type { PlatformResourcePool } from './platformConfigService';

export const ANY_AIRCRAFT_CONFIG = 'ANY';

export interface AircraftConfigurationDefinition {
  id: string;
  label: string;
  definition: string;
}

const normaliseConfigId = (value: unknown, fallback: string): string => {
  const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
  return cleaned || fallback;
};

export const normaliseAircraftConfigurationDefinitions = (
  definitions?: unknown,
): AircraftConfigurationDefinition[] => {
  if (!Array.isArray(definitions)) return [];

  return definitions
    .map((definition, index) => {
      const item = definition && typeof definition === 'object' ? definition as Record<string, any> : {};
      const fallbackId = `CONFIG-${index + 1}`;
      return {
        id: normaliseConfigId(item.id || item.label || fallbackId, fallbackId),
        label: `Config ${index + 1}`,
        definition: String(item.definition || item.description || '').trim(),
      };
    })
    .filter((definition, index, all) => (
      all.findIndex(candidate => candidate.id === definition.id) === index
    ));
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
    .map(value => String(value || '').trim().toUpperCase())
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
