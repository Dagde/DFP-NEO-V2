import type { CurrencyProfile } from './crewCompositionProfiles';

export type ContinuationDayNight = 'Day' | 'Night' | 'Day/Night';
export type ContinuationFlightType = 'Solo' | 'Dual';

export interface ContinuationEventSetting {
  id?: string;
  name: string;
  code?: string;
  unitCode?: string;
  compositeUnitCode?: string;
  aircraftTypeCode?: string;
  crew?: string;
  config?: string;
  acceptableAircraftConfigs?: string[];
  currency?: string;
  dayNight?: ContinuationDayNight;
  flightType?: ContinuationFlightType;
  aircraftCount?: number;
  status?: string;
}

export type ContinuationEventInput = string | Partial<ContinuationEventSetting> | null | undefined;

const normaliseText = (value: unknown): string => String(value || '').trim();
const normaliseUnitCode = (value: unknown): string => normaliseText(value).toUpperCase();

const normaliseCode = (value: unknown, fallback: string): string => {
  const token = normaliseText(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (token) return token;
  return normaliseText(fallback).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CONT';
};

export const normaliseContinuationDayNight = (value: unknown, fallbackName = ''): ContinuationDayNight => {
  const text = normaliseText(value).toLowerCase();
  if (text === 'night') return 'Night';
  if (text === 'day/night' || text === 'daynight' || text === 'day and night') return 'Day/Night';
  return /\bnight\b/i.test(fallbackName) ? 'Night' : 'Day';
};

export const normaliseContinuationFlightType = (value: unknown): ContinuationFlightType => (
  normaliseText(value).toLowerCase() === 'solo' ? 'Solo' : 'Dual'
);

const normaliseAircraftCount = (value: unknown): number => (
  Math.max(1, Math.min(24, Math.round(Number(value) || 1)))
);

const normaliseConfigs = (value: unknown, fallback: string): string[] => {
  const rows = Array.isArray(value) ? value : [];
  const configs = rows.map(item => normaliseText(item)).filter(Boolean);
  return Array.from(new Set(configs.length > 0 ? configs : [fallback || 'ANY']));
};

export const normaliseContinuationEventSettings = (events: unknown): ContinuationEventSetting[] => {
  const rows = Array.isArray(events) ? events : [];
  return rows.map((row: ContinuationEventInput, index): ContinuationEventSetting | null => {
    if (typeof row === 'string') {
      const name = normaliseText(row);
      if (!name) return null;
      return {
        id: `continuation-event-${index + 1}`,
        name,
        code: normaliseCode('', name),
        config: 'ANY',
        acceptableAircraftConfigs: ['ANY'],
        dayNight: normaliseContinuationDayNight('', name),
        flightType: 'Dual',
        aircraftCount: 1,
        status: 'ACTIVE',
      };
    }
    if (!row || typeof row !== 'object') return null;
    const source = row as Partial<ContinuationEventSetting> & Record<string, unknown>;
    const name = normaliseText(source.name || source.currency || source.code);
    if (!name) return null;
    const config = normaliseText(source.config) || 'ANY';
    return {
      id: normaliseText(source.id) || `continuation-event-${index + 1}`,
      name,
      code: normaliseCode(source.code, name),
      unitCode: normaliseUnitCode(source.unitCode),
      compositeUnitCode: normaliseUnitCode(source.compositeUnitCode),
      aircraftTypeCode: normaliseUnitCode(source.aircraftTypeCode),
      crew: normaliseText(source.crew),
      config,
      acceptableAircraftConfigs: normaliseConfigs(source.acceptableAircraftConfigs, config),
      currency: normaliseText(source.currency || name),
      dayNight: normaliseContinuationDayNight(source.dayNight, name),
      flightType: normaliseContinuationFlightType(source.flightType),
      aircraftCount: normaliseAircraftCount(source.aircraftCount),
      status: normaliseText(source.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    };
  }).filter((event): event is ContinuationEventSetting => Boolean(event));
};

export const getContinuationEventNames = (events: unknown): string[] => (
  Array.from(new Set(
    normaliseContinuationEventSettings(events)
      .filter(event => event.status !== 'INACTIVE')
      .map(event => event.name)
      .filter(Boolean),
  ))
);

export const isContinuationScheduleEvent = (event: unknown): boolean => {
  if (!event || typeof event !== 'object') return false;
  const source = event as Record<string, unknown>;
  if (String(source.eventCategory || '').trim().toLowerCase() === 'sct') return true;
  const flightNumber = String(source.flightNumber || '').trim().toUpperCase();
  return flightNumber === 'SCT' || flightNumber === 'SCT FORM' || flightNumber.startsWith('SCT ');
};

export const continuationEventToCurrencyProfile = (event: ContinuationEventSetting): CurrencyProfile => ({
  id: event.id || event.name,
  unitCode: event.unitCode || '',
  compositeUnitCode: event.compositeUnitCode || '',
  aircraftTypeCode: event.aircraftTypeCode || '',
  name: event.name,
  code: normaliseCode(event.code, event.name),
  crew: event.crew || '',
  config: event.config || event.acceptableAircraftConfigs?.[0] || 'ANY',
  acceptableAircraftConfigs: event.acceptableAircraftConfigs?.length ? event.acceptableAircraftConfigs : [event.config || 'ANY'],
  currency: event.currency || event.name,
  dayNight: event.dayNight || normaliseContinuationDayNight('', event.name),
  flightType: event.flightType || 'Dual',
  aircraftCount: normaliseAircraftCount(event.aircraftCount),
  status: event.status || 'ACTIVE',
});

export const getContinuationEventCurrencyProfiles = (events: unknown): CurrencyProfile[] => (
  normaliseContinuationEventSettings(events)
    .filter(event => event.status !== 'INACTIVE')
    .map(continuationEventToCurrencyProfile)
);
