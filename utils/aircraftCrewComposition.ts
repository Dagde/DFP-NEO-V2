import type { PlatformConfig } from './platformConfigService';

export type AircraftCrewResourceKind = 'flight' | 'sim' | 'cpt';

export type AircraftCrewResourceMap = Partial<Record<AircraftCrewResourceKind, boolean>>;
export type AircraftCrewResourceRoles = Partial<Record<AircraftCrewResourceKind, string[]>>;
export type AircraftCrewResourceSeatCounts = Record<AircraftCrewResourceKind, number>;

export interface AircraftSeatRole {
  id: string;
  role: string;
  eligibleRoles?: string[];
  resourceTypes?: AircraftCrewResourceMap;
  eligibleRolesByResource?: AircraftCrewResourceRoles;
}

export interface AircraftCrewComposition {
  crewCount: number;
  seats: AircraftSeatRole[];
  resourceSeatCounts?: AircraftCrewResourceSeatCounts;
}

export const AIRCRAFT_CREW_RESOURCE_KINDS: Array<{ kind: AircraftCrewResourceKind; label: string; shortLabel: string }> = [
  { kind: 'flight', label: 'Flight', shortLabel: 'Flight' },
  { kind: 'sim', label: 'Sim', shortLabel: 'Sim' },
  { kind: 'cpt', label: 'Procedural Trainer', shortLabel: 'Procedural Trainer' },
];

export const DEFAULT_AIRCRAFT_CREW_COMPOSITION: AircraftCrewComposition = {
  crewCount: 2,
  resourceSeatCounts: { flight: 2, sim: 2, cpt: 2 },
  seats: [
    { id: 'seat-1', role: 'Pilot' },
    { id: 'seat-2', role: 'Crew' },
  ],
};

const clampCrewCount = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_AIRCRAFT_CREW_COMPOSITION.crewCount;
  return Math.max(1, Math.min(12, parsed));
};

const defaultRoleForSeat = (index: number): string => {
  if (index === 0) return 'Pilot';
  return `Crew ${index + 1}`;
};

const uniqueRoles = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || '').trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getAircraftSeatEligibleRoles = (seat?: Partial<AircraftSeatRole> | null): string[] => {
  const roles = uniqueRoles([
    ...(Array.isArray(seat?.eligibleRoles) ? seat?.eligibleRoles || [] : []),
    ...(Array.isArray((seat as any)?.roles) ? (seat as any).roles : []),
    ...(Array.isArray((seat as any)?.allowedRoles) ? (seat as any).allowedRoles : []),
    seat?.role,
  ]);
  return roles.length > 0 ? roles : ['Crew'];
};

export const getAircraftSeatEligibleRolesForResource = (
  seat: Partial<AircraftSeatRole> | null | undefined,
  kind: AircraftCrewResourceKind,
): string[] => {
  const byResource = (seat?.eligibleRolesByResource || {}) as AircraftCrewResourceRoles;
  if (Array.isArray(byResource[kind])) return uniqueRoles(byResource[kind] || []);
  if (seat?.resourceTypes && seat.resourceTypes[kind] === false) return [];
  return getAircraftSeatEligibleRoles(seat);
};

export const getAircraftSeatAppliesToResource = (
  seat: Partial<AircraftSeatRole> | null | undefined,
  kind: AircraftCrewResourceKind,
): boolean => getAircraftSeatEligibleRolesForResource(seat, kind).length > 0;

const normaliseResourceSeatCounts = (
  raw: any,
  crewCount: number,
  seats: AircraftSeatRole[],
): AircraftCrewResourceSeatCounts => {
  const source = raw?.resourceSeatCounts || raw?.crewSeatCounts || raw?.seatCounts || {};
  const legacyAll = !raw?.resourceSeatCounts && !raw?.crewSeatCounts && !raw?.seatCounts;
  const fromSource = (kind: AircraftCrewResourceKind, aliases: string[]): number | null => {
    for (const key of [kind, ...aliases]) {
      if (source[key] !== undefined && source[key] !== null) {
        const parsed = Math.round(Number(source[key]));
        if (Number.isFinite(parsed)) return Math.max(0, Math.min(crewCount, parsed));
      }
    }
    return null;
  };
  const computed = (kind: AircraftCrewResourceKind): number => (
    seats.filter(seat => getAircraftSeatAppliesToResource(seat, kind)).length
  );
  return {
    flight: fromSource('flight', ['flights', 'aircraft']) ?? (legacyAll ? crewCount : computed('flight')),
    sim: fromSource('sim', ['simulator', 'ftd']) ?? (legacyAll ? crewCount : computed('sim')),
    cpt: fromSource('cpt', ['proceduralTrainer', 'procedural_trainer', 'trainer']) ?? (legacyAll ? crewCount : computed('cpt')),
  };
};

