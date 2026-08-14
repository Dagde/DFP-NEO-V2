import React, { useState, useEffect, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TIECourse {
  name: string;
  recordCount: number;
  lastRun: { completedAt: string; totalTrainees?: number; totalRecords?: number } | null;
}

interface TIERun {
  id: string;
  status: string;
  triggeredBy: string;
  courseFilter: string | null;
  startedAt: string;
  completedAt: string | null;
  recordsProcessed: number | null;
  errorMessage: string | null;
}

interface TIECourseSummary {
  courseName: string;
  totalTrainees: number;
  totalPt051s: number;
  bottleneckEvents: any;
  bottleneckSkillFamilies: any;
  atRiskTrainees: any;
  exceedingTrainees: any;
  overServicedEvents: any;
  skillHeatmap: any;
  narrativeSummary: string;
  completedAt: string;
  recordsProcessed: number;
  triggeredBy: string;
}

interface TIETraineeSummary {
  id: string;
  traineeFullName: string;
  courseName: string;
  overallTrend: string;
  riskLevel: string;
  strongestSkillFamilies: any;
  weakestSkillFamilies: any;
  recurringWeakElements: any;
  positiveCommentThemes: any;
  negativeCommentThemes: any;
  totalPt051Count: number;
  avgOverallGrade: number;
  recentAvgGrade: number;
  gradeProgression: any;
  narrativeSummary: string;
  atRiskReasons: any;
  skillFamilyScores?: any;
}

interface TIEEventSummary {
  id: string;
  eventCode: string;
  courseName: string;
  totalAttempts: number;
  avgOverallGrade: number;
  gradeVariance: number;
  passRate: number;
  weakElementsByAvg: any;
  strongElementsByAvg: any;
  dominantNegativeTags: any;
  dominantPositiveTags: any;
  difficultyScore: number;
  bottleneckScore: number;
  overServiceIndicator: boolean;
  differentiationScore: number;
  syllabusPosition: number;
  narrativeSummary: string;
  skillFamilyScores?: any;
}

interface TIEFinding {
  id: string;
  level: string;
  subjectKey: string;
  findingType: string;
  descriptiveFinding: string;
  interpretedInsight: string;
  recommendation: string;
  confidenceLevel: string;
  confidenceScore: number;
  evidenceCount: number;
}
// ── TIE Threshold configuration ──────────────────────────────────────────────

interface TIEThresholds {
  atRiskAvgGrade: number;        // avg grade BELOW which trainee is at-risk
  normalAvgGrade: number;        // avg grade at or above which trainee is normal
  worseningRecentAvgGrade: number; // recent avg BELOW which worsening trend is at-risk
  exceedingAvgGrade: number;     // avg grade ABOVE which trainee is exceeding
  concernThresholdGrade: number; // grade BELOW which an element is a concern (pass = >= this value)
  excellentGradeColorThreshold: number;
  normalGradeColorThreshold: number;
  concernGradeColorThreshold: number;
  criticalLowGradeThreshold: number;
  bottleneckThresholdPct: number;// % of trainees below concern threshold to flag event as elevated risk
  healthyPassRatePct: number;    // pass rate at or above which charts show healthy/green
  highVarianceThreshold: number; // grade std-dev ABOVE which event has high variance
  normalMinGrade: number;
  atRiskAverageEnabled: boolean;
  atRiskSustainedDeclineEnabled: boolean;
  atRiskRecentDropEnabled: boolean;
  atRiskLowRecentEnabled: boolean;
  atRiskRecurringWeakElementsEnabled: boolean;
  sustainedDeclineCount: number;
  recentDropThreshold: number;
  lowRecentGrade: number;
  recurringWeakElementCount: number;
  minAssessmentsForRisk: number;
  minObservationsForPattern: number;
  recencyWeightFactor: number;
  commentWeightVsScore: number;
  overServiceGradeThreshold: number; // avg grade above which event may be over-serviced
}

const DEFAULT_THRESHOLDS: TIEThresholds = {
  atRiskAvgGrade: 3.2,
  normalAvgGrade: 3.5,
  worseningRecentAvgGrade: 3.5,
  exceedingAvgGrade: 4.2,
  concernThresholdGrade: 3,
  excellentGradeColorThreshold: 4.5,
  normalGradeColorThreshold: 3.5,
  concernGradeColorThreshold: 3.0,
  criticalLowGradeThreshold: 2.5,
  bottleneckThresholdPct: 40,
  healthyPassRatePct: 80,
  highVarianceThreshold: 1.0,
  normalMinGrade: 3.5,
  atRiskAverageEnabled: true,
  atRiskSustainedDeclineEnabled: true,
  atRiskRecentDropEnabled: true,
  atRiskLowRecentEnabled: true,
  atRiskRecurringWeakElementsEnabled: true,
  sustainedDeclineCount: 3,
  recentDropThreshold: 0.4,
  lowRecentGrade: 3.2,
  recurringWeakElementCount: 3,
  minAssessmentsForRisk: 3,
  minObservationsForPattern: 3,
  recencyWeightFactor: 1.5,
  commentWeightVsScore: 0.4,
  overServiceGradeThreshold: 4.3,
};

const ThresholdContext = React.createContext<{
  thresholds: TIEThresholds;
  setThresholds: (t: TIEThresholds) => void;
}>({ thresholds: DEFAULT_THRESHOLDS, setThresholds: () => {} });

const useThresholds = () => React.useContext(ThresholdContext);



// ── Helpers ────────────────────────────────────────────────────────────────────

const gradeColor = (g: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (g >= t.excellentGradeColorThreshold) return 'text-emerald-400';
  if (g >= t.normalGradeColorThreshold) return 'text-green-400';
  if (g >= t.concernGradeColorThreshold) return 'text-yellow-400';
  if (g >= t.criticalLowGradeThreshold) return 'text-orange-400';
  return 'text-red-400';
};

const gradeBg = (g: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (g >= t.excellentGradeColorThreshold) return 'bg-emerald-900/40 border-emerald-700';
  if (g >= t.normalGradeColorThreshold) return 'bg-green-900/40 border-green-700';
  if (g >= t.concernGradeColorThreshold) return 'bg-yellow-900/40 border-yellow-700';
  if (g >= t.criticalLowGradeThreshold) return 'bg-orange-900/40 border-orange-700';
  return 'bg-red-900/40 border-red-700';
};

const gradeChartColor = (g: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (g >= t.excellentGradeColorThreshold) return '#34d399';
  if (g >= t.normalGradeColorThreshold) return '#4ade80';
  if (g >= t.concernGradeColorThreshold) return '#facc15';
  if (g >= t.criticalLowGradeThreshold) return '#fb923c';
  return '#f87171';
};

const passRateWarningThreshold = (t: TIEThresholds = DEFAULT_THRESHOLDS): number =>
  Math.max(0, Math.min(100, 100 - t.bottleneckThresholdPct));

const passRateTextColor = (rate: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (rate >= t.healthyPassRatePct) return 'text-emerald-400';
  if (rate >= passRateWarningThreshold(t)) return 'text-yellow-400';
  return 'text-red-400';
};

const passRateChartColor = (rate: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (rate >= t.healthyPassRatePct) return '#10b981';
  if (rate >= passRateWarningThreshold(t)) return '#eab308';
  return '#ef4444';
};

const varianceChartColor = (variance: number, t: TIEThresholds = DEFAULT_THRESHOLDS): string => {
  if (variance > t.highVarianceThreshold) return '#ef4444';
  if (variance > t.highVarianceThreshold * 0.8) return '#eab308';
  return '#3b82f6';
};

const riskBadge = (risk: string): string => {
  if (risk === 'at_risk') return 'bg-red-900/60 text-red-300 border border-red-700';
  if (risk === 'monitor') return 'bg-yellow-900/60 text-yellow-300 border border-yellow-700';
  if (risk === 'exceeding') return 'bg-emerald-900/60 text-emerald-300 border border-emerald-700';
  return 'bg-gray-700 text-gray-300 border border-gray-600';
};

const trendIcon = (dir: string): string => {
  if (dir === 'improving') return '\u2191';
  if (dir === 'worsening') return '\u2193';
  return '\u2192';
};

const trendColor = (dir: string): string => {
  if (dir === 'improving') return 'text-emerald-400';
  if (dir === 'worsening') return 'text-red-400';
  return 'text-gray-400';
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
};

const safe = (n: number | undefined | null, d = 2): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return '\u2014';
  return Number(n).toFixed(d);
};

const safeN = (n: number | undefined | null): number => {
  if (n === undefined || n === null || isNaN(Number(n))) return 0;
  return Number(n);
};

const normalizeSettingValue = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return normalizeSettingValue((value as Record<string, unknown>).value);
  }
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const numberSetting = (value: unknown, fallback: number): number => {
  const n = Number(normalizeSettingValue(value));
  return Number.isFinite(n) ? n : fallback;
};

const boolSetting = (value: unknown, fallback: boolean): boolean => {
  const normalizedValue = normalizeSettingValue(value);
  if (typeof normalizedValue === 'boolean') return normalizedValue;
  if (typeof normalizedValue === 'number') return normalizedValue !== 0;
  if (typeof normalizedValue === 'string') {
    const normalized = normalizedValue.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const riskCriteriaRows = (thresholds: TIEThresholds) => [
  thresholds.atRiskAverageEnabled
    ? `Course average below ${thresholds.atRiskAvgGrade.toFixed(1)}`
    : null,
].filter(Boolean) as string[];

const monitorSignalRows = (thresholds: TIEThresholds) => [
  thresholds.atRiskSustainedDeclineEnabled
    ? `Sustained decline across the last ${thresholds.sustainedDeclineCount} assessments`
    : null,
  thresholds.atRiskRecentDropEnabled
    ? `Recent average ${thresholds.recentDropThreshold.toFixed(1)} or more below overall average`
    : null,
  thresholds.atRiskLowRecentEnabled
    ? `Worsening trend recent average below ${thresholds.worseningRecentAvgGrade.toFixed(1)}`
    : null,
  thresholds.atRiskRecurringWeakElementsEnabled
    ? `${thresholds.recurringWeakElementCount}+ recurring weak elements`
    : null,
].filter(Boolean) as string[];

const TimelineZoomControl: React.FC<{
  value: number;
  onChange: (next: number) => void;
  max?: number;
}> = ({ value, onChange, max = 6 }) => (
  <div className="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-950 p-1">
    <button
      type="button"
      onClick={() => onChange(Math.max(0, value - 1))}
      disabled={value <= 0}
      className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      title="Zoom out"
    >
      -
    </button>
    <span className="min-w-[64px] text-center text-[11px] font-semibold text-gray-400">
      {value === 0 ? 'Full' : `${value}x`}
    </span>
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={value >= max}
      className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
      title="Zoom in"
    >
      +
    </button>
  </div>
);

const parseJ = (raw: any, fallback: any) => {
  if (!raw) return fallback;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return fallback; } }
  return raw;
};

const parseProgression = (raw: any): number[] => {
  const arr = parseJ(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr.map((item: any) => {
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object') return item.grade ?? item.score ?? item.avgGrade ?? 0;
    return 0;
  }).filter((v: number) => v > 0);
};

const parseProgressionFull = (raw: any): { grades: number[]; labels: string[] } => {
  const arr = parseJ(raw, []);
  if (!Array.isArray(arr)) return { grades: [], labels: [] };
  const filtered = arr
    .map((item: any, i: number) => {
      const grade = typeof item === 'number' ? item
        : (item && typeof item === 'object') ? (item.grade ?? item.score ?? item.avgGrade ?? 0) : 0;
      const label = (item && typeof item === 'object' && item.event) ? String(item.event) : `#${i + 1}`;
      return { grade, label };
    })
    .filter(x => x.grade > 0);
  return {
    grades: filtered.map(x => x.grade),
    labels: filtered.map(x => x.label),
  };
};

const hasSustainedDecline = (grades: number[], count: number): boolean => {
  const windowSize = Math.max(2, Math.round(count || 3));
  if (grades.length < windowSize) return false;
  const recent = grades.slice(-windowSize);
  return recent.every((grade, index) => index === 0 || grade < recent[index - 1]);
};

const evaluateTraineeRisk = (
  trainee: TIETraineeSummary,
  thresholds: TIEThresholds
): { riskLevel: string; reasons: string[] } => {
  const grades = parseProgression(trainee.gradeProgression);
  const avgGrade = safeN(trainee.avgOverallGrade);
  const recentAvg = safeN(trainee.recentAvgGrade);
  const weakElements = parseJ(trainee.recurringWeakElements, []) as unknown[];
  const enoughData = Math.max(grades.length, safeN(trainee.totalPt051Count)) >= thresholds.minAssessmentsForRisk;
  const atRiskReasons: string[] = [];
  const monitorReasons: string[] = [];

  if (enoughData && thresholds.atRiskAverageEnabled && avgGrade < thresholds.atRiskAvgGrade) {
    atRiskReasons.push(`Course average ${avgGrade.toFixed(2)} below at-risk threshold of ${thresholds.atRiskAvgGrade.toFixed(1)}`);
  }
  if (enoughData && thresholds.atRiskSustainedDeclineEnabled && hasSustainedDecline(grades, thresholds.sustainedDeclineCount)) {
    monitorReasons.push(`Sustained decline across last ${thresholds.sustainedDeclineCount} assessments`);
  }
  if (enoughData && thresholds.atRiskRecentDropEnabled && avgGrade - recentAvg >= thresholds.recentDropThreshold) {
    monitorReasons.push(`Recent average ${recentAvg.toFixed(2)} is ${(avgGrade - recentAvg).toFixed(2)} below overall average`);
  }
  if (enoughData && thresholds.atRiskLowRecentEnabled && trainee.overallTrend === 'worsening' && recentAvg < thresholds.worseningRecentAvgGrade) {
    monitorReasons.push(`Recent average ${recentAvg.toFixed(2)} below worsening-trend recent-average threshold of ${thresholds.worseningRecentAvgGrade.toFixed(1)}`);
  }
  if (enoughData && thresholds.atRiskRecurringWeakElementsEnabled && weakElements.length >= thresholds.recurringWeakElementCount) {
    monitorReasons.push(`${weakElements.length} weak elements recurring`);
  }

  if (!enoughData && (avgGrade < thresholds.atRiskAvgGrade || (trainee.overallTrend === 'worsening' && recentAvg < thresholds.worseningRecentAvgGrade) || trainee.overallTrend === 'worsening')) {
    return { riskLevel: 'monitor', reasons: [`Monitor until ${thresholds.minAssessmentsForRisk} assessments are available`] };
  }
  if (atRiskReasons.length > 0) return { riskLevel: 'at_risk', reasons: atRiskReasons };
  if (monitorReasons.length > 0) return { riskLevel: 'monitor', reasons: monitorReasons };
  if (avgGrade >= thresholds.exceedingAvgGrade && trainee.overallTrend !== 'worsening') {
    return { riskLevel: 'exceeding', reasons: [] };
  }
  if (avgGrade >= thresholds.normalAvgGrade && trainee.overallTrend !== 'worsening') {
    return { riskLevel: 'normal', reasons: [] };
  }
  const reasons: string[] = [];
  if (avgGrade < thresholds.normalAvgGrade) {
    reasons.push(`Course average ${avgGrade.toFixed(2)} below normal/watch boundary of ${thresholds.normalAvgGrade.toFixed(1)}`);
  }
  if (trainee.overallTrend === 'worsening') {
    reasons.push('Overall trend is worsening');
  }
  return { riskLevel: 'monitor', reasons: reasons.length ? reasons : ['Monitor status requires review'] };
};

const riskReasonLabel = (reason: string): string => {
  const normalized = reason.toLowerCase();
  if (normalized.includes('below at-risk threshold')) return 'course average below At Risk threshold';
  if (normalized.includes('sustained decline')) return 'sustained decline';
  if (normalized.includes('below overall average')) return 'recent average drop';
  if (normalized.includes('worsening-trend recent-average') || normalized.includes('low-recent-average')) return 'worsening trend recent average';
  if (normalized.includes('weak elements')) return 'recurring weak elements';
  if (normalized.includes('monitor until')) return 'not enough assessment history';
  if (normalized.includes('below normal threshold')) return 'course average below Normal threshold';
  if (normalized.includes('trend is worsening')) return 'worsening trend';
  return 'manual review signal';
};

const summarizeStatusTriggers = (
  evaluations: Array<{ name: string; riskLevel: string; reasons: string[] }>,
  status: 'at_risk' | 'monitor'
) => {
  const counts = new Map<string, { count: number; names: string[] }>();
  evaluations
    .filter(evaluation => {
      const riskLevel = evaluation.riskLevel === 'watch' ? 'monitor' : evaluation.riskLevel;
      return riskLevel === status;
    })
    .forEach(evaluation => (evaluation.reasons.length ? evaluation.reasons : ['manual review signal']).forEach(reason => {
      const label = riskReasonLabel(reason);
      const existing = counts.get(label) || { count: 0, names: [] };
      counts.set(label, {
        count: existing.count + 1,
        names: existing.names.includes(evaluation.name) ? existing.names : [...existing.names, evaluation.name],
      });
    }));
  return Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([label, detail]) => ({ label, count: detail.count, names: detail.names }));
};

