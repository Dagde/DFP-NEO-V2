import type { SyllabusItemDetail } from '../types';
import { isSyllabusCourseShell } from './syllabusCourseShell';

export type LmpAudience = 'staff' | 'trainee';

const AUDIENCE_NOTE_REGEX = /\[DFP_LMP_AUDIENCE:(staff|trainee)\]/i;

export const normaliseLmpAudience = (value?: string | null): LmpAudience | null => {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'staff') return 'staff';
  if (clean === 'trainee') return 'trainee';
  return null;
};

export const getLmpAudienceFromNotes = (notes?: string | null): LmpAudience | null => {
  const match = String(notes || '').match(AUDIENCE_NOTE_REGEX);
  return normaliseLmpAudience(match?.[1]);
};

export const withLmpAudienceInNotes = (notes: string | undefined | null, audience: LmpAudience): string => {
  const withoutAudience = String(notes || '').replace(AUDIENCE_NOTE_REGEX, '').replace(/\n{3,}/g, '\n\n').trim();
  return [withoutAudience, `[DFP_LMP_AUDIENCE:${audience}]`].filter(Boolean).join('\n');
};

export const getDefaultLmpAudience = (
  options: {
    lmpType?: string | null;
    activeTab?: 'master' | 'packages' | string;
    operationalModel?: string | null;
  } = {},
): LmpAudience => {
  if (String(options.lmpType || '').trim() === 'Staff CAT') return 'staff';
  if (options.activeTab === 'packages') return 'staff';
  if (String(options.operationalModel || '').trim().toLowerCase() === 'flight_school') return 'trainee';
  return 'staff';
};

export const getLmpAudienceForCourse = (
  items: SyllabusItemDetail[],
  courseCode: string,
  options: {
    activeTab?: 'master' | 'packages' | string;
    operationalModel?: string | null;
    lmpType?: string | null;
    catalogueAudience?: string | null;
  } = {},
): LmpAudience => {
  const catalogueAudience = normaliseLmpAudience(options.catalogueAudience);
  if (catalogueAudience) return catalogueAudience;
  const courseKey = String(courseCode || '').trim().toUpperCase();
  const matchingItems = items.filter(item => (
    item?.isActive !== false &&
    Array.isArray(item.courses) &&
    item.courses.some(course => String(course || '').trim().toUpperCase() === courseKey)
  ));
  const shellAudience = matchingItems
    .filter(isSyllabusCourseShell)
    .map(item => getLmpAudienceFromNotes(item.notes))
    .find(Boolean);
  if (shellAudience) return shellAudience;
  const anyAudience = matchingItems
    .map(item => getLmpAudienceFromNotes(item.notes))
    .find(Boolean);
  return anyAudience || getDefaultLmpAudience(options);
};
