import type { Instructor, StaffCallsignInfo } from '../types';
import type { PersonnelDisplaySettings } from './personnelDisplaySettings';
import type { UnitCallsignSettings } from './unitCallsigns';

const personKey = (person: Instructor): string =>
  String((person as any).id || person.idNumber || person.name || '').trim();

export const getStaffCallsignAssignments = (
  _instructors: Instructor[],
  _settings?: PersonnelDisplaySettings,
  _unitCallsignSettings?: UnitCallsignSettings,
): Map<string, StaffCallsignInfo> => {
  return new Map<string, StaffCallsignInfo>();
};

export const getStaffCallsignKey = personKey;
