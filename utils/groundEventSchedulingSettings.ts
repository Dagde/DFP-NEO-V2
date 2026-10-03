export type GroundEventSchedulingMode = 'automatic' | 'suggest' | 'manual';

export interface GroundEventSchedulingWindow {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface GroundEventTypeSchedulingRule {
  mode: GroundEventSchedulingMode;
  preferredWindows: string[];
}

export interface GroundEventSchedulingSettings {
  byEventType: Record<string, GroundEventTypeSchedulingRule>;
}

export const GROUND_EVENT_SCHEDULING_WINDOWS: GroundEventSchedulingWindow[] = [
  { id: '0800-1000', label: '0800-1000', start: 8, end: 10 },
  { id: '1000-1200', label: '1000-1200', start: 10, end: 12 },
  { id: '1200-1400', label: '1200-1400', start: 12, end: 14 },
  { id: '1400-1600', label: '1400-1600', start: 14, end: 16 },
  { id: '1600-1800', label: '1600-1800', start: 16, end: 18 },
];

export const DEFAULT_GROUND_EVENT_TYPE_SCHEDULING_RULE: GroundEventTypeSchedulingRule = {
  mode: 'manual',
  preferredWindows: [],
};

export const DEFAULT_GROUND_EVENT_SCHEDULING_SETTINGS: GroundEventSchedulingSettings = {
  byEventType: {},
};

const VALID_GROUND_EVENT_SCHEDULING_MODES = new Set<GroundEventSchedulingMode>(['automatic', 'suggest', 'manual']);
const VALID_WINDOW_IDS = new Set(GROUND_EVENT_SCHEDULING_WINDOWS.map(window => window.id));

export const normaliseGroundEventTypeKey = (value: unknown): string => (
  String(value || 'Ground School').trim() || 'Ground School'
);

export const normaliseGroundEventSchedulingRule = (value: unknown): GroundEventTypeSchedulingRule => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<GroundEventTypeSchedulingRule>
    : {};
  const mode = VALID_GROUND_EVENT_SCHEDULING_MODES.has(source.mode as GroundEventSchedulingMode)
    ? source.mode as GroundEventSchedulingMode
    : DEFAULT_GROUND_EVENT_TYPE_SCHEDULING_RULE.mode;
  const preferredWindows = Array.isArray(source.preferredWindows)
    ? Array.from(new Set(source.preferredWindows
      .map(windowId => String(windowId || '').trim())
      .filter(windowId => VALID_WINDOW_IDS.has(windowId))))
    : [];

  return { mode, preferredWindows };
};

export const normaliseGroundEventSchedulingSettings = (value: unknown): GroundEventSchedulingSettings => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<GroundEventSchedulingSettings>
    : {};
  const byEventTypeSource = source.byEventType && typeof source.byEventType === 'object' && !Array.isArray(source.byEventType)
    ? source.byEventType as Record<string, unknown>
    : {};
  const byEventType = Object.fromEntries(
    Object.entries(byEventTypeSource)
      .map(([eventType, rule]) => [normaliseGroundEventTypeKey(eventType), normaliseGroundEventSchedulingRule(rule)])
      .filter(([eventType]) => Boolean(eventType))
  );

  return { byEventType };
};

export const getGroundEventSchedulingRuleForType = (
  settings: GroundEventSchedulingSettings | undefined | null,
  eventType: unknown,
): GroundEventTypeSchedulingRule => {
  const normalisedSettings = normaliseGroundEventSchedulingSettings(settings);
  const eventTypeKey = normaliseGroundEventTypeKey(eventType);
  return normalisedSettings.byEventType[eventTypeKey] || DEFAULT_GROUND_EVENT_TYPE_SCHEDULING_RULE;
};

