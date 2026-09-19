import { Instructor, PersonnelPreferences, SyllabusItemDetail } from '../types';

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

export interface FlightSchoolStaffLmpAssignment {
  assignmentId: string;
  lmpCode: string;
  title: string;
  locationCode?: string;
  unitCode?: string;
  assignedAt: string;
  assignedBy?: string;
}

export const getFlightSchoolStaffLmpKey = (
  lmpCode: string,
  locationCode?: string,
  unitCode?: string,
): string => [
  'flight_school',
  normaliseCode(locationCode) || 'GLOBAL',
  normaliseCode(unitCode) || 'GLOBAL',
  'master_lmp',
  normaliseCode(lmpCode),
].join(':');

export const getFlightSchoolStaffLmpAssignmentFromItem = (
  item: SyllabusItemDetail,
  lmpCode: string,
  locationCode: string,
  unitCode: string,
  assignedBy?: string,
): FlightSchoolStaffLmpAssignment => {
  const code = String(lmpCode || (item.courses || []).find(Boolean) || item.code || '').trim();
  const assignmentLocation = normaliseCode(locationCode || item.location);
  const assignmentUnit = normaliseCode(unitCode || item.unit);
  const assignmentId = getFlightSchoolStaffLmpKey(code, assignmentLocation, assignmentUnit);
  return {
    assignmentId,
    lmpCode: code,
    title: String(item.module || item.phase || item.eventDescription || code),
    locationCode: assignmentLocation,
    unitCode: assignmentUnit,
    assignedAt: new Date().toISOString(),
    assignedBy,
  };
};

export const normaliseFlightSchoolStaffLmpAssignments = (
  preferences?: PersonnelPreferences | null,
): FlightSchoolStaffLmpAssignment[] => {
  const raw = preferences?.flightSchool?.masterLmpAssignments;
  return (Array.isArray(raw) ? raw : [])
    .map((item: any): FlightSchoolStaffLmpAssignment | null => {
      const lmpCode = String(item.lmpCode || item.code || '').trim();
      if (!lmpCode) return null;
      const locationCode = normaliseCode(item.locationCode);
      const unitCode = normaliseCode(item.unitCode);
      const assignmentId = String(item.assignmentId || getFlightSchoolStaffLmpKey(lmpCode, locationCode, unitCode));
      return {
        assignmentId,
        lmpCode,
        title: String(item.title || lmpCode),
        locationCode,
        unitCode,
        assignedAt: String(item.assignedAt || ''),
        assignedBy: item.assignedBy ? String(item.assignedBy) : undefined,
      };
    })
    .filter(Boolean) as FlightSchoolStaffLmpAssignment[];
};

export const setFlightSchoolStaffLmpAssignment = (
  instructor: Instructor,
  assignment: FlightSchoolStaffLmpAssignment,
  assigned: boolean,
): Instructor => {
  const preferences = { ...(instructor.preferences || {}) } as PersonnelPreferences;
  const current = normaliseFlightSchoolStaffLmpAssignments(preferences);
  const nextAssignments = assigned
    ? [
        ...current.filter(item => item.assignmentId !== assignment.assignmentId),
        assignment,
      ]
    : current.filter(item => item.assignmentId !== assignment.assignmentId);

  return {
    ...instructor,
    preferences: {
      ...preferences,
      flightSchool: {
        ...(preferences.flightSchool || {}),
        masterLmpAssignments: nextAssignments,
      },
    },
  };
};

export const staffHasFlightSchoolStaffLmpAssignment = (
  instructor: Instructor,
  assignment: FlightSchoolStaffLmpAssignment,
): boolean => (
  normaliseFlightSchoolStaffLmpAssignments(instructor.preferences)
    .some(item => item.assignmentId === assignment.assignmentId)
);
