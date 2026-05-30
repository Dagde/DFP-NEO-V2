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
import type { Instructor, ScheduleEvent } from '../../types';

type TimelineKey = '7d' | '1m' | '6m' | '12m' | '2y' | '3y' | '5y';
type MetricKey = 'availability' | 'flight' | 'simulator' | 'total' | 'cancellations' | 'staffFlight' | 'staffSimulator' | 'staffTotal';
type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface DailyEventMetrics {
  date: string;
  flightEvents: number;
  simulatorEvents: number;
  totalEvents: number;
}

interface AvailabilityMetrics {
  date: string;
  availableAverage: number | null;
  totalAircraft: number | null;
  availabilityPct: number | null;
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
  currentAircraftAvailable?: number;
  totalAircraft?: number;
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

const TIMELINE_OPTIONS: { key: TimelineKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '1m', label: 'Last month' },
  { key: '6m', label: 'Last 6 months' },
  { key: '12m', label: 'Last 12 months' },
  { key: '2y', label: 'Last 2 years' },
  { key: '3y', label: 'Last 3 years' },
  { key: '5y', label: 'Last 5 years' },
];

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

const getTimelineRange = (anchorIso: string, timeline: TimelineKey): { startDate: string; endDate: string } => {
  const end = parseIsoDate(anchorIso);
  let start = new Date(end);

  if (timeline === '7d') start = addUtcDays(end, -6);
  if (timeline === '1m') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  if (timeline === '6m') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1));
  if (timeline === '12m') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1));
  if (timeline === '2y') start = addUtcYears(end, -2);
  if (timeline === '3y') start = addUtcYears(end, -3);
  if (timeline === '5y') start = addUtcYears(end, -5);

  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

const valueSum = (series: ChartPoint[]): number => series.reduce((sum, point) => sum + (Number(point.value) || 0), 0);

