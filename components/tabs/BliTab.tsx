import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  ClockIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  Squares2X2Icon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { showDarkAlert, showDarkPrompt } from '../DarkMessageModal';
import type { CancellationCode, Instructor, ScheduleEvent, Trainee } from '../../types';
import { verifyCurrentUserPassword } from '../../utils/passwordVerification';
import { isTraineeSuspended } from '../../utils/traineeStatus';

type TimelineKey = '7d' | '1m' | '6m' | '12m' | '2y' | '3y' | '5y' | 'lastCY' | 'lastFY' | 'thisCY' | 'thisFY';
type MetricKey = 'availability' | 'flight' | 'flightHours' | 'simulator' | 'simulatorHours' | 'total' | 'cancellations' | 'staffFlight' | 'staffSimulator' | 'staffTotal';
type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;
type PeriodKey = 'cy' | 'fy';

interface BliOperationalContext {
  locationCode?: string;
  unitCode?: string;
  unitName?: string;
  unitCodes?: string[];
  isSharedFleetContext?: boolean;
}

interface BliUnitScopeOption {
  key: string;
  label: string;
  unitCode?: string;
}

interface BliRequestContext {
  eventUnitCode?: string;
  availabilityUnitCode?: string;
  locationCode?: string;
}

interface DailyEventMetrics {
  date: string;
  flightEvents: number;
  simulatorEvents: number;
  totalEvents: number;
  flightHours: number;
  simulatorHours: number;
}

type DailyMetricNumberKey = Exclude<keyof DailyEventMetrics, 'date'>;

interface AvailabilityMetrics {
  date: string;
  availableAverage: number | null;
  totalAircraft: number | null;
  availabilityPct: number | null;
}

interface AvailabilityHistoryRecord {
  date: string;
  dailyAverage?: number | string | null;
  totalAircraft?: number | string | null;
  totalFleet?: number | string | null;
  availabilityPct?: number | string | null;
}

interface CancellationCodeCount {
  code: string;
  count: number;
}

interface CancellationCategory {
  category: string;
  total: number;
  codes: CancellationCodeCount[];
}

interface BliMetricsResponse {
  success: boolean;
  startDate: string;
  endDate: string;
  snapshotCount: number;
  dates: string[];
  eventSeries: DailyEventMetrics[];
  availabilitySeries: AvailabilityMetrics[];
  cancellationsByCategory: CancellationCategory[];
  staffSeries: Record<string, DailyEventMetrics[]>;
}

interface BliTabProps {
  date: string;
  events: ScheduleEvent[];
  instructorsData: Instructor[];
  traineesData: Trainee[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  operationalContext?: BliOperationalContext;
  cancellationCodes?: CancellationCode[];
}

interface CourseMovementEvent {
  id?: string;
  traineeName?: string;
  idNumber?: number | string | null;
  fromCourse?: string;
  toCourse?: string;
  direction?: 'back-course' | 'forward-course' | 'course-change' | string;
  unit?: string;
  location?: string;
  changedAt?: string;
  createdAt?: string;
}

type CourseOutcomeMetricKey = 'started' | 'failed' | 'paused' | 'backCoursed' | 'forwardCoursed' | 'remaining';

interface CourseOutcomeMetric {
  key: CourseOutcomeMetricKey;
  label: string;
  current: number;
  historicalAverage: number;
}

interface ChartPoint {
  date: string;
  value: number | null;
}

interface MetricDefinition {
  key: MetricKey;
  title: string;
  subtitle: string;
  icon: IconType;
  color: string;
  unit?: string;
  series: ChartPoint[];
  summary: string;
  footer: string;
}

interface SeriesStats {
  total: number;
  average: number | null;
  highest: ChartPoint | null;
  lowest: ChartPoint | null;
  dataPointCount: number;
}

interface BliYearBoundary {
  start: string;
  end: string;
}

interface BliPeriodSettings {
  cy: BliYearBoundary;
  fy: BliYearBoundary;
}

const isStaffMetricKey = (key: MetricKey): boolean => (
  key === 'staffFlight' || key === 'staffSimulator' || key === 'staffTotal'
);

const isUnitScopedMetricKey = (key: MetricKey): boolean => (
  key === 'availability'
  || key === 'flight'
  || key === 'flightHours'
  || key === 'simulator'
  || key === 'simulatorHours'
  || key === 'total'
);

const metricStrokeColor = (color: string): string => {
  if (color.includes('cyan')) return '#22d3ee';
  if (color.includes('blue')) return '#60a5fa';
  if (color.includes('emerald')) return '#34d399';
  if (color.includes('amber')) return '#fbbf24';
  if (color.includes('rose')) return '#fb7185';
  if (color.includes('sky')) return '#38bdf8';
  if (color.includes('teal')) return '#2dd4bf';
  if (color.includes('violet')) return '#a78bfa';
  if (color.includes('fuchsia')) return '#f472b6';
  return '#f472b6';
};

const TIMELINE_OPTIONS: { key: TimelineKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '1m', label: '4 weeks' },
  { key: '6m', label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
  { key: '2y', label: 'Last 2 years' },
  { key: '3y', label: 'Last 3 years' },
  { key: '5y', label: 'Last 5 years' },
  { key: 'lastCY', label: 'Last CY' },
  { key: 'lastFY', label: 'Last FY' },
  { key: 'thisCY', label: 'This CY' },
  { key: 'thisFY', label: 'This FY' },
];

const BLI_PERIOD_SETTINGS_KEY = 'neo_bli_period_settings';
const DEFAULT_BLI_PERIOD_SETTINGS: BliPeriodSettings = {
  cy: { start: '01-01', end: '12-31' },
  fy: { start: '07-01', end: '06-30' },
};

const RANK_ORDER: Record<string, number> = {
  AIRCDRE: 1,
  GPCAPT: 2,
  WGCDR: 3,
  SQNLDR: 4,
  FLTLT: 5,
  FLGOFF: 6,
  PLTOFF: 7,
  WO: 8,
  SGT: 9,
  CPL: 10,
  Mr: 20,
  Mrs: 20,
  Ms: 20,
  Dr: 20,
};

const parseIsoDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

const dateLabel = (value: string): string => {
  const date = parseIsoDate(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });
};

const formatDateRange = (startDate: string, endDate: string): string => `${dateLabel(startDate)} - ${dateLabel(endDate)}`;

