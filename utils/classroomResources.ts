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
  (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()) : parseClassroomNames(value)).join('\n')
);

export const getClassroomNamesForRows = (value: unknown, rowCount: number): string[] => {
  const count = Math.max(0, Math.floor(Number(rowCount) || 0));
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '').includes('\n')
      ? String(value || '').split(/\n/)
      : String(value || '').split(/,/);
  return Array.from({ length: count }, (_, index) => String(rawItems[index] ?? '').trim());
};

export const updateClassroomNameForRow = (
  value: unknown,
  rowCount: number,
  rowIndex: number,
  nextName: string,
): string[] => {
  const names = getClassroomNamesForRows(value, rowCount);
  if (rowIndex >= 0 && rowIndex < names.length) names[rowIndex] = nextName;
  return names;
};

export const formatClassroomRowLabel = (index: number): string => (
  `Ground ${index + 1}`
);

export const formatClassroomFieldLabel = (index: number): string => (
  `Classroom ${index + 1}`
);

export const buildClassroomResourceOptions = (
  settings: any,
  groundCount: number,
): ClassroomResourceOption[] => {
  const count = Math.max(0, Math.floor(Number(groundCount) || 0));
  const names = getClassroomNamesForRows(settings?.classrooms ?? settings?.classroomNames ?? settings?.groundClassrooms, count);
  return Array.from({ length: count }, (_, index) => {
    const id = formatClassroomRowLabel(index);
    return {
      id,
      label: names[index] || formatClassroomFieldLabel(index),
    };
  });
};
