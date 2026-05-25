import type { PlatformConfig } from './platformConfigService';

export type InsertEventDayNight = 'Day' | 'Night' | 'Day/Night';
export type InsertEventSyllabusType = 'Flight' | 'FTD' | 'Ground School' | 'Academics';

export interface InsertEventTypeConfig {
  label: string;
  syllabusType: InsertEventSyllabusType;
  dayNight: InsertEventDayNight;
  duration: number;
  flightOrSimHours: number;
  totalEventHours: number;
  preFlightTime: number;
  postFlightTime: number;
  resourceCount: number;
}

export const INSERT_EVENT_LABEL_MAX_LENGTH = 8;

export const DEFAULT_INSERT_EVENT_TYPES: InsertEventTypeConfig[] = [
  { label: 'GF', syllabusType: 'Ground School', dayNight: 'Day', duration: 1, flightOrSimHours: 0, totalEventHours: 1, preFlightTime: 0.25, postFlightTime: 0, resourceCount: 0 },
  { label: 'IF', syllabusType: 'Flight', dayNight: 'Day', duration: 1.5, flightOrSimHours: 1.5, totalEventHours: 2.5, preFlightTime: 1, postFlightTime: 0.5, resourceCount: 1 },
  { label: 'NF', syllabusType: 'Flight', dayNight: 'Night', duration: 1.5, flightOrSimHours: 1.5, totalEventHours: 2.5, preFlightTime: 1, postFlightTime: 0.5, resourceCount: 1 },
  { label: 'FORM', syllabusType: 'Flight', dayNight: 'Day/Night', duration: 1.5, flightOrSimHours: 1.5, totalEventHours: 2.5, preFlightTime: 1, postFlightTime: 0.5, resourceCount: 2 },
  { label: 'Nav', syllabusType: 'Flight', dayNight: 'Day/Night', duration: 2, flightOrSimHours: 2, totalEventHours: 3, preFlightTime: 1, postFlightTime: 0.5, resourceCount: 1 },
  { label: 'Currency', syllabusType: 'Flight', dayNight: 'Day/Night', duration: 1.5, flightOrSimHours: 1.5, totalEventHours: 2.5, preFlightTime: 1, postFlightTime: 0.5, resourceCount: 1 },
];

const cleanLabel = (value: unknown, fallback: string): string => {
  const raw = typeof value === 'string' ? value.trim() : fallback;
  return (raw || fallback).slice(0, INSERT_EVENT_LABEL_MAX_LENGTH);
};

const cleanNumber = (value: unknown, fallback: number, min = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, numeric);
};

const cleanSyllabusType = (value: unknown, fallback: InsertEventSyllabusType): InsertEventSyllabusType => {
  return value === 'Flight' || value === 'FTD' || value === 'Ground School' || value === 'Academics'
    ? value
    : fallback;
};

const cleanDayNight = (value: unknown, fallback: InsertEventDayNight): InsertEventDayNight => {
  return value === 'Day' || value === 'Night' || value === 'Day/Night' ? value : fallback;
};

export const normaliseInsertEventTypes = (input: unknown): InsertEventTypeConfig[] => {
  const source = Array.isArray(input) && input.length > 0 ? input : DEFAULT_INSERT_EVENT_TYPES;
  return source.map((item: any, index) => {
    const fallback = DEFAULT_INSERT_EVENT_TYPES[index] || DEFAULT_INSERT_EVENT_TYPES[0];
    const syllabusType = cleanSyllabusType(item?.syllabusType || item?.type, fallback.syllabusType);
    const duration = cleanNumber(item?.duration, fallback.duration, 0.25);
    const flightOrSimHours = cleanNumber(item?.flightOrSimHours, syllabusType === 'Ground School' ? 0 : duration, 0);
    return {
      label: cleanLabel(item?.label || item?.code, fallback.label),
      syllabusType,
      dayNight: cleanDayNight(item?.dayNight, fallback.dayNight),
      duration,
      flightOrSimHours,
      totalEventHours: cleanNumber(item?.totalEventHours, Math.max(duration, flightOrSimHours), 0.25),
      preFlightTime: cleanNumber(item?.preFlightTime, fallback.preFlightTime, 0),
      postFlightTime: cleanNumber(item?.postFlightTime, fallback.postFlightTime, 0),
      resourceCount: Math.round(cleanNumber(item?.resourceCount, fallback.resourceCount, 0)),
    };
  }).filter((item) => item.label);
};

export const getInsertEventTypes = (config?: PlatformConfig | null): InsertEventTypeConfig[] => {
  const organisations = Array.isArray(config?.organisations) ? config!.organisations : [];
  const activeOrganisation = organisations.find((org) => String(org.status || 'ACTIVE').toUpperCase() === 'ACTIVE') || organisations[0];
  return normaliseInsertEventTypes(activeOrganisation?.settings?.insertEventTypes || null);
};
