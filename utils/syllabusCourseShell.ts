import type { SyllabusItemDetail } from '../types';

export const SYLLABUS_COURSE_SHELL_NOTE = '[DFP_COURSE_SHELL]';

export const isSyllabusCourseShell = (item?: Partial<SyllabusItemDetail> | null): boolean => (
  String(item?.notes || '').includes(SYLLABUS_COURSE_SHELL_NOTE)
);

