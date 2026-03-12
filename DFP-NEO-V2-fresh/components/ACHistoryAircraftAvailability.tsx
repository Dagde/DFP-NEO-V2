import React, { useState, useEffect, useMemo, useCallback } from 'react';

type TimePeriod = 'week' | 'month' | '6months' | 'year' | '2years' | '5years' | 'lastFY' | 'lastCY';

interface AvailabilityRecord {
  id: string;
  date: string;
  dailyAverage: number;
  plannedCount: number;
  actualCount: number | null;
  totalAircraft: number;
  availabilityPct: number;
  recordedBy: string | null;
  notes: string | null;
  flyingWindowStart: string | null;
  flyingWindowEnd: string | null;
  effectiveEndTime: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ACHistoryAircraftAvailabilityProps {
  currentUserId?: string;
  currentAircraftAvailable?: number;
  totalAircraft?: number;
}

// ─── Tiny SVG line/area chart ────────────────────────────────────────────────
interface ChartPoint {
  date: string;
  value: number;
  label: string;
}

const AvailabilityChart: React.FC<{ data: ChartPoint[]; totalAircraft: number }> = ({ data, totalAircraft }) => {
  const W = 900;
  const H = 220;
  const PAD = { top: 20, right: 24, bottom: 48, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        No data available for the selected period
      </div>
    );
  }

  const values = data.map(d => d.value);
  const minVal = Math.max(0, Math.floor(Math.min(...values) - 1));
  const maxVal = Math.ceil(Math.max(...values) + 1);
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - ((v - minVal) / range) * chartH;

  // Build polyline points
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');

  // Build area fill path
  const areaPath =
    `M ${xScale(0)},${yScale(data[0].value)} ` +
    data.slice(1).map((d, i) => `L ${xScale(i + 1)},${yScale(d.value)}`).join(' ') +
    ` L ${xScale(data.length - 1)},${PAD.top + chartH} L ${xScale(0)},${PAD.top + chartH} Z`;

  // Y-axis grid lines (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => minVal + (range / 4) * i);

  // X-axis labels: show up to 10 evenly spaced
  const xLabelStep = Math.max(1, Math.ceil(data.length / 10));
  const xLabels = data.filter((_, i) => i % xLabelStep === 0 || i === data.length - 1);

