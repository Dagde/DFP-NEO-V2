import type { PlatformResourcePool } from './platformConfigService';

export interface ResourceDisplayNames {
  aircraft: string;
  ftd: string;
  cpt: string;
}

export const DEFAULT_RESOURCE_DISPLAY_NAMES: ResourceDisplayNames = {
  aircraft: 'PC-21',
  ftd: 'FTD',
  cpt: 'CPT',
};

const cleanLabel = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const getResourceDisplayNames = (resourcePool?: PlatformResourcePool | null): ResourceDisplayNames => {
  const settings = resourcePool?.settings || {};

  return {
    aircraft: cleanLabel(settings.aircraftLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.aircraft),
    ftd: cleanLabel(settings.ftdLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.ftd),
    cpt: cleanLabel(settings.cptLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.cpt),
  };
};

export const formatResourceLabel = (
  resourceId: string,
  names: ResourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
): string => {
  if (!resourceId || typeof resourceId !== 'string') return resourceId;

  if (resourceId === 'PC-21') return names.aircraft;
  if (resourceId === 'FTD') return names.ftd;
  if (resourceId === 'CPT') return names.cpt;

  const aircraftMatch = resourceId.match(/^PC-21(\s+\d+)$/);
  if (aircraftMatch) return `${names.aircraft}${aircraftMatch[1]}`;

  const deployedMatch = resourceId.match(/^Deployed(\s+\d+)$/);
  if (deployedMatch) {
    const deployedLabel = names.aircraft.length >= 5 ? 'Dep' : 'Deployed';
    return `${deployedLabel} ${names.aircraft}${deployedMatch[1]}`;
  }

  const ftdMatch = resourceId.match(/^FTD(\s+\d+)$/);
  if (ftdMatch) return `${names.ftd}${ftdMatch[1]}`;

  const cptMatch = resourceId.match(/^CPT(\s+\d+)$/);
  if (cptMatch) return `${names.cpt}${cptMatch[1]}`;

  return resourceId;
};
