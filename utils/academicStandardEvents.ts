export type AcademicStandardEventConfig = {
  code: string;
  label: string;
  duration: number;
  color: string;
};

export const DEFAULT_ACADEMIC_STANDARD_EVENTS: AcademicStandardEventConfig[] = [
  { code: 'MORNING_BREAK', label: 'Morning Break', duration: 0.25, color: '#64748b' },
  { code: 'LUNCH', label: 'Lunch', duration: 1.0, color: '#78716c' },
  { code: 'AFTERNOON_BREAK', label: 'Afternoon Break', duration: 0.25, color: '#64748b' },
  { code: 'SELF_STUDY', label: 'Self-Study', duration: 1.0, color: '#475569' },
  { code: 'SPORT', label: 'Sport', duration: 1.0, color: '#15803d' },
  { code: 'ADMIN', label: 'Admin', duration: 0.5, color: '#7c3aed' },
  { code: 'FREE_TIME', label: 'Free Time', duration: 1.0, color: '#0f766e' },
  { code: 'OTHER', label: 'Other', duration: 1.0, color: '#b45309' },
];

const DEFAULT_COLORS = ['#64748b', '#78716c', '#475569', '#15803d', '#7c3aed', '#0f766e', '#b45309', '#1d4ed8'];

export const createAcademicStandardEventCode = (label: unknown, index = 0): string => {
  const token = String(label || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || `STANDARD_EVENT_${index + 1}`;
};

export const normaliseAcademicStandardEvents = (
  value: unknown,
  fallback: AcademicStandardEventConfig[] = DEFAULT_ACADEMIC_STANDARD_EVENTS,
): AcademicStandardEventConfig[] => {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source
    .map((item: any, index) => {
      const label = String(item?.label || item?.name || '').trim();
      if (!label) return null;
      const duration = Number(item?.duration);
      return {
        code: String(item?.code || createAcademicStandardEventCode(label, index)).trim().toUpperCase(),
        label,
        duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
        color: String(item?.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]),
      };
    })
    .filter(Boolean) as AcademicStandardEventConfig[];
};

export const formatAcademicStandardEventsText = (value: unknown): string => (
  normaliseAcademicStandardEvents(value)
    .map(event => `${event.label}|${event.duration}|${event.color}`)
    .join('\n')
);
