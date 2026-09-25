import type { PlatformResourcePool } from './platformConfigService';

export interface ResourceDisplayNames {
  aircraft: string;
  ftd: string;
  cpt: string;
  dutySupervisor: string;
  dutySupervisorShort: string;
  towerDutyInstructor: string;
  towerDutyInstructorShort: string;
}

export const DEFAULT_RESOURCE_DISPLAY_NAMES: ResourceDisplayNames = {
  aircraft: 'Aircraft',
  ftd: 'Simulator',
  cpt: 'CPT',
  dutySupervisor: 'Duty Supervisor',
  dutySupervisorShort: 'Duty Sup',
  towerDutyInstructor: 'Tower Duty Instructor',
  towerDutyInstructorShort: 'TWR DI',
};

const cleanLabel = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const cleanSimulatorLabel = (value: unknown): string => {
  const label = cleanLabel(value, DEFAULT_RESOURCE_DISPLAY_NAMES.ftd);
  return label.toUpperCase() === 'FTD' ? DEFAULT_RESOURCE_DISPLAY_NAMES.ftd : label;
};

const isNonAircraftResourceId = (resourceId: string): boolean => (
  /^SIM(\s+\d+)?$/i.test(resourceId) ||
  /^FTD(\s+\d+)?$/i.test(resourceId) ||
  /^CPT(\s+\d+)?$/i.test(resourceId) ||
  /^Ground(\s+\d+)?$/i.test(resourceId) ||
  /^STBY(\s+\d+)?$/i.test(resourceId) ||
  /^BNF-STBY(\s+\d+)?$/i.test(resourceId) ||
  resourceId === 'Duty Sup' ||
  resourceId === 'TWR DI'
);

const getAircraftResourceMatch = (resourceId: string): { typeCode: string; suffix: string } | null => {
  const cleanId = String(resourceId || '').trim();
  if (!cleanId || isNonAircraftResourceId(cleanId)) return null;
  if (/^Deployed(\s+\d+)?$/i.test(cleanId)) return null;

  const numberedMatch = cleanId.match(/^([A-Z0-9][A-Z0-9/-]*(?:\s+[A-Z0-9][A-Z0-9/-]*)?)(\s+\d+)$/i);
  if (numberedMatch) {
    return {
      typeCode: numberedMatch[1].trim(),
      suffix: numberedMatch[2],
    };
  }

  if (/^[A-Z0-9][A-Z0-9/-]*(?:\s+[A-Z0-9][A-Z0-9/-]*)?$/i.test(cleanId) && /[-/]/.test(cleanId)) {
    return {
      typeCode: cleanId,
      suffix: '',
    };
  }

  return null;
};

export const isAircraftResourceId = (resourceId?: string | null): boolean => {
  const cleanId = String(resourceId || '').trim();
  if (!cleanId || isNonAircraftResourceId(cleanId)) return false;
  if (/^Deployed(\s+\d+)?$/i.test(cleanId)) return true;
  return Boolean(getAircraftResourceMatch(cleanId));
};

export const getResourceCategory = (resourceId?: string | null): string => {
  const cleanId = String(resourceId || '').trim();
  if (!cleanId) return 'Other';
  if (isAircraftResourceId(cleanId)) return 'Aircraft';
  if (/^STBY\b/i.test(cleanId) || /^BNF-STBY\b/i.test(cleanId)) return 'STBY';
  if (cleanId === 'Duty Sup') return 'Duty Sup';
  if (cleanId === 'TWR DI') return 'TWR DI';
  if (/^SIM\b/i.test(cleanId)) return 'FTD';
  if (/^FTD\b/i.test(cleanId)) return 'FTD';
  if (/^CPT\b/i.test(cleanId)) return 'CPT';
  if (/^Ground\b/i.test(cleanId)) return 'Ground';
  return 'Other';
};

export const getResourceDisplayNames = (resourcePool?: PlatformResourcePool | null): ResourceDisplayNames => {
  const settings = resourcePool?.settings || {};
  const aircraftFallback = cleanLabel(
    resourcePool?.aircraftTypeCode,
    DEFAULT_RESOURCE_DISPLAY_NAMES.aircraft,
  );

  return {
    aircraft: cleanLabel(settings.aircraftLabel, aircraftFallback),
    ftd: cleanSimulatorLabel(settings.ftdLabel),
    cpt: cleanLabel(settings.cptLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.cpt),
    dutySupervisor: cleanLabel(settings.dutySupervisorLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.dutySupervisor),
    dutySupervisorShort: cleanLabel(settings.dutySupervisorShortLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.dutySupervisorShort),
    towerDutyInstructor: cleanLabel(settings.towerDutyInstructorLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.towerDutyInstructor),
    towerDutyInstructorShort: cleanLabel(settings.towerDutyInstructorShortLabel, DEFAULT_RESOURCE_DISPLAY_NAMES.towerDutyInstructorShort),
  };
};

export const formatResourceLabel = (
  resourceId: string,
  names: ResourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
): string => {
  if (!resourceId || typeof resourceId !== 'string') return resourceId;

  if (resourceId === 'FTD') return names.ftd;
  if (resourceId === 'CPT') return names.cpt;
  if (resourceId === 'Duty Sup') return names.dutySupervisorShort;
  if (resourceId === 'TWR DI') return names.towerDutyInstructorShort;

  const deployedMatch = resourceId.match(/^Deployed(\s+\d+)$/);
  if (deployedMatch) {
    const deployedLabel = names.aircraft.length >= 5 ? 'Dep' : 'Deployed';
    return `${deployedLabel} ${names.aircraft}${deployedMatch[1]}`;
  }

  const aircraftMatch = getAircraftResourceMatch(resourceId);
  if (aircraftMatch) {
    return `${names.aircraft}${aircraftMatch.suffix}`;
  }

  const ftdMatch = resourceId.match(/^FTD(\s+\d+)$/);
  if (ftdMatch) return `${names.ftd}${ftdMatch[1]}`;

  const cptMatch = resourceId.match(/^CPT(\s+\d+)$/);
  if (cptMatch) return `${names.cpt}${cptMatch[1]}`;

  return resourceId;
};
