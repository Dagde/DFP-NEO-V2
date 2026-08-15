import type { Instructor, LmpTestEventType } from '../types';
import {
  getPersonAssignedQualificationIds,
  type StaffQualificationCatalogue,
} from './staffQualifications';

export const normaliseLmpTestEventType = (value: unknown): LmpTestEventType => {
  const candidate = String(value || '').trim().toUpperCase();
  if (candidate === 'FLIGHT_TEST' || candidate === 'SIMULATOR_TEST') return candidate;
  return 'NONE';
};

export const isLmpTestEvent = (value: unknown): boolean => (
  normaliseLmpTestEventType(value) !== 'NONE'
);

export const filterQualifiedTestingOfficers = (
  candidates: Instructor[],
  testEventType: unknown,
  requiredQualificationId: unknown,
  catalogue?: StaffQualificationCatalogue,
): Instructor[] => {
  if (!isLmpTestEvent(testEventType)) return candidates;

  const qualificationId = String(requiredQualificationId || '').trim();
  if (!qualificationId) return [];

  return candidates.filter(person => (
    getPersonAssignedQualificationIds(person, catalogue, false).includes(qualificationId)
  ));
};

export const resolveLmpTestEventCallsign = (options: {
  formationCallsign?: unknown;
  testEventType?: unknown;
  useTestingOfficerSecondaryCallsign?: boolean;
  officerSecondaryCallsign?: unknown;
}): string | undefined => {
  const formationCallsign = String(options.formationCallsign || '').trim();
  if (formationCallsign) return formationCallsign;

  if (
    normaliseLmpTestEventType(options.testEventType) !== 'FLIGHT_TEST'
    || options.useTestingOfficerSecondaryCallsign !== true
  ) {
    return undefined;
  }

  return String(options.officerSecondaryCallsign || '').trim() || undefined;
};
