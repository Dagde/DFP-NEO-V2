import type { PlatformConfig } from './platformConfigService';

export interface TrainingReportTerminology {
  name: string;
  shortName: string;
}

export const DEFAULT_TRAINING_REPORT_TERMINOLOGY: TrainingReportTerminology = {
  name: 'PT-051',
  shortName: 'Training Report',
};

const cleanLabel = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

export const normaliseTrainingReportTerminology = (
  input?: Partial<TrainingReportTerminology> | null,
): TrainingReportTerminology => ({
  name: cleanLabel(input?.name, DEFAULT_TRAINING_REPORT_TERMINOLOGY.name),
  shortName: cleanLabel(input?.shortName, DEFAULT_TRAINING_REPORT_TERMINOLOGY.shortName),
});

export const getTrainingReportTerminology = (config?: PlatformConfig | null): TrainingReportTerminology => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  const settings = activeOrganisation?.settings || {};
  return normaliseTrainingReportTerminology(settings.trainingReportTerminology || null);
};

