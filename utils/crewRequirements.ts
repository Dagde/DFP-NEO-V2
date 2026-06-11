import type { CrewRequirement, CrewRequirementRole } from '../types';
import type { AircraftCrewComposition } from './aircraftCrewComposition';
import { DEFAULT_AIRCRAFT_CREW_COMPOSITION, getAircraftSeatEligibleRoles } from './aircraftCrewComposition';
import {
  findCrewPositionEntry,
  normaliseCrewPositionTerminology,
  type CrewPositionTerminology,
} from './crewPositionTerminology';

const clampCrewRoleCount = (value: unknown): number => {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0, Math.min(20, parsed));
};

const getRoleDisplayLabel = (role: string, terminology?: CrewPositionTerminology): string => {
  const entry = findCrewPositionEntry(role, terminology);
  return entry?.label || String(role || '').trim() || 'Crew';
};

const uniqueCrewRoles = (values: unknown[]): string[] => {
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

export const getCrewRequirementRoleOptions = (role: CrewRequirementRole | null | undefined): string[] => {
  const roles = uniqueCrewRoles([
    ...(Array.isArray(role?.eligibleRoles) ? role?.eligibleRoles || [] : []),
    role?.role,
  ]);
  return roles.length > 0 ? roles : ['Crew'];
};

export const normaliseCrewRequirement = (
  source?: CrewRequirement | null,
): CrewRequirement => {
  const mode = source?.mode === 'custom' ? 'custom' : 'aircraft_default';
  const roles = Array.isArray(source?.roles)
    ? source.roles
        .map((role): CrewRequirementRole | null => {
          const roleText = String(role?.role || '').trim();
          const count = clampCrewRoleCount(role?.count);
          if (!roleText || count <= 0) return null;
          return {
            crewPositionId: String(role?.crewPositionId || '').trim() || undefined,
            role: roleText,
            count,
            eligibleRoles: getCrewRequirementRoleOptions({ ...role, role: roleText, count }),
          };
        })
        .filter((role): role is CrewRequirementRole => Boolean(role))
    : [];

  return {
    mode,
    ...(roles.length > 0 ? { roles } : {}),
  };
};

export const crewRequirementFromAircraftComposition = (
  composition?: AircraftCrewComposition | null,
): CrewRequirement => {
  const source = composition || DEFAULT_AIRCRAFT_CREW_COMPOSITION;
  const seats = source.seats || [];
  const hasSeatAlternatives = seats.some((seat) => getAircraftSeatEligibleRoles(seat).length > 1);
  if (hasSeatAlternatives) {
    return {
      mode: 'custom',
      roles: seats.map((seat) => ({
        role: String(seat.role || '').trim() || getAircraftSeatEligibleRoles(seat)[0] || 'Crew',
        count: 1,
        eligibleRoles: getAircraftSeatEligibleRoles(seat),
      })),
    };
  }

  const grouped = new Map<string, CrewRequirementRole>();
  seats.forEach((seat) => {
    const role = String(seat.role || '').trim() || 'Crew';
    const key = role.toUpperCase();
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, {
        role,
        count: 1,
        eligibleRoles: [role],
      });
    }
  });

  return {
    mode: 'custom',
    roles: Array.from(grouped.values()),
  };
};

export const resolveCrewRequirement = (
  requirement: CrewRequirement | null | undefined,
  aircraftComposition?: AircraftCrewComposition | null,
): CrewRequirement => {
  const normalised = normaliseCrewRequirement(requirement);
  if (normalised.mode === 'custom' && normalised.roles && normalised.roles.length > 0) {
    return normalised;
  }
  return crewRequirementFromAircraftComposition(aircraftComposition);
};

export const getCrewRequirementRoles = (
  requirement: CrewRequirement | null | undefined,
  aircraftComposition?: AircraftCrewComposition | null,
): CrewRequirementRole[] => (
  resolveCrewRequirement(requirement, aircraftComposition).roles || []
);

export const getCrewRequirementCount = (
  requirement: CrewRequirement | null | undefined,
  aircraftComposition?: AircraftCrewComposition | null,
): number => (
  getCrewRequirementRoles(requirement, aircraftComposition)
    .reduce((total, role) => total + clampCrewRoleCount(role.count), 0)
);

export const formatCrewRequirementSummary = (
  requirement: CrewRequirement | null | undefined,
  aircraftComposition?: AircraftCrewComposition | null,
  terminology?: CrewPositionTerminology,
): string => {
  const roles = getCrewRequirementRoles(requirement, aircraftComposition);
  if (roles.length === 0) return 'No crew required';
  return roles
    .map((role) => {
      const options = getCrewRequirementRoleOptions(role);
      const label = options.length > 1
        ? options.map((option) => getRoleDisplayLabel(option, terminology)).join(' or ')
        : getRoleDisplayLabel(role.role, terminology);
      return `${label} ${clampCrewRoleCount(role.count)}`;
    })
    .join(', ');
};

export const getCrewRequirementOptions = (
  terminology?: CrewPositionTerminology,
): { id: string; value: string; label: string }[] => (
  normaliseCrewPositionTerminology(terminology).positions.map((entry) => ({
    id: entry.id,
    value: entry.genericName,
    label: entry.label,
  }))
);
