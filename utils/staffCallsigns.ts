import type { Instructor, StaffCallsignInfo } from '../types';
import {
  comparePeopleByConfiguredRank,
  type PersonnelDisplaySettings,
} from './personnelDisplaySettings';
import {
  getDefaultUnitCallsign,
  getUnitCallsignPolicy,
  normaliseUnitCallsignSettings,
  type UnitCallsignSettings,
} from './unitCallsigns';

const CALLSIGN_LIMIT = 50;

const norm = (value?: string | null): string => String(value || '').trim().toUpperCase();
const normPolicyToken = (value?: string | null): string => (
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
);

const personKey = (person: Instructor): string =>
  String((person as any).id || person.idNumber || person.name || '').trim();

const isCallsignAssignableStaff = (person: Instructor): boolean => (
  Boolean(person.name) && (person as any).isActive !== false && !person.isAdminStaff
);

const matchesPermanentCallsignRolePolicy = (person: Instructor, allowedRoles: string[] = []): boolean => {
  if (allowedRoles.length === 0) return false;
  const role = norm(person.role);
  const category = norm(person.category);
  const crew = norm(person.crew);
  const personTokens = new Set<string>();
  const addToken = (value?: string | null) => {
    const raw = norm(value);
    const policy = normPolicyToken(value);
    if (raw) personTokens.add(raw);
    if (policy) personTokens.add(policy);
  };

  addToken(role);
  addToken(category);
  addToken(crew);
  if (person.isQFI) {
    addToken('QFI');
    addToken('Qualified Flying Instructor');
  }
  if (person.isOFI) addToken('OFI');
  if (person.isCFI) addToken('CFI');
  if (person.isCommandingOfficer) addToken('CO');
  if (person.isExecutive) addToken('Executive');
  if (person.isFlyingSupervisor) addToken('Flying Supervisor');
  if (person.isTestingOfficer) addToken('Testing Officer');
  if (person.isIRE) addToken('IRE');
  if (person.isDeputyFlightCommander) addToken('Deputy Flight Commander');
  if (person.isContractor) addToken('Contractor');
  (person.preferences?.qualifications || []).forEach(qualification => addToken(String(qualification || '')));

  return allowedRoles.some((token) => {
    const value = norm(token);
    const policyValue = normPolicyToken(token);
    if (!value) return false;
    if (personTokens.has(value) || personTokens.has(policyValue)) return true;
    if (value === role) return true;
    if (value.startsWith('ROLE:') && value.slice(5) === role) return true;
    if (category && (value === category || value === `CATEGORY:${category}`)) return true;
    if (crew && (value === crew || value === `CREW:${crew}`)) return true;
    if (value.startsWith('QUALIFICATION:')) {
      const qualificationValue = value.slice(14);
      return personTokens.has(qualificationValue) || personTokens.has(normPolicyToken(qualificationValue));
    }
    return false;
  });
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

const getConfiguredPermanentCallsignAssignments = (
  instructors: Instructor[],
  settings?: PersonnelDisplaySettings,
  unitCallsignSettings?: UnitCallsignSettings,
): Map<string, StaffCallsignInfo> => {
  const assignments = new Map<string, StaffCallsignInfo>();
  const callsignSettings = normaliseUnitCallsignSettings(unitCallsignSettings || null);
  const permanentUnitCodes = Array.from(new Set(
    callsignSettings.entries
      .map((entry) => entry.unitCode)
      .filter((unitCode) => (
        unitCode
        && getUnitCallsignPolicy(callsignSettings, unitCode).allocationMethod === 'permanent'
        && getDefaultUnitCallsign(callsignSettings, unitCode)
      )),
  ));

  permanentUnitCodes.forEach((unitCode) => {
    const prefix = getDefaultUnitCallsign(callsignSettings, unitCode);
    if (!prefix) return;
    const policy = getUnitCallsignPolicy(callsignSettings, unitCode);
    const unitStaff = sortedStaff(instructors.filter((person) => (
      person.name
      && (person as any).isActive !== false
      && norm(person.unit) === unitCode
      && isCallsignAssignableStaff(person)
      && matchesPermanentCallsignRolePolicy(person, policy.permanentRoleValues || [])
    )), settings);
    assignSequence(assignments, unitStaff, prefix, 1);
  });

  return assignments;
};

export const getStaffCallsignAssignments = (
  instructors: Instructor[],
  settings?: PersonnelDisplaySettings,
  unitCallsignSettings?: UnitCallsignSettings,
): Map<string, StaffCallsignInfo> => {
  return getConfiguredPermanentCallsignAssignments(
    instructors,
    settings,
    unitCallsignSettings,
  );
};

export const getStaffCallsignKey = personKey;
