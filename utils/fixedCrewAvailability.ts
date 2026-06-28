import type { Instructor } from '../types';

export type FixedCrewAvailabilityWindow = {
  date: string;
  start: number;
  end: number;
  resourceKind?: 'flight' | 'sim' | 'ground' | string;
};

export type FixedCrewUnavailabilityStatus = {
  unavailable: boolean;
  reason: string;
};

export const hoursOverlap = (
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean => firstStart < secondEnd && secondStart < firstEnd;

export const timeFieldToHours = (value?: string | number | null, fallback: number | null = null): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hours, minutes] = text.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) return hours + (minutes / 60);
  }
  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, '0');
    const hours = Number(padded.slice(0, 2));
    const minutes = Number(padded.slice(2, 4));
    if (Number.isFinite(hours) && Number.isFinite(minutes)) return hours + (minutes / 60);
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const formatAvailabilityHour = (value: number): string => {
  const bounded = Math.max(0, Math.min(24, value));
  const hours = Math.floor(bounded);
  const minutes = Math.round((bounded - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getStaffUnavailabilityStatus = (
  staff: Instructor | undefined | null,
  window: FixedCrewAvailabilityWindow,
): FixedCrewUnavailabilityStatus => {
  if (!staff?.unavailability?.length || !window.date) {
    return { unavailable: false, reason: '' };
  }

  const windowStart = Math.max(0, Number(window.start) || 0);
  const windowEnd = Math.min(24, Math.max(windowStart, Number(window.end) || windowStart));
  const resourceKind = String(window.resourceKind || 'flight').toLowerCase();

  for (const period of staff.unavailability) {
    if (!period?.startDate || !period?.endDate) continue;
    if (window.date < period.startDate || window.date > period.endDate) continue;
    if (period.reason === 'TMUF - Ground Duties only' && resourceKind !== 'flight') continue;

    const reason = period.reason || 'Unavailable';
    if (period.allDay) {
      return { unavailable: true, reason: `${reason} all day` };
    }

    const periodStart = window.date === period.startDate
      ? timeFieldToHours(period.startTime, 0)
      : 0;
    const periodEnd = window.date === period.endDate
      ? timeFieldToHours(period.endTime, 24)
      : 24;

    if (periodStart === null || periodEnd === null) continue;
    if (hoursOverlap(windowStart, windowEnd, periodStart, periodEnd)) {
      return {
        unavailable: true,
        reason: `${reason} ${formatAvailabilityHour(periodStart)}-${formatAvailabilityHour(periodEnd)}`,
      };
    }
  }

  return { unavailable: false, reason: '' };
};

export const summariseCrewUnavailability = (
  members: Instructor[],
  window: FixedCrewAvailabilityWindow,
): string => {
  const unavailableMembers = members
    .map(member => ({
      member,
      status: getStaffUnavailabilityStatus(member, window),
    }))
    .filter(item => item.status.unavailable);

  if (unavailableMembers.length === 0) return '';
  if (unavailableMembers.length === 1) {
    const item = unavailableMembers[0];
    return `${item.member.name}: ${item.status.reason}`;
  }
  return `${unavailableMembers.length} crew unavailable`;
};

export const appendUnavailableLabel = (label: string, reason: string): string => (
  reason ? `${label} - UNAVAILABLE: ${reason}` : label
);
