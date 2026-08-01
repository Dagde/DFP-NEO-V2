import type { ScheduleEvent } from '../types';

export type FixedCrewTileColourMode = 'event_type' | 'crew';

export interface FixedCrewTileColourKeyItem {
  key: string;
  label: string;
  color: string;
}

export const DEFAULT_FIXED_CREW_TILE_COLOUR_MODE: FixedCrewTileColourMode = 'event_type';

const EVENT_TYPE_COLOURS: Record<string, FixedCrewTileColourKeyItem> = {
  task: { key: 'task', label: 'Directed Task', color: 'bg-cyan-500/70' },
  currency: { key: 'currency', label: 'Currency', color: 'bg-violet-500/70' },
  course: { key: 'course', label: 'Course', color: 'bg-sky-500/70' },
  package: { key: 'package', label: 'Package', color: 'bg-green-500/70' },
  other: { key: 'other', label: 'Other', color: 'bg-gray-500/70' },
};

const EVENT_TYPE_ORDER = ['task', 'currency', 'course', 'package', 'other'];

const CREW_COLOURS = [
  'bg-sky-500/70',
  'bg-green-500/70',
  'bg-violet-500/70',
  'bg-amber-500/70',
  'bg-cyan-500/70',
  'bg-fuchsia-500/70',
  'bg-teal-500/70',
  'bg-orange-500/70',
  'bg-blue-500/70',
  'bg-rose-500/70',
  'bg-lime-500/70',
  'bg-purple-500/70',
];

export const normaliseFixedCrewTileColourMode = (value: unknown): FixedCrewTileColourMode => (
  value === 'crew' ? 'crew' : DEFAULT_FIXED_CREW_TILE_COLOUR_MODE
);

export const normaliseFixedCrewTileColourModeByUnit = (value: unknown): Record<string, FixedCrewTileColourMode> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([unitCode, mode]) => [
        String(unitCode || '').trim().toUpperCase(),
        normaliseFixedCrewTileColourMode(mode),
      ])
      .filter(([unitCode]) => Boolean(unitCode))
  ) as Record<string, FixedCrewTileColourMode>;
};

export const getFixedCrewTileColourModeForUnit = (
  modesByUnit: Record<string, FixedCrewTileColourMode> | undefined,
  unitCode: string
): FixedCrewTileColourMode => {
  const key = String(unitCode || '').trim().toUpperCase() || 'DEFAULT';
  return normaliseFixedCrewTileColourMode(modesByUnit?.[key] || modesByUnit?.DEFAULT);
};

const normaliseCrewValue = (value: unknown): string => (
  String(value || '').trim().replace(/^CREW\s*/i, '').trim()
);

const parseScopedCrewValue = (crew: string): { unit: string; crew: string } => {
  const parts = String(crew || '').split('::');
  if (parts.length <= 1) return { unit: '', crew: normaliseCrewValue(crew) };
  return {
    unit: parts[0],
    crew: normaliseCrewValue(parts.slice(1).join('::')),
  };
};

const formatCrewKeyLabel = (crew: string): string => {
  const parsed = parseScopedCrewValue(crew);
  return parsed.unit ? `${parsed.unit} Crew ${parsed.crew}` : `Crew ${parsed.crew}`;
};

export const getFixedCrewGroupForTileColour = (event: Partial<ScheduleEvent>): string => {
  const explicit = normaliseCrewValue((event as any).fixedCrewGroup);
  if (explicit) return explicit;
  return normaliseCrewValue(event.crew || event.group || event.student);
};

export const isFixedCrewScheduleEvent = (event: Partial<ScheduleEvent>): boolean => {
  const source = String((event as any)._source || '').trim().toLowerCase();
  return Boolean(
    getFixedCrewGroupForTileColour(event) ||
    source.startsWith('fixed-crew') ||
    source.includes('fixed-crew')
  );
};

const getFixedCrewEventTypeColourKey = (event: Partial<ScheduleEvent>): string => {
  const source = String((event as any)._source || '').trim().toLowerCase();
  const category = String(event.eventCategory || '').trim().toLowerCase();
  const flightNumber = String(event.flightNumber || '').trim().toUpperCase();

  if (event.isTaskingRequest || event.taskingRequestId || event.taskingName || source.includes('task')) return 'task';
  if (event.currencyDraftId || event.currency || category === 'currency' || category === 'lmp_currency' || source.includes('currency') || flightNumber === 'CURR') return 'currency';
  if (source === 'fixed-crew-course' || category === 'lmp_event') return 'course';
  if (source === 'fixed-crew-package' || category === 'staff_cat') return 'package';
  return 'other';
};

const getCrewColour = (crew: string): string => {
  if (String(crew || '').includes('::')) {
    const hash = String(crew || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    return CREW_COLOURS[Math.abs(hash) % CREW_COLOURS.length];
  }
  const numeric = Number(String(crew).match(/\d+/)?.[0]);
  if (Number.isFinite(numeric) && numeric > 0) return CREW_COLOURS[(numeric - 1) % CREW_COLOURS.length];
  const hash = String(crew || '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return CREW_COLOURS[Math.abs(hash) % CREW_COLOURS.length];
};

export const resolveFixedCrewTileColour = (
  event: Partial<ScheduleEvent>,
  mode: FixedCrewTileColourMode
): string => {
  if (mode === 'crew') {
    const crew = getFixedCrewGroupForTileColour(event);
    return crew ? getCrewColour(crew) : EVENT_TYPE_COLOURS.other.color;
  }
  return EVENT_TYPE_COLOURS[getFixedCrewEventTypeColourKey(event)]?.color || EVENT_TYPE_COLOURS.other.color;
};

export const applyFixedCrewTileColour = <T extends Partial<ScheduleEvent>>(
  event: T,
  mode: FixedCrewTileColourMode
): T => (
  isFixedCrewScheduleEvent(event)
    ? { ...event, color: resolveFixedCrewTileColour(event, mode) } as T
    : event
);

export const buildFixedCrewTileColourKey = (
  events: Array<Partial<ScheduleEvent>>,
  mode: FixedCrewTileColourMode
): FixedCrewTileColourKeyItem[] => {
  const fixedCrewEvents = events.filter(isFixedCrewScheduleEvent);
  if (mode === 'crew') {
    const crews = Array.from(new Set(fixedCrewEvents.map(getFixedCrewGroupForTileColour).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
    return crews.map(crew => ({
      key: `crew:${crew}`,
      label: formatCrewKeyLabel(crew),
      color: getCrewColour(crew),
    }));
  }

  const presentTypes = new Set(fixedCrewEvents.map(getFixedCrewEventTypeColourKey));
  return EVENT_TYPE_ORDER
    .filter(key => key !== 'other' || presentTypes.has('other'))
    .filter(key => key === 'other' ? presentTypes.has('other') : true)
    .map(key => EVENT_TYPE_COLOURS[key]);
};
