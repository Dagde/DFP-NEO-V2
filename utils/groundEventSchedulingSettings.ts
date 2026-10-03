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

export interface GroundEventSchedulingGroup extends GroundEventTypeSchedulingRule {
  id: string;
  name: string;
  eventCodes: string[];
}

export interface GroundEventSchedulingSettings {
  byEventType: Record<string, GroundEventTypeSchedulingRule>;
  groups: GroundEventSchedulingGroup[];
  ungroupedEventCodes: string[];
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
  groups: [],
  ungroupedEventCodes: [],
};

const VALID_GROUND_EVENT_SCHEDULING_MODES = new Set<GroundEventSchedulingMode>(['automatic', 'suggest', 'manual']);
const VALID_WINDOW_IDS = new Set(GROUND_EVENT_SCHEDULING_WINDOWS.map(window => window.id));

export const normaliseGroundEventTypeKey = (value: unknown): string => (
  String(value || 'Ground School').trim() || 'Ground School'
);

export const normaliseGroundEventCode = (value: unknown): string => (
  String(value || '').trim().replace(/\s+/g, ' ').toUpperCase()
);

export const getGroundEventSchedulingItemCode = (item: unknown): string => {
  const source = item && typeof item === 'object'
    ? item as Record<string, unknown>
    : {};
  return normaliseGroundEventCode(
    source.code
    || source.eventCode
    || source.masterEventId
    || source.id
    || source.eventDescription
    || source.name
    || source.title
  );
};

export const makeGroundEventSchedulingGroupId = (name: unknown, index = 0): string => {
  const base = String(name || 'ground-group')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'ground-group';
  return `${base}-${index}`;
};

const formatDerivedGroundEventCategory = (value: string): string => {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Ground';
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{1,5}$/.test(upper)) return upper;
  return trimmed
    .toLowerCase()
    .replace(/\b[a-z]/g, char => char.toUpperCase());
};

export const deriveGroundEventSchedulingCategory = (item: unknown): string => {
  const source = item && typeof item === 'object'
    ? item as Record<string, unknown>
    : {};
  const explicitCategory = source.groundEventCategory || source.groundCategory || source.groundEventType;
  if (String(explicitCategory || '').trim()) {
    return normaliseGroundEventTypeKey(explicitCategory);
  }

  const rawCode = String(
    source.code
    || source.eventCode
    || source.masterEventId
    || source.id
    || source.eventDescription
    || source.name
    || source.title
    || source.type
    || 'Ground'
  ).trim();
  const normalisedCode = rawCode
    .replace(/[_/]+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const upperCode = normalisedCode.toUpperCase();

  if (upperCode.includes('PRE-SOLO') && upperCode.includes('QUIZ')) return 'Pre-Solo Quiz';
  if (upperCode.includes('PRE SOLO') && upperCode.includes('QUIZ')) return 'Pre-Solo Quiz';

  const withoutGenericPrefix = upperCode
    .replace(/^GF[\s-]+/, '')
    .trim();
  const firstToken = withoutGenericPrefix.split(/\s+/)[0] || withoutGenericPrefix;
  const alphaNumericPrefix = firstToken.match(/^([A-Z]+)\d+[A-Z]?$/);
  if (alphaNumericPrefix?.[1]) return formatDerivedGroundEventCategory(alphaNumericPrefix[1]);

  const spacedPrefix = withoutGenericPrefix.match(/^([A-Z]+)\s+\d+[A-Z]?$/);
  if (spacedPrefix?.[1]) return formatDerivedGroundEventCategory(spacedPrefix[1]);

  return formatDerivedGroundEventCategory(withoutGenericPrefix || normalisedCode || 'Ground');
};

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

export const normaliseGroundEventSchedulingGroup = (value: unknown, index = 0): GroundEventSchedulingGroup => {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<GroundEventSchedulingGroup>
    : {};
  const name = normaliseGroundEventTypeKey(source.name || `Ground Group ${index + 1}`);
  const rule = normaliseGroundEventSchedulingRule(source);
  const eventCodes = Array.isArray(source.eventCodes)
    ? Array.from(new Set(source.eventCodes.map(normaliseGroundEventCode).filter(Boolean)))
    : [];
  const id = String(source.id || '').trim() || makeGroundEventSchedulingGroupId(name, index);

  return {
    id,
    name,
    eventCodes,
    mode: rule.mode,
    preferredWindows: rule.preferredWindows,
  };
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
  const groups = Array.isArray(source.groups)
    ? source.groups.map(normaliseGroundEventSchedulingGroup)
    : [];
  const ungroupedEventCodes = Array.isArray(source.ungroupedEventCodes)
    ? Array.from(new Set(source.ungroupedEventCodes.map(normaliseGroundEventCode).filter(Boolean)))
    : [];

  return { byEventType, groups, ungroupedEventCodes };
};

export const getGroundEventSchedulingRuleForType = (
  settings: GroundEventSchedulingSettings | undefined | null,
  eventType: unknown,
): GroundEventTypeSchedulingRule => {
  const normalisedSettings = normaliseGroundEventSchedulingSettings(settings);
  const eventTypeKey = normaliseGroundEventTypeKey(eventType);
  return normalisedSettings.byEventType[eventTypeKey]
    || normalisedSettings.byEventType.Ground
    || normalisedSettings.byEventType['Ground School']
    || DEFAULT_GROUND_EVENT_TYPE_SCHEDULING_RULE;
};

export const getGroundEventSchedulingGroupForItem = (
  settings: GroundEventSchedulingSettings | undefined | null,
  item: unknown,
): GroundEventSchedulingGroup | null => {
  const normalisedSettings = normaliseGroundEventSchedulingSettings(settings);
  const eventCode = getGroundEventSchedulingItemCode(item);
  if (!eventCode) return null;
  if (normalisedSettings.ungroupedEventCodes.includes(eventCode)) return null;
  return normalisedSettings.groups.find(group => group.eventCodes.includes(eventCode)) || null;
};

export const getGroundEventSchedulingRuleForItem = (
  settings: GroundEventSchedulingSettings | undefined | null,
  item: unknown,
): { groupName: string; rule: GroundEventTypeSchedulingRule; explicitGroup: GroundEventSchedulingGroup | null } => {
  const normalisedSettings = normaliseGroundEventSchedulingSettings(settings);
  const eventCode = getGroundEventSchedulingItemCode(item);
  if (eventCode && normalisedSettings.ungroupedEventCodes.includes(eventCode)) {
    return {
      groupName: deriveGroundEventSchedulingCategory(item),
      rule: DEFAULT_GROUND_EVENT_TYPE_SCHEDULING_RULE,
      explicitGroup: null,
    };
  }
  const explicitGroup = getGroundEventSchedulingGroupForItem(settings, item);
  if (explicitGroup) {
    return {
      groupName: explicitGroup.name,
      rule: {
        mode: explicitGroup.mode,
        preferredWindows: explicitGroup.preferredWindows,
      },
      explicitGroup,
    };
  }

  const groupName = deriveGroundEventSchedulingCategory(item);
  return {
    groupName,
    rule: getGroundEventSchedulingRuleForType(normalisedSettings, groupName),
    explicitGroup: null,
  };
};