  // Average line
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 320 }}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yScale(tick)}
              x2={PAD.left + chartW} y2={yScale(tick)}
              stroke="#374151" strokeWidth="1" strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 8} y={yScale(tick) + 4}
              textAnchor="end" fontSize="11" fill="#9ca3af"
            >
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Average reference line */}
        <line
          x1={PAD.left} y1={yScale(avg)}
          x2={PAD.left + chartW} y2={yScale(avg)}
          stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.7"
        />
        <text
          x={PAD.left + chartW + 4} y={yScale(avg) + 4}
          fontSize="10" fill="#f59e0b" opacity="0.9"
        >
          avg
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points + hover */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xScale(i)} cy={yScale(d.value)}
              r={hovered === i ? 6 : 3.5}
              fill={hovered === i ? '#38bdf8' : '#0ea5e9'}
              stroke={hovered === i ? '#fff' : '#1e3a5f'}
              strokeWidth={hovered === i ? 2 : 1}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={() => setHovered(i)}
            />
            {/* Invisible wider hit area */}
            <rect
              x={xScale(i) - 12} y={PAD.top}
              width={24} height={chartH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hovered !== null && (() => {
          const d = data[hovered];
          const cx = xScale(hovered);
          const cy = yScale(d.value);
          const tipW = 130;
          const tipH = 44;
          const tipX = Math.min(cx - tipW / 2, W - PAD.right - tipW);
          const tipY = cy - tipH - 10 < PAD.top ? cy + 14 : cy - tipH - 10;
          return (
            <g>
              <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="6"
                fill="#1f2937" stroke="#374151" strokeWidth="1" />
              <text x={tipX + tipW / 2} y={tipY + 16} textAnchor="middle"
                fontSize="11" fill="#9ca3af">{d.label}</text>
              <text x={tipX + tipW / 2} y={tipY + 33} textAnchor="middle"
                fontSize="13" fontWeight="bold" fill="#38bdf8">
                {d.value.toFixed(2)} ac
              </text>
            </g>
          );
        })()}

        {/* X-axis labels */}
        {xLabels.map((d, _) => {
          const i = data.indexOf(d);
          return (
            <text
              key={i}
              x={xScale(i)} y={PAD.top + chartH + 18}
              textAnchor="middle" fontSize="10" fill="#6b7280"
              transform={`rotate(-35, ${xScale(i)}, ${PAD.top + chartH + 18})`}
            >
              {d.label}
            </text>
          );
        })}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
          stroke="#4b5563" strokeWidth="1" />
        <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
          stroke="#4b5563" strokeWidth="1" />

        {/* Y-axis label */}
        <text
          x={14} y={PAD.top + chartH / 2}
          textAnchor="middle" fontSize="11" fill="#6b7280"
          transform={`rotate(-90, 14, ${PAD.top + chartH / 2})`}
        >
          Aircraft Available
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-2 px-2 text-xs text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-sky-400 rounded" />
          <span>Daily Average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-amber-400 rounded" style={{ borderTop: '1.5px dashed #f59e0b' }} />
          <span>Period Average</span>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ACHistoryAircraftAvailability: React.FC<ACHistoryAircraftAvailabilityProps> = ({
  currentUserId,
  currentAircraftAvailable = 0,
  totalAircraft = 24,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [todaysAverage, setTodaysAverage] = useState<number | null>(null);
  const [todaysAverageLoading, setTodaysAverageLoading] = useState(false);
  // Store metadata about today's average calculation
  const [todaysAverageDate, setTodaysAverageDate] = useState<string | null>(null);
  const [todaysFlyingWindowStart, setTodaysFlyingWindowStart] = useState<string | null>(null);
  const [todaysFlyingWindowEnd, setTodaysFlyingWindowEnd] = useState<string | null>(null);
  const [todaysEffectiveEndTime, setTodaysEffectiveEndTime] = useState<string | null>(null);
  // Current time state (updated every minute)
  const [currentLocalTime, setCurrentLocalTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Helper function to set today's average with all metadata
  const setTodaysAverageWithMetadata = (record: any) => {
    if (!record) {
      setTodaysAverage(null);
      setTodaysAverageDate(null);
      setTodaysFlyingWindowStart(null);
      setTodaysFlyingWindowEnd(null);
      setTodaysEffectiveEndTime(null);
      return;
    }
    setTodaysAverage(record.dailyAverage);
    setTodaysAverageDate(record.date || null);
    setTodaysFlyingWindowStart(record.flyingWindowStart || null);
    setTodaysFlyingWindowEnd(record.flyingWindowEnd || null);
    setTodaysEffectiveEndTime(record.effectiveEndTime || null);
  };

  // Update current local time every minute
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentLocalTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    
    // Update immediately
    updateTime();
    
    // Then update every minute
    const interval = setInterval(updateTime, 60 * 1000);
    return () => clearInterval(interval);
  }, []);



  const getDateRange = useCallback((period: TimePeriod): { start: Date; end: Date } => {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case '6months':
        start.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case '2years':
        start.setFullYear(now.getFullYear() - 2);
        break;
      case '5years':
        start.setFullYear(now.getFullYear() - 5);
        break;
      case 'lastFY': {
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        if (currentMonth >= 6) {
          start = new Date(currentYear - 1, 6, 1);
          end.setFullYear(currentYear);
          end.setMonth(5, 30);
        } else {
          start = new Date(currentYear - 2, 6, 1);
          end.setFullYear(currentYear - 1);
          end.setMonth(5, 30);
        }
        break;
      }
      case 'lastCY':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end.setFullYear(now.getFullYear() - 1);
        end.setMonth(11, 31);
        break;
    }
    return { start, end };
  }, []);

  const toISODate = (d: Date) => d.toISOString().split('T')[0];

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(selectedPeriod);
      const params = new URLSearchParams({
        startDate: toISODate(start),
        endDate: toISODate(end),
      });
      const res = await fetch(`/api/aircraft-availability-history?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err: any) {
      setError('Failed to load aircraft availability history.');
      console.error('ACHistoryAircraftAvailability fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, getDateRange]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Fetch today's average from the database
  // Uses the POST /api/aircraft-availability-history endpoint to trigger recalculation
  // This ensures the time-weighted average is always up-to-date based on raw events
  useEffect(() => {
    const fetchTodaysAverage = async () => {
      setTodaysAverageLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // First, trigger a recalculation via the recalculate endpoint
        // This will rebuild the daily summary from raw events
        const recalcRes = await fetch('/api/aircraft-availability-recalculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            date: today,
            clientLocalHour: new Date().getHours(),
            clientLocalMinute: new Date().getMinutes(),
            // Use default flying window (0800-1700) - the server will use its configured values
          }),
        });
        
        if (recalcRes.ok) {
          const recalcData = await recalcRes.json();
          if (recalcData.summary) {
            // The recalculation returned the updated summary
            // Add the date to the summary for the UI
            const recordWithDate = {
              ...recalcData.summary,
              date: today
            };
            setTodaysAverageWithMetadata(recordWithDate);
          } else {
            // No events exist yet for today
            setTodaysAverageWithMetadata(null);
          }
        } else {
          // Recalculation failed, show no data
          setTodaysAverageWithMetadata(null);
        }
      } catch (err) {
        console.error('Failed to fetch today\'s average:', err);
        setTodaysAverageWithMetadata(null);
      } finally {
        setTodaysAverageLoading(false);
      }
    };
    fetchTodaysAverage();
    
    // Also set up a periodic refresh every 5 minutes to keep the average current
    const interval = setInterval(fetchTodaysAverage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Refresh today's average when currentAircraftAvailable changes
  // This ensures the average updates when the user changes availability in the daily schedule
  useEffect(() => {
    // Debounce the refresh to avoid too many API calls
    const timeoutId = setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      fetch('/api/aircraft-availability-recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          date: today,
          clientLocalHour: new Date().getHours(),
          clientLocalMinute: new Date().getMinutes(),
        }),
      }).then(res => res.json())
        .then(data => {
          if (data.summary) {
            const recordWithDate = {
              ...data.summary,
              date: today
            };
            setTodaysAverageWithMetadata(recordWithDate);
          }
        })
        .catch(err => console.error('Failed to refresh today\'s average:', err));
    }, 2000); // 2 second debounce
    
    return () => clearTimeout(timeoutId);
  }, [currentAircraftAvailable]);

  const formatPeriodLabel = (period: TimePeriod): string => {
    const labels: Record<TimePeriod, string> = {
      week: 'Past Week',
      month: 'Past Month',
      '6months': 'Past 6 Months',
      year: 'Past Year',
      '2years': 'Past 2 Years',
      '5years': 'Past 5 Years',
      lastFY: 'Last Financial Year',
      lastCY: 'Last Calendar Year',
    };
    return labels[period];
  };

  const formatDateLabel = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
  };

  // Derived stats
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    const avgs = records.map(r => r.dailyAverage);
    const pcts = records.map(r => r.availabilityPct);
    const mean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
    const meanPct = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const max = Math.max(...avgs);
    const min = Math.min(...avgs);
    const maxRecord = records.find(r => r.dailyAverage === max);
    const minRecord = records.find(r => r.dailyAverage === min);

    // Trend: compare first half vs second half
    const half = Math.floor(records.length / 2);
    const firstHalf = records.slice(0, half);
    const secondHalf = records.slice(half);
    const firstAvg = firstHalf.length > 0
      ? firstHalf.reduce((a, r) => a + r.dailyAverage, 0) / firstHalf.length : mean;
    const secondAvg = secondHalf.length > 0
      ? secondHalf.reduce((a, r) => a + r.dailyAverage, 0) / secondHalf.length : mean;
    const trendPct = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    return { mean, meanPct, max, min, maxRecord, minRecord, trendPct, count: records.length };
  }, [records]);

  const chartData: ChartPoint[] = useMemo(() =>
    records.map(r => ({
      date: r.date,
      value: r.dailyAverage,
      label: formatDateLabel(r.date),
    })),
    [records]
  );

  const historicalTotalAircraft = records.length > 0
    ? Math.max(...records.map(r => r.totalAircraft))
    : totalAircraft;

  const getTrendIcon = (trend: number) => {
    if (trend > 2) return <span className="text-green-400">↑</span>;
    if (trend < -2) return <span className="text-red-400">↓</span>;
    return <span className="text-gray-400">→</span>;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 2) return 'text-green-400';
    if (trend < -2) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mt-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">AC History (Aircraft Availability)</h2>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="animate-spin h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Loading…
            </div>
          )}
          <button
            onClick={() => setShowTable(v => !v)}
            className="px-3 py-1.5 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
          >
            {showTable ? 'Hide Table' : 'Show Table'}
          </button>
        </div>
      </div>

      {/* Current Status Display - Live aircraft count and today's average */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-gradient-to-br from-sky-900/40 to-sky-800/20 rounded-lg p-4 border border-sky-700/50">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-xs text-gray-400 uppercase tracking-wider">Current Available</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-sky-400">{currentAircraftAvailable}</span>
            <span className="text-sm text-gray-400">of {totalAircraft} aircraft</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {((currentAircraftAvailable / totalAircraft) * 100).toFixed(0)}% availability
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-900/40 to-amber-800/20 rounded-lg p-4 border border-amber-700/50">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-gray-400 uppercase tracking-wider">Today's Average (Flying Window)</span>
          </div>
          {todaysAverageLoading ? (
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : todaysAverage !== null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-amber-400">{todaysAverage.toFixed(2)}</span>
                <span className="text-sm text-gray-400">avg aircraft</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {((todaysAverage / totalAircraft) * 100).toFixed(0)}% time-weighted availability
              </div>
              {/* Metadata display */}
              {todaysAverageDate && (
                <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-700/50 space-y-0.5">
                  {todaysAverageDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span>{new Date(todaysAverageDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  )}
                  {todaysFlyingWindowStart && todaysFlyingWindowEnd && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Flying Window:</span>
                      <span>{todaysFlyingWindowStart} - {todaysFlyingWindowEnd}</span>
                    </div>
                  )}
                  {/* Current time indicator */}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current Time:</span>
                    <span className="text-amber-300 font-medium">{currentLocalTime}</span>
                  </div>
                  {todaysEffectiveEndTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Calculated at:</span>
                      <span>{todaysEffectiveEndTime}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-gray-500">—</div>
              <div className="text-xs text-gray-600 mt-1">No data recorded today yet</div>
            </>
          )}
        </div>
      </div>

      {/* Time Period Selectors */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-400 mb-2">Time Period</label>
        <div className="flex flex-wrap gap-2">
          {(['week', 'month', '6months', 'year', '2years', '5years', 'lastFY', 'lastCY'] as TimePeriod[]).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                selectedPeriod === period
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {formatPeriodLabel(period)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
          <button onClick={fetchRecords} className="ml-3 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Summary Stats */}
      {stats && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-750 bg-gray-900/40 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Period Average</div>
            <div className="text-2xl font-bold text-sky-400">{stats.mean.toFixed(1)}</div>
            <div className="text-xs text-gray-500">{stats.meanPct.toFixed(1)}% of fleet</div>
          </div>
          <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Peak Availability</div>
            <div className="text-2xl font-bold text-green-400">{stats.max.toFixed(1)}</div>
            <div className="text-xs text-gray-500">
              {stats.maxRecord ? formatDateLabel(stats.maxRecord.date) : '—'}
            </div>
          </div>
          <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Lowest Availability</div>
            <div className="text-2xl font-bold text-red-400">{stats.min.toFixed(1)}</div>
            <div className="text-xs text-gray-500">
              {stats.minRecord ? formatDateLabel(stats.minRecord.date) : '—'}
            </div>
          </div>
          <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Trend</div>
            <div className={`text-2xl font-bold ${getTrendColor(stats.trendPct)}`}>
              {getTrendIcon(stats.trendPct)}{' '}
              {stats.trendPct > 0 ? '+' : ''}{stats.trendPct.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">{stats.count} data points</div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!loading && records.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No aircraft availability data recorded for this period.</p>
          <p className="text-xs mt-1 text-gray-600">Data is automatically recorded daily when aircraft availability is updated.</p>
        </div>
      )}

      {/* Chart */}
      {!loading && records.length > 0 && (
        <div className="bg-gray-900/40 rounded-lg p-4 border border-gray-700 mb-4">
          <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">
            Daily Average Aircraft Available — {formatPeriodLabel(selectedPeriod)}
          </div>
          <AvailabilityChart data={chartData} totalAircraft={historicalTotalAircraft} />
        </div>
      )}

      {/* Data Table (collapsible) */}
      {showTable && records.length > 0 && (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 text-gray-300 font-semibold">Date</th>
                <th className="text-right py-2 px-3 text-gray-300 font-semibold">Daily Avg</th>
                <th className="text-right py-2 px-3 text-gray-300 font-semibold">Planned</th>
                <th className="text-right py-2 px-3 text-gray-300 font-semibold">Actual</th>
                <th className="text-right py-2 px-3 text-gray-300 font-semibold">Fleet</th>
                <th className="text-right py-2 px-3 text-gray-300 font-semibold">Avail %</th>
              </tr>
            </thead>
            <tbody>
              {[...records].reverse().map(r => (
                <tr key={r.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="py-2 px-3 text-white font-mono text-xs">{r.date}</td>
                  <td className="py-2 px-3 text-right text-sky-400 font-semibold">{r.dailyAverage.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{r.plannedCount}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{r.actualCount ?? '—'}</td>
                  <td className="py-2 px-3 text-right text-gray-400">{r.totalAircraft}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`font-semibold ${
                      r.availabilityPct >= 70 ? 'text-green-400' :
                      r.availabilityPct >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {r.availabilityPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer notes */}
      <div className="mt-4 text-sm text-gray-400 space-y-1">
        <p>• Daily Average is the <strong className="text-gray-300">time-weighted average</strong> aircraft availability during the flying window only.</p>
        <p>• Each availability state change is recorded as an event; the daily average weights by minutes active.</p>
        <p>• Trend compares the second half of the selected period against the first half.</p>
        <p>• Availability % is calculated as Daily Average ÷ Total Fleet × 100.</p>
        <p>• Data is stored in a dedicated database table and persists independently of schedule data.</p>
        <p>• Both active and inactive codes appear in analytics if used historically.</p>
      </div>
    </div>
  );
};

export default ACHistoryAircraftAvailability;