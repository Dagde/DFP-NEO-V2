import React, { useState, useEffect } from 'react';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const gradeColor = (g: number): string => {
  if (g >= 4.5) return 'text-emerald-400';
  if (g >= 3.5) return 'text-green-400';
  if (g >= 3.0) return 'text-yellow-400';
  if (g >= 2.5) return 'text-orange-400';
  return 'text-red-400';
};

const gradeBg = (g: number): string => {
  if (g >= 4.5) return 'bg-emerald-900/40 border-emerald-700';
  if (g >= 3.5) return 'bg-green-900/40 border-green-700';
  if (g >= 3.0) return 'bg-yellow-900/40 border-yellow-700';
  if (g >= 2.5) return 'bg-orange-900/40 border-orange-700';
  return 'bg-red-900/40 border-red-700';
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

// ── SparkBar ────────────────────────────────────────────────────────────────────

const SparkBar: React.FC<{ value: number; max?: number; colorClass?: string }> = ({ value, max = 5, colorClass }) => {
  const pct = Math.min(100, (safeN(value) / max) * 100);
  const c = colorClass || (value >= 4 ? 'bg-emerald-500' : value >= 3 ? 'bg-yellow-500' : 'bg-red-500');
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`${c} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${gradeColor(value)}`}>{safe(value, 1)}</span>
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
}> = ({ data, labels, width = 100, height = 32, color = '#60a5fa', interactive = false }) => {
  const [tooltip, setTooltip] = React.useState<{ i: number; svgX: number; svgY: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (!data || data.length < 2) return <span className="text-gray-600 text-xs">&mdash;</span>;

  // Fixed scale: always 0 → 5 on Y axis so labels align correctly
  const YMIN = 0, YMAX = 5;
  const PAD_TOP = 8, PAD_BOT = 8;
  const usableH = height - PAD_TOP - PAD_BOT;

  const getX = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * width);
  const getY = (v: number) => PAD_TOP + usableH * (1 - Math.max(0, Math.min(1, (v - YMIN) / (YMAX - YMIN))));

  const pts = data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');

  const hoveredVal = tooltip !== null ? data[tooltip.i] : null;
  const gc = (v: number) => v >= 4.5 ? '#34d399' : v >= 3.5 ? '#4ade80' : v >= 3.0 ? '#facc15' : v >= 2.5 ? '#fb923c' : '#f87171';

  // Fixed Y-axis reference lines at 0,1,2,3,4,5
  const gridLines = interactive ? [0, 1, 2, 3, 4, 5] : [];

  return (
    <div className="relative" style={{ display: 'inline-block' }}>
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
            <line key={v} x1={0} y1={y} x2={width} y2={y}
              stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
          );
        })}

        <polyline points={pts} fill="none" stroke={color} strokeWidth={interactive ? 2 : 1.5} strokeLinejoin="round" />

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
              <circle cx={x} cy={y} r={interactive ? (isHov ? 6 : 4) : 2} fill={color}
                stroke={isHov ? '#fff' : 'none'} strokeWidth={1.5} />
              {interactive && (
                <circle
                  cx={x} cy={y} r={14} fill="transparent"
                  onMouseEnter={() => setTooltip({ i, svgX: x, svgY: y })}
                  onMouseLeave={() => setTooltip(null)}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Floating tooltip — positioned relative to SVG container, never clipped */}
      {interactive && tooltip !== null && hoveredVal !== null && (() => {
        const label = labels?.[tooltip.i] ?? `Assessment #${tooltip.i + 1}`;
        const ttW = 130, ttH = 44;
        // Position: right of point, flip left if near right edge
        const leftPos = tooltip.svgX + ttW + 10 > width ? tooltip.svgX - ttW - 6 : tooltip.svgX + 10;
        const topPos = Math.max(0, tooltip.svgY - ttH / 2);
        return (
          <div
            style={{
              position: 'absolute',
              left: leftPos,
              top: topPos,
              width: ttW,
              pointerEvents: 'none',
              zIndex: 100,
            }}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 shadow-xl"
          >
            <p className="text-xs text-gray-400 leading-tight">{label}</p>
            <p className="text-sm font-bold leading-tight" style={{ color: gc(hoveredVal) }}>
              Grade: {hoveredVal.toFixed(2)}
            </p>
          </div>
        );
      })()}
    </div>
  );
};

