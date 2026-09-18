export type ClassroomResourceOption = {
  id: string;
  label: string;
};

export const parseClassroomNames = (value: unknown): string[] => {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);
  const seen = new Set<string>();
  return rawItems
    .map((item) => String(item ?? '').trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getConfiguredClassroomNames = (settings: any): string[] => (
  parseClassroomNames(settings?.classrooms ?? settings?.classroomNames ?? settings?.groundClassrooms)
);

export const formatClassroomNames = (value: unknown): string => (
  parseClassroomNames(value).join('\n')
);

export const buildClassroomResourceOptions = (
  settings: any,
  groundCount: number,
): ClassroomResourceOption[] => {
  const names = getConfiguredClassroomNames(settings);
  const count = Math.max(0, Math.floor(Number(groundCount) || 0));
  return Array.from({ length: count }, (_, index) => {
    const id = `Ground ${index + 1}`;
    return {
      id,
      label: names[index] || id,
    };
  });
};