export const normaliseAircraftCrewComposition = (source?: any): AircraftCrewComposition => {
  const raw = source?.crewComposition && typeof source.crewComposition === 'object'
    ? source.crewComposition
    : source;
  const rawSeats = Array.isArray(raw?.seats) ? raw.seats : [];
  const crewCount = clampCrewCount(raw?.crewCount ?? rawSeats.length);
  const explicitSeatCounts = raw?.resourceSeatCounts || raw?.crewSeatCounts || raw?.seatCounts || null;
  const seats = Array.from({ length: crewCount }, (_, index) => {
    const existing = rawSeats[index] || {};
    const fallbackRole = defaultRoleForSeat(index);
    const role = String(existing.role || fallbackRole).trim() || fallbackRole;
    const eligibleRoles = getAircraftSeatEligibleRoles({ ...existing, role });
    const primaryRole = eligibleRoles.find((candidate) => candidate.toUpperCase() === role.toUpperCase()) || eligibleRoles[0];
    const resourceTypes = AIRCRAFT_CREW_RESOURCE_KINDS.reduce<AircraftCrewResourceMap>((acc, { kind }) => {
      const explicitCount = explicitSeatCounts?.[kind] ?? explicitSeatCounts?.[kind === 'sim' ? 'ftd' : kind === 'cpt' ? 'proceduralTrainer' : kind];
      const legacyApplies = explicitSeatCounts ? index < Math.max(0, Math.round(Number(explicitCount) || 0)) : true;
      acc[kind] = existing.resourceTypes?.[kind] !== undefined ? Boolean(existing.resourceTypes[kind]) : legacyApplies;
      return acc;
    }, {});
    const eligibleRolesByResource = AIRCRAFT_CREW_RESOURCE_KINDS.reduce<AircraftCrewResourceRoles>((acc, { kind }) => {
      const sourceRoles = existing.eligibleRolesByResource?.[kind];
      acc[kind] = Array.isArray(sourceRoles)
        ? uniqueRoles(sourceRoles)
        : resourceTypes[kind] === false
          ? []
          : eligibleRoles;
      return acc;
    }, {});
    return {
      id: String(existing.id || `seat-${index + 1}`),
      role: primaryRole,
      eligibleRoles,
      resourceTypes,
      eligibleRolesByResource,
    };
  });

  return {
    crewCount,
    seats,
    resourceSeatCounts: normaliseResourceSeatCounts(raw, crewCount, seats),
  };
};

export const filterAircraftCrewCompositionForResource = (
  composition: AircraftCrewComposition | null | undefined,
  kind: AircraftCrewResourceKind,
): AircraftCrewComposition => {
  const normalised = normaliseAircraftCrewComposition(composition);
  const seats = normalised.seats
    .map((seat) => {
      const eligibleRoles = getAircraftSeatEligibleRolesForResource(seat, kind);
      if (eligibleRoles.length === 0) return null;
      const role = eligibleRoles.some(candidate => candidate.toUpperCase() === String(seat.role || '').trim().toUpperCase())
        ? seat.role
        : eligibleRoles[0];
      return {
        ...seat,
        role,
        eligibleRoles,
      };
    })
    .filter((seat): seat is AircraftSeatRole => Boolean(seat));
  return {
    crewCount: seats.length,
    seats,
    resourceSeatCounts: {
      flight: kind === 'flight' ? seats.length : 0,
      sim: kind === 'sim' ? seats.length : 0,
      cpt: kind === 'cpt' ? seats.length : 0,
    },
  };
};

export const getAircraftCrewResourceKindForEvent = (event?: { type?: string; resourceId?: string } | null): AircraftCrewResourceKind => {
  const type = String(event?.type || '').trim().toLowerCase();
  const resourceId = String(event?.resourceId || '').trim().toUpperCase();
  if (type === 'cpt' || resourceId.startsWith('CPT')) return 'cpt';
  if (type === 'ftd' || resourceId.startsWith('FTD') || resourceId.startsWith('SIM')) return 'sim';
  return 'flight';
};

export const getAircraftCrewCompositionForEvent = (
  composition: AircraftCrewComposition | null | undefined,
  event?: { type?: string; resourceId?: string } | null,
): AircraftCrewComposition => (
  filterAircraftCrewCompositionForResource(composition, getAircraftCrewResourceKindForEvent(event))
);

export const isSingleSeatAircraft = (source?: any): boolean => (
  normaliseAircraftCrewComposition(source).crewCount === 1
);

export const getAircraftTypeCrewComposition = (
  platformConfig: Pick<PlatformConfig, 'aircraftTypes'> | null | undefined,
  aircraftTypeCode?: string | null,
): AircraftCrewComposition => {
  const normalisedCode = String(aircraftTypeCode || '').trim().toUpperCase();
  const aircraftType = (platformConfig?.aircraftTypes || []).find((candidate: any) => (
    String(candidate?.code || '').trim().toUpperCase() === normalisedCode
  ));

  return normaliseAircraftCrewComposition(aircraftType?.crewComposition);
};