const parseMonthDay = (value: string): { month: number; day: number } | null => {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(2024, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { month, day };
};

const monthDaySortValue = (value: string): number => {
  const parsed = parseMonthDay(value);
  return parsed ? parsed.month * 100 + parsed.day : 0;
};

const normaliseMonthDay = (value: string): string => {
  const parsed = parseMonthDay(value);
  if (!parsed) return '';
  return `${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

const monthDayLabel = (value: string): string => {
  const parsed = parseMonthDay(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(2024, parsed.month - 1, parsed.day));
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const periodLabel = (period: BliYearBoundary): string => `${monthDayLabel(period.start)} - ${monthDayLabel(period.end)}`;

const loadBliPeriodSettings = (): BliPeriodSettings => {
  if (typeof window === 'undefined') return DEFAULT_BLI_PERIOD_SETTINGS;
  try {
    const stored = window.localStorage.getItem(BLI_PERIOD_SETTINGS_KEY);
    if (!stored) return DEFAULT_BLI_PERIOD_SETTINGS;
    const parsed = JSON.parse(stored);
    const cyStart = normaliseMonthDay(parsed?.cy?.start) || DEFAULT_BLI_PERIOD_SETTINGS.cy.start;
    const cyEnd = normaliseMonthDay(parsed?.cy?.end) || DEFAULT_BLI_PERIOD_SETTINGS.cy.end;
    const fyStart = normaliseMonthDay(parsed?.fy?.start) || DEFAULT_BLI_PERIOD_SETTINGS.fy.start;
    const fyEnd = normaliseMonthDay(parsed?.fy?.end) || DEFAULT_BLI_PERIOD_SETTINGS.fy.end;
    return { cy: { start: cyStart, end: cyEnd }, fy: { start: fyStart, end: fyEnd } };
  } catch {
    return DEFAULT_BLI_PERIOD_SETTINGS;
  }
};

const saveBliPeriodSettings = (settings: BliPeriodSettings): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BLI_PERIOD_SETTINGS_KEY, JSON.stringify(settings));
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addUtcYears = (date: Date, years: number): Date => {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
};

const buildConfiguredPeriod = (period: BliYearBoundary, startYear: number): { start: Date; end: Date } => {
  const start = parseMonthDay(period.start) || parseMonthDay(DEFAULT_BLI_PERIOD_SETTINGS.cy.start)!;
  const end = parseMonthDay(period.end) || parseMonthDay(DEFAULT_BLI_PERIOD_SETTINGS.cy.end)!;
  const rollsIntoNextYear = monthDaySortValue(period.end) < monthDaySortValue(period.start);
  return {
    start: new Date(Date.UTC(startYear, start.month - 1, start.day)),
    end: new Date(Date.UTC(rollsIntoNextYear ? startYear + 1 : startYear, end.month - 1, end.day)),
  };
};

const getConfiguredPeriodRange = (
  anchor: Date,
  period: BliYearBoundary,
  mode: 'this' | 'last',
): { startDate: string; endDate: string } => {
  const anchorYear = anchor.getUTCFullYear();
  const candidates = [anchorYear - 1, anchorYear, anchorYear + 1].map(year => ({
    startYear: year,
    ...buildConfiguredPeriod(period, year),
  }));
  const current = candidates.find(candidate => anchor >= candidate.start && anchor <= candidate.end) || candidates[1];
  const selected = mode === 'this'
    ? current
    : { startYear: current.startYear - 1, ...buildConfiguredPeriod(period, current.startYear - 1) };
  return { startDate: toIsoDate(selected.start), endDate: toIsoDate(selected.end) };
};

const getTimelineRange = (
  anchorIso: string,
  timeline: TimelineKey,
  periodSettings: BliPeriodSettings = DEFAULT_BLI_PERIOD_SETTINGS,
): { startDate: string; endDate: string } => {
  const end = parseIsoDate(anchorIso);
  let start = new Date(end);

  if (timeline === '7d') start = addUtcDays(end, -6);
  if (timeline === '1m') start = addUtcDays(end, -27);
  if (timeline === '6m') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
  if (timeline === '12m') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  if (timeline === '2y') start = addUtcYears(end, -2);
  if (timeline === '3y') start = addUtcYears(end, -3);
  if (timeline === '5y') start = addUtcYears(end, -5);
  if (timeline === 'thisCY') return getConfiguredPeriodRange(end, periodSettings.cy, 'this');
  if (timeline === 'lastCY') return getConfiguredPeriodRange(end, periodSettings.cy, 'last');
  if (timeline === 'thisFY') return getConfiguredPeriodRange(end, periodSettings.fy, 'this');
  if (timeline === 'lastFY') return getConfiguredPeriodRange(end, periodSettings.fy, 'last');

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

const normalizeAvailabilityDate = (value: string): string => String(value || '').slice(0, 10);

const numberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const availabilityFromHistory = (record: AvailabilityHistoryRecord): AvailabilityMetrics => {
  const availableAverage = numberOrNull(record.dailyAverage);
  const totalAircraft = numberOrNull(record.totalAircraft ?? record.totalFleet);
  const availabilityPct = numberOrNull(record.availabilityPct);
  return {
    date: normalizeAvailabilityDate(record.date),
    availableAverage,
    totalAircraft,
    availabilityPct: availabilityPct ?? (
      availableAverage !== null && totalAircraft && totalAircraft > 0
        ? (availableAverage / totalAircraft) * 100
        : null
    ),
  };
};

const mergeAvailabilityHistory = (
  metrics: BliMetricsResponse,
  records: AvailabilityHistoryRecord[],
): BliMetricsResponse => {
  const byDate = new Map<string, AvailabilityMetrics>();
  records.forEach(record => {
    const normalized = availabilityFromHistory(record);
    if (normalized.date) byDate.set(normalized.date, normalized);
  });

  const existingByDate = new Map(metrics.availabilitySeries.map(point => [normalizeAvailabilityDate(point.date), point]));
  return {
    ...metrics,
    availabilitySeries: metrics.dates.map(date => (
      byDate.get(date) || existingByDate.get(date) || {
        date,
        availableAverage: null,
        totalAircraft: null,
        availabilityPct: null,
      }
    )),
  };
};

const fetchBliMetrics = async (
  startDate: string,
  endDate: string,
  signal: AbortSignal,
  requestContext?: BliRequestContext,
): Promise<BliMetricsResponse> => {
  const params = new URLSearchParams({ startDate, endDate });
  if (requestContext?.eventUnitCode) params.set('unit', requestContext.eventUnitCode);
  if (requestContext?.availabilityUnitCode) params.set('unitCode', requestContext.availabilityUnitCode);
  if (requestContext?.locationCode) params.set('locationCode', requestContext.locationCode);
  const query = params.toString();
  const [bliResponse, availabilityResponse] = await Promise.all([
    fetch(`/api/bli/metrics?${query}`, { credentials: 'include', signal }),
    fetch(`/api/aircraft-availability-history?${query}`, { credentials: 'include', signal }).catch(() => null),
  ]);

  if (!bliResponse.ok) throw new Error(await bliResponse.text());
  const metrics = await bliResponse.json() as BliMetricsResponse;

  if (!availabilityResponse || !availabilityResponse.ok) return metrics;
  const availabilityData = await availabilityResponse.json();
  return mergeAvailabilityHistory(metrics, availabilityData.records || availabilityData.history || []);
};

const fetchCourseMovements = async (
  signal: AbortSignal,
  requestContext?: BliRequestContext,
): Promise<CourseMovementEvent[]> => {
  const params = new URLSearchParams();
  if (requestContext?.eventUnitCode) params.set('unit', requestContext.eventUnitCode);
  if (requestContext?.locationCode) params.set('locationCode', requestContext.locationCode);
  const response = await fetch(`/api/bli/course-movements${params.toString() ? `?${params.toString()}` : ''}`, {
    credentials: 'include',
    signal,
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return Array.isArray(data.movements) ? data.movements : [];
};

const valueSum = (series: ChartPoint[]): number => series.reduce((sum, point) => sum + (Number(point.value) || 0), 0);

const valueAvg = (series: ChartPoint[]): number | null => {
  const values = series.map(point => point.value).filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const niceTickStep = (range: number, targetTicks = 4): number => {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, targetTicks);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalised = rough / magnitude;
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return nice * magnitude;
};

const niceAxisRange = (values: number[], targetTicks = 4): { min: number; max: number; ticks: number[] } => {
  const finiteValues = values.filter(value => Number.isFinite(value));
  const rawMin = Math.min(0, ...finiteValues);
  const rawMax = Math.max(1, ...finiteValues);
  const step = niceTickStep(rawMax - rawMin || rawMax || 1, targetTicks);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let tick = min; tick <= max + step * 0.001; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }
  return { min, max, ticks };
};

const seriesStats = (series: ChartPoint[]): SeriesStats => {
  const values = series
    .filter(point => point.value !== null && Number.isFinite(Number(point.value)))
    .map(point => ({ ...point, value: Number(point.value) }));
  if (values.length === 0) {
    return { total: 0, average: null, highest: null, lowest: null, dataPointCount: 0 };
  }

  const total = values.reduce((sum, point) => sum + point.value, 0);
  const highest = values.reduce((best, point) => (point.value > best.value ? point : best), values[0]);
  const lowest = values.reduce((best, point) => (point.value < best.value ? point : best), values[0]);
  return {
    total,
    average: total / values.length,
    highest,
    lowest,
    dataPointCount: values.length,
  };
};

const compactNumber = (value: number | null | undefined, digits = 0): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  return Number(value).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
};

const metricDigits = (metric: Pick<MetricDefinition, 'unit'>): number => (
  ['%', 'h', 'ac'].includes(String(metric.unit || '').trim()) ? 1 : 0
);

const formatMetricAmount = (value: number | null | undefined, metric: Pick<MetricDefinition, 'unit'>): string => {
  const formatted = compactNumber(value, metricDigits(metric));
  if (formatted === 'No data') return formatted;
  return `${formatted}${metric.unit || ''}`;
};

const sumDailyMetric = (rows: DailyEventMetrics[], field: DailyMetricNumberKey): number => (
  rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)
);

const eventMetricHours = (event: ScheduleEvent): number => {
  const duration = Number(event.duration ?? 0);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
};

const eventStaffNames = (event: ScheduleEvent): string[] => {
  const names = [
    event.instructor,
    event.pilot,
    event.crew,
    ...((event.attendees || []) as string[]),
  ]
    .map(name => String(name || '').trim())
    .filter(name => name && !/^TBA$/i.test(name));
  return [...new Set(names)];
};

const buildFallbackMetrics = (
  date: string,
  events: ScheduleEvent[],
  currentAircraftAvailable?: number,
  totalAircraft?: number,
): BliMetricsResponse => {
  const flightEvents = events.filter(event => event.type === 'flight').length;
  const simulatorEvents = events.filter(event => event.type === 'ftd').length;
  const flightHours = events.reduce((sum, event) => sum + (event.type === 'flight' ? eventMetricHours(event) : 0), 0);
  const simulatorHours = events.reduce((sum, event) => sum + (event.type === 'ftd' ? eventMetricHours(event) : 0), 0);
  const staffSeries: Record<string, DailyEventMetrics[]> = {};

  events.forEach(event => {
    eventStaffNames(event).forEach(staffName => {
      if (!staffSeries[staffName]) {
        staffSeries[staffName] = [{ date, flightEvents: 0, simulatorEvents: 0, totalEvents: 0, flightHours: 0, simulatorHours: 0 }];
      }
      staffSeries[staffName][0].totalEvents += 1;
      if (event.type === 'flight') {
        staffSeries[staffName][0].flightEvents += 1;
        staffSeries[staffName][0].flightHours += eventMetricHours(event);
      }
      if (event.type === 'ftd') {
        staffSeries[staffName][0].simulatorEvents += 1;
        staffSeries[staffName][0].simulatorHours += eventMetricHours(event);
      }
    });
  });

  const cancellationMap = new Map<string, CancellationCategory>();
  events.forEach(event => {
    if (!(event.isCancelled || event.cancellationCode)) return;
    const category = event.type === 'flight'
      ? 'Flight'
      : event.type === 'ftd'
        ? 'Simulator'
        : event.type === 'cpt'
          ? 'CPT'
          : event.type === 'ground'
            ? 'Ground'
            : event.type === 'deployment'
              ? 'Deployment'
              : 'Other';
    const code = String(event.cancellationCode || 'UNSPECIFIED');
    const entry = cancellationMap.get(category) || { category, total: 0, codes: [] };
    entry.total += 1;
    const codeEntry = entry.codes.find(item => item.code === code);
    if (codeEntry) codeEntry.count += 1;
    else entry.codes.push({ code, count: 1 });
    cancellationMap.set(category, entry);
  });

  return {
    success: true,
    startDate: date,
    endDate: date,
    snapshotCount: 0,
    dates: [date],
    eventSeries: [{ date, flightEvents, simulatorEvents, totalEvents: events.length, flightHours, simulatorHours }],
    availabilitySeries: [{
      date,
      availableAverage: currentAircraftAvailable ?? null,
      totalAircraft: totalAircraft ?? null,
      availabilityPct: currentAircraftAvailable !== undefined && totalAircraft ? (currentAircraftAvailable / totalAircraft) * 100 : null,
    }],
    cancellationsByCategory: [...cancellationMap.values()],
    staffSeries,
  };
};

const staffSort = (a: Instructor, b: Instructor): number => {
  const unitA = String(a.unit || '').localeCompare(String(b.unit || ''), undefined, { sensitivity: 'base' });
  if (unitA !== 0) return unitA;
  const rankA = RANK_ORDER[String(a.rank || '')] ?? 100;
  const rankB = RANK_ORDER[String(b.rank || '')] ?? 100;
  if (rankA !== rankB) return rankA - rankB;
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
};

const makeSeries = (dates: string[], values: Record<string, number | null>): ChartPoint[] =>
  dates.map(date => ({ date, value: values[date] ?? 0 }));

const normalizeUnitCode = (value: unknown): string => String(value || '').trim().toUpperCase();

const buildUnitScopeOptions = (context?: BliOperationalContext): BliUnitScopeOption[] => {
  const memberUnits = Array.from(new Set(
    (Array.isArray(context?.unitCodes) && context?.unitCodes.length > 0
      ? context.unitCodes
      : String(context?.unitCode || '').split('+')
    )
      .map(normalizeUnitCode)
      .filter(Boolean),
  ));
  if (!context?.isSharedFleetContext || memberUnits.length <= 1) return [];
  const combinedUnitCode = normalizeUnitCode(context?.unitCode);
  return [
    { key: 'combined', label: `${memberUnits.join('+')} combined`, unitCode: combinedUnitCode || undefined },
    ...memberUnits.map(unitCode => ({
      key: `unit:${unitCode}`,
      label: unitCode,
      unitCode,
    })),
  ];
};

const buildBliRequestContext = (
  context: BliOperationalContext | undefined,
  unitScopeOptions: BliUnitScopeOption[],
  selectedUnitScopeKey: string,
): BliRequestContext => {
  const selectedOption = unitScopeOptions.find(option => option.key === selectedUnitScopeKey);
  const selectedIndividualUnitCode = selectedOption?.key.startsWith('unit:') ? normalizeUnitCode(selectedOption.unitCode) : '';
  const contextUnitCode = normalizeUnitCode(context?.unitCode);
  const locationCode = normalizeUnitCode(context?.locationCode);
  return {
    eventUnitCode: selectedIndividualUnitCode || (!context?.isSharedFleetContext ? contextUnitCode : undefined),
    availabilityUnitCode: selectedIndividualUnitCode || contextUnitCode || undefined,
    locationCode: locationCode || undefined,
  };
};

const normaliseCourseCode = (value: unknown): string => String(value || '').trim();

const traineeMatchesBliUnit = (trainee: Trainee, context?: BliOperationalContext, selectedUnitScopeKey = 'combined'): boolean => {
  const selectedUnit = selectedUnitScopeKey.startsWith('unit:')
    ? normalizeUnitCode(selectedUnitScopeKey.slice(5))
    : '';
  const contextUnit = normalizeUnitCode(context?.unitCode);
  const traineeUnit = normalizeUnitCode(trainee.unit);
  if (selectedUnit) return traineeUnit === selectedUnit;
  if (!context?.isSharedFleetContext && contextUnit) return traineeUnit === contextUnit;
  const allowedUnits = new Set((context?.unitCodes || String(context?.unitCode || '').split('+')).map(normalizeUnitCode).filter(Boolean));
  return allowedUnits.size === 0 || allowedUnits.has(traineeUnit);
};

const courseMovementMatchesBliUnit = (movement: CourseMovementEvent, context?: BliOperationalContext, selectedUnitScopeKey = 'combined'): boolean => {
  const selectedUnit = selectedUnitScopeKey.startsWith('unit:')
    ? normalizeUnitCode(selectedUnitScopeKey.slice(5))
    : '';
  const contextUnit = normalizeUnitCode(context?.unitCode);
  const movementUnit = normalizeUnitCode(movement.unit);
  if (selectedUnit) return movementUnit === selectedUnit || !movementUnit;
  if (!context?.isSharedFleetContext && contextUnit) return movementUnit === contextUnit || !movementUnit;
  const allowedUnits = new Set((context?.unitCodes || String(context?.unitCode || '').split('+')).map(normalizeUnitCode).filter(Boolean));
  return allowedUnits.size === 0 || allowedUnits.has(movementUnit) || !movementUnit;
};

const buildCourseOutcomeMetrics = (
  selectedCourse: string,
  trainees: Trainee[],
  movements: CourseMovementEvent[],
): CourseOutcomeMetric[] => {
  const course = normaliseCourseCode(selectedCourse);
  const courseTrainees = trainees.filter(trainee => normaliseCourseCode(trainee.course) === course);
  const movedOut = movements.filter(movement => normaliseCourseCode(movement.fromCourse) === course && normaliseCourseCode(movement.toCourse) !== course);
  const backCoursed = movedOut.filter(movement => movement.direction === 'back-course').length;
  const forwardCoursed = movedOut.filter(movement => movement.direction === 'forward-course').length;
  const suspended = courseTrainees.filter(trainee => isTraineeSuspended(trainee)).length;
  const paused = courseTrainees.filter(trainee => trainee.isPaused && !isTraineeSuspended(trainee)).length;
  const remaining = courseTrainees.filter(trainee => !trainee.isPaused && !isTraineeSuspended(trainee)).length;
  const started = Math.max(courseTrainees.length + movedOut.length, remaining + paused + suspended + backCoursed + forwardCoursed);

  const courses = Array.from(new Set([
    ...trainees.map(trainee => normaliseCourseCode(trainee.course)),
    ...movements.map(movement => normaliseCourseCode(movement.fromCourse)),
  ].filter(Boolean))).filter(candidate => candidate !== course);
  const selectedScale = Math.max(1, started);
  const historicalRows = courses.map(candidate => {
    const candidateTrainees = trainees.filter(trainee => normaliseCourseCode(trainee.course) === candidate);
    const candidateMovedOut = movements.filter(movement => normaliseCourseCode(movement.fromCourse) === candidate && normaliseCourseCode(movement.toCourse) !== candidate);
    const candidateStarted = Math.max(1, candidateTrainees.length + candidateMovedOut.length);
    return {
      started: 1,
      failed: candidateTrainees.filter(trainee => isTraineeSuspended(trainee)).length / candidateStarted,
      paused: candidateTrainees.filter(trainee => trainee.isPaused && !isTraineeSuspended(trainee)).length / candidateStarted,
      backCoursed: candidateMovedOut.filter(movement => movement.direction === 'back-course').length / candidateStarted,
      forwardCoursed: candidateMovedOut.filter(movement => movement.direction === 'forward-course').length / candidateStarted,
      remaining: candidateTrainees.filter(trainee => !trainee.isPaused && !isTraineeSuspended(trainee)).length / candidateStarted,
    };
  });
  const averageRatio = (key: CourseOutcomeMetricKey): number => {
    if (historicalRows.length === 0) return 0;
    return historicalRows.reduce((sum, row) => sum + Number(row[key] || 0), 0) / historicalRows.length;
  };
  const historicalAverage = (key: CourseOutcomeMetricKey): number => averageRatio(key) * selectedScale;

  return [
    { key: 'started', label: 'Started on course', current: started, historicalAverage: historicalAverage('started') },
    { key: 'failed', label: 'Failed / suspended', current: suspended, historicalAverage: historicalAverage('failed') },
    { key: 'paused', label: 'Paused', current: paused, historicalAverage: historicalAverage('paused') },
    { key: 'backCoursed', label: 'Back-coursed', current: backCoursed, historicalAverage: historicalAverage('backCoursed') },
    { key: 'forwardCoursed', label: 'Forward-coursed', current: forwardCoursed, historicalAverage: historicalAverage('forwardCoursed') },
    { key: 'remaining', label: 'Remaining on course', current: remaining, historicalAverage: historicalAverage('remaining') },
  ];
};

const buildMetricDefinitions = (
  metrics: BliMetricsResponse,
  date: string,
  events: ScheduleEvent[],
  currentAircraftAvailable: number | undefined,
  totalAircraft: number | undefined,
  selectedStaff: string,
): MetricDefinition[] => {
  const dates = metrics.dates.length > 0 ? metrics.dates : [date];
  const fallback = buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft);
  const eventSeries = metrics.eventSeries.length > 0 ? metrics.eventSeries : fallback.eventSeries;
  const staffDays = selectedStaff
    ? (metrics.staffSeries?.[selectedStaff] || dates.map(day => ({ date: day, flightEvents: 0, simulatorEvents: 0, totalEvents: 0, flightHours: 0, simulatorHours: 0 })))
    : dates.map(day => ({ date: day, flightEvents: 0, simulatorEvents: 0, totalEvents: 0, flightHours: 0, simulatorHours: 0 }));
  const availabilitySeries = metrics.availabilitySeries.length > 0 ? metrics.availabilitySeries : fallback.availabilitySeries;
  const liveAvailabilityAvailable = currentAircraftAvailable !== undefined
    && Number.isFinite(Number(currentAircraftAvailable))
    && totalAircraft !== undefined
    && Number.isFinite(Number(totalAircraft))
    && Number(totalAircraft) > 0;
  const availabilityByDate = new Map<string, AvailabilityMetrics>();
  availabilitySeries.forEach(point => {
    availabilityByDate.set(normalizeAvailabilityDate(point.date), point);
  });
  if (liveAvailabilityAvailable && dates.map(normalizeAvailabilityDate).includes(date)) {
    const existing = availabilityByDate.get(date);
    if (!existing || existing.availableAverage === null || !Number.isFinite(Number(existing.availableAverage))) {
      availabilityByDate.set(date, {
        date,
        availableAverage: Number(currentAircraftAvailable),
        totalAircraft: Number(totalAircraft),
        availabilityPct: (Number(currentAircraftAvailable) / Number(totalAircraft)) * 100,
      });
    }
  }

  const availabilityPoints = dates
    .map(day => availabilityByDate.get(normalizeAvailabilityDate(day)))
    .filter((point): point is AvailabilityMetrics => Boolean(point))
    .filter(point => point.availableAverage !== null && Number.isFinite(Number(point.availableAverage)))
    .map(point => ({
      date: point.date,
      value: Number(point.availableAverage),
    }));
  const flightPoints = eventSeries.map(point => ({ date: point.date, value: point.flightEvents }));
  const flightHourPoints = eventSeries.map(point => ({ date: point.date, value: point.flightHours }));
  const simPoints = eventSeries.map(point => ({ date: point.date, value: point.simulatorEvents }));
  const simHourPoints = eventSeries.map(point => ({ date: point.date, value: point.simulatorHours }));
  const totalPoints = eventSeries.map(point => ({ date: point.date, value: point.totalEvents }));
  const staffFlightPoints = staffDays.map(point => ({ date: point.date, value: point.flightEvents }));
  const staffSimPoints = staffDays.map(point => ({ date: point.date, value: point.simulatorEvents }));
  const staffTotalPoints = staffDays.map(point => ({ date: point.date, value: point.totalEvents }));
  const cancellationTotal = metrics.cancellationsByCategory.reduce((sum, category) => sum + category.total, 0);

  return [
    {
      key: 'availability',
      title: 'Aircraft availability',
      subtitle: 'Daily average aircraft available from AC History records, with the selected DFP day filled from live aircraft availability when history is not saved yet.',
      icon: PaperAirplaneIcon,
      color: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
      unit: ' ac',
      series: availabilityPoints,
      summary: `${compactNumber(valueAvg(availabilityPoints), 1)} ac`,
      footer: `${availabilityPoints.filter(point => point.value !== null).length} availability points`,
    },
    {
      key: 'flight',
      title: 'Flight events per day',
      subtitle: 'Scheduled flying events counted from published DFP snapshots.',
      icon: ChartBarIcon,
      color: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
      series: flightPoints,
      summary: compactNumber(valueSum(flightPoints)),
      footer: 'total flights in range',
    },
    {
      key: 'flightHours',
      title: 'Flight hours per day',
      subtitle: 'Total scheduled flying hours from published DFP snapshots.',
      icon: ClockIcon,
      color: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
      unit: 'h',
      series: flightHourPoints,
      summary: `${compactNumber(valueSum(flightHourPoints), 1)}h`,
      footer: 'total flight hours',
    },
    {
      key: 'simulator',
      title: 'Simulator events per day',
      subtitle: 'FTD and simulator events counted by published DFP day.',
      icon: ComputerDesktopIcon,
      color: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
      series: simPoints,
      summary: compactNumber(valueSum(simPoints)),
      footer: 'total simulator events',
    },
    {
      key: 'simulatorHours',
      title: 'Simulator hours per day',
      subtitle: 'Total scheduled FTD and simulator hours by published DFP day.',
      icon: ClockIcon,
      color: 'border-teal-400/40 bg-teal-400/10 text-teal-200',
      unit: 'h',
      series: simHourPoints,
      summary: `${compactNumber(valueSum(simHourPoints), 1)}h`,
      footer: 'total simulator hours',
    },
    {
      key: 'total',
      title: 'Total events per day',
      subtitle: 'All scheduled events in the selected operational timeline.',
      icon: Squares2X2Icon,
      color: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
      series: totalPoints,
      summary: compactNumber(valueSum(totalPoints)),
      footer: 'all scheduled events',
    },
    {
      key: 'cancellations',
      title: 'Cancellation codes',
      subtitle: 'Cancellation codes grouped by event category.',
      icon: ExclamationTriangleIcon,
      color: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
      series: makeSeries(dates, {}),
      summary: compactNumber(cancellationTotal),
      footer: 'cancellations in range',
    },
    {
      key: 'staffFlight',
      title: 'Staff flight events',
      subtitle: selectedStaff ? `${selectedStaff} flight events per day.` : 'Open to select staff and inspect flying load.',
      icon: UserGroupIcon,
      color: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
      series: staffFlightPoints,
      summary: compactNumber(valueSum(staffFlightPoints)),
      footer: 'selected staff flights',
    },
    {
      key: 'staffSimulator',
      title: 'Staff simulator events',
      subtitle: selectedStaff ? `${selectedStaff} simulator events per day.` : 'Open to select staff and inspect simulator load.',
      icon: ComputerDesktopIcon,
      color: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
      series: staffSimPoints,
      summary: compactNumber(valueSum(staffSimPoints)),
      footer: 'selected staff simulator events',
    },
    {
      key: 'staffTotal',
      title: 'Staff total events',
      subtitle: selectedStaff ? `${selectedStaff} all scheduled events per day.` : 'Open to select staff and inspect total load.',
      icon: ClockIcon,
      color: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
      series: staffTotalPoints,
      summary: compactNumber(valueSum(staffTotalPoints)),
      footer: 'selected staff total events',
    },
  ];
};

const MiniLine: React.FC<{ series: ChartPoint[]; color: string; height?: number }> = ({ series, color, height = 54 }) => {
  const width = 180;
  const values = series.map(point => Number(point.value) || 0);
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible" role="img" aria-label="Metric trend preview">
      <polyline points={`0,${height} ${points} ${width},${height}`} fill={`${color}22`} stroke="none" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const FullLineChart: React.FC<{ series: ChartPoint[]; color: string; label: string; unit?: string }> = ({ series, color, label, unit }) => {
  const width = Math.max(760, series.length * 7);
  const height = 320;
  const padding = { top: 24, right: 26, bottom: 42, left: 54 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = series.map(point => Number(point.value) || 0);
  const axis = niceAxisRange(values);
  const max = axis.max;
  const min = axis.min;
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = padding.left + (series.length <= 1 ? 0 : (index / (series.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value, date: series[index].date };
  });
  const pointString = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-950/45 p-3">
      <svg width={width} height={height} role="img" aria-label={`${label} chart`}>
        {axis.ticks.map(value => {
          const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
          return (
            <g key={value}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="rgb(148,163,184)" fontSize="11">
                {compactNumber(value, max < 10 ? 1 : 0)}{unit || ''}
              </text>
            </g>
          );
        })}
        <polyline points={`${padding.left},${padding.top + chartHeight} ${pointString} ${width - padding.right},${padding.top + chartHeight}`} fill={`${color}20`} />
        <polyline points={pointString} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="1.5" fill={color}>
            <title>{dateLabel(point.date)}: {compactNumber(point.value, 1)}{unit || ''}</title>
          </circle>
        ))}
        {series.length > 0 && (
          <>
            <text x={padding.left} y={height - 12} fill="rgb(148,163,184)" fontSize="12">{dateLabel(series[0].date)}</text>
            <text x={width - padding.right} y={height - 12} textAnchor="end" fill="rgb(148,163,184)" fontSize="12">{dateLabel(series[series.length - 1].date)}</text>
          </>
        )}
      </svg>
    </div>
  );
};

const cancellationColumnColor = (category: string): string => {
  const key = category.toLowerCase();
  if (key.includes('flight')) return 'bg-blue-400';
  if (key.includes('simulator')) return 'bg-emerald-400';
  if (key.includes('cpt')) return 'bg-violet-400';
  if (key.includes('ground')) return 'bg-amber-400';
  if (key.includes('deployment')) return 'bg-fuchsia-400';
  return 'bg-rose-400';
};

const CancellationColumnChart: React.FC<{ categories: CancellationCategory[]; cancellationCodes?: CancellationCode[] }> = ({ categories, cancellationCodes = [] }) => {
  const cancellationLegendByCode = new Map(cancellationCodes.map(code => [code.code.toUpperCase(), code]));
  const columns = categories
    .flatMap(category => category.codes.map(code => ({
      category: category.category,
      code: code.code,
      count: code.count,
    })))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
  const maxCount = Math.max(1, ...columns.map(column => column.count));
  const total = columns.reduce((sum, column) => sum + column.count, 0);
  const legendItems = [...new Map(columns.map(column => [column.code.toUpperCase(), column])).values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(column => {
      const definition = cancellationLegendByCode.get(column.code.toUpperCase());
      const description = definition
        ? [definition.category, definition.description]
          .filter(Boolean)
          .filter((part, index, parts) => index === 0 || part.toLowerCase() !== parts[0].toLowerCase())
          .join(' ')
        : column.category;
      return {
        code: column.code,
        description,
        category: column.category,
      };
    });

  if (columns.length === 0) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-5 text-sm text-slate-400">
        No cancellation codes were recorded in this timeline.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Cancellation codes by category</h3>
          <p className="text-sm text-slate-400">{compactNumber(total)} cancellations across {compactNumber(categories.length)} event categories</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-x-auto">
          <div className="flex h-80 min-w-max items-end gap-3 border-b border-l border-slate-700/80 px-3 pb-12 pt-6">
            {columns.map(column => (
              <div key={`${column.category}-${column.code}`} className="relative flex h-full w-20 flex-col items-center justify-end">
                <span className="mb-2 text-xs font-semibold text-slate-200">{column.count}</span>
                <div
                  className={`w-11 rounded-t-md ${cancellationColumnColor(column.category)} shadow-[0_0_16px_rgba(251,113,133,0.22)]`}
                  style={{ height: `${Math.max(10, (column.count / maxCount) * 220)}px` }}
                  title={`${column.category} ${column.code}: ${column.count}`}
                />
                <div className="absolute -bottom-10 w-24 text-center">
                  <div className="truncate text-[11px] font-semibold text-slate-200" title={column.code}>{column.code}</div>
                  <div className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-500" title={column.category}>{column.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="rounded-md border border-slate-700/80 bg-slate-950/50 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Code Key</div>
          <div className="space-y-1.5">
            {legendItems.map(item => (
              <div key={item.code} className="flex items-start gap-2 text-[11px] leading-4 text-slate-300">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${cancellationColumnColor(item.category)}`} />
                <span>
                  <span className="font-bold text-slate-100">{item.code}</span>
                  <span className="text-slate-500"> - </span>
                  <span>{item.description}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map(category => (
          <span key={category.category} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            {category.category}: {category.total}
          </span>
        ))}
      </div>
    </div>
  );
};

