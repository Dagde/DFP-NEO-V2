import type { PlatformConfig } from './platformConfigService';

export interface SctTerminology {
  shortLabel: string;
  longLabel: string;
}

export const DEFAULT_SCT_TERMINOLOGY: SctTerminology = {
  shortLabel: 'SCT',
  longLabel: 'Staff Continuation Training',
};

export const SCT_SHORT_LABEL_MAX_LENGTH = 12;
export const SCT_LONG_LABEL_MAX_LENGTH = 40;

export const normaliseSctTerminology = (input?: Partial<SctTerminology> | null): SctTerminology => ({
  shortLabel: String(input?.shortLabel || '').trim().slice(0, SCT_SHORT_LABEL_MAX_LENGTH) || DEFAULT_SCT_TERMINOLOGY.shortLabel,
  longLabel: String(input?.longLabel || '').trim().slice(0, SCT_LONG_LABEL_MAX_LENGTH) || DEFAULT_SCT_TERMINOLOGY.longLabel,
});

export const getSctTerminology = (config?: PlatformConfig | null): SctTerminology => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  return normaliseSctTerminology(activeOrganisation?.settings?.sctTerminology || null);
};