const valueAvg = (series: ChartPoint[]): number | null => {
  const values = series.map(point => point.value).filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const compactNumber = (value: number | null | undefined, digits = 0): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No data';
  return Number(value).toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });
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
  const staffSeries: Record<string, DailyEventMetrics[]> = {};

  events.forEach(event => {
    eventStaffNames(event).forEach(staffName => {
      if (!staffSeries[staffName]) {
        staffSeries[staffName] = [{ date, flightEvents: 0, simulatorEvents: 0, totalEvents: 0 }];
      }
      staffSeries[staffName][0].totalEvents += 1;
      if (event.type === 'flight') staffSeries[staffName][0].flightEvents += 1;
      if (event.type === 'ftd') staffSeries[staffName][0].simulatorEvents += 1;
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
    eventSeries: [{ date, flightEvents, simulatorEvents, totalEvents: events.length }],
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
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = padding.left + (series.length <= 1 ? 0 : (index / (series.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value, date: series[index].date };
  });
  const pointString = points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-950/45 p-3">
      <svg width={width} height={height} role="img" aria-label={`${label} chart`}>
        {gridLines.map(level => {
          const y = padding.top + chartHeight - level * chartHeight;
          const value = min + level * range;
          return (
            <g key={level}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="rgb(148,163,184)" fontSize="11">
                {compactNumber(value, max < 10 ? 1 : 0)}{unit || ''}
              </text>
            </g>
          );
        })}
        <polyline points={`${padding.left},${padding.top + chartHeight} ${pointString} ${width - padding.right},${padding.top + chartHeight}`} fill={`${color}20`} />
        <polyline points={pointString} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.date}-${index}`} cx={point.x} cy={point.y} r="3" fill={color}>
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
          : <MiniLine series={metric.series} color={metric.color.includes('cyan') ? '#22d3ee' : metric.color.includes('blue') ? '#60a5fa' : metric.color.includes('emerald') ? '#34d399' : metric.color.includes('amber') ? '#fbbf24' : '#f472b6'} />}
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">{metric.footer}</p>
    </button>
  );
};

const MetricModal: React.FC<{
  metric: MetricDefinition;
  onClose: () => void;
  cancellationCategories: CancellationCategory[];
  dateRangeLabel: string;
}> = ({ metric, onClose, cancellationCategories, dateRangeLabel }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-6 py-8" onMouseDown={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">BLI</p>
            <h2 className="mt-1 text-2xl font-bold text-white">{metric.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{metric.subtitle} · {dateRangeLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400 hover:text-white"
          >
            Close
          </button>
        </div>

        {metric.key === 'cancellations' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {cancellationCategories.length === 0 && (
              <div className="rounded-lg border border-slate-700 bg-slate-950/45 p-5 text-sm text-slate-400">
                No cancellation codes were recorded in this timeline.
              </div>
            )}
            {cancellationCategories.map(category => (
              <div key={category.category} className="rounded-lg border border-slate-700 bg-slate-950/45 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">{category.category}</h3>
                  <span className="rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-200">{category.total}</span>
                </div>
                <div className="space-y-2">
                  {category.codes.map(code => (
                    <div key={code.code} className="flex items-center gap-3">
                      <span className="w-28 truncate text-sm font-medium text-slate-300">{code.code}</span>
                      <div className="h-3 flex-1 rounded-full bg-slate-800">
                        <div
                          className="h-3 rounded-full bg-rose-400"
                          style={{ width: `${Math.max(4, (code.count / Math.max(1, category.total)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm text-slate-300">{code.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <FullLineChart
            series={metric.series}
            color={metric.color.includes('cyan') ? '#22d3ee' : metric.color.includes('blue') ? '#60a5fa' : metric.color.includes('emerald') ? '#34d399' : metric.color.includes('amber') ? '#fbbf24' : '#f472b6'}
            label={metric.title}
            unit={metric.unit}
          />
        )}
      </div>
    </div>
  );
};

const BliTab: React.FC<BliTabProps> = ({ date, events, instructorsData, currentAircraftAvailable, totalAircraft }) => {
  const [timeline, setTimeline] = useState<TimelineKey>('7d');
  const [metrics, setMetrics] = useState<BliMetricsResponse>(() => buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft));
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMetric, setOpenMetric] = useState<MetricDefinition | null>(null);

  const range = useMemo(() => getTimelineRange(date, timeline), [date, timeline]);
  const dateRangeLabel = useMemo(() => formatDateRange(range.startDate, range.endDate), [range.startDate, range.endDate]);

  const sortedStaff = useMemo(() => {
    const deduped = new Map<string, Instructor>();
    instructorsData.forEach(person => {
      if (person?.name) deduped.set(person.name, person);
    });
    return [...deduped.values()].sort(staffSort);
  }, [instructorsData]);

  useEffect(() => {
    if (!selectedStaff && sortedStaff.length > 0) {
      const activeStaff = sortedStaff.find(staff => metrics.staffSeries?.[staff.name]?.some(day => day.totalEvents > 0));
      setSelectedStaff(activeStaff?.name || sortedStaff[0].name);
    }
  }, [metrics.staffSeries, selectedStaff, sortedStaff]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/bli/metrics?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
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
  }, [date, events, range.endDate, range.startDate, currentAircraftAvailable, totalAircraft]);

  const staffGroups = useMemo(() => {
    const groups = new Map<string, Instructor[]>();
    sortedStaff.forEach(staff => {
      const unit = staff.unit || 'Unassigned';
      if (!groups.has(unit)) groups.set(unit, []);
      groups.get(unit)?.push(staff);
    });
    return [...groups.entries()];
  }, [sortedStaff]);

  const metricsList = useMemo<MetricDefinition[]>(() => {
    const dates = metrics.dates.length > 0 ? metrics.dates : [date];
    const eventSeries = metrics.eventSeries.length > 0 ? metrics.eventSeries : buildFallbackMetrics(date, events, currentAircraftAvailable, totalAircraft).eventSeries;
    const staffDays = metrics.staffSeries?.[selectedStaff] || dates.map(day => ({ date: day, flightEvents: 0, simulatorEvents: 0, totalEvents: 0 }));
    const availabilitySeries = metrics.availabilitySeries.length > 0 ? metrics.availabilitySeries : [];

    const availabilityPoints = availabilitySeries.map(point => ({
      date: point.date,
      value: point.availabilityPct,
    }));
    const flightPoints = eventSeries.map(point => ({ date: point.date, value: point.flightEvents }));
    const simPoints = eventSeries.map(point => ({ date: point.date, value: point.simulatorEvents }));
    const totalPoints = eventSeries.map(point => ({ date: point.date, value: point.totalEvents }));
    const staffFlightPoints = staffDays.map(point => ({ date: point.date, value: point.flightEvents }));
    const staffSimPoints = staffDays.map(point => ({ date: point.date, value: point.simulatorEvents }));
    const staffTotalPoints = staffDays.map(point => ({ date: point.date, value: point.totalEvents }));
    const cancellationTotal = metrics.cancellationsByCategory.reduce((sum, category) => sum + category.total, 0);

    return [
      {
        key: 'availability',
        title: 'Aircraft availability',
        subtitle: 'Average daily availability across the selected timeline.',
        icon: PaperAirplaneIcon,
        color: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
        unit: '%',
        series: availabilityPoints,
        summary: `${compactNumber(valueAvg(availabilityPoints), 1)}%`,
        footer: `${metrics.snapshotCount} published DFP snapshots`,
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
        subtitle: selectedStaff ? `${selectedStaff} flight events per day.` : 'Select a staff member to inspect flying load.',
        icon: UserGroupIcon,
        color: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
        series: staffFlightPoints,
        summary: compactNumber(valueSum(staffFlightPoints)),
        footer: 'selected staff flights',
      },
      {
        key: 'staffSimulator',
        title: 'Staff simulator events',
        subtitle: selectedStaff ? `${selectedStaff} simulator events per day.` : 'Select a staff member to inspect simulator load.',
        icon: ComputerDesktopIcon,
        color: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
        series: staffSimPoints,
        summary: compactNumber(valueSum(staffSimPoints)),
        footer: 'selected staff simulator events',
      },
      {
        key: 'staffTotal',
        title: 'Staff total events',
        subtitle: selectedStaff ? `${selectedStaff} all scheduled events per day.` : 'Select a staff member to inspect total load.',
        icon: ClockIcon,
        color: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200',
        series: staffTotalPoints,
        summary: compactNumber(valueSum(staffTotalPoints)),
        footer: 'selected staff total events',
      },
    ];
  }, [currentAircraftAvailable, date, events, metrics, selectedStaff, totalAircraft]);

  return (
    <div className="space-y-5">
      {openMetric && (
        <MetricModal
          metric={openMetric}
          onClose={() => setOpenMetric(null)}
          cancellationCategories={metrics.cancellationsByCategory}
          dateRangeLabel={dateRangeLabel}
        />
      )}

      <div className="rounded-lg border border-cyan-500/25 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">BLI</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Business-Level Intelligence</h2>
            <p className="mt-1 text-sm text-slate-400">Operational schedule, cancellation and utilisation signals for {dateRangeLabel}.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
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
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{loading ? 'Loading published metrics...' : `${metrics.snapshotCount} published snapshots in range`}</span>
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
    </div>
  );
};

export default BliTab;
