import { SyllabusItemDetail } from '../types';

export type FixedCrewTrainingKind = 'course' | 'training_package';

export interface FixedCrewTrainingStreamPriority {
  key: string;
  kind: FixedCrewTrainingKind;
  code: string;
  title?: string;
  locationCode?: string;
  unitCode?: string;
  weight: number;
  enabled: boolean;
}

export const FIXED_CREW_COURSE_PACKAGE_PREFLIGHT_HOURS = 1.5;
export const FIXED_CREW_COURSE_PACKAGE_POSTFLIGHT_HOURS = 1;

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

export const getFixedCrewCoursePackageBriefingTimes = (): { preFlightTime: number; postFlightTime: number } => ({
  preFlightTime: FIXED_CREW_COURSE_PACKAGE_PREFLIGHT_HOURS,
  postFlightTime: FIXED_CREW_COURSE_PACKAGE_POSTFLIGHT_HOURS,
});

export const withFixedCrewCoursePackageBriefingTimes = <T extends Pick<SyllabusItemDetail, 'preFlightTime' | 'postFlightTime'>>(
  item: T,
): T => ({
  ...item,
  preFlightTime: FIXED_CREW_COURSE_PACKAGE_PREFLIGHT_HOURS,
  postFlightTime: FIXED_CREW_COURSE_PACKAGE_POSTFLIGHT_HOURS,
});

export const getFixedCrewTrainingKindForLmpType = (lmpType?: string | null): FixedCrewTrainingKind => (
  lmpType === 'Staff CAT' ? 'training_package' : 'course'
);

export const getFixedCrewTrainingKey = (
  kind: FixedCrewTrainingKind,
  code: string,
  locationCode?: string,
  unitCode?: string,
): string => [
  'fixed_crew',
  normaliseCode(locationCode) || 'GLOBAL',
  normaliseCode(unitCode) || 'GLOBAL',
  kind,
  normaliseCode(code),
].join(':');

export const getFixedCrewTrainingCodeFromItem = (item: SyllabusItemDetail): string => (
  (item.courses || []).find(Boolean) || item.code || ''
);

export const getFixedCrewTrainingTitleFromItem = (item: SyllabusItemDetail): string => {
  const code = getFixedCrewTrainingCodeFromItem(item);
  return item.module && item.module !== code ? item.module : (item.eventDescription || code);
};

export const normaliseFixedCrewTrainingPriorities = (
  streams?: Partial<FixedCrewTrainingStreamPriority>[] | null,
): FixedCrewTrainingStreamPriority[] => {
  if (!Array.isArray(streams)) return [];
  return streams
    .map((stream: Partial<FixedCrewTrainingStreamPriority>) => {
      const kind: FixedCrewTrainingKind = stream.kind === 'training_package' ? 'training_package' : 'course';
      const code = String(stream.code || '').trim();
      if (!code) return null;
      const locationCode = normaliseCode(stream.locationCode);
      const unitCode = normaliseCode(stream.unitCode);
      const key = String(stream.key || getFixedCrewTrainingKey(kind, code, locationCode, unitCode));
      const weight = Math.max(0, Math.min(100, Math.round(Number(stream.weight) || 0)));
      return {
        key,
        kind,
        code,
        title: stream.title ? String(stream.title) : code,
        locationCode,
        unitCode,
        weight,
        enabled: stream.enabled !== false,
      };
    })
    .filter(Boolean) as FixedCrewTrainingStreamPriority[];
};

export const normaliseFixedCrewTrainingPriorityWeights = (
  streams?: Partial<FixedCrewTrainingStreamPriority>[] | null,
): FixedCrewTrainingStreamPriority[] => {
  const normalised = normaliseFixedCrewTrainingPriorities(streams);
  const enabled = normalised.filter(stream => stream.enabled);
  if (enabled.length === 0) {
    return normalised.map(stream => ({ ...stream, weight: 0 }));
  }

  const enabledTotal = enabled.reduce((sum, stream) => sum + stream.weight, 0);
  const fallbackWeight = enabledTotal > 0 ? 0 : 1;
  const weighted = normalised.map(stream => ({
    ...stream,
    weight: stream.enabled ? (enabledTotal > 0 ? stream.weight : fallbackWeight) : 0,
  }));
  const activeTotal = weighted.reduce((sum, stream) => stream.enabled ? sum + stream.weight : sum, 0);

  let runningTotal = 0;
  let activeIndex = 0;
  const activeCount = weighted.filter(stream => stream.enabled).length;
  return weighted.map(stream => {
    if (!stream.enabled) return { ...stream, weight: 0 };
    activeIndex += 1;
    const isLastActive = activeIndex === activeCount;
    const weight = isLastActive ? Math.max(0, 100 - runningTotal) : Math.round((stream.weight / activeTotal) * 100);
    runningTotal += weight;
    return { ...stream, weight };
  });
};
