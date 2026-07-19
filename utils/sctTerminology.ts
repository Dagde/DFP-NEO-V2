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

const normaliseUnitCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

export const getSctTerminology = (config?: PlatformConfig | null, unitCode?: string | null): SctTerminology => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const units = Array.isArray(config?.units) ? config!.units : [];
  const activeUnitCodes = normaliseUnitCode(unitCode)
    .split('+')
    .map(code => normaliseUnitCode(code))
    .filter(Boolean);
  const activeUnit = activeUnitCodes.length > 0
    ? units.find(unit => activeUnitCodes.includes(normaliseUnitCode(unit.code)))
    : null;
  const unitTerminology = activeUnit?.settings?.sctTerminology;
  if (unitTerminology) return normaliseSctTerminology(unitTerminology);

  const activeOrganisationCode = normaliseUnitCode(activeUnit?.organisationCode);
  const activeOrganisation = activeOrganisationCode
    ? organisations.find(org => normaliseUnitCode(org.code) === activeOrganisationCode)
    : null;
  const fallbackOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  return normaliseSctTerminology((activeOrganisation || fallbackOrganisation)?.settings?.sctTerminology || null);
};
