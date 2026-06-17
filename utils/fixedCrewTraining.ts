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

const normaliseCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

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
