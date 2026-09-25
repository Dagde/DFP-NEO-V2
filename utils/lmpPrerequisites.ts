import type { SyllabusItemDetail } from '../types';

export const normaliseLmpPrerequisiteKey = (value?: string | null): string => (
  String(value || '').replace(/\*/g, '').trim()
);

export const getAllLmpPrerequisiteKeys = (item?: Partial<SyllabusItemDetail> | null): string[] => {
  if (!item) return [];
  const values = [
    ...(item.prerequisites || []),
    ...(item.prerequisitesGround || []),
    ...(item.prerequisitesFlying || []),
  ];
  return Array.from(new Set(values.map(normaliseLmpPrerequisiteKey).filter(Boolean)));
};

export const areAllLmpPrerequisitesMet = (
  item: Partial<SyllabusItemDetail> | null | undefined,
  completedEventIds: Set<string>,
): boolean => (
  getAllLmpPrerequisiteKeys(item).every(prerequisite => completedEventIds.has(prerequisite))
);
