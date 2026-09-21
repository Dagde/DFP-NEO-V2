import type { Course, Trainee } from '../types';
import { resolveConfiguredServiceName, servicesMatchConfiguredName } from './serviceAliases';

export type CourseStudentGroupDefinition = {
  longName?: string;
  shortName?: string;
};

export type CourseStudentGroupCount = {
  label: string;
  count: number;
};

export const MAX_COURSE_STUDENT_GROUPS = 4;

export const DEFAULT_COURSE_STUDENT_GROUPS: Required<CourseStudentGroupDefinition>[] = [
  { longName: 'Group 1', shortName: 'Group 1' },
  { longName: 'Group 2', shortName: 'Group 2' },
  { longName: 'Group 3', shortName: 'Group 3' },
];

export const normaliseCourseStudentGroups = (
  definitions: CourseStudentGroupDefinition[] = [],
  options: { useFallback?: boolean } = {},
): Required<CourseStudentGroupDefinition>[] => {
  const rows = definitions
    .slice(0, MAX_COURSE_STUDENT_GROUPS)
    .map((definition) => {
      const longName = String(definition?.longName || '').trim();
      const shortName = String(definition?.shortName || '').trim();
      const label = shortName || longName;
      return {
        longName: longName || label,
        shortName: shortName || label,
      };
    })
    .filter((definition) => definition.longName || definition.shortName);

  if (rows.length > 0 || options.useFallback === false) return rows;
  return DEFAULT_COURSE_STUDENT_GROUPS;
};

export const getCourseStudentGroupLabels = (
  definitions: CourseStudentGroupDefinition[] = [],
  options: { useFallback?: boolean } = {},
): string[] => normaliseCourseStudentGroups(definitions, options)
  .map((definition) => definition.shortName || definition.longName)
  .filter(Boolean);

export const getCourseStudentGroupCounts = (
  course: Pick<Course, 'raafStart' | 'navyStart' | 'armyStart'>,
  definitions: CourseStudentGroupDefinition[] = [],
  trainees?: Pick<Trainee, 'course' | 'service'>[],
): CourseStudentGroupCount[] => {
  const labels = getCourseStudentGroupLabels(definitions);
  if (Array.isArray(trainees)) {
    const courseName = 'name' in course ? String((course as Course).name || '').trim().toUpperCase() : '';
    const traineesForCourse = trainees.filter((trainee) => (
      String(trainee.course || '').trim().toUpperCase() === courseName
    ));
    const configuredServices = labels.slice(0, MAX_COURSE_STUDENT_GROUPS);
    return labels.slice(0, MAX_COURSE_STUDENT_GROUPS).map((label) => {
      return {
        label,
        count: traineesForCourse.filter((trainee) => servicesMatchConfiguredName(trainee.service, label, configuredServices)).length,
      };
    });
  }
  const storedCounts = [
    Number(course.raafStart) || 0,
    Number(course.navyStart) || 0,
    Number(course.armyStart) || 0,
    0,
  ];

  return labels.slice(0, MAX_COURSE_STUDENT_GROUPS).map((label, index) => ({
    label,
    count: storedCounts[index] || 0,
  }));
};

export const getTraineeServiceOptions = (
  trainees: Pick<Trainee, 'service'>[] = [],
  configuredServices: string[] = [],
): string[] => Array.from(new Set(
  trainees
    .map((trainee) => resolveConfiguredServiceName(trainee.service, configuredServices))
    .filter(Boolean),
)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
