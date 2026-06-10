import type { PlatformConfig } from './platformConfigService';

export interface AircraftSeatRole {
  id: string;
  role: string;
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

export const normaliseAircraftCrewComposition = (source?: any): AircraftCrewComposition => {
  const raw = source?.crewComposition && typeof source.crewComposition === 'object'
    ? source.crewComposition
    : source;
  const rawSeats = Array.isArray(raw?.seats) ? raw.seats : [];
  const crewCount = clampCrewCount(raw?.crewCount ?? rawSeats.length);
  const seats = Array.from({ length: crewCount }, (_, index) => {
    const existing = rawSeats[index] || {};
    return {
      id: String(existing.id || `seat-${index + 1}`),
      role: String(existing.role || defaultRoleForSeat(index)).trim() || defaultRoleForSeat(index),
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
