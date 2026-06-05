import {
  AirCombatTrainingAssignment,
  AirCombatTrainingAssignments,
  Instructor,
  PersonnelPreferences,
  SyllabusItemDetail,
} from '../types';

export type AirCombatTrainingKind = AirCombatTrainingAssignment['kind'];

export interface AirCombatSchedulingWeights {
  courses: number;
  trainingPackages: number;
}

export const DEFAULT_AIR_COMBAT_SCHEDULING_WEIGHTS: AirCombatSchedulingWeights = {
  courses: 60,
  trainingPackages: 40,
};

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

export const getAirCombatTrainingKindForLmpType = (lmpType?: string | null): AirCombatTrainingKind => (
  lmpType === 'Staff CAT' ? 'training_package' : 'course'
);

export const getAirCombatTrainingKey = (
  kind: AirCombatTrainingKind,
  code: string,
  locationCode?: string,
  unitCode?: string,
): string => [
  'air_combat',
  normaliseCode(locationCode) || 'GLOBAL',
  normaliseCode(unitCode) || 'GLOBAL',
  kind,
  normaliseCode(code),
].join(':');

export const getAirCombatTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
  (item.courses || []).find(Boolean) || item.code || ''
);

export const getAirCombatTrainingTitleFromItem = (item: SyllabusItemDetail): string => {
  const code = getAirCombatTrainingCodeFromItem(item);
  return item.module && item.module !== code ? item.module : (item.eventDescription || code);
};

export const getAirCombatAssignmentFromItem = (
  item: SyllabusItemDetail,
  locationCode: string,
  unitCode: string,
  assignedBy?: string,
): AirCombatTrainingAssignment => {
  const kind = getAirCombatTrainingKindForLmpType(item.lmpType);
  const code = getAirCombatTrainingCodeFromItem(item);
  const assignmentLocation = normaliseCode(locationCode || item.location);
  const assignmentUnit = normaliseCode(unitCode || item.unit);
  const trainingKey = getAirCombatTrainingKey(kind, code, assignmentLocation, assignmentUnit);
  return {
    assignmentId: trainingKey,
    kind,
    trainingKey,
    lmpType: kind === 'training_package' ? 'Staff CAT' : 'Master LMP',
    code,
    title: getAirCombatTrainingTitleFromItem(item),
    locationCode: assignmentLocation,
    unitCode: assignmentUnit,
    operationalModel: 'air_combat',
    assignedAt: new Date().toISOString(),
    assignedBy,
  };
};

export const normaliseAirCombatTrainingAssignments = (preferences?: PersonnelPreferences | null): AirCombatTrainingAssignments => {
  const raw = preferences?.airCombat?.trainingAssignments || {};
  const normaliseList = (items: any[] | undefined, kind: AirCombatTrainingKind): AirCombatTrainingAssignment[] => (
    Array.isArray(items) ? items : []
  )
    .map((item: any) => {
      const code = String(item.code || '').trim();
      if (!code) return null;
      const locationCode = normaliseCode(item.locationCode);
      const unitCode = normaliseCode(item.unitCode);
      const trainingKey = String(item.trainingKey || getAirCombatTrainingKey(kind, code, locationCode, unitCode));
      return {
        assignmentId: String(item.assignmentId || trainingKey),
        kind,
        trainingKey,
        lmpType: kind === 'training_package' ? 'Staff CAT' : 'Master LMP',
        code,
        title: String(item.title || code),
        locationCode,
        unitCode,
        operationalModel: 'air_combat' as const,
        assignedAt: String(item.assignedAt || ''),
        assignedBy: item.assignedBy ? String(item.assignedBy) : undefined,
      };
    })
    .filter(Boolean) as AirCombatTrainingAssignment[];

  return {
    courses: normaliseList(raw.courses, 'course'),
    trainingPackages: normaliseList(raw.trainingPackages, 'training_package'),
  };
};

export const setAirCombatTrainingAssignment = (
  instructor: Instructor,
  assignment: AirCombatTrainingAssignment,
  assigned: boolean,
): Instructor => {
  const preferences = { ...(instructor.preferences || {}) } as PersonnelPreferences;
  const current = normaliseAirCombatTrainingAssignments(preferences);
  const field = assignment.kind === 'training_package' ? 'trainingPackages' : 'courses';
  const nextList = assigned
    ? [
        ...current[field].filter(item => item.trainingKey !== assignment.trainingKey),
        assignment,
      ]
    : current[field].filter(item => item.trainingKey !== assignment.trainingKey);

  return {
    ...instructor,
    preferences: {
      ...preferences,
      airCombat: {
        ...(preferences.airCombat || {}),
        trainingAssignments: {
          ...current,
          [field]: nextList,
        },
      },
    },
  };
};

export const staffHasAirCombatAssignment = (
  instructor: Instructor,
  assignment: AirCombatTrainingAssignment,
): boolean => {
  const assignments = normaliseAirCombatTrainingAssignments(instructor.preferences);
  const list = assignment.kind === 'training_package' ? assignments.trainingPackages : assignments.courses;
  return list.some(item => item.trainingKey === assignment.trainingKey);
};

export const normaliseAirCombatSchedulingWeights = (value: any): AirCombatSchedulingWeights => {
  const courses = Number(value?.courses);
  const trainingPackages = Number(value?.trainingPackages);
  if (!Number.isFinite(courses) || !Number.isFinite(trainingPackages) || courses + trainingPackages <= 0) {
    return DEFAULT_AIR_COMBAT_SCHEDULING_WEIGHTS;
  }
  const total = courses + trainingPackages;
  return {
    courses: Math.round((courses / total) * 100),
    trainingPackages: 100 - Math.round((courses / total) * 100),
  };
};

