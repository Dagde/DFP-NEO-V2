import type { Instructor, StaffCallsignInfo } from '../types';
import {
  comparePeopleByConfiguredRank,
  type PersonnelDisplaySettings,
} from './personnelDisplaySettings';

const CALLSIGN_LIMIT = 50;

const norm = (value?: string | null): string => String(value || '').trim().toUpperCase();

const personKey = (person: Instructor): string =>
  String((person as any).id || person.idNumber || person.name || '').trim();

const isQfiStaff = (person: Instructor): boolean =>
  person.role === 'QFI' || person.isQFI === true || (person as any).role === 'INSTRUCTOR';

const isSimIp = (person: Instructor): boolean => person.role === 'SIM IP';

const isEastSale = (person: Instructor): boolean => {
  const location = norm(person.location);
  const unit = norm(person.unit);
  return location === 'EAST SALE' || location === 'ESL' || (!location && (unit.startsWith('1FTS') || unit.startsWith('CFS')));
};

const isPearce = (person: Instructor): boolean => {
  const location = norm(person.location);
  const unit = norm(person.unit);
  return location === 'PEARCE' || location === 'PEA' || (!location && unit.startsWith('2FTS'));
};

const sortedStaff = (people: Instructor[], settings?: PersonnelDisplaySettings): Instructor[] =>
  [...people].sort((a, b) => comparePeopleByConfiguredRank(a, b, settings, 'staff'));

const assignSequence = (
  assignments: Map<string, StaffCallsignInfo>,
  people: Instructor[],
  prefix: string,
  startingNumber = 1,
): number => {
  let nextNumber = startingNumber;

  people.forEach((person) => {
    const key = personKey(person);
    if (!key || nextNumber > CALLSIGN_LIMIT) return;

    assignments.set(key, {
      callsign: `${prefix}${nextNumber}`,
      callsignPrefix: prefix,
      callsignNumber: nextNumber,
    });
    nextNumber += 1;
  });

  return nextNumber;
};

export const getStaffCallsignAssignments = (
  instructors: Instructor[],
  settings?: PersonnelDisplaySettings,
): Map<string, StaffCallsignInfo> => {
  const assignments = new Map<string, StaffCallsignInfo>();
  const activeStaff = instructors.filter((person) => person.name && (person as any).isActive !== false);

  const oneFts = sortedStaff(activeStaff.filter((person) => isQfiStaff(person) && norm(person.unit).startsWith('1FTS')), settings);
  const cfs = sortedStaff(activeStaff.filter((person) => isQfiStaff(person) && norm(person.unit).startsWith('CFS')), settings);
  const twoFts = sortedStaff(activeStaff.filter((person) => isQfiStaff(person) && norm(person.unit).startsWith('2FTS')), settings);
  const eslSimIp = sortedStaff(activeStaff.filter((person) => isSimIp(person) && isEastSale(person)), settings);
  const peaSimIp = sortedStaff(activeStaff.filter((person) => isSimIp(person) && isPearce(person)), settings);

  const nextRolr = assignSequence(assignments, oneFts, 'ROLR', 1);
  assignSequence(assignments, eslSimIp, 'ROLR', nextRolr);

  assignSequence(assignments, cfs, 'ALDN', 1);

  const nextVipr = assignSequence(assignments, twoFts, 'VIPR', 1);
  assignSequence(assignments, peaSimIp, 'VIPR', nextVipr);

  return assignments;
};

export const getStaffCallsignKey = personKey;