const StatRow: React.FC<{ label: string; value: string; subtext?: string; accent?: string }> = ({ label, value, subtext, accent = 'text-white' }) => (
  <div className="rounded-md border border-slate-700/80 bg-slate-950/50 p-3">
    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
    <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
    {subtext && <div className="mt-1 text-xs text-slate-500">{subtext}</div>}
  </div>
);

const staffRankingField = (key: MetricKey): DailyMetricNumberKey | null => {
  if (key === 'staffFlight') return 'flightEvents';
  if (key === 'staffSimulator') return 'simulatorEvents';
  if (key === 'staffTotal') return 'totalEvents';
  return null;
};

const MetricStatsPanel: React.FC<{
  metric: MetricDefinition;
  metrics: BliMetricsResponse;
  staffGroups: [string, Instructor[]][];
  selectedStaff: string;
}> = ({ metric, metrics, staffGroups, selectedStaff }) => {
  const stats = seriesStats(metric.series);
  const primaryValue = metric.key === 'availability'
    ? formatMetricAmount(stats.average, metric)
    : formatMetricAmount(stats.total, metric);
  const flightHourStats = seriesStats(metrics.eventSeries.map(point => ({ date: point.date, value: point.flightHours })));
  const simulatorHourStats = seriesStats(metrics.eventSeries.map(point => ({ date: point.date, value: point.simulatorHours })));
  const allStaff = staffGroups.flatMap(([, staff]) => staff);
  const selectedStaffInfo = allStaff.find(staff => staff.name === selectedStaff);
  const selectedUnit = selectedStaffInfo?.unit || '';
  const rankingField = staffRankingField(metric.key);
  const rankedStaff = rankingField
    ? allStaff
      .filter(staff => !selectedUnit || (staff.unit || 'Unassigned') === selectedUnit)
      .map(staff => ({
        staff,
        total: sumDailyMetric(metrics.staffSeries?.[staff.name] || [], rankingField),
      }))
      .sort((a, b) => b.total - a.total || staffSort(a.staff, b.staff))
    : [];
  const selectedRankIndex = rankingField ? rankedStaff.findIndex(row => row.staff.name === selectedStaff) : -1;
  const visibleRanking = rankedStaff.slice(0, 8);
  const selectedRanking = selectedRankIndex >= 8 ? rankedStaff[selectedRankIndex] : null;

  return (
    <aside className="space-y-3 rounded-lg border border-slate-700/80 bg-slate-950/45 p-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Selected Period</h3>
        <p className="mt-1 text-xs text-slate-500">{compactNumber(stats.dataPointCount)} daily data points</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <StatRow
          label={metric.key === 'availability' ? 'Average' : 'Total'}
          value={primaryValue}
          accent="text-cyan-200"
        />
        <StatRow
          label={metric.key === 'availability' ? 'Mean by day' : 'Average per day'}
          value={formatMetricAmount(stats.average, metric)}
        />
        <StatRow
          label="Highest day"
          value={formatMetricAmount(stats.highest?.value, metric)}
          subtext={stats.highest ? dateLabel(stats.highest.date) : 'No date'}
          accent="text-emerald-200"
        />
        <StatRow
          label="Lowest day"
          value={formatMetricAmount(stats.lowest?.value, metric)}
          subtext={stats.lowest ? dateLabel(stats.lowest.date) : 'No date'}
          accent="text-amber-200"
        />
      </div>

      <div className="rounded-md border border-slate-700/80 bg-slate-950/50 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hours in period</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-xs text-slate-500">Flight</div>
            <div className="text-base font-bold text-sky-200">{compactNumber(flightHourStats.total, 1)}h</div>
            <div className="text-[11px] text-slate-500">{compactNumber(flightHourStats.average, 1)}h/day</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Simulator</div>
            <div className="text-base font-bold text-teal-200">{compactNumber(simulatorHourStats.total, 1)}h</div>
            <div className="text-[11px] text-slate-500">{compactNumber(simulatorHourStats.average, 1)}h/day</div>
          </div>
        </div>
      </div>

      {rankingField && (
        <div className="rounded-md border border-slate-700/80 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {selectedUnit || 'All staff'} ranking
            </div>
            {selectedRankIndex >= 0 && (
              <div className="text-xs font-semibold text-cyan-200">#{selectedRankIndex + 1}</div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {visibleRanking.map((row, index) => (
              <div
                key={row.staff.name}
                className={`grid grid-cols-[28px_minmax(0,1fr)_42px] items-center gap-2 rounded px-2 py-1.5 text-xs ${row.staff.name === selectedStaff ? 'bg-cyan-400/12 text-cyan-100' : 'text-slate-300'}`}
              >
                <span className="text-slate-500">{index + 1}</span>
                <span className="truncate">{row.staff.rank} {row.staff.name}</span>
                <span className="text-right font-semibold">{compactNumber(row.total)}</span>
              </div>
            ))}
            {selectedRanking && (
              <>
                <div className="px-2 text-center text-slate-600">...</div>
                <div className="grid grid-cols-[28px_minmax(0,1fr)_42px] items-center gap-2 rounded bg-cyan-400/12 px-2 py-1.5 text-xs text-cyan-100">
                  <span>{selectedRankIndex + 1}</span>
                  <span className="truncate">{selectedRanking.staff.rank} {selectedRanking.staff.name}</span>
                  <span className="text-right font-semibold">{compactNumber(selectedRanking.total)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

const CancellationPreview: React.FC<{ categories: CancellationCategory[] }> = ({ categories }) => {
  const max = Math.max(1, ...categories.map(category => category.total));
  return (
    <div className="space-y-2">
      {categories.slice(0, 4).map(category => (
        <div key={category.category} className="flex items-center gap-2">
          <span className="w-20 truncate text-[10px] text-slate-400">{category.category}</span>
          <div className="h-2 flex-1 rounded-full bg-slate-950">
            <div className="h-2 rounded-full bg-rose-400" style={{ width: `${Math.max(5, (category.total / max) * 100)}%` }} />
          </div>
          <span className="w-7 text-right text-[10px] text-slate-300">{category.total}</span>
        </div>
      ))}
      {categories.length === 0 && <div className="text-xs text-slate-500">No cancellation data in range</div>}
    </div>
  );
};

const MetricTile: React.FC<{
  metric: MetricDefinition;
  onOpen: (metric: MetricDefinition) => void;
  cancellationCategories: CancellationCategory[];
}> = ({ metric, onOpen, cancellationCategories }) => {
  const Icon = metric.icon;
  return (
    <button
      onClick={() => onOpen(metric)}
      className="group flex min-h-[214px] flex-col rounded-lg border border-slate-700/80 bg-slate-900/80 p-4 text-left shadow-[0_10px_26px_rgba(0,0,0,0.22)] transition hover:border-cyan-400/60 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-14 w-14 items-center justify-center rounded-lg border ${metric.color}`}>
          <Icon className="h-8 w-8" />
        </div>
        <ArrowTopRightOnSquareIcon className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-300" />
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold text-white">{metric.title}</h3>
        <p className="mt-1 min-h-[34px] text-xs leading-5 text-slate-400">{metric.subtitle}</p>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-normal text-white">{metric.summary}</div>
      <div className="mt-4 flex-1">
        {metric.key === 'cancellations'
          ? <CancellationPreview categories={cancellationCategories} />
          : <MiniLine series={metric.series} color={metricStrokeColor(metric.color)} />}
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.footer}</p>
    </button>
  );
};

const CourseOutcomeComparison: React.FC<{
  traineesData: Trainee[];
  movements: CourseMovementEvent[];
  operationalContext?: BliOperationalContext;
  selectedUnitScopeKey: string;
}> = ({ traineesData, movements, operationalContext, selectedUnitScopeKey }) => {
  const scopedTrainees = useMemo(
    () => traineesData.filter(trainee => traineeMatchesBliUnit(trainee, operationalContext, selectedUnitScopeKey)),
    [operationalContext, selectedUnitScopeKey, traineesData],
  );
  const scopedMovements = useMemo(
    () => movements.filter(movement => courseMovementMatchesBliUnit(movement, operationalContext, selectedUnitScopeKey)),
    [movements, operationalContext, selectedUnitScopeKey],
  );
  const courses = useMemo(() => (
    Array.from(new Set([
      ...scopedTrainees.map(trainee => normaliseCourseCode(trainee.course)),
      ...scopedMovements.map(movement => normaliseCourseCode(movement.fromCourse)),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  ), [scopedMovements, scopedTrainees]);
  const [selectedCourse, setSelectedCourse] = useState('');

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourse('');
      return;
    }
    if (!courses.includes(selectedCourse)) setSelectedCourse(courses[0]);
  }, [courses, selectedCourse]);

  const rows = useMemo(() => (
    selectedCourse
      ? buildCourseOutcomeMetrics(selectedCourse, scopedTrainees, scopedMovements)
      : []
  ), [scopedMovements, scopedTrainees, selectedCourse]);
  const axis = niceAxisRange(rows.flatMap(row => [row.current, row.historicalAverage]), 5);
  const max = Math.max(1, axis.max);

  return (
    <section className="rounded-lg border border-slate-700/80 bg-slate-900/80 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Course Outcomes</p>
          <h3 className="mt-1 text-lg font-bold text-white">Course status comparison</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
            Current course counts are compared with historical course averages, normalised to the selected course intake size. Course movement history is captured from new back-course and forward-course actions.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Course</span>
          <select
            value={selectedCourse}
            onChange={event => setSelectedCourse(event.target.value)}
            className="h-10 min-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
          >
            {courses.map(course => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/50 px-4 py-8 text-center text-sm text-slate-500">
          No course roster data is available for this unit.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-end gap-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span className="flex items-center gap-2"><span className="h-2 w-5 rounded bg-cyan-400" />Selected course</span>
            <span className="flex items-center gap-2"><span className="h-2 w-5 rounded bg-slate-500" />Historical average</span>
          </div>
          {rows.map(row => {
            const currentPct = Math.max(0, Math.min(100, (row.current / max) * 100));
            const historicalPct = Math.max(0, Math.min(100, (row.historicalAverage / max) * 100));
            return (
              <div key={row.key} className="grid grid-cols-[170px_minmax(0,1fr)_76px] items-center gap-3">
                <div className="text-sm font-semibold text-slate-200">{row.label}</div>
                <div className="space-y-1.5">
                  <div className="h-3 rounded bg-slate-950 ring-1 ring-slate-800">
                    <div className="h-full rounded bg-cyan-400" style={{ width: `${currentPct}%` }} />
                  </div>
                  <div className="h-3 rounded bg-slate-950 ring-1 ring-slate-800">
                    <div className="h-full rounded bg-slate-500" style={{ width: `${historicalPct}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div className="font-bold text-white">{compactNumber(row.current, 0)}</div>
                  <div>{compactNumber(row.historicalAverage, 1)} avg</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

const BliPeriodWindow: React.FC<{
  title: string;
  periodKey: PeriodKey;
  boundary: BliYearBoundary;
  isEditing: boolean;
  draft: BliYearBoundary;
  onDraftChange: (boundary: BliYearBoundary) => void;
  onRequestEdit: (periodKey: PeriodKey) => void;
  onSave: (periodKey: PeriodKey) => void;
  onCancel: () => void;
}> = ({ title, periodKey, boundary, isEditing, draft, onDraftChange, onRequestEdit, onSave, onCancel }) => (
  <div className={`${isEditing ? 'min-w-[220px]' : 'min-w-[128px]'} rounded border border-slate-700/70 bg-slate-950/55 p-2 shadow-sm`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</div>
        {!isEditing && <div className="mt-0.5 text-[11px] font-semibold text-slate-300">{periodLabel(boundary)}</div>}
      </div>
      {!isEditing && (
        <button
          type="button"
          onClick={() => onRequestEdit(periodKey)}
          className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 hover:border-cyan-400 hover:text-cyan-200"
        >
          Edit
        </button>
      )}
    </div>
    {isEditing && (
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-slate-500">Start</span>
            <input
              value={draft.start}
              onChange={event => onDraftChange({ ...draft, start: event.target.value })}
              placeholder="MM-DD"
              className="h-7 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-slate-500">End</span>
            <input
              value={draft.end}
              onChange={event => onDraftChange({ ...draft, end: event.target.value })}
              placeholder="MM-DD"
              className="h-7 w-full rounded border border-slate-700 bg-slate-900 px-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white">
            Cancel
          </button>
          <button type="button" onClick={() => onSave(periodKey)} className="rounded bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-cyan-500">
            Save
          </button>
        </div>
      </div>
    )}
  </div>
);

const MetricModal: React.FC<{
  metric: MetricDefinition;
  onClose: () => void;
  date: string;
  events: ScheduleEvent[];
  currentAircraftAvailable?: number;
  totalAircraft?: number;
  initialMetrics: BliMetricsResponse;
  staffGroups: [string, Instructor[]][];
  initialStaff: string;
  periodSettings: BliPeriodSettings;
  unitScopeOptions: BliUnitScopeOption[];
  selectedUnitScopeKey: string;
  onUnitScopeChange: (key: string) => void;
  operationalContext?: BliOperationalContext;
  cancellationCodes?: CancellationCode[];
}> = ({ metric, onClose, date, events, currentAircraftAvailable, totalAircraft, initialMetrics, staffGroups, initialStaff, periodSettings, unitScopeOptions, selectedUnitScopeKey, onUnitScopeChange, operationalContext, cancellationCodes = [] }) => {
  const [timeline, setTimeline] = useState<TimelineKey>('7d');
  const [modalMetrics, setModalMetrics] = useState<BliMetricsResponse>(initialMetrics);
  const [selectedStaff, setSelectedStaff] = useState(initialStaff);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => getTimelineRange(date, timeline, periodSettings), [date, periodSettings, timeline]);
  const dateRangeLabel = useMemo(() => formatDateRange(range.startDate, range.endDate), [range.endDate, range.startDate]);
  const showStaffSelector = isStaffMetricKey(metric.key);
  const showUnitSelector = isUnitScopedMetricKey(metric.key) && unitScopeOptions.length > 1;
  const requestContext = showUnitSelector
    ? buildBliRequestContext(operationalContext, unitScopeOptions, selectedUnitScopeKey)
    : buildBliRequestContext(operationalContext, [], 'combined');

  useEffect(() => {
    setSelectedStaff(initialStaff);
  }, [initialStaff, metric.key]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchBliMetrics(range.startDate, range.endDate, controller.signal, requestContext)
      .then((data: BliMetricsResponse) => {
        setModalMetrics(data);
      })
      .catch(fetchError => {
        if (fetchError.name === 'AbortError') return;
        console.error('Failed to load expanded BLI metrics:', fetchError);
        setError('Published metrics could not be loaded for this graph. Showing the current DFP day only.');
        setModalMetrics(buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [date, range.endDate, range.startDate, requestContext.availabilityUnitCode, requestContext.eventUnitCode, requestContext.locationCode]);

  const activeMetric = useMemo(() => {
    return buildMetricDefinitions(modalMetrics, date, events, currentAircraftAvailable, totalAircraft, selectedStaff)
      .find(candidate => candidate.key === metric.key) || metric;
  }, [currentAircraftAvailable, date, events, metric, modalMetrics, selectedStaff, totalAircraft]);
  const metricStatusText = activeMetric.key === 'availability'
    ? `${activeMetric.series.length} AC History availability records in this graph`
    : `${modalMetrics.snapshotCount} published snapshots in this graph`;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-6 py-8" onMouseDown={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">BLI</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{activeMetric.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{activeMetric.subtitle} · {dateRangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Timeline</span>
              <select
                value={timeline}
                onChange={event => setTimeline(event.target.value as TimelineKey)}
                className="h-10 min-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
              >
                {TIMELINE_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            {showUnitSelector && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unit data</span>
                <select
                  value={selectedUnitScopeKey}
                  onChange={event => onUnitScopeChange(event.target.value)}
                  className="h-10 min-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
                >
                  {unitScopeOptions.map(option => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
            {showStaffSelector && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Staff</span>
                <select
                  value={selectedStaff}
                  onChange={event => setSelectedStaff(event.target.value)}
                  className="h-10 min-w-[260px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
                >
                  {staffGroups.map(([unit, staff]) => (
                    <optgroup key={unit} label={unit}>
                      {staff.map(person => (
                        <option key={person.name} value={person.name}>{person.rank} · {person.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <button
              onClick={onClose}
              className="h-10 rounded-md border border-slate-700 px-3 text-sm font-semibold text-slate-300 hover:border-cyan-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{loading ? 'Loading this graph...' : metricStatusText}</span>
          {error && <span className="text-amber-300">{error}</span>}
        </div>

        {activeMetric.key === 'cancellations' ? (
          <CancellationColumnChart categories={modalMetrics.cancellationsByCategory} cancellationCodes={cancellationCodes} />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <FullLineChart
              series={activeMetric.series}
              color={metricStrokeColor(activeMetric.color)}
              label={activeMetric.title}
              unit={activeMetric.unit}
            />
            <MetricStatsPanel
              metric={activeMetric}
              metrics={modalMetrics}
              staffGroups={staffGroups}
              selectedStaff={selectedStaff}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const BliTab: React.FC<BliTabProps> = ({ date, events, instructorsData, traineesData, currentAircraftAvailable, totalAircraft, operationalContext, cancellationCodes = [] }) => {
  const [metrics, setMetrics] = useState<BliMetricsResponse>(() => buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseMovements, setCourseMovements] = useState<CourseMovementEvent[]>([]);
  const [courseMovementError, setCourseMovementError] = useState<string | null>(null);
  const [openMetric, setOpenMetric] = useState<MetricDefinition | null>(null);
  const [periodSettings, setPeriodSettings] = useState<BliPeriodSettings>(() => loadBliPeriodSettings());
  const [editingPeriod, setEditingPeriod] = useState<PeriodKey | null>(null);
  const [periodDraft, setPeriodDraft] = useState<BliPeriodSettings>(() => loadBliPeriodSettings());
  const unitScopeOptions = useMemo(() => buildUnitScopeOptions(operationalContext), [operationalContext]);
  const [selectedUnitScopeKey, setSelectedUnitScopeKey] = useState('combined');
  const requestContext = useMemo(
    () => buildBliRequestContext(operationalContext, unitScopeOptions, selectedUnitScopeKey),
    [operationalContext, selectedUnitScopeKey, unitScopeOptions],
  );

  const previewRange = useMemo(() => getTimelineRange(date, '7d', periodSettings), [date, periodSettings]);
  const previewDateRangeLabel = useMemo(
    () => formatDateRange(previewRange.startDate, previewRange.endDate),
    [previewRange.endDate, previewRange.startDate],
  );

  useEffect(() => {
    if (unitScopeOptions.length === 0) {
      setSelectedUnitScopeKey('combined');
      return;
    }
    if (!unitScopeOptions.some(option => option.key === selectedUnitScopeKey)) {
      setSelectedUnitScopeKey(unitScopeOptions[0].key);
    }
  }, [selectedUnitScopeKey, unitScopeOptions]);

  const requestPeriodEdit = async (periodKey: PeriodKey) => {
    const password = await showDarkPrompt({
      title: 'Change BLI Year Dates',
      message: `Enter your password to change the ${periodKey === 'cy' ? 'Calendar Year' : 'Financial Year'} reporting dates.`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Unlock',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The BLI reporting dates were not unlocked.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The BLI reporting dates were not unlocked.', 'Password Check Failed', 'error');
      return;
    }

    setPeriodDraft(periodSettings);
    setEditingPeriod(periodKey);
  };

  const updatePeriodDraft = (periodKey: PeriodKey, boundary: BliYearBoundary) => {
    setPeriodDraft(prev => ({ ...prev, [periodKey]: boundary }));
  };

  const cancelPeriodEdit = () => {
    setPeriodDraft(periodSettings);
    setEditingPeriod(null);
  };

  const savePeriodBoundary = async (periodKey: PeriodKey) => {
    const draft = periodDraft[periodKey];
    const start = normaliseMonthDay(draft.start);
    const end = normaliseMonthDay(draft.end);
    if (!start || !end) {
      await showDarkAlert('Enter dates in MM-DD format, for example 01-01 or 07-01.', 'Invalid Date Format', 'warning');
      return;
    }
    if (start === end) {
      await showDarkAlert('Start and end dates must be different.', 'Invalid Reporting Period', 'warning');
      return;
    }

    const nextSettings = {
      ...periodSettings,
      [periodKey]: { start, end },
    };
    setPeriodSettings(nextSettings);
    setPeriodDraft(nextSettings);
    saveBliPeriodSettings(nextSettings);
    setEditingPeriod(null);
  };

  const sortedStaff = useMemo(() => {
    const deduped = new Map<string, Instructor>();
    instructorsData.forEach(person => {
      if (person?.name) deduped.set(person.name, person);
    });
    return [...deduped.values()].sort(staffSort);
  }, [instructorsData]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchBliMetrics(previewRange.startDate, previewRange.endDate, controller.signal, requestContext)
      .then((data: BliMetricsResponse) => {
        setMetrics(data);
      })
      .catch(fetchError => {
        if (fetchError.name === 'AbortError') return;
        console.error('Failed to load BLI metrics:', fetchError);
        setError('Published historical metrics could not be loaded. Showing the current DFP day only.');
        setMetrics(buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [date, previewRange.endDate, previewRange.startDate, requestContext.availabilityUnitCode, requestContext.eventUnitCode, requestContext.locationCode]);

  useEffect(() => {
    const controller = new AbortController();
    setCourseMovementError(null);
    fetchCourseMovements(controller.signal, requestContext)
      .then(setCourseMovements)
      .catch(fetchError => {
        if (fetchError.name === 'AbortError') return;
        console.error('Failed to load BLI course movements:', fetchError);
        setCourseMovementError('Course movement history could not be loaded.');
        setCourseMovements([]);
      });
    return () => controller.abort();
  }, [requestContext.eventUnitCode, requestContext.locationCode]);

  const staffGroups = useMemo(() => {
    const groups = new Map<string, Instructor[]>();
    sortedStaff.forEach(staff => {
      const unit = staff.unit || 'Unassigned';
      if (!groups.has(unit)) groups.set(unit, []);
      groups.get(unit)?.push(staff);
    });
    return [...groups.entries()];
  }, [sortedStaff]);

  const previewStaff = useMemo(() => {
    const activeStaff = sortedStaff.find(staff => metrics.staffSeries?.[staff.name]?.some(day => day.totalEvents > 0));
    return activeStaff?.name || sortedStaff[0]?.name || '';
  }, [metrics.staffSeries, sortedStaff]);

  const metricsList = useMemo<MetricDefinition[]>(() => (
    buildMetricDefinitions(metrics, date, events, currentAircraftAvailable, totalAircraft, previewStaff)
  ), [currentAircraftAvailable, date, events, metrics, previewStaff, totalAircraft]);

  return (
    <div className="space-y-5">
      {openMetric && (
        <MetricModal
          metric={openMetric}
          onClose={() => setOpenMetric(null)}
          date={date}
          events={events}
          currentAircraftAvailable={currentAircraftAvailable}
          totalAircraft={totalAircraft}
          initialMetrics={metrics}
          staffGroups={staffGroups}
          initialStaff={previewStaff}
          periodSettings={periodSettings}
          unitScopeOptions={unitScopeOptions}
          selectedUnitScopeKey={selectedUnitScopeKey}
          onUnitScopeChange={setSelectedUnitScopeKey}
          operationalContext={operationalContext}
          cancellationCodes={cancellationCodes}
        />
      )}

      <div className="relative rounded-lg border border-cyan-500/25 bg-slate-900/80 p-4">
        <div className="mb-3 flex flex-col items-end gap-2 lg:absolute lg:right-3 lg:top-3 lg:mb-0">
          <BliPeriodWindow
            title="CY"
            periodKey="cy"
            boundary={periodSettings.cy}
            isEditing={editingPeriod === 'cy'}
            draft={periodDraft.cy}
            onDraftChange={boundary => updatePeriodDraft('cy', boundary)}
            onRequestEdit={requestPeriodEdit}
            onSave={savePeriodBoundary}
            onCancel={cancelPeriodEdit}
          />
          <BliPeriodWindow
            title="FY"
            periodKey="fy"
            boundary={periodSettings.fy}
            isEditing={editingPeriod === 'fy'}
            draft={periodDraft.fy}
            onDraftChange={boundary => updatePeriodDraft('fy', boundary)}
            onRequestEdit={requestPeriodEdit}
            onSave={savePeriodBoundary}
            onCancel={cancelPeriodEdit}
          />
        </div>
        <div className="lg:pr-[250px]">
          <div className="max-w-4xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">BLI</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Business-Level Intelligence</h2>
            <p className="mt-1 text-sm text-slate-400">
              Operational schedule, cancellation and utilisation signals. Preview cards show {previewDateRangeLabel}; each expanded graph has its own timeline control.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{loading ? 'Loading published metrics...' : `${metrics.snapshotCount} published snapshots in range`}</span>
          {unitScopeOptions.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Unit data</span>
              <select
                value={selectedUnitScopeKey}
                onChange={event => setSelectedUnitScopeKey(event.target.value)}
                className="h-8 min-w-[170px] rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
              >
                {unitScopeOptions.map(option => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
          )}
          {error && <span className="text-amber-300">{error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricsList.map(metric => (
          <MetricTile
            key={metric.key}
            metric={metric}
            onOpen={setOpenMetric}
            cancellationCategories={metrics.cancellationsByCategory}
          />
        ))}
      </div>
      {courseMovementError && <p className="text-xs text-amber-300">{courseMovementError}</p>}
      <CourseOutcomeComparison
        traineesData={traineesData}
        movements={courseMovements}
        operationalContext={operationalContext}
        selectedUnitScopeKey={selectedUnitScopeKey}
      />
    </div>
  );
};

export default BliTab;
