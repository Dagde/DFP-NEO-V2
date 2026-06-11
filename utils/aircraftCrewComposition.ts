import type { PlatformConfig } from './platformConfigService';

export interface AircraftSeatRole {
  id: string;
  role: string;
  eligibleRoles?: string[];
}

export interface AircraftCrewComposition {
  crewCount: number;
  seats: AircraftSeatRole[];
}

export const DEFAULT_AIRCRAFT_CREW_COMPOSITION: AircraftCrewComposition = {
  crewCount: 2,
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

export const normaliseAircraftCrewComposition = (source?: any): AircraftCrewComposition => {
  const raw = source?.crewComposition && typeof source.crewComposition === 'object'
    ? source.crewComposition
    : source;
  const rawSeats = Array.isArray(raw?.seats) ? raw.seats : [];
  const crewCount = clampCrewCount(raw?.crewCount ?? rawSeats.length);
  const seats = Array.from({ length: crewCount }, (_, index) => {
    const existing = rawSeats[index] || {};
    const fallbackRole = defaultRoleForSeat(index);
    const role = String(existing.role || fallbackRole).trim() || fallbackRole;
    const eligibleRoles = getAircraftSeatEligibleRoles({ ...existing, role });
    const primaryRole = eligibleRoles.find((candidate) => candidate.toUpperCase() === role.toUpperCase()) || eligibleRoles[0];
    return {
      id: String(existing.id || `seat-${index + 1}`),
      role: primaryRole,
      eligibleRoles,
    };
  });

  return { crewCount, seats };
};

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