// ── SparkBar ────────────────────────────────────────────────────────────────────

const SparkBar: React.FC<{ value: number; max?: number; colorClass?: string }> = ({ value, max = 5, colorClass }) => {
  const { thresholds } = useThresholds();
  const pct = Math.min(100, (safeN(value) / max) * 100);
  const c = colorClass || (
    value >= thresholds.excellentGradeColorThreshold ? 'bg-emerald-500' :
    value >= thresholds.concernGradeColorThreshold ? 'bg-yellow-500' :
    'bg-red-500'
  );
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`${c} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${gradeColor(value, thresholds)}`}>{safe(value, 1)}</span>
    </div>
  );
};

// ── SparkLine (SVG) — fixed 0-5 Y scale + floating div tooltip ─────────────────

const SparkLine: React.FC<{
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  interactive?: boolean;
  yMin?: number;
  yMax?: number;
  showYAxisLabels?: boolean;
}> = ({ data, labels, width = 100, height = 32, color = '#60a5fa', interactive = false, yMin = 0, yMax = 5, showYAxisLabels = false }) => {
  const { thresholds } = useThresholds();
  const [tooltip, setTooltip] = React.useState<{ i: number; pageX: number; pageY: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (!data || data.length < 2) return <span className="text-gray-600 text-xs">&mdash;</span>;

  const YMIN = yMin;
  const YMAX = Math.max(yMin + 0.1, yMax);
  const PAD_TOP = 8, PAD_BOT = 8;
  const usableH = height - PAD_TOP - PAD_BOT;

  const getX = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * width);
  const getY = (v: number) => PAD_TOP + usableH * (1 - Math.max(0, Math.min(1, (v - YMIN) / (YMAX - YMIN))));

  const pts = data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  const hoveredVal = tooltip !== null ? data[tooltip.i] : null;
  const gc = (v: number) => gradeChartColor(v, thresholds);

  const gridSpan = YMAX - YMIN;
  const gridStep = gridSpan <= 1 ? 0.2 : gridSpan <= 2 ? 0.5 : 1;
  const gridLines = interactive
    ? Array.from(
        { length: Math.floor((YMAX - YMIN) / gridStep) + 1 },
        (_, i) => Math.round((YMIN + i * gridStep) * 10) / 10
      ).filter(v => v <= YMAX + 0.001)
    : [];

  return (
    <div className="relative" style={{ display: 'inline-block', overflow: 'visible' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
        style={{ cursor: interactive ? 'crosshair' : 'default', display: 'block' }}
      >
        {gridLines.map(v => {
          const y = getY(v);
          return (
            <g key={v}>
              <line
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={Number.isInteger(v) && v >= 1 && v <= 5 ? '#64748b' : '#475569'}
                strokeWidth={Number.isInteger(v) && v >= 1 && v <= 5 ? 0.9 : 0.55}
                strokeDasharray="4,4"
                opacity={Number.isInteger(v) && v >= 1 && v <= 5 ? 0.75 : 0.45}
              />
              {showYAxisLabels && Number.isInteger(v) && v >= 1 && v <= 5 && (
                <text x={-12} y={y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="#cbd5e1">
                  {v}
                </text>
              )}
            </g>
          );
        })}

        <polyline points={pts} fill="none" stroke={color} strokeWidth={interactive ? 1 : 0.75} strokeLinejoin="round" />

        {interactive && (
          <polygon
            points={`0,${getY(data[0])} ${pts} ${getX(data.length - 1)},${height} 0,${height}`}
            fill={color} fillOpacity={0.07}
          />
        )}

        {data.map((v, i) => {
          const x = getX(i);
          const y = getY(v);
          const isHov = tooltip?.i === i;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={interactive ? (isHov ? 3 : 2) : 1} fill={color}
                stroke={isHov ? '#fff' : 'none'} strokeWidth={0.75} />
              {interactive && (
                <circle
                  cx={x} cy={y} r={14} fill="transparent"
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      const scaleX = rect.width / (svgRef.current?.viewBox?.baseVal?.width || width);
                      setTooltip({ i, pageX: rect.left + x * (rect.width / width), pageY: rect.top + y * (rect.height / height) });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip — fixed position relative to viewport, never clipped */}
      {interactive && tooltip !== null && hoveredVal !== null && (() => {
        const label = labels?.[tooltip.i] ?? `Assessment #${tooltip.i + 1}`;
        const ttW = 140, ttH = 52;
        // Use fixed positioning based on page coordinates to escape any overflow:hidden parent
        const vpW = window.innerWidth;
        const leftPos = tooltip.pageX + ttW + 14 > vpW ? tooltip.pageX - ttW - 8 : tooltip.pageX + 12;
        const topPos = Math.max(8, tooltip.pageY - ttH / 2);
        return (
          <div
            style={{
              position: 'fixed',
              left: leftPos,
              top: topPos,
              width: ttW,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 shadow-xl"
          >
            <p className="text-xs text-gray-400 leading-tight">{label}</p>
            <p className="text-sm font-bold leading-tight" style={{ color: gc(hoveredVal) }}>
              Grade: {Math.round(hoveredVal)}
            </p>
          </div>
        );
      })()}
    </div>
  );
};

// ── HBarChart ───────────────────────────────────────────────────────────────────

const HBarChart: React.FC<{ data: Array<{ label: string; value: number; color?: string }>; max?: number }> = ({ data, max = 5 }) => {
  const { thresholds } = useThresholds();
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  return (
    <div className="space-y-2">
      {data.map(item => {
        const pct = Math.min(100, (safeN(item.value) / max) * 100);
        const c = item.color || (
          item.value >= thresholds.excellentGradeColorThreshold ? 'bg-emerald-500' :
          item.value >= thresholds.concernGradeColorThreshold ? 'bg-yellow-500' :
          'bg-red-500'
        );
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-300 truncate max-w-[160px]" title={item.label}>{item.label}</span>
              <span className={gradeColor(item.value, thresholds)}>{safe(item.value, 1)}</span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5">
              <div className={`${c} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── DonutChart (SVG) ────────────────────────────────────────────────────────────

const DonutChart: React.FC<{ segments: Array<{ label: string; value: number; color: string }>; size?: number }> = ({ segments, size = 140 }) => {
  const total = segments.reduce((s, seg) => s + safeN(seg.value), 0);
  if (total === 0) return <p className="text-gray-500 text-sm">No data</p>;
  const r = (size - 28) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let off = 0;
  const arcs = segments.map(seg => {
    const pct = safeN(seg.value) / total;
    const arc = { ...seg, dash: pct * circ, dashOff: -off * circ };
    off += pct;
    return arc;
  });
  return (
    <div className="flex items-center justify-center gap-6 py-2">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth="11" />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth="11"
            strokeDasharray={`${a.dash} ${circ}`} strokeDashoffset={a.dashOff}
            transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="bold" fill="#f9fafb">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#9ca3af">trainees</text>
      </svg>
      <div className="space-y-2">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-300">{seg.label}</span>
            <span className="text-gray-100 font-bold ml-1">{seg.value}</span>
            <span className="text-gray-500 text-xs">({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const CircularProgress: React.FC<{ value: number; size?: number }> = ({ value, size = 34 }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-600"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-cyan-300 transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[8px] font-bold leading-none text-cyan-100">{pct}%</span>
    </span>
  );
};

// ── RadarChart (SVG) ────────────────────────────────────────────────────────────

const RadarChart: React.FC<{ data: Record<string, number>; size?: number }> = ({ data, size = 180 }) => {
  const entries = Object.entries(data).filter(([, v]) => safeN(v) > 0);
  if (entries.length < 3) return <HBarChart data={entries.map(([l, v]) => ({ label: l, value: v }))} />;
  const cx = size / 2, cy = size / 2, r = size / 2 - 22, n = entries.length, max = 5;
  const angle = (i: number) => -Math.PI / 2 + i * (2 * Math.PI / n);
  const pt = (i: number, val: number) => ({
    x: cx + r * (safeN(val) / max) * Math.cos(angle(i)),
    y: cy + r * (safeN(val) / max) * Math.sin(angle(i)),
  });
  const axisPt = (i: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const poly = entries.map(([, v], i) => pt(i, v));
  const polyStr = poly.map(p => `${p.x},${p.y}`).join(' ');
  return (
    <svg width={size} height={size} className="overflow-visible">
      {[0.25, 0.5, 0.75, 1].map(lv => (
        <polygon key={lv}
          points={entries.map((_, i) => `${cx + r * lv * Math.cos(angle(i))},${cy + r * lv * Math.sin(angle(i))}`).join(' ')}
          fill="none" stroke="#374151" strokeWidth="1" />
      ))}
      {entries.map((_, i) => { const p = axisPt(i); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#4b5563" strokeWidth="1" />; })}
      <polygon points={polyStr} fill="#3b82f630" stroke="#3b82f6" strokeWidth="1" />
      {poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#3b82f6" />)}
      {entries.map(([lbl], i) => {
        const lx = cx + (r + 16) * Math.cos(angle(i));
        const ly = cy + (r + 16) * Math.sin(angle(i));
        const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
        return <text key={i} x={lx} y={ly + 4} textAnchor={anchor} fontSize="8" fill="#9ca3af">{lbl.length > 13 ? lbl.slice(0, 13) + '...' : lbl}</text>;
      })}
    </svg>
  );
};

// ── ColChart (SVG) ──────────────────────────────────────────────────────────────

const ColChart: React.FC<{ data: Array<{ label: string; value: number; color?: string }>; max?: number; height?: number }> = ({
  data, max = 5, height = 120
}) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  const bw = Math.max(10, Math.min(30, 220 / data.length));
  const gap = Math.max(3, bw * 0.35);
  const tw = data.length * (bw + gap) + gap;
  const tp = 10, bp = 26, ch = height - tp - bp;
  return (
    <svg width={tw} height={height} className="overflow-visible" style={{ maxWidth: '100%' }}>
      {[0, 0.5, 1].map(pct => {
        const y = tp + ch * (1 - pct);
        return <line key={pct} x1={0} y1={y} x2={tw} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />;
      })}
      {data.map((item, i) => {
        const pct = Math.min(1, safeN(item.value) / max);
        const bh = Math.max(2, pct * ch);
        const x = gap + i * (bw + gap);
        const y = tp + ch - bh;
        const color = item.color || (item.value >= 4 ? '#10b981' : item.value >= 3 ? '#eab308' : '#ef4444');
        const lbl = item.label.length > 7 ? item.label.slice(0, 7) + '...' : item.label;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={color} fillOpacity={0.85} rx="2" />
            <text x={x + bw / 2} y={y - 2} textAnchor="middle" fontSize="7.5" fill="#9ca3af">{safe(item.value, 1)}</text>
            <text x={x + bw / 2} y={height - 4} textAnchor="middle" fontSize="7" fill="#6b7280"
              transform={`rotate(-35,${x + bw / 2},${height - 4})`}>{lbl}</text>
          </g>
        );
      })}
    </svg>
  );
};

// ── StatCard ────────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({
  label, value, sub, color = 'text-white'
}) => (
  <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
  </div>
);

// ── SectionCard ─────────────────────────────────────────────────────────────────

const SCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`rounded-lg border border-cyan-500/20 bg-slate-900/80 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.25)] ${className || ''}`}>
    <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
    {children}
  </div>
);

// ── Tag ─────────────────────────────────────────────────────────────────────────

const Tag: React.FC<{ text: string; type?: 'red' | 'green' | 'yellow' | 'blue' | 'gray' }> = ({ text, type = 'gray' }) => {
  const m: Record<string, string> = {
    red: 'bg-red-900/40 border-red-800 text-red-300',
    green: 'bg-emerald-900/40 border-emerald-800 text-emerald-300',
    yellow: 'bg-yellow-900/40 border-yellow-800 text-yellow-300',
    blue: 'bg-blue-900/40 border-blue-800 text-blue-300',
    gray: 'bg-gray-700 border-gray-600 text-gray-300',
  };
  return <span className={`border text-xs px-2 py-0.5 rounded ${m[type]}`}>{text}</span>;
};

// ── Grade Progression Modal (interactive, enlarged) ─────────────────────────────

const ProgressionModal: React.FC<{ data: number[]; labels?: string[]; name: string; trend: string; onClose: () => void }> = ({ data, labels: propLabels, name, trend, onClose }) => {
  const { thresholds } = useThresholds();
  const [timelineZoom, setTimelineZoom] = React.useState(0);
  const [scoreZoom, setScoreZoom] = React.useState(0);
  const color = trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#60a5fa';
  const avgVal = data.reduce((s, v) => s + v, 0) / data.length;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const labels = propLabels && propLabels.length === data.length ? propLabels : data.map((_, i) => `#${i + 1}`);
  const focusPad = Math.max(0.25, (maxVal - minVal) * 0.2);
  const focusMin = Math.max(0, minVal - focusPad);
  const focusMax = Math.min(5, maxVal + focusPad);
  const chartYMin = scoreZoom > 0 ? focusMin : 0;
  const chartYMax = scoreZoom > 0 ? focusMax : 5;
  const chartWidth = timelineZoom === 0 ? 760 : Math.max(760, data.length * (24 + timelineZoom * 12));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-4" style={{ maxWidth: '860px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">{name} &mdash; Grade Progression</h3>
            <p className="text-gray-400 text-sm mt-0.5">{data.length} assessments across the course to date &middot; hover over a point to see details</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Timeline</span>
              <TimelineZoomControl value={timelineZoom} onChange={setTimelineZoom} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Score</span>
              <TimelineZoomControl value={scoreZoom} onChange={setScoreZoom} max={1} />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-1 flex-shrink-0">&times;</button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <div className="flex gap-3">
            <div className="ml-5 flex-1 overflow-x-auto">
              <SparkLine
                data={data}
                labels={labels}
                width={chartWidth}
                height={220}
                color={color}
                interactive={true}
                yMin={chartYMin}
                yMax={chartYMax}
                showYAxisLabels={scoreZoom === 0}
              />
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2 ml-9 px-1">
            <span>Assessment 1</span>
            <span>Assessment {data.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {([
            { label: 'Minimum', value: minVal },
            { label: 'Average', value: avgVal },
            { label: 'Maximum', value: maxVal },
          ] as Array<{label: string; value: number}>).map((s) => (
            <div key={s.label} className="bg-gray-800 rounded-lg px-4 py-3 text-center border border-gray-700">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
              <p className={`text-xl font-bold font-mono ${gradeColor(s.value, thresholds)}`}>{s.value.toFixed(2)}</p>
            </div>
          ))}
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-center border border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Trend</p>
            <p className={`text-base font-bold ${trendColor(trend)}`}>{trendIcon(trend)} {trend || 'stable'}</p>
          </div>
        </div>

        <p className="text-gray-600 text-xs mt-3 text-center">Click outside or &times; to close</p>
      </div>
    </div>
  );
};

// ── Grade by Trainee Modal ────────────────────────────────────────────────────────

const ColChartExpanded: React.FC<{ data: Array<{ label: string; value: number }>; max?: number; height?: number; zoomY?: boolean; thresholds?: TIEThresholds }> = ({
  data, max = 5, height = 240, zoomY = false, thresholds = DEFAULT_THRESHOLDS
}) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  const bw = Math.max(20, Math.min(52, 800 / data.length));
  const gap = Math.max(5, bw * 0.4);
  const leftPad = 36;
  const tw = leftPad + data.length * (bw + gap) + gap;
  const tp = 16, bp = 80, ch = height - tp - bp;
  // Default to full score range. Zoom mode is available as a deliberate manager action.
  const vals = data.map(d => safeN(d.value)).filter(v => v > 0);
  const dataMin = vals.length > 0 ? Math.min(...vals) : 0;
  const dataMax = vals.length > 0 ? Math.max(...vals) : max;
  const yPad = Math.max(0.2, (dataMax - dataMin) * 0.15);
  const yMin = zoomY ? Math.max(0, dataMin - yPad) : 0;
  const yMax = zoomY ? Math.min(max, dataMax + yPad) : max;
  const yRange = yMax - yMin || 1;
  // Grid lines at nice intervals within the data range
  const gridStep = yRange <= 0.5 ? 0.1 : yRange <= 1 ? 0.2 : yRange <= 2 ? 0.5 : 1;
  const gridLines: number[] = [];
  for (let v = Math.ceil(yMin / gridStep) * gridStep; v <= yMax + 0.001; v += gridStep) {
    gridLines.push(Math.round(v * 100) / 100);
  }
  const getBarY = (v: number) => tp + ch * (1 - (v - yMin) / yRange);
  return (
    <svg width={tw} height={height} className="overflow-visible" style={{ minWidth: '100%' }}>
      {gridLines.map(v => {
        const y = getBarY(v);
        return (
          <g key={v}>
            <line x1={leftPad} y1={y} x2={tw} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={leftPad - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#6b7280">{v.toFixed(1)}</text>
          </g>
        );
      })}
      {data.map((item, i) => {
        const barTop = getBarY(safeN(item.value));
        const barBot = getBarY(yMin);
        const bh = Math.max(3, barBot - barTop);
        const x = leftPad + gap + i * (bw + gap);
        const y = barTop;
        const color = gradeChartColor(item.value, thresholds);
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={color} fillOpacity={0.9} rx="3" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#e5e7eb" fontWeight="bold">
              {safe(item.value, 2)}
            </text>
            <text
              x={x + bw / 2}
              y={height - bp + 14}
              textAnchor="end"
              fontSize="13"
              fill="#e5e7eb"
              fontWeight="500"
              transform={`rotate(-45,${x + bw / 2},${height - bp + 14})`}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── ColChartModal (zoomed Y-axis, per-bar colour, large fonts) ──────────────

const ColChartModal: React.FC<{
  data: Array<{ label: string; value: number; color?: string }>;
  max?: number;
  height?: number;
  /** If true, Y-axis zooms into actual data range for exaggerated differences */
  zoomY?: boolean;
}> = ({ data, max = 100, height = 380, zoomY = false }) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;

  // Bar sizing — wider bars, readable at any count
  const bw = Math.max(18, Math.min(48, 900 / data.length));
  const gap = Math.max(6, bw * 0.45);
  const leftPad = 48;
  const bp = 90; // bottom pad for rotated labels
  const tp = 24;
  const tw = leftPad + data.length * (bw + gap) + gap;
  const ch = height - tp - bp;

  // Y-axis: zoom into actual data range so differences are obvious
  const vals = data.map(d => d.value).filter(v => isFinite(v));
  const dataMin = vals.length > 0 ? Math.min(...vals) : 0;
  const dataMax = vals.length > 0 ? Math.max(...vals) : max;

  let yMin: number, yMax: number;
  if (zoomY && dataMax - dataMin > 0.5) {
    const pad = Math.max(1, (dataMax - dataMin) * 0.15);
    yMin = Math.max(0, dataMin - pad);
    yMax = Math.min(max, dataMax + pad);
  } else {
    yMin = 0;
    yMax = max;
  }
  const yRange = yMax - yMin || 1;

  // Grid lines
  const rawRange = yMax - yMin;
  const gridStep = rawRange <= 1 ? 0.2 : rawRange <= 5 ? 1 : rawRange <= 20 ? 5 : rawRange <= 50 ? 10 : 20;
  const gridLines: number[] = [];
  for (let v = Math.ceil(yMin / gridStep) * gridStep; v <= yMax + 0.001; v += gridStep) {
    gridLines.push(Math.round(v * 100) / 100);
  }

  const getBarY = (v: number) => tp + ch * (1 - (v - yMin) / yRange);

  return (
    <svg width={tw} height={height} className="overflow-visible" style={{ minWidth: '100%' }}>
      {/* Grid lines + Y-axis labels */}
      {gridLines.map(v => {
        const y = getBarY(v);
        return (
          <g key={v}>
            <line x1={leftPad} y1={y} x2={tw} y2={y} stroke="#374151" strokeWidth="0.7" strokeDasharray="4,3" />
            <text x={leftPad - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af" fontFamily="monospace">{v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}</text>
          </g>
        );
      })}
      {/* Y-axis line */}
      <line x1={leftPad} y1={tp} x2={leftPad} y2={tp + ch} stroke="#4b5563" strokeWidth="1" />

      {/* Bars */}
      {data.map((item, i) => {
        const clampedVal = Math.max(yMin, Math.min(yMax, item.value));
        const barTop = getBarY(clampedVal);
        const barBot = getBarY(yMin);
        const bh = Math.max(3, barBot - barTop);
        const x = leftPad + gap + i * (bw + gap);
        const color = item.color || '#3b82f6';

        // Value label above bar
        const valLabel = item.value % 1 === 0 ? item.value.toFixed(0) : item.value.toFixed(1);

        return (
          <g key={i}>
            <rect x={x} y={barTop} width={bw} height={bh} fill={color} fillOpacity={0.88} rx="3" />
            {/* Value above bar */}
            <text x={x + bw / 2} y={barTop - 6} textAnchor="middle" fontSize="11" fill="#e5e7eb" fontWeight="600">
              {valLabel}
            </text>
            {/* X-axis label — rotated 45° */}
            <text
              x={x + bw / 2}
              y={height - bp + 16}
              textAnchor="end"
              fontSize="11"
              fill="#d1d5db"
              fontWeight="500"
              transform={`rotate(-45,${x + bw / 2},${height - bp + 16})`}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const GradeByTraineeModal: React.FC<{
  trainees: Array<{ label: string; value: number }>;
  thresholds: TIEThresholds;
  onClose: () => void;
}> = ({ trainees, thresholds, onClose }) => {
  const [timelineZoom, setTimelineZoom] = React.useState(0);
  const [scoreZoom, setScoreZoom] = React.useState(0);
  const visibleData = trainees;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-2" style={{ maxWidth: '1100px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">Grade by Trainee (sorted low to high)</h3>
            <p className="text-gray-400 text-sm mt-0.5">{trainees.length} trainees &middot; course-to-date average grade per trainee</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Timeline</span>
              <TimelineZoomControl value={timelineZoom} onChange={setTimelineZoom} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Score</span>
              <TimelineZoomControl value={scoreZoom} onChange={setScoreZoom} max={1} />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-1 flex-shrink-0">&times;</button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
          <div style={{ width: timelineZoom === 0 ? '100%' : Math.max(900, visibleData.length * (42 + timelineZoom * 16)) }}>
            <ColChartExpanded data={visibleData} max={5} height={420} zoomY={scoreZoom > 0} thresholds={thresholds} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 justify-center text-xs">
          {[
            { color: '#f87171', label: `Below ${thresholds.criticalLowGradeThreshold.toFixed(1)} - critically low` },
            { color: '#fb923c', label: `${thresholds.criticalLowGradeThreshold.toFixed(1)}+ - low` },
            { color: '#facc15', label: `${thresholds.concernGradeColorThreshold.toFixed(1)}+ - concern` },
            { color: '#4ade80', label: `${thresholds.normalGradeColorThreshold.toFixed(1)}+ - normal` },
            { color: '#34d399', label: `${thresholds.excellentGradeColorThreshold.toFixed(1)}+ - excellent` },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: l.color }} />
              <span className="text-gray-400">{l.label}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-3 text-center">Click outside or &times; to close</p>
      </div>
    </div>
  );
};


// ── Threshold Settings Panel ──────────────────────────────────────────────────

const ThresholdSettingsPanel: React.FC<{
  onClose: () => void;
  onSave: (t: TIEThresholds) => void;
}> = ({ onClose, onSave }) => {
  const { thresholds } = useThresholds();
  const [local, setLocal] = React.useState<TIEThresholds>({ ...thresholds });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = (key: keyof TIEThresholds, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setLocal(prev => ({ ...prev, [key]: n }));
  };

  const setBool = (key: keyof TIEThresholds, val: boolean) => {
    setLocal(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: TIEThresholds = {
        ...local,
        // Keep legacy setting keys in sync for older analytics records and code paths.
        normalMinGrade: local.normalAvgGrade,
        lowRecentGrade: local.worseningRecentAvgGrade,
      };
      // Map TIEThresholds keys to DB setting keys
      const mapping: Record<keyof TIEThresholds, string> = {
        atRiskAvgGrade: 'at_risk_avg_grade',
        normalAvgGrade: 'normal_avg_grade',
        worseningRecentAvgGrade: 'worsening_recent_avg_grade',
        exceedingAvgGrade: 'exceeding_avg_grade',
        concernThresholdGrade: 'concern_threshold_grade',
        excellentGradeColorThreshold: 'excellent_grade_color_threshold',
        normalGradeColorThreshold: 'normal_grade_color_threshold',
        concernGradeColorThreshold: 'concern_grade_color_threshold',
        criticalLowGradeThreshold: 'critical_low_grade_threshold',
        bottleneckThresholdPct: 'bottleneck_threshold_pct',
        healthyPassRatePct: 'healthy_pass_rate_pct',
        highVarianceThreshold: 'high_variance_threshold',
        normalMinGrade: 'normal_min_grade',
        atRiskAverageEnabled: 'at_risk_average_enabled',
        atRiskSustainedDeclineEnabled: 'at_risk_sustained_decline_enabled',
        atRiskRecentDropEnabled: 'at_risk_recent_drop_enabled',
        atRiskLowRecentEnabled: 'at_risk_low_recent_enabled',
        atRiskRecurringWeakElementsEnabled: 'at_risk_recurring_weak_elements_enabled',
        sustainedDeclineCount: 'at_risk_sustained_decline_count',
        recentDropThreshold: 'at_risk_recent_drop_threshold',
        lowRecentGrade: 'at_risk_low_recent_grade',
        recurringWeakElementCount: 'at_risk_recurring_weak_element_count',
        minAssessmentsForRisk: 'at_risk_min_assessments',
        minObservationsForPattern: 'min_observations_for_pattern',
        recencyWeightFactor: 'recency_weight_factor',
        commentWeightVsScore: 'comment_weight_vs_score',
        overServiceGradeThreshold: 'over_service_threshold',
      };
      const sessionToken = localStorage.getItem('dfp_session_token') || '';
      await Promise.all(
        (Object.keys(payload) as Array<keyof TIEThresholds>).map(async k => {
          const response = await fetch('/api/tie/settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            },
            body: JSON.stringify({ key: mapping[k], value: payload[k] }),
          });
          if (!response.ok) {
            const body = await response.text().catch(() => '');
            throw new Error(`Failed to save ${mapping[k]}${body ? `: ${body}` : ''}`);
          }
        })
      );
      onSave({ ...payload });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save analytics thresholds.');
    }
    finally { setSaving(false); }
  };

  const fields: Array<{ key: keyof TIEThresholds; label: string; desc: string; min: number; max: number; step: number }> = [
    {
      key: 'atRiskAvgGrade',
      label: 'At-Risk Threshold',
      desc: 'Average grade BELOW which a trainee is classified as At-Risk. E.g. 3.2 means any trainee averaging below 3.2 is flagged.',
      min: 1.0, max: 4.5, step: 0.1,
    },
    {
      key: 'normalAvgGrade',
      label: 'Normal / Watch Boundary',
      desc: 'Whole-course average at or above which a trainee is Normal instead of Watch. This is the overall average, not recent trend performance.',
      min: 2.5, max: 4.5, step: 0.1,
    },
    {
      key: 'worseningRecentAvgGrade',
      label: 'Worsening Trend Recent Average',
      desc: 'Recent average below which a trainee with a worsening trend is escalated. This stays separate from Normal / Watch because it measures recent performance only.',
      min: 2.5, max: 4.5, step: 0.1,
    },
    {
      key: 'exceedingAvgGrade',
      label: 'Exceeding Threshold',
      desc: 'Average grade ABOVE which a trainee is classified as Exceeding (high performer). E.g. 4.2.',
      min: 3.0, max: 5.0, step: 0.1,
    },
    {
      key: 'concernThresholdGrade',
      label: 'Pass / Concern Threshold',
      desc: 'Grade at or below which an assessment element is flagged as a concern. Grade ≥ this value = PASS. Default is 3 (Satisfactory).',
      min: 1, max: 4, step: 1,
    },
    {
      key: 'excellentGradeColorThreshold',
      label: 'Grade Colour: Excellent',
      desc: 'Grade at or above which charts and scores use the excellent colour.',
      min: 3.0, max: 5.0, step: 0.1,
    },
    {
      key: 'normalGradeColorThreshold',
      label: 'Grade Colour: Normal',
      desc: 'Grade at or above which charts and scores use the normal colour.',
      min: 2.5, max: 5.0, step: 0.1,
    },
    {
      key: 'concernGradeColorThreshold',
      label: 'Grade Colour: Concern',
      desc: 'Grade at or above which charts and scores move out of low/critical and into concern.',
      min: 1.0, max: 4.0, step: 0.1,
    },
    {
      key: 'criticalLowGradeThreshold',
      label: 'Grade Colour: Critically Low',
      desc: 'Grade below this value is shown as critical. Grades from this value up to Concern are shown as low.',
      min: 1.0, max: 3.0, step: 0.1,
    },
    {
      key: 'bottleneckThresholdPct',
      label: 'Elevated Risk % Threshold',
      desc: 'Percentage of trainees scoring below the concern threshold that triggers an event to be flagged as an elevated risk event.',
      min: 10, max: 80, step: 5,
    },
    {
      key: 'healthyPassRatePct',
      label: 'Healthy Pass Rate Colour',
      desc: 'Pass rate at or above which pass-rate charts show healthy/green. Yellow sits between this value and the elevated-risk boundary.',
      min: 50, max: 100, step: 5,
    },
    {
      key: 'highVarianceThreshold',
      label: 'High Variance Threshold',
      desc: 'Grade standard deviation above which an event is flagged as high-variance (inconsistent trainee performance).',
      min: 0.3, max: 2.5, step: 0.1,
    },
    {
      key: 'minObservationsForPattern',
      label: 'Minimum Reports Before Alerting',
      desc: 'Minimum number of training reports required before analytics generates pattern-based findings.',
      min: 1, max: 10, step: 1,
    },
    {
      key: 'recencyWeightFactor',
      label: 'Recent Performance Weighting',
      desc: 'Multiplier applied to recent assessments so current performance carries more weight than older results.',
      min: 1.0, max: 3.0, step: 0.1,
    },
    {
      key: 'commentWeightVsScore',
      label: 'Instructor Comment Weighting',
      desc: 'Weight given to comment tags compared with numeric scores when interpreting training issues.',
      min: 0, max: 1, step: 0.1,
    },
    {
      key: 'overServiceGradeThreshold',
      label: 'Over-Service Grade Threshold',
      desc: 'Average grade at or above which a stable event may be classed as over-serviced.',
      min: 3.0, max: 5.0, step: 0.1,
    },
  ];

  const atRiskCriteria: Array<{
    enabledKey: keyof TIEThresholds;
    title: string;
    detail: string;
    control?: { key: keyof TIEThresholds; suffix: string; min: number; max: number; step: number };
  }> = [
    {
      enabledKey: 'atRiskAverageEnabled',
      title: 'Low course average',
      detail: 'Classifies trainees as At Risk when their whole-course score average falls below the at-risk threshold.',
      control: { key: 'atRiskAvgGrade', suffix: 'avg', min: 1, max: 4.5, step: 0.1 },
    },
    {
      enabledKey: 'atRiskSustainedDeclineEnabled',
      title: 'Sustained decline',
      detail: 'Moves a trainee to Monitor when each of the most recent assessments is lower than the previous one.',
      control: { key: 'sustainedDeclineCount', suffix: 'events', min: 3, max: 6, step: 1 },
    },
    {
      enabledKey: 'atRiskRecentDropEnabled',
      title: 'Recent performance drop',
      detail: 'Moves trainees to Monitor when their recent average has fallen materially below their whole-course average.',
      control: { key: 'recentDropThreshold', suffix: 'drop', min: 0.2, max: 1.5, step: 0.1 },
    },
    {
      enabledKey: 'atRiskLowRecentEnabled',
      title: 'Worsening trend recent average',
      detail: 'Moves trainees to Monitor when their recent assessment window is below the configured recent score floor and their trend is worsening.',
      control: { key: 'worseningRecentAvgGrade', suffix: 'recent avg', min: 1, max: 4.5, step: 0.1 },
    },
    {
      enabledKey: 'atRiskRecurringWeakElementsEnabled',
      title: 'Recurring weak elements',
      detail: 'Moves trainees to Monitor when repeated weak element patterns appear before the overall average has fallen.',
      control: { key: 'recurringWeakElementCount', suffix: 'elements', min: 2, max: 8, step: 1 },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full mx-4"
        style={{ maxWidth: 860 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-white font-bold text-base">Analytics Thresholds</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Adjust the thresholds used for risk classification and event analysis.
              Changes persist across sessions. Re-run analytics after saving to reclassify trainees.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none ml-4">&times;</button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-white">At-Risk Criteria</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  At Risk is controlled by the course average threshold. The other enabled signals move trainees into Monitor so the At Risk count follows the threshold you set.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
                <span className="text-xs text-slate-400">Minimum data</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={local.minAssessmentsForRisk}
                  onChange={e => set('minAssessmentsForRisk', e.target.value)}
                  className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {atRiskCriteria.map(criteria => {
                const enabled = Boolean(local[criteria.enabledKey]);
                return (
                  <label
                    key={criteria.enabledKey}
                    className={`rounded-lg border p-3 transition-colors ${
                      enabled ? 'border-cyan-500/35 bg-slate-900/80' : 'border-slate-700 bg-slate-950/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => setBool(criteria.enabledKey, e.target.checked)}
                        className="mt-1 h-4 w-4 accent-cyan-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-100">{criteria.title}</span>
                          {criteria.control && (
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                min={criteria.control.min}
                                max={criteria.control.max}
                                step={criteria.control.step}
                                value={local[criteria.control.key] as number}
                                disabled={!enabled}
                                onChange={e => set(criteria.control!.key, e.target.value)}
                                className="w-16 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-xs text-white disabled:opacity-40 focus:outline-none focus:border-cyan-400"
                              />
                              <span className="text-[11px] text-slate-500">{criteria.control.suffix}</span>
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{criteria.detail}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {fields.map(f => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-200">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={f.min} max={f.max} step={f.step}
                    value={local[f.key] as number}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-32 accent-blue-500"
                  />
                  <input
                    type="number"
                    min={f.min} max={f.max} step={f.step}
                    value={local[f.key] as number}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-16 bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-0.5 text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
          </div>

          {/* Status definition legend */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mt-2">
            <h4 className="text-gray-300 font-semibold text-xs uppercase tracking-wide mb-3">
              How Status Levels Are Determined
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-red-300 font-semibold">At Risk — </span>
                  <span className="text-gray-400">
                    Course average is below the at-risk threshold after {local.minAssessmentsForRisk} assessment(s).
                    Active criteria: {riskCriteriaRows(local).join('; ') || 'none selected'}.
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-yellow-300 font-semibold">Monitor / Watch — </span>
                  <span className="text-gray-400">
                    Trend, recent-average, or recurring weak-element signals are triggered, or whole-course avg grade is below {local.normalAvgGrade.toFixed(1)} once not classified At Risk.
                    Active monitor signals: {monitorSignalRows(local).join('; ') || 'none selected'}.
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-blue-300 font-semibold">Normal — </span>
                  <span className="text-gray-400">
                    Whole-course avg grade ≥ {local.normalAvgGrade.toFixed(1)} and &lt; {local.exceedingAvgGrade.toFixed(1)}.
                    Trainee is meeting expectations satisfactorily.
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-emerald-300 font-semibold">Exceeding — </span>
                  <span className="text-gray-400">
                    Avg grade ≥ {local.exceedingAvgGrade.toFixed(1)} with a stable or improving trend.
                    Trainee is consistently performing above the expected standard.
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
              <span className="text-gray-400 font-semibold">Pass Grade: </span>
              Grade ≥ {local.concernThresholdGrade} = PASS (Satisfactory or above on the 1–5 scale).
              Only grades below {local.concernThresholdGrade} are counted as failures.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <p className="text-gray-500 text-xs">
            Changes take effect after re-running analytics
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600 text-gray-300">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
                saved ? 'bg-emerald-600 text-white' :
                saving ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
              }`}
            >
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Thresholds'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};



// ── COURSE TAB ──────────────────────────────────────────────────────────────────

const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
  trainingReportDisplayName: string;
}> = ({ summary, trainees, events, trainingReportDisplayName }) => {
  const { thresholds } = useThresholds();
  const [eventAvgExpanded, setEventAvgExpanded] = useState(false);
  const [openStatusFlyout, setOpenStatusFlyout] = useState<'at_risk' | 'monitor' | null>(null);
  const evaluatedRisks = trainees.map(t => ({
    name: t.traineeFullName,
    ...evaluateTraineeRisk(t, thresholds),
  }));
  const riskLevels = evaluatedRisks.map(r => r.riskLevel === 'watch' ? 'monitor' : r.riskLevel);
  const atRisk = riskLevels.filter(r => r === 'at_risk').length;
  const exceeding = riskLevels.filter(r => r === 'exceeding').length;
  const monitor = riskLevels.filter(r => r === 'monitor').length;
  const normal = trainees.length - atRisk - exceeding - monitor;
  const atRiskSummary = summarizeStatusTriggers(evaluatedRisks, 'at_risk');
  const monitorSummary = summarizeStatusTriggers(evaluatedRisks, 'monitor');
  const statusFlyoutSummary = openStatusFlyout === 'at_risk' ? atRiskSummary : monitorSummary;
  const statusFlyoutTitle = openStatusFlyout === 'at_risk' ? 'At Risk names' : 'Monitor names';
  const avgGrade = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;
  const passRate = trainees.length > 0
    ? (trainees.filter(t => safeN(t.avgOverallGrade) >= thresholds.concernThresholdGrade).length / trainees.length) * 100
    : 0;
  const skillHeatmap = parseJ(summary.skillHeatmap, {}) as Record<string, number>;
  const skillEntries = Object.entries(skillHeatmap).sort((a, b) => a[1] - b[1]);
  const bottleneckEvents = parseJ(summary.bottleneckEvents, []) as string[];
  const overServicedEventsFromSummary = parseJ(summary.overServicedEvents, []) as string[];

  // Derive low risk events from event data if summary is empty
  const overServicedFromEvents = events
    .filter(ev => ev.overServiceIndicator === true || (ev as any).overServiceIndicator === 'true' || (ev as any).overServiceIndicator === 1)
    .map(ev => ev.eventCode);
  const overServicedEvents = overServicedEventsFromSummary.length > 0
    ? overServicedEventsFromSummary
    : overServicedFromEvents;

  // Difficulty ranking — sort by avgOverallGrade ascending (hardest first), filter events with valid grade
  const eventsByDiff = [...events]
    .filter(ev => safeN(ev.avgOverallGrade) > 0)
    .sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade));

  const topByAttempts = [...events].sort((a, b) => safeN(b.totalAttempts) - safeN(a.totalAttempts)).slice(0, 12);

  const allSkills = Array.from(new Set(events.flatMap(ev => Object.keys(parseJ(ev.skillFamilyScores, {})))));

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Avg Score" value={safe(avgGrade, 2)} color={gradeColor(avgGrade, thresholds)} sub="course average" />
        <StatCard label="Pass Rate" value={`${passRate.toFixed(0)}%`}
          color={passRateTextColor(passRate, thresholds)}
          sub={`trainees avg ≥ ${thresholds.concernThresholdGrade}.0`} />
        <StatCard label="At-Risk" value={atRisk}
          color={atRisk > 0 ? 'text-red-400' : 'text-gray-400'} sub={`of ${trainees.length} trainees`} />
        <StatCard label={`${trainingReportDisplayName} Records`} value={summary.totalPt051s} sub={`${trainees.length} trainees`} />
        <StatCard label="Events" value={events.length}
          sub={`${bottleneckEvents.length} elevated risk`}
          color={bottleneckEvents.length > 0 ? 'text-orange-400' : 'text-white'} />
      </div>

      {/* Row 1: Status Donut + Skill Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SCard title="Trainee Status Distribution">
          <div className="flex justify-center items-center py-2">
            <DonutChart size={260} segments={[
              { label: 'At Risk', value: atRisk, color: '#ef4444' },
              { label: 'Monitor', value: monitor, color: '#eab308' },
              { label: 'Normal', value: normal, color: '#3b82f6' },
              { label: 'Exceeding', value: exceeding, color: '#10b981' },
            ].filter(s => s.value > 0)} />
          </div>
          <div className="grid grid-cols-1 gap-2 border-t border-gray-700 pt-3 text-xs md:grid-cols-2">
            <div className="relative">
            <button
              type="button"
              onClick={() => setOpenStatusFlyout(openStatusFlyout === 'at_risk' ? null : 'at_risk')}
              className="w-full rounded-md border border-red-500/20 bg-red-500/5 p-3 text-left transition-colors hover:border-red-400/50 hover:bg-red-500/10"
            >
              <p className="font-semibold text-red-300">At Risk summary</p>
              <p className="mt-1 text-gray-400">
                {atRisk === 0
                  ? 'No trainees are below the At Risk average threshold.'
                  : atRiskSummary.map(item => `${item.count} ${item.label}`).join('; ')}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-red-200/70">Click for names</p>
            </button>
            {openStatusFlyout === 'at_risk' && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-md border border-red-500/30 bg-slate-950 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-semibold text-red-200">{statusFlyoutTitle}</p>
                  <button type="button" onClick={() => setOpenStatusFlyout(null)} className="text-slate-500 hover:text-white">&times;</button>
                </div>
                {statusFlyoutSummary.length === 0 ? (
                  <p className="text-slate-500">No trainees to list.</p>
                ) : statusFlyoutSummary.map(item => (
                  <div key={item.label} className="border-t border-slate-800 py-2 first:border-t-0 first:pt-0">
                    <p className="font-semibold text-slate-300">{item.count} {item.label}</p>
                    <ul className="mt-1 max-h-44 space-y-1 overflow-y-auto text-slate-500">
                      {item.names.slice(0, 12).map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    {item.names.length > 12 && (
                      <p className="mt-1 text-slate-600">+{item.names.length - 12} more</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
            <div className="relative">
            <button
              type="button"
              onClick={() => setOpenStatusFlyout(openStatusFlyout === 'monitor' ? null : 'monitor')}
              className="w-full rounded-md border border-yellow-500/20 bg-yellow-500/5 p-3 text-left transition-colors hover:border-yellow-400/50 hover:bg-yellow-500/10"
            >
              <p className="font-semibold text-yellow-300">Monitor summary</p>
              <p className="mt-1 text-gray-400">
                {monitor === 0
                  ? 'No trainees have Monitor signals.'
                  : monitorSummary.map(item => `${item.count} ${item.label}`).join('; ')}
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-yellow-200/70">Click for names</p>
            </button>
            {openStatusFlyout === 'monitor' && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-md border border-yellow-500/30 bg-slate-950 p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-semibold text-yellow-200">{statusFlyoutTitle}</p>
                  <button type="button" onClick={() => setOpenStatusFlyout(null)} className="text-slate-500 hover:text-white">&times;</button>
                </div>
                {statusFlyoutSummary.length === 0 ? (
                  <p className="text-slate-500">No trainees to list.</p>
                ) : statusFlyoutSummary.map(item => (
                  <div key={item.label} className="border-t border-slate-800 py-2 first:border-t-0 first:pt-0">
                    <p className="font-semibold text-slate-300">{item.count} {item.label}</p>
                    <ul className="mt-1 max-h-44 space-y-1 overflow-y-auto text-slate-500">
                      {item.names.slice(0, 12).map(name => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    {item.names.length > 12 && (
                      <p className="mt-1 text-slate-600">+{item.names.length - 12} more</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
          {/* Status definitions */}
          <div className="mt-3 border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Status Definitions</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-red-300 font-semibold">At Risk: </span>
                  Course average is below the at-risk threshold after <span className="text-white font-mono">{thresholds.minAssessmentsForRisk}</span>
                  {' '}assessment(s): {riskCriteriaRows(thresholds).join('; ') || 'no criteria selected'}.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-yellow-300 font-semibold">Monitor: </span>
                  Trend, recent-average, or recurring weak-element signals are triggered, or whole-course avg grade is below <span className="text-white font-mono">{thresholds.normalAvgGrade.toFixed(1)}</span> once not classified At Risk.
                  {' '}Active monitor signals: {monitorSignalRows(thresholds).join('; ') || 'none selected'}.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-blue-300 font-semibold">Normal: </span>
                  Whole-course avg grade <span className="text-white font-mono">{thresholds.normalAvgGrade.toFixed(1)}</span>–<span className="text-white font-mono">{thresholds.exceedingAvgGrade.toFixed(1)}</span>.
                  {' '}Meeting expectations.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-emerald-300 font-semibold">Exceeding: </span>
                  Avg grade ≥ <span className="text-white font-mono">{thresholds.exceedingAvgGrade.toFixed(1)}</span>
                  {' '}with stable/improving trend. Above standard.
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-700/60">
              Pass = grade ≥ <span className="text-gray-400 font-mono">{thresholds.concernThresholdGrade}</span> (Satisfactory or above).
              {' '}Elevated risk = &gt;<span className="text-gray-400 font-mono">{thresholds.bottleneckThresholdPct}%</span> trainees below pass grade.
            </p>
          </div>
        </SCard>
        <SCard title="Skill Family Performance">
          {skillEntries.length > 0
            ? <HBarChart data={skillEntries.map(([l, v]) => ({ label: l, value: v }))} />
            : <p className="text-gray-500 text-sm">Run analytics to generate skill data</p>}
        </SCard>
      </div>

      {/* Row 2: Event Difficulty Ranking */}
      <SCard title="Event Difficulty Ranking (lowest avg grade first — hardest events at top)">
        {eventsByDiff.length > 0 ? (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {eventsByDiff.map((ev, i) => (
              <div key={ev.id || ev.eventCode} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-5 flex-shrink-0 text-right">{i + 1}.</span>
                <span className="text-xs text-gray-200 flex-1 truncate font-medium" title={ev.eventCode}>{ev.eventCode}</span>
                <div className="w-32 flex-shrink-0">
                  <SparkBar value={safeN(ev.avgOverallGrade)} />
                </div>
                <span className="text-xs text-gray-500 w-16 flex-shrink-0 text-right">{ev.totalAttempts} tries</span>
                {safeN(ev.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100 && <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1.5 py-0.5 rounded flex-shrink-0">ELEVATED RISK</span>}
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <p className="text-gray-500 text-sm">Event grades not yet computed — run analytics to populate</p>
        ) : (
          <p className="text-gray-500 text-sm">No event data — run analytics first</p>
        )}
      </SCard>

      {/* Row 3: Event avg bar chart — click to expand */}
      {topByAttempts.length > 0 && (
        <>
          {/* Expanded modal */}
          {eventAvgExpanded && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setEventAvgExpanded(false)}>
              <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full max-w-6xl p-6" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-white font-bold text-xl">Event Average Scores (Top 12 by Attempts)</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{topByAttempts.length} events &mdash; click outside to close</p>
                  </div>
                  <button onClick={() => setEventAvgExpanded(false)} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 overflow-x-auto mt-3">
                  <ColChartExpanded
                    data={topByAttempts.map(ev => ({ label: ev.eventCode, value: safeN(ev.avgOverallGrade) }))}
                    max={5} height={420} thresholds={thresholds} />
                </div>
              </div>
            </div>
          )}
          <div className="cursor-pointer group" title="Click to expand" onClick={() => setEventAvgExpanded(true)}>
            <SCard title={
              <span className="flex items-center gap-2">
                Event Average Scores (Top 12 by Attempts)
                <span className="text-gray-500 group-hover:text-blue-400 transition-colors text-xs font-normal ml-1">⤢ expand</span>
              </span>
            }>
              <div className="overflow-x-auto">
                <ColChart data={topByAttempts.map(ev => ({ label: ev.eventCode, value: safeN(ev.avgOverallGrade) }))} max={5} height={130} />
              </div>
            </SCard>
          </div>
        </>
      )}

      {/* Row 4: Elevated Risk + Low Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SCard title="Elevated Risk Events">
          {bottleneckEvents.length === 0
            ? <p className="text-gray-500 text-sm">No elevated risk events detected</p>
            : (
              <>
                <p className="text-xs text-gray-500 mb-2">Events where trainees consistently struggle — high difficulty score, low pass rate, or recurring weak elements.</p>
                <div className="flex flex-wrap gap-2">{bottleneckEvents.slice(0, 5).map(e => <Tag key={e} text={e} type="red" />)}</div>
                {bottleneckEvents.length > 5 && <p className="text-xs text-gray-600 mt-2">+{bottleneckEvents.length - 5} more</p>}
              </>
            )}
        </SCard>
        <SCard title="Low Risk Events">
          <p className="text-xs text-gray-500 mb-2">
            Low risk events are events where trainees perform well above expectations — high pass rates and grades suggest these events may require less attention than elevated risk events.
          </p>
          {overServicedEvents.length === 0
            ? <p className="text-gray-500 text-sm">No low risk events detected</p>
            : <div className="flex flex-wrap gap-2">{overServicedEvents.map(e => <Tag key={e} text={e} type="green" />)}</div>}
        </SCard>
      </div>

      {/* Row 5: Skill heatmap matrix */}
      {events.length > 0 && allSkills.length > 0 && (
        <SCard title="Skill Weakness Heatmap (Event x Skill Family)">
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left text-gray-400 pr-4 py-1 whitespace-nowrap">Event</th>
                  {allSkills.map(sk => <th key={sk} className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">{sk}</th>)}
                  <th className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">Overall</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => {
                  const sf = parseJ(ev.skillFamilyScores, {}) as Record<string, number>;
                  return (
                    <tr key={ev.id} className="border-t border-gray-700/50 hover:bg-gray-700/20">
                      <td className="text-gray-300 pr-4 py-1.5 whitespace-nowrap font-medium">{ev.eventCode}</td>
                      {allSkills.map(sk => {
                        const v = sf[sk];
                        return (
                          <td key={sk} className="px-2 py-1.5 text-center">
                            {v !== undefined
                              ? <span className={`font-mono font-bold ${gradeColor(v, thresholds)}`}>{safe(v, 1)}</span>
                              : <span className="text-gray-700">&mdash;</span>}
                          </td>
                        );
                      })}
                      <td className={`px-2 py-1.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>
                        {safe(ev.avgOverallGrade, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SCard>
      )}

      {/* Narrative */}
      {summary.narrativeSummary && (
        <SCard title="Course Analysis Narrative">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{summary.narrativeSummary}</p>
          <p className="text-gray-600 text-xs mt-3">Last analysed: {formatDate(summary.completedAt)} &middot; {summary.recordsProcessed} records processed</p>
        </SCard>
      )}
    </div>
  );
};

// ── TRAINEE TAB ─────────────────────────────────────────────────────────────────

const TraineeTab: React.FC<{ trainees: TIETraineeSummary[]; trainingReportDisplayName: string }> = ({ trainees, trainingReportDisplayName }) => {
  const { thresholds } = useThresholds();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'monitor' | 'exceeding'>('all');
  const [selected, setSelected] = useState<TIETraineeSummary | null>(null);
  const [progressionModal, setProgressionModal] = useState<{ data: number[]; labels: string[]; name: string; trend: string } | null>(null);
  const [gradeByTraineeModal, setGradeByTraineeModal] = useState(false);
  const [detailTimelineZoom, setDetailTimelineZoom] = useState(0);

  const traineeRisk = useMemo(() => {
    const map = new Map<string, { riskLevel: string; reasons: string[] }>();
    trainees.forEach(t => map.set(t.id, evaluateTraineeRisk(t, thresholds)));
    return map;
  }, [trainees, thresholds]);

  const getRisk = (t: TIETraineeSummary) => traineeRisk.get(t.id) || { riskLevel: t.riskLevel, reasons: parseJ(t.atRiskReasons, []) as string[] };

  const atRiskCount = trainees.filter(t => getRisk(t).riskLevel === 'at_risk').length;
  const monitorCount = trainees.filter(t => getRisk(t).riskLevel === 'monitor' || getRisk(t).riskLevel === 'watch').length;
  const exceedingCount = trainees.filter(t => getRisk(t).riskLevel === 'exceeding').length;

  const filtered = trainees.filter(t => {
    const displayRisk = getRisk(t).riskLevel === 'watch' ? 'monitor' : getRisk(t).riskLevel;
    if (filter !== 'all' && displayRisk !== filter) return false;
    if (search && !t.traineeFullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const courseAvg = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;

  const selProgression = selected ? parseProgression(selected.gradeProgression) : [];
  const selProgressionFull = selected ? parseProgressionFull(selected.gradeProgression) : { grades: [], labels: [] };
  const selSkills = selected ? parseJ(selected.skillFamilyScores ?? selected.strongestSkillFamilies, {}) as Record<string, number> : {};
  const hasSkillScores = Object.values(selSkills).some(v => typeof v === 'number' && v > 0);
  const weakEls = selected ? parseJ(selected.recurringWeakElements, []) as string[] : [];
  const strongFams = selected ? parseJ(selected.strongestSkillFamilies, []) as string[] : [];
  const selectedRisk = selected ? getRisk(selected) : null;
  const selectedRiskLevel = selectedRisk?.riskLevel === 'watch' ? 'monitor' : selectedRisk?.riskLevel;
  const atRiskReasons = selectedRisk?.reasons || [];

  const filterButtons = [
    { k: 'all' as const, label: `All (${trainees.length})` },
    { k: 'at_risk' as const, label: `At Risk (${atRiskCount})` },
    { k: 'monitor' as const, label: `Monitor (${monitorCount})` },
    { k: 'exceeding' as const, label: `Exceeding (${exceedingCount})` },
  ];

  return (
    <div className="space-y-4">
      {/* Grade Progression Modal */}
      {progressionModal && (
        <ProgressionModal
          data={progressionModal.data}
          labels={progressionModal.labels}
          name={progressionModal.name}
          trend={progressionModal.trend}
          onClose={() => setProgressionModal(null)}
        />
      )}

      {gradeByTraineeModal && (
        <GradeByTraineeModal
          trainees={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
            // traineeFullName format: "Surname, First - COURSE"
            // Split on dash to get the name part, then take surname before comma.
            const namePart = t.traineeFullName.split(/\s*[\u2013\u2014-]\s*/)[0].trim();
            const label = namePart.includes(',')
              ? namePart.split(',')[0].trim()  // "Brown" (surname)
              : namePart.split(/\s+/)[0].trim(); // first word if no comma
            return { label, value: safeN(t.avgOverallGrade) };
          })}
          thresholds={thresholds}
          onClose={() => setGradeByTraineeModal(false)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search trainee..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-md px-3 py-1.5 w-56 focus:outline-none focus:border-blue-500" />
        <div className="flex gap-1 flex-wrap">
          {filterButtons.map(({ k, label }) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${filter === k ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-gray-500 text-xs ml-auto">{filtered.length} shown</span>
      </div>

      <div className="flex gap-4">
        {/* List */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium px-4 py-2.5 text-xs uppercase">Trainee</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Avg</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Recent</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Trend</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">{trainingReportDisplayName}s</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Risk</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Prog.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8 text-sm">No trainees match the filter</td></tr>
                )}
                {filtered.map(t => {
                  const progFull = parseProgressionFull(t.gradeProgression);
                  const prog = progFull.grades;
                  const progLabels = progFull.labels;
                  const displayRisk = getRisk(t).riskLevel === 'watch' ? 'monitor' : getRisk(t).riskLevel;
                  return (
                    <tr key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}
                      className={`border-b border-gray-700/50 cursor-pointer transition-colors ${selected?.id === t.id ? 'bg-blue-900/30' : 'hover:bg-gray-700/40'}`}>
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{t.traineeFullName}</td>
                      <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(safeN(t.avgOverallGrade), thresholds)}`}>{safe(t.avgOverallGrade, 2)}</td>
                      <td className={`px-3 py-2.5 text-center font-mono text-xs ${gradeColor(safeN(t.recentAvgGrade), thresholds)}`}>{safe(t.recentAvgGrade, 2)}</td>
                      <td className={`px-3 py-2.5 text-center font-bold ${trendColor(t.overallTrend)}`}>{trendIcon(t.overallTrend)}</td>
                      <td className="px-3 py-2.5 text-center text-gray-400">{t.totalPt051Count}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskBadge(displayRisk)}`}>
                          {displayRisk === 'at_risk' ? 'At Risk' : displayRisk === 'monitor' ? 'Monitor' : displayRisk === 'exceeding' ? 'Exceeding' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {prog.length >= 2
                          ? (
                            <button
                              title="Click to enlarge"
                              onClick={e => {
                                e.stopPropagation();
                                setProgressionModal({ data: prog, labels: progLabels, name: t.traineeFullName, trend: t.overallTrend });
                              }}
                              className="hover:opacity-80 transition-opacity cursor-zoom-in"
                            >
                              <SparkLine data={prog} width={70} height={24} color={t.overallTrend === 'improving' ? '#10b981' : t.overallTrend === 'worsening' ? '#ef4444' : '#60a5fa'} />
                            </button>
                          )
                          : <span className="text-gray-600 text-xs">&mdash;</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom: grade by trainee + recent vs overall */}
          {trainees.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <SCard title="Grade by Trainee (sorted low to high)">
                <button
                  onClick={() => setGradeByTraineeModal(true)}
                  className="w-full hover:opacity-80 transition-opacity cursor-zoom-in text-left"
                  title="Click to enlarge"
                >
                  <div className="overflow-x-auto">
                    <ColChart
                      data={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
                        // traineeFullName format: "Surname, First - COURSE"
                        const namePart2 = t.traineeFullName.split(/\s*[\u2013\u2014-]\s*/)[0].trim();
                        const label = namePart2.includes(',')
                          ? namePart2.split(',')[0].trim()
                          : namePart2.split(/\s+/)[0].trim();
                        return { label, value: safeN(t.avgOverallGrade) };
                      })}
                      max={5} height={130} />
                  </div>
                </button>
                <p className="text-xs text-gray-600 mt-1 text-center">click to enlarge</p>
              </SCard>

              <SCard title="Recent vs Overall Grade Delta">
                <div className="overflow-y-auto max-h-44">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left text-gray-400 py-1 pr-2">Trainee</th>
                        <th className="text-center text-gray-400 py-1 px-2">Overall</th>
                        <th className="text-center text-gray-400 py-1 px-2">Recent</th>
                        <th className="text-center text-gray-400 py-1 px-2">Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
                        const d = safeN(t.recentAvgGrade) - safeN(t.avgOverallGrade);
                        return (
                          <tr key={t.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                            <td className="py-1.5 pr-2 text-gray-300 truncate max-w-[90px]">{t.traineeFullName}</td>
                            <td className={`py-1.5 px-2 text-center font-mono ${gradeColor(safeN(t.avgOverallGrade), thresholds)}`}>{safe(t.avgOverallGrade, 2)}</td>
                            <td className={`py-1.5 px-2 text-center font-mono ${gradeColor(safeN(t.recentAvgGrade), thresholds)}`}>{safe(t.recentAvgGrade, 2)}</td>
                            <td className={`py-1.5 px-2 text-center font-mono ${d > 0.1 ? 'text-emerald-400' : d < -0.1 ? 'text-red-400' : 'text-gray-400'}`}>
                              {d >= 0 ? '+' : ''}{d.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SCard>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 space-y-3">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-sm">{selected.traineeFullName}</h3>
                  <p className="text-gray-400 text-xs">{selected.courseName}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-200 text-lg leading-none">&times;</button>
              </div>
              <div className={`rounded border p-3 ${gradeBg(safeN(selected.avgOverallGrade), thresholds)}`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-xs">Average Grade</span>
                  <span className={`text-2xl font-bold font-mono ${gradeColor(safeN(selected.avgOverallGrade), thresholds)}`}>{safe(selected.avgOverallGrade, 2)}</span>
                </div>
                <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                  <span>Recent: <span className={gradeColor(safeN(selected.recentAvgGrade), thresholds)}>{safe(selected.recentAvgGrade, 2)}</span></span>
                  <span>Trend: <span className={trendColor(selected.overallTrend)}>{trendIcon(selected.overallTrend)} {selected.overallTrend || 'stable'}</span></span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${riskBadge(selectedRiskLevel || selected.riskLevel)}`}>
                    {selectedRiskLevel === 'at_risk' ? 'At Risk' : selectedRiskLevel === 'monitor' ? 'Monitor' : selectedRiskLevel === 'exceeding' ? 'Exceeding' : 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            {/* vs Course */}
            <SCard title="vs Course Average">
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-400">This Trainee</span>
                    <span className={gradeColor(safeN(selected.avgOverallGrade), thresholds)}>{safe(selected.avgOverallGrade, 2)}</span>
                  </div>
                  <SparkBar value={safeN(selected.avgOverallGrade)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-400">Course Avg</span>
                    <span className={gradeColor(courseAvg, thresholds)}>{safe(courseAvg, 2)}</span>
                  </div>
                  <SparkBar value={courseAvg} colorClass="bg-blue-500" />
                </div>
              </div>
            </SCard>

            {/* Progression sparkline — interactive inline + click to enlarge */}
            {selProgression.length >= 2 && (
              <SCard title="Grade Progression">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">Full course timeline</span>
                  <TimelineZoomControl value={detailTimelineZoom} onChange={setDetailTimelineZoom} max={4} />
                </div>
                <div className="overflow-x-auto">
                  <SparkLine
                    data={selProgression}
                    labels={selProgression.map((_, i) => `Assessment #${i + 1}`)}
                    width={detailTimelineZoom === 0 ? 230 : Math.max(230, selProgression.length * (18 + detailTimelineZoom * 10))}
                    height={90}
                    color={selected.overallTrend === 'improving' ? '#10b981' : selected.overallTrend === 'worsening' ? '#ef4444' : '#60a5fa'}
                    interactive={true}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Earliest</span><span>Latest</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{selProgression.length} assessments</p>
                <button
                  onClick={() => setProgressionModal({ data: selProgressionFull.grades, labels: selProgressionFull.labels, name: selected.traineeFullName, trend: selected.overallTrend })}
                  className="mt-2 w-full text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded py-1 transition-colors border border-blue-900/40"
                >
                  Expand full view
                </button>
              </SCard>
            )}

            {/* Skill radar */}
            {hasSkillScores && Object.keys(selSkills).length >= 3 && (
              <SCard title="Skill Family Radar">
                <div className="flex justify-center">
                  <RadarChart data={selSkills} size={175} />
                </div>
              </SCard>
            )}

            {/* Skill bars */}
            {hasSkillScores && Object.keys(selSkills).length < 3 && (
              <SCard title="Skill Families">
                <HBarChart data={Object.entries(selSkills).map(([l, v]) => ({ label: l, value: v }))} />
              </SCard>
            )}

            {/* Weak elements */}
            {weakEls.length > 0 && (
              <SCard title="Recurring Weak Elements">
                <div className="flex flex-wrap gap-1.5">{weakEls.map(e => <Tag key={e} text={e} type="red" />)}</div>
              </SCard>
            )}

            {/* Strong families */}
            {strongFams.length > 0 && (
              <SCard title="Strongest Skill Families">
                <div className="flex flex-wrap gap-1.5">{strongFams.map(e => <Tag key={e} text={e} type="green" />)}</div>
              </SCard>
            )}

            {/* At-risk reasons */}
            {selectedRiskLevel === 'at_risk' && atRiskReasons.length > 0 && (
              <SCard title="At-Risk Reasons">
                <ul className="space-y-1">
                  {atRiskReasons.map((r, i) => (
                    <li key={i} className="text-xs text-red-300 flex items-start gap-1">
                      <span className="text-red-500 flex-shrink-0">&bull;</span>{r}
                    </li>
                  ))}
                </ul>
              </SCard>
            )}

            {/* Narrative */}
            {selected.narrativeSummary && (
              <SCard title="Analysis">
                <p className="text-gray-300 text-xs leading-relaxed">{selected.narrativeSummary}</p>
              </SCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── EVENTS TAB ──────────────────────────────────────────────────────────────────

const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const { thresholds } = useThresholds();
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);
  const [chartModal, setChartModal] = useState<{ title: string; data: { label: string; value: number; color: string }[]; max: number } | null>(null);
  const [chartTimelineZoom, setChartTimelineZoom] = useState(0);
  const [chartScoreZoom, setChartScoreZoom] = useState(0);

  // Derive passRate when DB value is null (old rows pre-fix)
  // Grading scale: 1=Unsatisfactory, 2=Below Standard, 3=Satisfactory(Pass), 4=Above Avg, 5=Exceptional
  // Pass threshold comes from Analytics Thresholds so user-defined grading rules drive this display.
  //
  // Old DB elevated-risk score was computed with WRONG threshold (counted grade 3 as fail).
  // So the stored score is heavily inflated. We derive pass rate from avgOverallGrade instead:
  // If avg is at/above the configured pass threshold, treat the legacy row as 100% pass.
  // If avg is below it, estimate the failure fraction from distance below that configured threshold.
  const getPassRate = (ev: TIEEventSummary): number => {
    const stored = safeN(ev.passRate);
    if (stored > 0) return stored;
    const attempts = safeN(ev.totalAttempts);
    if (attempts === 0) return 0;
    const avg = safeN(ev.avgOverallGrade);
    if (avg <= 0) return 0;
    const passThreshold = thresholds.concernThresholdGrade;
    if (avg >= passThreshold) return 100;
    // avg < passThreshold: estimate fail fraction from distance below pass threshold
    const estimatedFailPct = Math.min(100, ((passThreshold - avg) / (passThreshold - 1)) * 100);
    return Math.round(Math.max(0, 100 - estimatedFailPct));
  };

  const handleSort = (k: keyof TIEEventSummary) => {
    if (sortKey === k) setSortAsc(p => !p);
    else { setSortKey(k); setSortAsc(true); }
  };

  const sorted = [...events].sort((a, b) => {
    const av = safeN(a[sortKey] as any);
    const bv = safeN(b[sortKey] as any);
    return sortAsc ? av - bv : bv - av;
  });

  const SortTh: React.FC<{ field: keyof TIEEventSummary; label: string }> = ({ field, label }) => (
    <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase cursor-pointer hover:text-gray-200 select-none"
      onClick={() => handleSort(field)}>
      {label}{sortKey === field ? (sortAsc ? ' \u2191' : ' \u2193') : ''}
    </th>
  );

  if (events.length === 0) return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
      <p className="text-gray-500">No event data available for this course</p>
    </div>
  );

  // Exclude CPT, TUT, MB events — only Flights and FTD count
  // Event codes are prefixed e.g. "BGF TUT1B", "BGF CPT1", "BGF MB1"
  // so we must split on spaces and check each token, not just startsWith on the whole code
  const isFlightOrFTD = (code: string) => {
    const tokens = code.toUpperCase().split(/[\s_\-]+/);
    return !tokens.some(t =>
      t === 'TUT' || t.startsWith('TUT') ||
      t === 'CPT' || t.startsWith('CPT') ||
      t === 'MB'  || t.startsWith('MB')
    );
  };

  const flightFtdEvents = events.filter(ev => isFlightOrFTD(ev.eventCode) && safeN(ev.avgOverallGrade) > 0);
  const hardest = flightFtdEvents.length > 0
    ? flightFtdEvents.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, flightFtdEvents[0])
    : events[0];
  const easiest = flightFtdEvents.length > 0
    ? flightFtdEvents.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, flightFtdEvents[0])
    : events[0];
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);

  // Top 5 events trainees struggle with (lowest avg grade, flights/FTD only, min 2 attempts)
  const top5Struggle = [...events]
    .filter(ev => safeN(ev.totalAttempts) >= 2 && safeN(ev.avgOverallGrade) > 0 && isFlightOrFTD(ev.eventCode))
    .sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade))
    .slice(0, 5);

  // Top 5 events trainees excel at (highest avg grade, flights/FTD only, min 2 attempts)
  const top5Excel = [...events]
    .filter(ev => safeN(ev.totalAttempts) >= 2 && safeN(ev.avgOverallGrade) > 0 && isFlightOrFTD(ev.eventCode))
    .sort((a, b) => safeN(b.avgOverallGrade) - safeN(a.avgOverallGrade))
    .slice(0, 5);

  const allSkills = Array.from(new Set(events.flatMap(ev => Object.keys(parseJ(ev.skillFamilyScores, {})))));
  const selSkills = selected ? parseJ(selected.skillFamilyScores, {}) as Record<string, number> : {};
  const selWeak = selected ? parseJ(selected.weakElementsByAvg, []) as any[] : [];
  const selStrong = selected ? parseJ(selected.strongElementsByAvg, []) as any[] : [];

  const normaliseElement = (e: any): string => typeof e === 'string' ? e : e?.element || JSON.stringify(e);

  return (
    <div className="space-y-5">
      {/* KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Hardest Event" value={hardest.eventCode}
          color="text-red-400" sub={`Avg: ${safe(hardest.avgOverallGrade, 2)}`} />
        <StatCard label="Easiest Event" value={easiest.eventCode}
          color="text-emerald-400" sub={`Avg: ${safe(easiest.avgOverallGrade, 2)}`} />
        <StatCard label="Most Attempted" value={mostAttempts.eventCode}
          color="text-blue-400" sub={`${mostAttempts.totalAttempts} attempts`} />
        <StatCard label="Most Variable" value={mostVariable.eventCode}
          color="text-yellow-400" sub={`Variance: ${safe(mostVariable.gradeVariance, 2)}`} />
      </div>

      {/* ── Top 5 Struggle / Excel Panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top 5 Struggle */}
        <div className="bg-gray-800 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Struggle With</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>
          <div className="space-y-2">
            {top5Struggle.map((ev, idx) => {
              const isSelected = struggleSelected?.id === ev.id;
              const weakEls = parseJ(ev.weakElementsByAvg, []) as any[];
              const negTags = parseJ(ev.dominantNegativeTags, []) as string[];
              return (
                <div key={ev.id}>
                  <button
                    onClick={() => setStruggleSelected(isSelected ? null : ev)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                      isSelected
                        ? 'bg-red-900/40 border-red-700'
                        : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold text-sm w-5 text-center">#{idx + 1}</span>
                        <span className="text-white font-semibold text-sm">{ev.eventCode}</span>
                        {safeN(ev.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100 && (
                          <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">ELEVATED RISK</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>
                          {safe(ev.avgOverallGrade, 2)}
                        </span>
                        <span className="text-gray-500 text-xs">{isSelected ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-7">
                      <span className="text-gray-400 text-xs">{ev.totalAttempts} attempts</span>
                      {weakEls.slice(0, 2).map((e: any) => (
                        <span key={typeof e === 'string' ? e : e.element} className="text-xs bg-red-900/30 text-red-300 px-1.5 py-0.5 rounded border border-red-900/50">
                          {typeof e === 'string' ? e : e.element}
                        </span>
                      ))}
                    </div>
                  </button>

                  {/* Expanded narrative panel */}
                  {isSelected && (
                    <div className="mt-1 mx-1 bg-gray-900/80 border border-red-900/40 rounded-lg p-4 space-y-3">
                      {/* Why in top 5 */}
                      <div>
                        <h4 className="text-red-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Why This Event Is a Struggle</h4>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {ev.narrativeSummary || `${ev.eventCode} has a mean grade of ${safe(ev.avgOverallGrade, 2)} across ${ev.totalAttempts} assessments, placing it among the most challenging events in this course.${safeN(ev.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100 ? ` It is classified as an elevated risk event because a high proportion of trainees are scoring below the satisfactory threshold.` : ''} ${safeN(ev.gradeVariance) > thresholds.highVarianceThreshold ? `The high grade variance (${safe(ev.gradeVariance, 2)}) indicates inconsistent performance, suggesting the event exposes gaps in preparation or foundational skills.` : ''}`}
                        </p>
                      </div>

                      {/* Weak elements */}
                      {weakEls.length > 0 && (
                        <div>
                          <h4 className="text-red-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Assessment Elements Contributing to Low Scores</h4>
                          <div className="space-y-1.5">
                            {weakEls.map((e: any) => {
                              const elName = typeof e === 'string' ? e : e.element;
                              const elAvg = typeof e === 'object' ? e.avg : null;
                              return (
                                <div key={elName} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5">
                                  <span className="text-gray-200 text-sm">{elName}</span>
                                  {elAvg !== null && (
                                    <span className={`text-sm font-bold font-mono ${gradeColor(elAvg, thresholds)}`}>{safe(elAvg, 2)}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Negative comment themes */}
                      {negTags.length > 0 && (
                        <div>
                          <h4 className="text-red-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Recurring Instructor Comments</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {negTags.map(tag => (
                              <span key={tag} className="text-xs bg-gray-700 text-gray-300 border border-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-700">
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Avg Grade</p>
                          <p className={`text-base font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>{safe(ev.avgOverallGrade, 2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Attempts</p>
                          <p className="text-base font-bold text-gray-200">{ev.totalAttempts}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Difficulty</p>
                          <p className="text-base font-bold text-orange-400">{safe(ev.difficultyScore, 2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Excel */}
        <div className="bg-gray-800 border border-emerald-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div>
              <h3 className="text-white font-bold text-sm">Top 5 Events Trainees Excel At</h3>
              <p className="text-gray-400 text-xs">Click an event for detailed analysis</p>
            </div>
          </div>
          <div className="space-y-2">
            {top5Excel.map((ev, idx) => {
              const isSelected = excelSelected?.id === ev.id;
              const strongEls = parseJ(ev.strongElementsByAvg, []) as any[];
              const posTags = parseJ(ev.dominantPositiveTags, []) as string[];
              return (
                <div key={ev.id}>
                  <button
                    onClick={() => setExcelSelected(isSelected ? null : ev)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                      isSelected
                        ? 'bg-emerald-900/40 border-emerald-700'
                        : 'bg-gray-700/50 border-gray-600/50 hover:bg-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-bold text-sm w-5 text-center">#{idx + 1}</span>
                        <span className="text-white font-semibold text-sm">{ev.eventCode}</span>
                        {ev.overServiceIndicator && (
                          <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">OVER-SERVICED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>
                          {safe(ev.avgOverallGrade, 2)}
                        </span>
                        <span className="text-gray-500 text-xs">{isSelected ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-7">
                      <span className="text-gray-400 text-xs">{ev.totalAttempts} attempts</span>
                      {strongEls.slice(0, 2).map((e: any) => (
                        <span key={typeof e === 'string' ? e : e.element} className="text-xs bg-emerald-900/30 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-900/50">
                          {typeof e === 'string' ? e : e.element}
                        </span>
                      ))}
                    </div>
                  </button>

                  {/* Expanded narrative panel */}
                  {isSelected && (
                    <div className="mt-1 mx-1 bg-gray-900/80 border border-emerald-900/40 rounded-lg p-4 space-y-3">
                      {/* Why in top 5 */}
                      <div>
                        <h4 className="text-emerald-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Why Trainees Excel at This Event</h4>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {ev.narrativeSummary || `${ev.eventCode} has a mean grade of ${safe(ev.avgOverallGrade, 2)} across ${ev.totalAttempts} assessments, making it one of the strongest-performing events in this course.${ev.overServiceIndicator ? ` This event is classified as low risk because trainees consistently perform at or near mastery before reaching it, which may indicate that preceding training adequately prepares them or that the event itself is not sufficiently challenging.` : ''} ${safeN(ev.gradeVariance) < 0.5 ? `The low grade variance (${safe(ev.gradeVariance, 2)}) shows consistent high performance across the cohort.` : ''}`}
                        </p>
                      </div>

                      {/* Strong elements */}
                      {strongEls.length > 0 && (
                        <div>
                          <h4 className="text-emerald-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Assessment Elements Where Trainees Performed Well</h4>
                          <div className="space-y-1.5">
                            {strongEls.map((e: any) => {
                              const elName = typeof e === 'string' ? e : e.element;
                              const elAvg = typeof e === 'object' ? e.avg : null;
                              return (
                                <div key={elName} className="flex items-center justify-between bg-gray-800 rounded px-3 py-1.5">
                                  <span className="text-gray-200 text-sm">{elName}</span>
                                  {elAvg !== null && (
                                    <span className={`text-sm font-bold font-mono ${gradeColor(elAvg, thresholds)}`}>{safe(elAvg, 2)}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Positive comment themes */}
                      {posTags.length > 0 && (
                        <div>
                          <h4 className="text-emerald-400 font-semibold text-xs uppercase tracking-wide mb-1.5">Recurring Positive Instructor Comments</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {posTags.map(tag => (
                              <span key={tag} className="text-xs bg-gray-700 text-gray-300 border border-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-700">
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Avg Grade</p>
                          <p className={`text-base font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>{safe(ev.avgOverallGrade, 2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Attempts</p>
                          <p className="text-base font-bold text-gray-200">{ev.totalAttempts}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500 text-xs">Difficulty</p>
                          <p className="text-base font-bold text-blue-400">{safe(ev.difficultyScore, 2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 font-medium px-4 py-2.5 text-xs uppercase">Event</th>
                  <SortTh field="avgOverallGrade" label="Avg" />
                  <SortTh field="passRate" label="Pass%" />
                  <SortTh field="totalAttempts" label="Attempts" />
                  <SortTh field="gradeVariance" label="Variance" />
                  <SortTh field="difficultyScore" label="Difficulty" />
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Flags</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(ev => (
                  <tr key={ev.id} onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
                    className={`border-b border-gray-700/50 cursor-pointer transition-colors ${selected?.id === ev.id ? 'bg-blue-900/30' : 'hover:bg-gray-700/40'}`}>
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{ev.eventCode}</td>
                    <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>{safe(ev.avgOverallGrade, 2)}</td>
                    <td className={`px-3 py-2.5 text-center text-xs font-medium ${passRateTextColor(getPassRate(ev), thresholds)}`}>
                      {getPassRate(ev).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{ev.totalAttempts}</td>
                    <td className={`px-3 py-2.5 text-center text-xs font-mono ${safeN(ev.gradeVariance) > thresholds.highVarianceThreshold ? 'text-orange-400' : 'text-gray-400'}`}>{safe(ev.gradeVariance, 2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <SparkBar value={safeN(ev.difficultyScore)} max={1} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {safeN(ev.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100 && <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1 py-0.5 rounded leading-none">ER</span>}
                        {ev.overServiceIndicator && <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-1 py-0.5 rounded leading-none">LR</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Chart expand modal */}
          {chartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setChartModal(null)}>
              <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full max-w-6xl p-6" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-white font-bold text-xl">{chartModal.title}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{chartModal.data.length} events &mdash; click outside to close</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Timeline</span>
                      <TimelineZoomControl value={chartTimelineZoom} onChange={setChartTimelineZoom} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Value</span>
                      <TimelineZoomControl value={chartScoreZoom} onChange={setChartScoreZoom} max={1} />
                    </div>
                    <button onClick={() => setChartModal(null)} className="text-gray-400 hover:text-white text-3xl leading-none ml-1 flex-shrink-0">&times;</button>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 overflow-x-auto mt-3">
                  <div style={{ width: chartTimelineZoom === 0 ? '100%' : Math.max(900, chartModal.data.length * (42 + chartTimelineZoom * 16)) }}>
                    <ColChartModal data={chartModal.data} max={chartModal.max} height={420} zoomY={chartScoreZoom > 0} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div
              className="cursor-pointer group"
              title="Click to expand"
              onClick={() => {
                setChartTimelineZoom(0);
                setChartScoreZoom(0);
                const data = [...events].sort((a, b) => getPassRate(a) - getPassRate(b)).map(ev => ({
                  label: ev.eventCode,
                  value: getPassRate(ev),
                  color: passRateChartColor(getPassRate(ev), thresholds),
                }));
                setChartModal({ title: 'Pass Rate by Event (%)', data, max: 100 });
              }}>
              <SCard title={
                <span className="flex items-center gap-2">
                  Pass Rate by Event (%)
                  <span className="text-gray-500 group-hover:text-blue-400 transition-colors text-xs font-normal ml-1">⤢ expand</span>
                </span>
              }>
                <div className="overflow-x-auto">
                  <ColChart
                    data={[...events].sort((a, b) => getPassRate(a) - getPassRate(b)).map(ev => ({
                      label: ev.eventCode,
                      value: getPassRate(ev),
                      color: passRateChartColor(getPassRate(ev), thresholds),
                    }))}
                    max={100} height={120} />
                </div>
              </SCard>
            </div>

            <div
              className="cursor-pointer group"
              title="Click to expand"
              onClick={() => {
                setChartTimelineZoom(0);
                setChartScoreZoom(0);
                const data = [...events].sort((a, b) => safeN(b.gradeVariance) - safeN(a.gradeVariance)).map(ev => ({
                  label: ev.eventCode,
                  value: safeN(ev.gradeVariance),
                  color: varianceChartColor(safeN(ev.gradeVariance), thresholds),
                }));
                const maxVal = Math.max(1, ...events.map(e => safeN(e.gradeVariance)));
                setChartModal({ title: 'Grade Variance by Event (spread indicator)', data, max: maxVal });
              }}>
              <SCard title={
                <span className="flex items-center gap-2">
                  Grade Variance by Event (spread indicator)
                  <span className="text-gray-500 group-hover:text-blue-400 transition-colors text-xs font-normal ml-1">⤢ expand</span>
                </span>
              }>
                <div className="overflow-x-auto">
                  <ColChart
                    data={[...events].sort((a, b) => safeN(b.gradeVariance) - safeN(a.gradeVariance)).map(ev => ({
                      label: ev.eventCode,
                      value: safeN(ev.gradeVariance),
                      color: varianceChartColor(safeN(ev.gradeVariance), thresholds),
                    }))}
                    max={Math.max(1, ...events.map(e => safeN(e.gradeVariance)))} height={120} />
                </div>
              </SCard>
            </div>
          </div>

          {/* Skill weakness table */}
          {allSkills.length > 0 && (
            <div className="mt-4">
              <SCard title="Skill Weakness by Event (sorted by avg grade)">
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-gray-400 pr-4 py-1 whitespace-nowrap">Event</th>
                        {allSkills.map(sk => <th key={sk} className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">{sk}</th>)}
                        <th className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">Ovrl</th>
                        <th className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">Pass%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...events].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(ev => {
                        const sf = parseJ(ev.skillFamilyScores, {}) as Record<string, number>;
                        return (
                          <tr key={ev.id} className={`border-t border-gray-700/50 hover:bg-gray-700/20 cursor-pointer ${selected?.id === ev.id ? 'bg-blue-900/20' : ''}`}
                            onClick={() => setSelected(selected?.id === ev.id ? null : ev)}>
                            <td className="text-gray-300 pr-4 py-1.5 font-medium whitespace-nowrap">{ev.eventCode}</td>
                            {allSkills.map(sk => {
                              const v = sf[sk];
                              return (
                                <td key={sk} className="px-2 py-1.5 text-center">
                                  {v !== undefined
                                    ? <span className={`font-mono font-bold ${gradeColor(v, thresholds)}`}>{safe(v, 1)}</span>
                                    : <span className="text-gray-700">&mdash;</span>}
                                </td>
                              );
                            })}
                            <td className={`px-2 py-1.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade), thresholds)}`}>{safe(ev.avgOverallGrade, 2)}</td>
                            <td className={`px-2 py-1.5 text-center text-xs ${passRateTextColor(getPassRate(ev), thresholds)}`}>
                              {getPassRate(ev).toFixed(0)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SCard>
            </div>
          )}
        </div>

        {/* Event Detail Panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 space-y-3">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-bold text-sm">{selected.eventCode}</h3>
                  <p className="text-gray-400 text-xs">{selected.courseName}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-gray-200 text-lg leading-none">&times;</button>
              </div>
              <div className={`rounded border p-3 ${gradeBg(safeN(selected.avgOverallGrade), thresholds)}`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-xs">Average Grade</span>
                  <span className={`text-2xl font-bold font-mono ${gradeColor(safeN(selected.avgOverallGrade), thresholds)}`}>{safe(selected.avgOverallGrade, 2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 mt-2 text-xs text-gray-400">
                  <span>Pass Rate: <span className={passRateTextColor(getPassRate(selected), thresholds)}>{getPassRate(selected).toFixed(0)}%</span></span>
                  <span>Attempts: <span className="text-gray-300">{selected.totalAttempts}</span></span>
                  <span>Variance: <span className={safeN(selected.gradeVariance) > thresholds.highVarianceThreshold ? 'text-orange-400' : 'text-gray-300'}>{safe(selected.gradeVariance, 2)}</span></span>
                  <span>Difficulty: <span className="text-gray-300">{safe(selected.difficultyScore, 2)}</span></span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {safeN(selected.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100 && <Tag text="Elevated Risk" type="red" />}
                {selected.overServiceIndicator && <Tag text="Low Risk" type="green" />}
              </div>
            </div>

            {/* Skill families */}
            {Object.keys(selSkills).length > 0 && (
              <SCard title="Skill Family Scores">
                <HBarChart data={Object.entries(selSkills).sort((a, b) => a[1] - b[1]).map(([l, v]) => ({ label: l, value: v }))} />
              </SCard>
            )}

            {/* Weak elements */}
            {selWeak.length > 0 && (
              <SCard title="Weak Elements (by avg)">
                <div className="flex flex-wrap gap-1.5">{selWeak.map(e => <Tag key={normaliseElement(e)} text={normaliseElement(e)} type="red" />)}</div>
              </SCard>
            )}

            {/* Strong elements */}
            {selStrong.length > 0 && (
              <SCard title="Strong Elements">
                <div className="flex flex-wrap gap-1.5">{selStrong.map(e => <Tag key={normaliseElement(e)} text={normaliseElement(e)} type="green" />)}</div>
              </SCard>
            )}

            {/* Narrative */}
            {selected.narrativeSummary && (
              <SCard title="Analysis">
                <p className="text-gray-300 text-xs leading-relaxed">{selected.narrativeSummary}</p>
              </SCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────────

interface TrainingIntelligenceTabProps {
  trainingReportDisplayName?: string;
}

const TrainingIntelligenceTab: React.FC<TrainingIntelligenceTabProps> = ({ trainingReportDisplayName = 'Training Reports' }) => {
  const reportRecordName = String(trainingReportDisplayName || 'Training Reports').trim() || 'Training Reports';
  const [courses, setCourses] = useState<TIECourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [recentRuns, setRecentRuns] = useState<TIERun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string>('');
  const [runProgressPercent, setRunProgressPercent] = useState(0);
  const [activeTab, setActiveTab] = useState<'course' | 'trainee' | 'events'>('course');

  const [summary, setSummary] = useState<TIECourseSummary | null>(null);
  const [trainees, setTrainees] = useState<TIETraineeSummary[]>([]);
  const [events, setEvents] = useState<TIEEventSummary[]>([]);
  const [findings, setFindings] = useState<TIEFinding[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [thresholds, setThresholds] = useState<TIEThresholds>(DEFAULT_THRESHOLDS);
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchRecentRuns();
    fetchThresholds();
  }, []);

  const fetchThresholds = async () => {
    try {
      const r = await fetch('/api/tie/settings');
      const data = await r.json();
      const map: Record<string, any> = {};
      if (Array.isArray(data)) {
        data.forEach((s: any) => { map[s.key] = s.value; });
      } else if (data && typeof data === 'object') {
        Object.assign(map, data);
      }
      if (Object.keys(map).length > 0) {
        setThresholds({
          atRiskAvgGrade: numberSetting(map['at_risk_avg_grade'], DEFAULT_THRESHOLDS.atRiskAvgGrade),
          normalAvgGrade: numberSetting(map['normal_avg_grade'], numberSetting(map['normal_min_grade'], DEFAULT_THRESHOLDS.normalAvgGrade)),
          worseningRecentAvgGrade: numberSetting(map['worsening_recent_avg_grade'], numberSetting(map['at_risk_low_recent_grade'], DEFAULT_THRESHOLDS.worseningRecentAvgGrade)),
          exceedingAvgGrade: numberSetting(map['exceeding_avg_grade'], DEFAULT_THRESHOLDS.exceedingAvgGrade),
          concernThresholdGrade: numberSetting(map['concern_threshold_grade'], DEFAULT_THRESHOLDS.concernThresholdGrade),
          excellentGradeColorThreshold: numberSetting(map['excellent_grade_color_threshold'], DEFAULT_THRESHOLDS.excellentGradeColorThreshold),
          normalGradeColorThreshold: numberSetting(map['normal_grade_color_threshold'], DEFAULT_THRESHOLDS.normalGradeColorThreshold),
          concernGradeColorThreshold: numberSetting(map['concern_grade_color_threshold'], DEFAULT_THRESHOLDS.concernGradeColorThreshold),
          criticalLowGradeThreshold: numberSetting(map['critical_low_grade_threshold'], DEFAULT_THRESHOLDS.criticalLowGradeThreshold),
          bottleneckThresholdPct: numberSetting(map['bottleneck_threshold_pct'], DEFAULT_THRESHOLDS.bottleneckThresholdPct),
          healthyPassRatePct: numberSetting(map['healthy_pass_rate_pct'], DEFAULT_THRESHOLDS.healthyPassRatePct),
          highVarianceThreshold: numberSetting(map['high_variance_threshold'], DEFAULT_THRESHOLDS.highVarianceThreshold),
          normalMinGrade: numberSetting(map['normal_min_grade'], numberSetting(map['normal_avg_grade'], DEFAULT_THRESHOLDS.normalMinGrade)),
          atRiskAverageEnabled: boolSetting(map['at_risk_average_enabled'], DEFAULT_THRESHOLDS.atRiskAverageEnabled),
          atRiskSustainedDeclineEnabled: boolSetting(map['at_risk_sustained_decline_enabled'], DEFAULT_THRESHOLDS.atRiskSustainedDeclineEnabled),
          atRiskRecentDropEnabled: boolSetting(map['at_risk_recent_drop_enabled'], DEFAULT_THRESHOLDS.atRiskRecentDropEnabled),
          atRiskLowRecentEnabled: boolSetting(map['at_risk_low_recent_enabled'], DEFAULT_THRESHOLDS.atRiskLowRecentEnabled),
          atRiskRecurringWeakElementsEnabled: boolSetting(map['at_risk_recurring_weak_elements_enabled'], DEFAULT_THRESHOLDS.atRiskRecurringWeakElementsEnabled),
          sustainedDeclineCount: numberSetting(map['at_risk_sustained_decline_count'], DEFAULT_THRESHOLDS.sustainedDeclineCount),
          recentDropThreshold: numberSetting(map['at_risk_recent_drop_threshold'], DEFAULT_THRESHOLDS.recentDropThreshold),
          lowRecentGrade: numberSetting(map['at_risk_low_recent_grade'], numberSetting(map['worsening_recent_avg_grade'], DEFAULT_THRESHOLDS.lowRecentGrade)),
          recurringWeakElementCount: numberSetting(map['at_risk_recurring_weak_element_count'], DEFAULT_THRESHOLDS.recurringWeakElementCount),
          minAssessmentsForRisk: numberSetting(map['at_risk_min_assessments'], DEFAULT_THRESHOLDS.minAssessmentsForRisk),
          minObservationsForPattern: numberSetting(map['min_observations_for_pattern'], DEFAULT_THRESHOLDS.minObservationsForPattern),
          recencyWeightFactor: numberSetting(map['recency_weight_factor'], DEFAULT_THRESHOLDS.recencyWeightFactor),
          commentWeightVsScore: numberSetting(map['comment_weight_vs_score'], DEFAULT_THRESHOLDS.commentWeightVsScore),
          overServiceGradeThreshold: numberSetting(map['over_service_threshold'], DEFAULT_THRESHOLDS.overServiceGradeThreshold),
        });
      }
    } catch { /* use defaults */ }
  };

  useEffect(() => {
    if (selectedCourse) loadCourseData(selectedCourse);
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const r = await fetch('/api/tie/courses');
      const data = await r.json();
      setCourses(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !selectedCourse) {
        setSelectedCourse(data[0].name);
      }
    } catch { setError('Failed to load courses'); }
  };

  const fetchRecentRuns = async () => {
    try {
      const r = await fetch('/api/tie/runs?limit=5');
      const data = await r.json();
      setRecentRuns(Array.isArray(data) ? data : []);
    } catch { /* non-fatal */ }
  };

  const loadCourseData = async (course: string) => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, trRes, evRes, fiRes] = await Promise.all([
        fetch(`/api/tie/summary/${encodeURIComponent(course)}`),
        fetch(`/api/tie/trainees/${encodeURIComponent(course)}`),
        fetch(`/api/tie/events/${encodeURIComponent(course)}`),
        fetch(`/api/tie/findings/${encodeURIComponent(course)}`),
      ]);
      const [sum, tr, ev, fi] = await Promise.all([sumRes.json(), trRes.json(), evRes.json(), fiRes.json()]);
      setSummary(sum);
      setTrainees(Array.isArray(tr) ? tr : []);
      setEvents(Array.isArray(ev) ? ev : []);
      setFindings(Array.isArray(fi) ? fi : []);
    } catch { setError('Failed to load course analytics'); }
    finally { setLoading(false); }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/tie/status${selectedCourse ? `?course=${encodeURIComponent(selectedCourse)}` : ''}`);
        const data = await r.json();
        if (data.status === 'complete') {
          setRunProgressPercent(100);
          setRunProgress(`Complete \u2014 ${data.recordsProcessed ?? '?'} records processed`);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setTimeout(() => {
            setRunProgress('');
            setRunProgressPercent(0);
            setIsRunning(false);
            fetchRecentRuns();
            fetchCourses();
            if (selectedCourse) loadCourseData(selectedCourse);
          }, 2500);
        } else if (data.status === 'failed') {
          setError(`Run failed: ${data.errorMessage || 'unknown error'}`);
          setRunProgress('');
          setRunProgressPercent(0);
          setIsRunning(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
        } else if (data.status === 'running') {
          setRunProgressPercent(prev => Math.max(prev, 15));
          setRunProgress(`Processing ${reportRecordName} records\u2026`);
        }
      } catch { /* poll silently */ }
    }, 2000);
  };

  const handleRunAnalytics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunProgressPercent(0);
    setRunProgress('Initialising analytics engine\u2026');
    setError(null);
    try {
      const sessionToken = localStorage.getItem('dfp_session_token') || '';
      const r = await fetch('/api/tie/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ courseFilter: selectedCourse || null, triggeredBy: 'manual-ui' }),
      });
      const result = await r.json();
      if (result.started) {
        setRunProgressPercent(8);
        setRunProgress('Analytics run started \u2014 processing in background\u2026');
        startPolling();
      } else if (result.success) {
        setRunProgressPercent(100);
        setRunProgress(`Complete \u2014 ${result.recordsProcessed} records`);
        setTimeout(() => {
          setRunProgress('');
          setRunProgressPercent(0);
          setIsRunning(false);
          fetchRecentRuns();
          fetchCourses();
          if (selectedCourse) loadCourseData(selectedCourse);
        }, 2500);
      } else {
        setError(`Run failed: ${result.error || 'unknown error'}`);
        setRunProgress('');
        setRunProgressPercent(0);
        setIsRunning(false);
      }
    } catch (e: any) {
      setError(`Run failed: ${e.message}`);
      setRunProgress('');
      setRunProgressPercent(0);
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (!isRunning) return;
    const progressTimer = setInterval(() => {
      setRunProgressPercent(prev => {
        if (prev >= 95) return prev;
        if (prev < 20) return prev + 4;
        if (prev < 60) return prev + 2;
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(progressTimer);
  }, [isRunning]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const atRiskBadge = trainees.filter(t => evaluateTraineeRisk(t, thresholds).riskLevel === 'at_risk').length;
  const bottleneckBadge = events.filter(e => safeN(e.bottleneckScore) >= thresholds.bottleneckThresholdPct / 100).length;

  const tabs = [
    { id: 'course' as const, label: 'Course' },
    { id: 'trainee' as const, label: 'Trainee', badge: atRiskBadge || undefined },
    { id: 'events' as const, label: 'Events', badge: bottleneckBadge || undefined },
  ];

  return (
    <ThresholdContext.Provider value={{ thresholds, setThresholds }}>
    <div className="space-y-5">
      {/* Threshold settings modal */}
      {showThresholdPanel && (
        <ThresholdSettingsPanel
          onClose={() => setShowThresholdPanel(false)}
          onSave={(t) => {
            setThresholds({ ...t });
            void fetchThresholds();
            setShowThresholdPanel(false);
          }}
        />
      )}
      {/* ── Header Controls ── */}
      <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-5 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-white font-bold text-lg leading-tight">Training Intelligence Engine</h2>
            <p className="text-slate-400 text-xs">Offline {reportRecordName} analytics &middot; all data stored in database</p>
          </div>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm whitespace-nowrap">Course:</label>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} disabled={isRunning}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400">
              <option value="">&mdash; All Courses &mdash;</option>
              {courses.map(c => <option key={c.name} value={c.name}>{c.name} ({c.recordCount} records)</option>)}
            </select>
          </div>
          <button
            onClick={() => setShowThresholdPanel(true)}
            title="Configure analytics thresholds"
            className="flex items-center gap-1.5 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-all hover:border-cyan-500/45 hover:bg-slate-700 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Thresholds
          </button>
          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-slate-700 text-slate-200 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer'}`}>
            {isRunning ? <><CircularProgress value={runProgressPercent} /> Running...</> : 'Run Analytics'}
          </button>
        </div>

        {runProgress && (
          <div className="mt-3 rounded border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-cyan-200 text-sm">{runProgress}</div>
        )}
        {error && (
          <div className="mt-3 flex items-center justify-between rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300 text-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-3">&times;</button>
          </div>
        )}
        {recentRuns.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            {recentRuns.slice(0, 3).map(run => (
              <span key={run.id} className="flex items-center gap-1">
                <span className={run.status === 'complete' ? 'text-emerald-500' : run.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}>&bull;</span>
                {run.courseFilter || 'All'} &middot; {formatDate(run.completedAt)} &middot; {run.recordsProcessed ?? '\u2014'} records
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── No Data State ── */}
      {!loading && !summary && !isRunning && (
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-10 text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <p className="text-white font-semibold text-lg">No analytics data yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Select a course and click <strong>Run Analytics</strong> to process {reportRecordName} data.</p>
          <button onClick={handleRunAnalytics} className="rounded-md bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-500">
            Run Analytics Now
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/80 p-10 text-center shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          <p className="text-slate-400 animate-pulse">Loading analytics data...</p>
        </div>
      )}

      {/* ── Main content ── */}
      {!loading && summary && (
        <>
          {/* Tab nav */}
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/80 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 rounded-md border px-6 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'border-cyan-400/70 bg-cyan-500/15 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-500/45 hover:bg-cyan-500/10 hover:text-white'
                }`}>
                {activeTab === tab.id && (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-t-sm bg-cyan-400" />
                )}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {activeTab === 'course' && (
            <CourseTab summary={summary} trainees={trainees} events={events} trainingReportDisplayName={reportRecordName} />
          )}
          {activeTab === 'trainee' && (
            <TraineeTab trainees={trainees} trainingReportDisplayName={reportRecordName} />
          )}
          {activeTab === 'events' && (
            <EventsTab events={events} />
          )}
        </>
      )}
    </div>
    </ThresholdContext.Provider>
  );
};

export default TrainingIntelligenceTab;
