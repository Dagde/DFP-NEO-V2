import type { PlatformConfig } from './platformConfigService';

export interface TrainingReportTerminology {
  name: string;
  shortName: string;
}

export const TRAINING_REPORT_NAME_MAX_LENGTH = 48;
export const TRAINING_REPORT_SHORT_LABEL_MAX_LENGTH = 16;

export const DEFAULT_TRAINING_REPORT_TERMINOLOGY: TrainingReportTerminology = {
  name: 'PT-051',
  shortName: 'Training Report',
};

const cleanLabel = (value: unknown, fallback: string, maxLength: number): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return (trimmed || fallback).slice(0, maxLength);
};

export const normaliseTrainingReportTerminology = (
  input?: Partial<TrainingReportTerminology> | null,
): TrainingReportTerminology => ({
  name: cleanLabel(input?.name, DEFAULT_TRAINING_REPORT_TERMINOLOGY.name, TRAINING_REPORT_NAME_MAX_LENGTH),
  shortName: cleanLabel(input?.shortName, DEFAULT_TRAINING_REPORT_TERMINOLOGY.shortName, TRAINING_REPORT_SHORT_LABEL_MAX_LENGTH),
});

export const getTrainingReportTerminology = (config?: PlatformConfig | null): TrainingReportTerminology => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  const settings = activeOrganisation?.settings || {};
  return normaliseTrainingReportTerminology(settings.trainingReportTerminology || null);
};