// ── HBarChart ───────────────────────────────────────────────────────────────────

const HBarChart: React.FC<{ data: Array<{ label: string; value: number; color?: string }>; max?: number }> = ({ data, max = 5 }) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  return (
    <div className="space-y-2">
      {data.map(item => {
        const pct = Math.min(100, (safeN(item.value) / max) * 100);
        const c = item.color || (item.value >= 4 ? 'bg-emerald-500' : item.value >= 3 ? 'bg-yellow-500' : 'bg-red-500');
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-300 truncate max-w-[160px]" title={item.label}>{item.label}</span>
              <span className={gradeColor(item.value)}>{safe(item.value, 1)}</span>
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth="22" />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth="22"
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
      <polygon points={polyStr} fill="#3b82f630" stroke="#3b82f6" strokeWidth="2" />
      {poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />)}
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
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

// ── SectionCard ─────────────────────────────────────────────────────────────────

const SCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className || ''}`}>
    <h3 className="text-sm font-semibold text-gray-300 mb-3">{title}</h3>
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

const ProgressionModal: React.FC<{ data: number[]; name: string; trend: string; onClose: () => void }> = ({ data, name, trend, onClose }) => {
  const color = trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#60a5fa';
  const avgVal = data.reduce((s, v) => s + v, 0) / data.length;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const labels = data.map((_, i) => `Assessment #${i + 1}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-4" style={{ maxWidth: '860px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">{name} &mdash; Grade Progression</h3>
            <p className="text-gray-400 text-sm mt-0.5">{data.length} assessments &middot; hover over a point to see details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <div className="flex gap-3">
            <div className="flex flex-col justify-between text-xs text-gray-500 py-1 flex-shrink-0 text-right" style={{ width: 28, height: 220 }}>
              <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span>
            </div>
            <div className="flex-1 overflow-x-auto">
              <SparkLine
                data={data}
                labels={labels}
                width={Math.max(760, data.length * 48)}
                height={220}
                color={color}
                interactive={true}
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
              <p className={`text-xl font-bold font-mono ${gradeColor(s.value)}`}>{s.value.toFixed(2)}</p>
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

const ColChartExpanded: React.FC<{ data: Array<{ label: string; value: number }>; max?: number; height?: number }> = ({
  data, max = 5, height = 240
}) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  const bw = Math.max(20, Math.min(52, 800 / data.length));
  const gap = Math.max(5, bw * 0.4);
  const leftPad = 32;
  const tw = leftPad + data.length * (bw + gap) + gap;
  const tp = 16, bp = 44, ch = height - tp - bp;
  return (
    <svg width={tw} height={height} className="overflow-visible" style={{ minWidth: '100%' }}>
      {[0, 1, 2, 3, 4, 5].map(v => {
        const y = tp + ch * (1 - v / max);
        return (
          <g key={v}>
            <line x1={leftPad} y1={y} x2={tw} y2={y} stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={leftPad - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#6b7280">{v.toFixed(0)}</text>
          </g>
        );
      })}
      {data.map((item, i) => {
        const pct = Math.min(1, safeN(item.value) / max);
        const bh = Math.max(3, pct * ch);
        const x = leftPad + gap + i * (bw + gap);
        const y = tp + ch - bh;
        const color = item.value >= 4 ? '#10b981' : item.value >= 3 ? '#eab308' : '#ef4444';
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={color} fillOpacity={0.9} rx="3" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#e5e7eb" fontWeight="bold">
              {safe(item.value, 2)}
            </text>
            <text
              x={x + bw / 2}
              y={height - 6}
              textAnchor="end"
              fontSize="10"
              fill="#9ca3af"
              transform={`rotate(-45,${x + bw / 2},${height - 6})`}
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
  onClose: () => void;
}> = ({ trainees, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-2" style={{ maxWidth: '1100px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">Grade by Trainee (sorted low to high)</h3>
            <p className="text-gray-400 text-sm mt-0.5">{trainees.length} trainees &middot; avg grade per trainee</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
          <ColChartExpanded data={trainees} max={5} height={300} />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 justify-center text-xs">
          {[
            { color: '#ef4444', label: 'Below 3.0 — unsatisfactory' },
            { color: '#eab308', label: '3.0–3.9 — satisfactory' },
            { color: '#10b981', label: '4.0+ — good / excellent' },
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


// ── COURSE TAB ──────────────────────────────────────────────────────────────────

const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const atRisk = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const exceeding = trainees.filter(t => t.riskLevel === 'exceeding').length;
  const monitor = trainees.filter(t => t.riskLevel === 'monitor').length;
  const normal = trainees.length - atRisk - exceeding - monitor;
  const avgGrade = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;
  const passRate = trainees.length > 0 ? (trainees.filter(t => safeN(t.avgOverallGrade) >= 3.0).length / trainees.length) * 100 : 0;
  const skillHeatmap = parseJ(summary.skillHeatmap, {}) as Record<string, number>;
  const skillEntries = Object.entries(skillHeatmap).sort((a, b) => a[1] - b[1]);
  const bottleneckEvents = parseJ(summary.bottleneckEvents, []) as string[];
  const overServicedEventsFromSummary = parseJ(summary.overServicedEvents, []) as string[];

  // Derive over-serviced events from event data if summary is empty
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
        <StatCard label="Avg Score" value={safe(avgGrade, 2)} color={gradeColor(avgGrade)} sub="course average" />
        <StatCard label="Pass Rate" value={`${passRate.toFixed(0)}%`}
          color={passRate >= 80 ? 'text-emerald-400' : passRate >= 60 ? 'text-yellow-400' : 'text-red-400'}
          sub="trainees >= 3.0 avg" />
        <StatCard label="At-Risk" value={atRisk}
          color={atRisk > 0 ? 'text-red-400' : 'text-gray-400'} sub={`of ${trainees.length} trainees`} />
        <StatCard label="PT-051 Records" value={summary.totalPt051s} sub={`${trainees.length} trainees`} />
        <StatCard label="Events" value={events.length}
          sub={`${bottleneckEvents.length} bottleneck`}
          color={bottleneckEvents.length > 0 ? 'text-orange-400' : 'text-white'} />
      </div>

      {/* Row 1: Status Donut + Skill Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SCard title="Trainee Status Distribution">
          <DonutChart size={150} segments={[
            { label: 'At Risk', value: atRisk, color: '#ef4444' },
            { label: 'Monitor', value: monitor, color: '#eab308' },
            { label: 'Normal', value: normal, color: '#3b82f6' },
            { label: 'Exceeding', value: exceeding, color: '#10b981' },
          ].filter(s => s.value > 0)} />
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
                {safeN(ev.bottleneckScore) > 0.5 && <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1.5 py-0.5 rounded flex-shrink-0">BOTTLENECK</span>}
              </div>
            ))}
          </div>
        ) : events.length > 0 ? (
          <p className="text-gray-500 text-sm">Event grades not yet computed — run analytics to populate</p>
        ) : (
          <p className="text-gray-500 text-sm">No event data — run analytics first</p>
        )}
      </SCard>

      {/* Row 3: Event avg bar chart */}
      {topByAttempts.length > 0 && (
        <SCard title="Event Average Scores (Top 12 by Attempts)">
          <div className="overflow-x-auto">
            <ColChart data={topByAttempts.map(ev => ({ label: ev.eventCode, value: safeN(ev.avgOverallGrade) }))} max={5} height={130} />
          </div>
        </SCard>
      )}

      {/* Row 4: Bottleneck + Over-Service */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SCard title="Bottleneck Events">
          {bottleneckEvents.length === 0
            ? <p className="text-gray-500 text-sm">No bottlenecks detected</p>
            : (
              <>
                <p className="text-xs text-gray-500 mb-2">Events where trainees consistently struggle — high difficulty score, low pass rate, or recurring weak elements.</p>
                <div className="flex flex-wrap gap-2">{bottleneckEvents.slice(0, 5).map(e => <Tag key={e} text={e} type="red" />)}</div>
                {bottleneckEvents.length > 5 && <p className="text-xs text-gray-600 mt-2">+{bottleneckEvents.length - 5} more</p>}
              </>
            )}
        </SCard>
        <SCard title="Over-Serviced Events">
          <p className="text-xs text-gray-500 mb-2">
            Over-serviced events are events where trainees perform well above expectations — high pass rates and grades suggest these events may receive disproportionate training time relative to their difficulty. Consider reallocating focus to bottleneck events.
          </p>
          {overServicedEvents.length === 0
            ? <p className="text-gray-500 text-sm">No over-serviced events detected</p>
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
                              ? <span className={`font-mono font-bold ${gradeColor(v)}`}>{safe(v, 1)}</span>
                              : <span className="text-gray-700">&mdash;</span>}
                          </td>
                        );
                      })}
                      <td className={`px-2 py-1.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade))}`}>
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

const TraineeTab: React.FC<{ trainees: TIETraineeSummary[] }> = ({ trainees }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'at_risk' | 'monitor' | 'exceeding'>('all');
  const [selected, setSelected] = useState<TIETraineeSummary | null>(null);
  const [progressionModal, setProgressionModal] = useState<{ data: number[]; name: string; trend: string } | null>(null);
  const [gradeByTraineeModal, setGradeByTraineeModal] = useState(false);

  const atRiskCount = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const monitorCount = trainees.filter(t => t.riskLevel === 'monitor').length;
  const exceedingCount = trainees.filter(t => t.riskLevel === 'exceeding').length;

  const filtered = trainees.filter(t => {
    if (filter !== 'all' && t.riskLevel !== filter) return false;
    if (search && !t.traineeFullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const courseAvg = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;

  const selProgression = selected ? parseProgression(selected.gradeProgression) : [];
  const selSkills = selected ? parseJ(selected.skillFamilyScores ?? selected.strongestSkillFamilies, {}) as Record<string, number> : {};
  const hasSkillScores = Object.values(selSkills).some(v => typeof v === 'number' && v > 0);
  const weakEls = selected ? parseJ(selected.recurringWeakElements, []) as string[] : [];
  const strongFams = selected ? parseJ(selected.strongestSkillFamilies, []) as string[] : [];
  const atRiskReasons = selected ? parseJ(selected.atRiskReasons, []) as string[] : [];

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
          name={progressionModal.name}
          trend={progressionModal.trend}
          onClose={() => setProgressionModal(null)}
        />
      )}

      {gradeByTraineeModal && (
        <GradeByTraineeModal
          trainees={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
            // Use surname if name has spaces, otherwise truncate the full string
            const parts = t.traineeFullName.trim().split(/\s+/);
            const label = parts.length >= 2
              ? parts[parts.length - 1]  // surname (last word)
              : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;
            return { label, value: safeN(t.avgOverallGrade) };
          })}
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
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">PT-051s</th>
                  <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Risk</th>
                  <th className="text-left text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Prog.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8 text-sm">No trainees match the filter</td></tr>
                )}
                {filtered.map(t => {
                  const prog = parseProgression(t.gradeProgression);
                  return (
                    <tr key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}
                      className={`border-b border-gray-700/50 cursor-pointer transition-colors ${selected?.id === t.id ? 'bg-blue-900/30' : 'hover:bg-gray-700/40'}`}>
                      <td className="px-4 py-2.5 text-gray-200 font-medium">{t.traineeFullName}</td>
                      <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(safeN(t.avgOverallGrade))}`}>{safe(t.avgOverallGrade, 2)}</td>
                      <td className={`px-3 py-2.5 text-center font-mono text-xs ${gradeColor(safeN(t.recentAvgGrade))}`}>{safe(t.recentAvgGrade, 2)}</td>
                      <td className={`px-3 py-2.5 text-center font-bold ${trendColor(t.overallTrend)}`}>{trendIcon(t.overallTrend)}</td>
                      <td className="px-3 py-2.5 text-center text-gray-400">{t.totalPt051Count}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskBadge(t.riskLevel)}`}>
                          {t.riskLevel === 'at_risk' ? 'At Risk' : t.riskLevel === 'monitor' ? 'Monitor' : t.riskLevel === 'exceeding' ? 'Exceeding' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {prog.length >= 2
                          ? (
                            <button
                              title="Click to enlarge"
                              onClick={e => {
                                e.stopPropagation();
                                setProgressionModal({ data: prog, name: t.traineeFullName, trend: t.overallTrend });
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
                        const parts = t.traineeFullName.trim().split(/\s+/);
                        const label = parts.length >= 2
                          ? parts[parts.length - 1]
                          : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;
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
                            <td className={`py-1.5 px-2 text-center font-mono ${gradeColor(safeN(t.avgOverallGrade))}`}>{safe(t.avgOverallGrade, 2)}</td>
                            <td className={`py-1.5 px-2 text-center font-mono ${gradeColor(safeN(t.recentAvgGrade))}`}>{safe(t.recentAvgGrade, 2)}</td>
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
              <div className={`rounded border p-3 ${gradeBg(safeN(selected.avgOverallGrade))}`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-xs">Average Grade</span>
                  <span className={`text-2xl font-bold font-mono ${gradeColor(safeN(selected.avgOverallGrade))}`}>{safe(selected.avgOverallGrade, 2)}</span>
                </div>
                <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                  <span>Recent: <span className={gradeColor(safeN(selected.recentAvgGrade))}>{safe(selected.recentAvgGrade, 2)}</span></span>
                  <span>Trend: <span className={trendColor(selected.overallTrend)}>{trendIcon(selected.overallTrend)} {selected.overallTrend || 'stable'}</span></span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${riskBadge(selected.riskLevel)}`}>
                    {selected.riskLevel === 'at_risk' ? 'At Risk' : selected.riskLevel === 'monitor' ? 'Monitor' : selected.riskLevel === 'exceeding' ? 'Exceeding' : 'Normal'}
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
                    <span className={gradeColor(safeN(selected.avgOverallGrade))}>{safe(selected.avgOverallGrade, 2)}</span>
                  </div>
                  <SparkBar value={safeN(selected.avgOverallGrade)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-gray-400">Course Avg</span>
                    <span className={gradeColor(courseAvg)}>{safe(courseAvg, 2)}</span>
                  </div>
                  <SparkBar value={courseAvg} colorClass="bg-blue-500" />
                </div>
              </div>
            </SCard>

            {/* Progression sparkline — interactive inline + click to enlarge */}
            {selProgression.length >= 2 && (
              <SCard title="Grade Progression">
                <div className="overflow-x-auto">
                  <SparkLine
                    data={selProgression}
                    labels={selProgression.map((_, i) => `Assessment #${i + 1}`)}
                    width={Math.max(230, selProgression.length * 28)}
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
                  onClick={() => setProgressionModal({ data: selProgression, name: selected.traineeFullName, trend: selected.overallTrend })}
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
            {selected.riskLevel === 'at_risk' && atRiskReasons.length > 0 && (
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
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);

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

  const hardest = events.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, events[0]);
  const easiest = events.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, events[0]);
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);

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
                    <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade))}`}>{safe(ev.avgOverallGrade, 2)}</td>
                    <td className={`px-3 py-2.5 text-center text-xs font-medium ${safeN(ev.passRate) >= 80 ? 'text-emerald-400' : safeN(ev.passRate) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {safe(ev.passRate, 0)}%
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{ev.totalAttempts}</td>
                    <td className={`px-3 py-2.5 text-center text-xs font-mono ${safeN(ev.gradeVariance) > 1 ? 'text-orange-400' : 'text-gray-400'}`}>{safe(ev.gradeVariance, 2)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <SparkBar value={safeN(ev.difficultyScore)} max={1} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {safeN(ev.bottleneckScore) > 0.5 && <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1 py-0.5 rounded leading-none">BN</span>}
                        {ev.overServiceIndicator && <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-1 py-0.5 rounded leading-none">OS</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <SCard title="Pass Rate by Event (%)">
              <div className="overflow-x-auto">
                <ColChart
                  data={[...events].sort((a, b) => safeN(a.passRate) - safeN(b.passRate)).map(ev => ({
                    label: ev.eventCode,
                    value: safeN(ev.passRate),
                    color: safeN(ev.passRate) >= 80 ? '#10b981' : safeN(ev.passRate) >= 60 ? '#eab308' : '#ef4444',
                  }))}
                  max={100} height={120} />
              </div>
            </SCard>

            <SCard title="Grade Variance by Event (spread indicator)">
              <div className="overflow-x-auto">
                <ColChart
                  data={[...events].sort((a, b) => safeN(b.gradeVariance) - safeN(a.gradeVariance)).map(ev => ({
                    label: ev.eventCode,
                    value: safeN(ev.gradeVariance),
                    color: safeN(ev.gradeVariance) > 1.5 ? '#ef4444' : safeN(ev.gradeVariance) > 0.8 ? '#eab308' : '#3b82f6',
                  }))}
                  max={Math.max(1, ...events.map(e => safeN(e.gradeVariance)))} height={120} />
              </div>
            </SCard>
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
                                    ? <span className={`font-mono font-bold ${gradeColor(v)}`}>{safe(v, 1)}</span>
                                    : <span className="text-gray-700">&mdash;</span>}
                                </td>
                              );
                            })}
                            <td className={`px-2 py-1.5 text-center font-mono font-bold ${gradeColor(safeN(ev.avgOverallGrade))}`}>{safe(ev.avgOverallGrade, 2)}</td>
                            <td className={`px-2 py-1.5 text-center text-xs ${safeN(ev.passRate) >= 80 ? 'text-emerald-400' : safeN(ev.passRate) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {safe(ev.passRate, 0)}%
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
              <div className={`rounded border p-3 ${gradeBg(safeN(selected.avgOverallGrade))}`}>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-xs">Average Grade</span>
                  <span className={`text-2xl font-bold font-mono ${gradeColor(safeN(selected.avgOverallGrade))}`}>{safe(selected.avgOverallGrade, 2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 mt-2 text-xs text-gray-400">
                  <span>Pass Rate: <span className={safeN(selected.passRate) >= 80 ? 'text-emerald-400' : 'text-yellow-400'}>{safe(selected.passRate, 0)}%</span></span>
                  <span>Attempts: <span className="text-gray-300">{selected.totalAttempts}</span></span>
                  <span>Variance: <span className={safeN(selected.gradeVariance) > 1 ? 'text-orange-400' : 'text-gray-300'}>{safe(selected.gradeVariance, 2)}</span></span>
                  <span>Difficulty: <span className="text-gray-300">{safe(selected.difficultyScore, 2)}</span></span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {safeN(selected.bottleneckScore) > 0.5 && <Tag text="Bottleneck" type="red" />}
                {selected.overServiceIndicator && <Tag text="Over-Serviced" type="green" />}
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

const TrainingIntelligenceTab: React.FC = () => {
  const [courses, setCourses] = useState<TIECourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [recentRuns, setRecentRuns] = useState<TIERun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'course' | 'trainee' | 'events'>('course');

  const [summary, setSummary] = useState<TIECourseSummary | null>(null);
  const [trainees, setTrainees] = useState<TIETraineeSummary[]>([]);
  const [events, setEvents] = useState<TIEEventSummary[]>([]);
  const [findings, setFindings] = useState<TIEFinding[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchRecentRuns();
  }, []);

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
          setRunProgress(`Complete \u2014 ${data.recordsProcessed ?? '?'} records processed`);
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setTimeout(() => {
            setRunProgress('');
            setIsRunning(false);
            fetchRecentRuns();
            fetchCourses();
            if (selectedCourse) loadCourseData(selectedCourse);
          }, 2500);
        } else if (data.status === 'failed') {
          setError(`Run failed: ${data.errorMessage || 'unknown error'}`);
          setRunProgress('');
          setIsRunning(false);
          clearInterval(pollRef.current!);
          pollRef.current = null;
        } else if (data.status === 'running') {
          setRunProgress('Processing PT-051 records\u2026');
        }
      } catch { /* poll silently */ }
    }, 2000);
  };

  const handleRunAnalytics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunProgress('Initialising analytics engine\u2026');
    setError(null);
    try {
      const r = await fetch('/api/tie/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseFilter: selectedCourse || null, triggeredBy: 'manual-ui' }),
      });
      const result = await r.json();
      if (result.started) {
        setRunProgress('Analytics run started \u2014 processing in background\u2026');
        startPolling();
      } else if (result.success) {
        setRunProgress(`Complete \u2014 ${result.recordsProcessed} records`);
        setTimeout(() => {
          setRunProgress('');
          setIsRunning(false);
          fetchRecentRuns();
          fetchCourses();
          if (selectedCourse) loadCourseData(selectedCourse);
        }, 2500);
      } else {
        setError(`Run failed: ${result.error || 'unknown error'}`);
        setRunProgress('');
        setIsRunning(false);
      }
    } catch (e: any) {
      setError(`Run failed: ${e.message}`);
      setRunProgress('');
      setIsRunning(false);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const atRiskBadge = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const bottleneckBadge = events.filter(e => safeN(e.bottleneckScore) > 0.5).length;

  const tabs = [
    { id: 'course' as const, label: 'Course' },
    { id: 'trainee' as const, label: 'Trainee', badge: atRiskBadge || undefined },
    { id: 'events' as const, label: 'Events', badge: bottleneckBadge || undefined },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header Controls ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-white font-bold text-lg leading-tight">Training Intelligence Engine</h2>
            <p className="text-gray-400 text-xs">Offline PT-051 analytics &middot; all data stored in database</p>
          </div>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm whitespace-nowrap">Course:</label>
            <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} disabled={isRunning}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500">
              <option value="">&mdash; All Courses &mdash;</option>
              {courses.map(c => <option key={c.name} value={c.name}>{c.name} ({c.recordCount} records)</option>)}
            </select>
          </div>
          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}`}>
            {isRunning ? <><span className="animate-spin inline-block">\u27F3</span> Running...</> : 'Run Analytics'}
          </button>
        </div>

        {runProgress && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded px-3 py-2 text-blue-300 text-sm">{runProgress}</div>
        )}
        {error && (
          <div className="mt-3 bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-3">&times;</button>
          </div>
        )}
        {recentRuns.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
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
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center">
          <p className="text-white font-semibold text-lg">No analytics data yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">Select a course and click <strong>Run Analytics</strong> to process PT-051 data.</p>
          <button onClick={handleRunAnalytics} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md text-sm font-semibold">
            Run Analytics Now
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center">
          <p className="text-gray-400 animate-pulse">Loading analytics data...</p>
        </div>
      )}

      {/* ── Main content ── */}
      {!loading && summary && (
        <>
          {/* Tab nav */}
          <div className="flex items-center gap-1 border-b border-gray-700">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium rounded-t-md transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white border border-b-0 border-gray-600'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}>
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
            <CourseTab summary={summary} trainees={trainees} events={events} />
          )}
          {activeTab === 'trainee' && (
            <TraineeTab trainees={trainees} />
          )}
          {activeTab === 'events' && (
            <EventsTab events={events} />
          )}
        </>
      )}
    </div>
  );
};

export default TrainingIntelligenceTab;