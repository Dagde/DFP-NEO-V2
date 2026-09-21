import type { Course } from '../types';

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
): CourseStudentGroupCount[] => {
  const labels = getCourseStudentGroupLabels(definitions);
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
