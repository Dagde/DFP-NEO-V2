import React, { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TIECourse {
  name: string;
  recordCount: number;
  lastRun: {
    completedAt: string;
    avgGrade: number;
    atRiskCount: number;
    totalRecords: number;
  } | null;
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
  totalRecords: number;
  uniqueTrainees: number;
  uniqueEvents: number;
  avgGrade: number;
  atRiskCount: number;
  exceedingCount: number;
  passRate: number;
  bottleneckEvents: string[];
  overServicedEvents: string[];
  skillHeatmap: Record<string, number>;
  narrative: string;
  completedAt: string;
  recordsProcessed: number;
  triggeredBy: string;
}

interface TIETraineeSummary {
  id: string;
  traineeName: string;
  courseFilter: string;
  totalAssessments: number;
  avgGrade: number;
  gradeMin: number;
  gradeMax: number;
  trendDirection: string;
  trendStrength: number;
  riskLevel: string;
  confidenceLevel: string;
  confidenceScore: number;
  skillFamilyScores: Record<string, number>;
  weakElements: string[];
  strongElements: string[];
  narrative: string;
}

interface TIEEventSummary {
  id: string;
  eventName: string;
  courseName: string;
  totalAttempts: number;
  avgGrade: number;
  passRate: number;
  trendDirection: string;
  bottleneckFlag: boolean;
  overServiceFlag: boolean;
  skillFamilyScores: Record<string, number>;
  weakElements: string[];
  narrative: string;
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

// ── Helper Functions ──────────────────────────────────────────────────────────

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
  if (dir === 'improving') return '↑';
  if (dir === 'worsening') return '↓';
  return '→';
};

const trendColor = (dir: string): string => {
  if (dir === 'improving') return 'text-emerald-400';
  if (dir === 'worsening') return 'text-red-400';
  return 'text-gray-400';
};

const findingTypeIcon: Record<string, string> = {
  bottleneck: '🚧',
  recurring_weakness: '⚠️',
  over_service: '✅',
  at_risk: '🔴',
  exceeding: '🌟',
  consistent_strength: '💪',
};

const confidenceColor = (c: string): string => {
  if (c === 'high') return 'text-emerald-400';
  if (c === 'medium') return 'text-yellow-400';
  return 'text-gray-400';
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const gradeBar = (score: number, max = 5): JSX.Element => {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${gradeColor(score)}`}>{score.toFixed(1)}</span>
    </div>
  );
};

// ── Sub-Components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: string;
}
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color = 'text-white', icon }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {icon && <span className="text-2xl">{icon}</span>}
    </div>
  </div>
);

interface SkillHeatmapProps {
  data: Record<string, number>;
  title?: string;
}
const SkillHeatmap: React.FC<SkillHeatmapProps> = ({ data, title }) => {
  const entries = Object.entries(data).sort((a, b) => a[1] - b[1]);
  if (!entries.length) return <p className="text-gray-500 text-sm">No skill data available</p>;
  return (
    <div>
      {title && <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{title}</p>}
      <div className="space-y-1.5">
        {entries.map(([skill, score]) => (
          <div key={skill}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-300 truncate max-w-[140px]">{skill}</span>
              <span className={gradeColor(score)}>{score.toFixed(1)}</span>
            </div>
            {gradeBar(score)}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const TrainingIntelligenceTab: React.FC = () => {
  // State
  const [courses, setCourses] = useState<TIECourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [recentRuns, setRecentRuns] = useState<TIERun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState<string>('');
  const [activePanel, setActivePanel] = useState<'overview' | 'trainees' | 'events' | 'findings' | 'settings'>('overview');

  const [summary, setSummary] = useState<TIECourseSummary | null>(null);
  const [trainees, setTrainees] = useState<TIETraineeSummary[]>([]);
  const [events, setEvents] = useState<TIEEventSummary[]>([]);
  const [findings, setFindings] = useState<TIEFinding[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const [traineeSearch, setTraineeSearch] = useState('');
  const [traineeFilter, setTraineeFilter] = useState<'all' | 'at_risk' | 'monitor' | 'exceeding'>('all');
  const [selectedTrainee, setSelectedTrainee] = useState<TIETraineeSummary | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TIEEventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load courses on mount
  useEffect(() => {
    fetchCourses();
    fetchRecentRuns();
    fetchSettings();
  }, []);

  // Load data when course changes
  useEffect(() => {
    if (!selectedCourse) return;
    loadCourseData(selectedCourse);
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const r = await fetch('/api/tie/courses');
      const data = await r.json();
      setCourses(data);
      if (data.length > 0 && !selectedCourse) {
        setSelectedCourse(data[0].name);
      }
    } catch (e) { setError('Failed to load courses'); }
  };

  const fetchRecentRuns = async () => {
    try {
      const r = await fetch('/api/tie/runs?limit=5');
      const data = await r.json();
      setRecentRuns(Array.isArray(data) ? data : []);
    } catch (e) { /* non-fatal */ }
  };

  const fetchSettings = async () => {
    try {
      const r = await fetch('/api/tie/settings');
      const data = await r.json();
      setSettings(data);
    } catch (e) { /* non-fatal */ }
  };

  const loadCourseData = async (course: string) => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, traineeRes, eventRes, findRes] = await Promise.all([
        fetch(`/api/tie/summary/${encodeURIComponent(course)}`),
        fetch(`/api/tie/trainees/${encodeURIComponent(course)}`),
        fetch(`/api/tie/events/${encodeURIComponent(course)}`),
        fetch(`/api/tie/findings/${encodeURIComponent(course)}`),
      ]);
      const [sum, tr, ev, fi] = await Promise.all([sumRes.json(), traineeRes.json(), eventRes.json(), findRes.json()]);
      setSummary(sum);
      setTrainees(Array.isArray(tr) ? tr : []);
      setEvents(Array.isArray(ev) ? ev : []);
      setFindings(Array.isArray(fi) ? fi : []);
      setSelectedTrainee(null);
      setSelectedEvent(null);
    } catch (e) {
      setError('Failed to load course analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalytics = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunProgress('Initialising analytics engine...');
    setError(null);
    try {
      setRunProgress('Processing PT-051 records...');
      const r = await fetch('/api/tie/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseFilter: selectedCourse || null, triggeredBy: 'manual-ui' })
      });
      const result = await r.json();
      if (result.success) {
        setRunProgress(`✅ Complete — ${result.recordsProcessed} records, ${result.trainees} trainees, ${result.events} events`);
        setTimeout(() => {
          setRunProgress('');
          setIsRunning(false);
          fetchRecentRuns();
          if (selectedCourse) loadCourseData(selectedCourse);
          fetchCourses();
        }, 2500);
      } else {
        setError(`Run failed: ${result.error}`);
        setRunProgress('');
        setIsRunning(false);
      }
    } catch (e: any) {
      setError(`Run failed: ${e.message}`);
      setRunProgress('');
      setIsRunning(false);
    }
  };

  const handleSaveSetting = async (key: string, value: string) => {
    try {
      await fetch('/api/tie/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (e) { setError('Failed to save setting'); }
  };

  // Filtered trainees
  const filteredTrainees = trainees.filter(t => {
    if (traineeFilter !== 'all' && t.riskLevel !== traineeFilter) return false;
    if (traineeSearch && !t.traineeName.toLowerCase().includes(traineeSearch.toLowerCase())) return false;
    return true;
  });

  const atRiskCount = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const monitorCount = trainees.filter(t => t.riskLevel === 'monitor').length;
  const exceedingCount = trainees.filter(t => t.riskLevel === 'exceeding').length;
  const bottleneckCount = events.filter(e => e.bottleneckFlag).length;

  const panelTabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'trainees' as const, label: 'Trainees', icon: '👤', badge: atRiskCount > 0 ? atRiskCount : undefined },
    { id: 'events' as const, label: 'Events', icon: '✈️', badge: bottleneckCount > 0 ? bottleneckCount : undefined },
    { id: 'findings' as const, label: 'Findings', icon: '🔍', badge: findings.length > 0 ? findings.length : undefined },
    { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header Controls ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Title */}
          <div className="flex-shrink-0">
            <h2 className="text-white font-bold text-lg leading-tight">Training Intelligence Engine</h2>
            <p className="text-gray-400 text-xs">Offline PT-051 analytics · all data stored in database</p>
          </div>

          <div className="flex-1 min-w-0" />

          {/* Course selector */}
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm whitespace-nowrap">Course:</label>
            <select
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-md px-3 py-1.5 focus:outline-none focus:border-blue-500"
              disabled={isRunning}
            >
              <option value="">— All Courses —</option>
              {courses.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.recordCount} records)
                </option>
              ))}
            </select>
          </div>

          {/* Run button */}
          <button
            onClick={handleRunAnalytics}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              isRunning
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
            }`}
          >
            {isRunning ? (
              <>
                <span className="animate-spin">⟳</span>
                Running...
              </>
            ) : (
              <>
                ▶ Run Analytics
              </>
            )}
          </button>
        </div>

        {/* Progress / status */}
        {runProgress && (
          <div className="mt-3 bg-blue-900/30 border border-blue-700 rounded px-3 py-2 text-blue-300 text-sm">
            {runProgress}
          </div>
        )}
        {error && (
          <div className="mt-3 bg-red-900/30 border border-red-700 rounded px-3 py-2 text-red-300 text-sm flex items-center justify-between">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200 ml-3">✕</button>
          </div>
        )}

        {/* Last run info */}
        {recentRuns.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            {recentRuns.slice(0, 3).map(run => (
              <span key={run.id} className="flex items-center gap-1">
                <span className={run.status === 'complete' ? 'text-emerald-500' : run.status === 'failed' ? 'text-red-500' : 'text-yellow-500'}>●</span>
                {run.courseFilter || 'All'} · {formatDate(run.completedAt)} · {run.recordsProcessed ?? '—'} records
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── No Data State ── */}
      {!loading && !summary && !isRunning && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center">
          <p className="text-4xl mb-3">🧠</p>
          <p className="text-white font-semibold text-lg">No analytics data yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-4">Select a course and click <strong>Run Analytics</strong> to process PT-051 data.</p>
          <button
            onClick={handleRunAnalytics}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-md text-sm font-semibold"
          >
            ▶ Run Analytics Now
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-10 text-center">
          <p className="text-gray-400 animate-pulse">Loading analytics data...</p>
        </div>
      )}

      {/* ── Main content (when data available) ── */}
      {!loading && summary && (
        <>
          {/* Panel tab nav */}
          <div className="flex items-center gap-1 border-b border-gray-700 pb-0">
            {panelTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActivePanel(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-all relative ${
                  activePanel === tab.id
                    ? 'bg-gray-800 text-white border border-b-0 border-gray-600'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ─── OVERVIEW PANEL ─── */}
          {activePanel === 'overview' && (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard label="Total Records" value={summary.totalRecords} icon="📋" />
                <StatCard label="Trainees" value={summary.uniqueTrainees} icon="👥" />
                <StatCard label="Events" value={summary.uniqueEvents} icon="✈️" />
                <StatCard
                  label="Avg Grade"
                  value={summary.avgGrade.toFixed(2)}
                  icon="⭐"
                  color={gradeColor(summary.avgGrade)}
                />
                <StatCard
                  label="At Risk"
                  value={summary.atRiskCount}
                  sub={`of ${summary.uniqueTrainees}`}
                  icon="🔴"
                  color={summary.atRiskCount > 0 ? 'text-red-400' : 'text-gray-400'}
                />
                <StatCard
                  label="Pass Rate"
                  value={`${summary.passRate.toFixed(0)}%`}
                  icon="✅"
                  color={summary.passRate >= 80 ? 'text-emerald-400' : summary.passRate >= 60 ? 'text-yellow-400' : 'text-red-400'}
                />
              </div>

              {/* Trainee Risk Distribution + Skill Heatmap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Risk Distribution */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Trainee Risk Distribution</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'At Risk', count: atRiskCount, color: 'bg-red-500', textColor: 'text-red-400' },
                      { label: 'Monitor', count: monitorCount, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
                      { label: 'Normal', count: trainees.length - atRiskCount - monitorCount - exceedingCount, color: 'bg-blue-500', textColor: 'text-blue-400' },
                      { label: 'Exceeding', count: exceedingCount, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                    ].map(item => {
                      const pct = trainees.length > 0 ? (item.count / trainees.length) * 100 : 0;
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={item.textColor}>{item.label}</span>
                            <span className="text-gray-400">{item.count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="bg-gray-700 rounded-full h-2">
                            <div className={`${item.color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Skill Family Heatmap */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 col-span-2">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Skill Family Performance</h3>
                  <SkillHeatmap data={summary.skillHeatmap} />
                </div>
              </div>

              {/* Bottleneck & Over-Service Events */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">🚧 Bottleneck Events</h3>
                  {summary.bottleneckEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm">No bottlenecks detected</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {summary.bottleneckEvents.map(e => (
                        <span key={e} className="bg-red-900/40 border border-red-700 text-red-300 text-xs px-2 py-1 rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">✅ Over-Serviced Events</h3>
                  {summary.overServicedEvents.length === 0 ? (
                    <p className="text-gray-500 text-sm">No over-serviced events</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {summary.overServicedEvents.map(e => (
                        <span key={e} className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs px-2 py-1 rounded">
                          {e}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Course Narrative */}
              {summary.narrative && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">📝 Course Analysis Narrative</h3>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{summary.narrative}</p>
                  <p className="text-gray-600 text-xs mt-3">
                    Last analysed: {formatDate(summary.completedAt)} · {summary.recordsProcessed} records processed
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ─── TRAINEES PANEL ─── */}
          {activePanel === 'trainees' && (
            <div className="space-y-4">
              {/* Search + Filter */}
              <div className="flex flex-wrap gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search trainee..."
                  value={traineeSearch}
                  onChange={e => setTraineeSearch(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-md px-3 py-1.5 w-56 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-1">
                  {(['all', 'at_risk', 'monitor', 'exceeding'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setTraineeFilter(f)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                        traineeFilter === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'at_risk' ? '🔴 At Risk' : f === 'monitor' ? '⚠️ Monitor' : '🌟 Exceeding'}
                      {f !== 'all' && (
                        <span className="ml-1 text-gray-400">
                          ({f === 'at_risk' ? atRiskCount : f === 'monitor' ? monitorCount : exceedingCount})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-gray-500 text-xs ml-auto">{filteredTrainees.length} trainees</span>
              </div>

              {/* Two-panel layout: list + detail */}
              <div className="flex gap-4">
                {/* Trainee list */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left text-gray-400 font-medium px-4 py-2.5 text-xs uppercase">Trainee</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Avg</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Trend</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Assessments</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Risk</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrainees.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-gray-500 py-6 text-sm">
                              No trainees match the current filter
                            </td>
                          </tr>
                        )}
                        {filteredTrainees.map(t => (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTrainee(t)}
                            className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                              selectedTrainee?.id === t.id
                                ? 'bg-blue-900/30'
                                : 'hover:bg-gray-700/40'
                            }`}
                          >
                            <td className="px-4 py-2.5 text-gray-200 font-medium">{t.traineeName}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(t.avgGrade)}`}>
                              {t.avgGrade.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2.5 text-center font-bold ${trendColor(t.trendDirection)}`}>
                              {trendIcon(t.trendDirection)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-400">{t.totalAssessments}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${riskBadge(t.riskLevel)}`}>
                                {t.riskLevel === 'at_risk' ? 'At Risk' : t.riskLevel === 'monitor' ? 'Monitor' : t.riskLevel === 'exceeding' ? 'Exceeding' : 'Normal'}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 text-center text-xs ${confidenceColor(t.confidenceLevel)}`}>
                              {t.confidenceLevel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Trainee Detail Panel */}
                {selectedTrainee && (
                  <div className="w-80 flex-shrink-0">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-white font-bold text-base">{selectedTrainee.traineeName}</h3>
                          <p className="text-gray-400 text-xs">{selectedTrainee.courseFilter}</p>
                        </div>
                        <button onClick={() => setSelectedTrainee(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
                      </div>

                      {/* Grade summary */}
                      <div className={`rounded-lg border p-3 ${gradeBg(selectedTrainee.avgGrade)}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-xs">Average Grade</span>
                          <span className={`text-2xl font-bold font-mono ${gradeColor(selectedTrainee.avgGrade)}`}>
                            {selectedTrainee.avgGrade.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span>Min: <span className={gradeColor(selectedTrainee.gradeMin)}>{selectedTrainee.gradeMin.toFixed(1)}</span></span>
                          <span>Max: <span className={gradeColor(selectedTrainee.gradeMax)}>{selectedTrainee.gradeMax.toFixed(1)}</span></span>
                          <span>Trend: <span className={trendColor(selectedTrainee.trendDirection)}>{trendIcon(selectedTrainee.trendDirection)} {selectedTrainee.trendDirection}</span></span>
                        </div>
                      </div>

                      {/* Skill family scores */}
                      {Object.keys(selectedTrainee.skillFamilyScores).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Skill Families</p>
                          <SkillHeatmap data={selectedTrainee.skillFamilyScores} />
                        </div>
                      )}

                      {/* Weak / strong elements */}
                      {selectedTrainee.weakElements.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Weak Elements</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedTrainee.weakElements.map(e => (
                              <span key={e} className="bg-red-900/40 border border-red-800 text-red-300 text-xs px-2 py-0.5 rounded">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedTrainee.strongElements.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Strong Elements</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedTrainee.strongElements.map(e => (
                              <span key={e} className="bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-xs px-2 py-0.5 rounded">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Narrative */}
                      {selectedTrainee.narrative && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Analysis</p>
                          <p className="text-gray-300 text-xs leading-relaxed">{selectedTrainee.narrative}</p>
                        </div>
                      )}

                      {/* Risk + Confidence */}
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${riskBadge(selectedTrainee.riskLevel)}`}>
                          {selectedTrainee.riskLevel === 'at_risk' ? '🔴 At Risk' :
                           selectedTrainee.riskLevel === 'monitor' ? '⚠️ Monitor' :
                           selectedTrainee.riskLevel === 'exceeding' ? '🌟 Exceeding' : '✅ Normal'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-700 border border-gray-600 ${confidenceColor(selectedTrainee.confidenceLevel)}`}>
                          {selectedTrainee.confidenceLevel} confidence ({(selectedTrainee.confidenceScore * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── EVENTS PANEL ─── */}
          {activePanel === 'events' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {/* Event list */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left text-gray-400 font-medium px-4 py-2.5 text-xs uppercase">Event</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Avg</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Pass%</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Attempts</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Trend</th>
                          <th className="text-center text-gray-400 font-medium px-3 py-2.5 text-xs uppercase">Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center text-gray-500 py-6 text-sm">No event data available</td>
                          </tr>
                        )}
                        {events.map(ev => (
                          <tr
                            key={ev.id}
                            onClick={() => setSelectedEvent(ev)}
                            className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                              selectedEvent?.id === ev.id ? 'bg-blue-900/30' : 'hover:bg-gray-700/40'
                            }`}
                          >
                            <td className="px-4 py-2.5 text-gray-200 font-medium">{ev.eventName}</td>
                            <td className={`px-3 py-2.5 text-center font-mono font-bold ${gradeColor(ev.avgGrade)}`}>
                              {ev.avgGrade.toFixed(2)}
                            </td>
                            <td className={`px-3 py-2.5 text-center text-xs font-medium ${ev.passRate >= 80 ? 'text-emerald-400' : ev.passRate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {ev.passRate.toFixed(0)}%
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-400">{ev.totalAttempts}</td>
                            <td className={`px-3 py-2.5 text-center font-bold ${trendColor(ev.trendDirection)}`}>
                              {trendIcon(ev.trendDirection)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {ev.bottleneckFlag && <span className="mr-1" title="Bottleneck">🚧</span>}
                              {ev.overServiceFlag && <span title="Over-serviced">✅</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Event Detail Panel */}
                {selectedEvent && (
                  <div className="w-80 flex-shrink-0">
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-white font-bold text-base">{selectedEvent.eventName}</h3>
                          <p className="text-gray-400 text-xs">{selectedEvent.courseName}</p>
                        </div>
                        <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-300 text-lg leading-none">✕</button>
                      </div>

                      <div className={`rounded-lg border p-3 ${gradeBg(selectedEvent.avgGrade)}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-300 text-xs">Average Grade</span>
                          <span className={`text-2xl font-bold font-mono ${gradeColor(selectedEvent.avgGrade)}`}>
                            {selectedEvent.avgGrade.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          <span>Pass Rate: <span className={selectedEvent.passRate >= 80 ? 'text-emerald-400' : 'text-yellow-400'}>{selectedEvent.passRate.toFixed(0)}%</span></span>
                          <span>Attempts: {selectedEvent.totalAttempts}</span>
                        </div>
                      </div>

                      {Object.keys(selectedEvent.skillFamilyScores).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Skill Families</p>
                          <SkillHeatmap data={selectedEvent.skillFamilyScores} />
                        </div>
                      )}

                      {selectedEvent.weakElements.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Weak Elements</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedEvent.weakElements.map(e => (
                              <span key={e} className="bg-red-900/40 border border-red-800 text-red-300 text-xs px-2 py-0.5 rounded">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {selectedEvent.bottleneckFlag && (
                          <span className="bg-red-900/40 border border-red-700 text-red-300 text-xs px-2 py-1 rounded">🚧 Bottleneck</span>
                        )}
                        {selectedEvent.overServiceFlag && (
                          <span className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs px-2 py-1 rounded">✅ Over-Serviced</span>
                        )}
                      </div>

                      {selectedEvent.narrative && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Analysis</p>
                          <p className="text-gray-300 text-xs leading-relaxed">{selectedEvent.narrative}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Event skill heatmap grid */}
              {events.length > 0 && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Event × Skill Family Grade Matrix</h3>
                  <div className="overflow-x-auto">
                    <table className="text-xs">
                      <thead>
                        <tr>
                          <th className="text-left text-gray-400 pr-4 py-1 whitespace-nowrap">Event</th>
                          {Array.from(new Set(events.flatMap(e => Object.keys(e.skillFamilyScores)))).map(skill => (
                            <th key={skill} className="text-gray-400 px-2 py-1 text-center whitespace-nowrap">{skill}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map(ev => {
                          const skills = Array.from(new Set(events.flatMap(e => Object.keys(e.skillFamilyScores))));
                          return (
                            <tr key={ev.id} className="border-t border-gray-700/50">
                              <td className="text-gray-300 pr-4 py-1 whitespace-nowrap font-medium">{ev.eventName}</td>
                              {skills.map(skill => {
                                const s = ev.skillFamilyScores[skill];
                                return (
                                  <td key={skill} className="px-2 py-1 text-center">
                                    {s !== undefined ? (
                                      <span className={`font-mono font-bold ${gradeColor(s)}`}>{s.toFixed(1)}</span>
                                    ) : (
                                      <span className="text-gray-700">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── FINDINGS PANEL ─── */}
          {activePanel === 'findings' && (
            <div className="space-y-3">
              {findings.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
                  <p className="text-gray-500">No findings available for this course</p>
                </div>
              ) : (
                <>
                  {/* Finding type summary */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {Array.from(new Set(findings.map(f => f.findingType))).map(type => {
                      const count = findings.filter(f => f.findingType === type).length;
                      return (
                        <span key={type} className="bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                          {findingTypeIcon[type] || '•'} {type} ({count})
                        </span>
                      );
                    })}
                  </div>

                  {/* Finding cards */}
                  {findings.map(f => (
                    <div key={f.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{findingTypeIcon[f.findingType] || '•'}</span>
                          <div>
                            <span className="text-white text-sm font-medium">{f.descriptiveFinding}</span>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-gray-500 text-xs">{f.level} · {f.subjectKey}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded bg-gray-700 border border-gray-600 ${confidenceColor(f.confidenceLevel)}`}>
                            {f.confidenceLevel}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 border border-gray-600 text-gray-400">
                            {f.evidenceCount} records
                          </span>
                        </div>
                      </div>

                      {f.interpretedInsight && (
                        <p className="text-gray-400 text-xs pl-7">{f.interpretedInsight}</p>
                      )}

                      {f.recommendation && (
                        <div className="bg-blue-900/20 border border-blue-800/50 rounded px-3 py-2 ml-7">
                          <p className="text-blue-300 text-xs"><span className="font-semibold">Recommendation:</span> {f.recommendation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ─── SETTINGS PANEL ─── */}
          {activePanel === 'settings' && (
            <div className="space-y-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-white font-semibold mb-4">TIE Configuration</h3>
                <div className="space-y-4 max-w-lg">
                  {Object.entries({
                    at_risk_threshold: { label: 'At-Risk Grade Threshold', desc: 'Average grade below this value flags trainee as at-risk (scale 1–5)' },
                    weak_element_threshold: { label: 'Weak Element Threshold', desc: 'Element average below this value is classified as weak' },
                    bottleneck_threshold: { label: 'Bottleneck Pass Rate %', desc: 'Events with pass rate below this % are marked as bottlenecks' },
                    over_service_threshold: { label: 'Over-Service Pass Rate %', desc: 'Events with pass rate above this % are marked as over-serviced' },
                    recency_weight_factor: { label: 'Recency Weight Factor', desc: 'Multiplier applied to the most recent 30% of assessments' },
                    min_confidence_records: { label: 'Minimum Records for Confidence', desc: 'Minimum assessment count for high-confidence findings' },
                  }).map(([key, meta]) => (
                    <div key={key} className="flex items-start gap-4">
                      <div className="flex-1">
                        <label className="text-gray-300 text-sm font-medium block">{meta.label}</label>
                        <p className="text-gray-500 text-xs mt-0.5">{meta.desc}</p>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={settings[key] ?? ''}
                        onChange={e => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                        onBlur={e => handleSaveSetting(key, e.target.value)}
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1.5 w-24 text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-gray-600 text-xs mt-5">Settings are saved to the database and take effect on the next analytics run.</p>
              </div>

              {/* Recent runs */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-white font-semibold mb-3">Recent Analytics Runs</h3>
                {recentRuns.length === 0 ? (
                  <p className="text-gray-500 text-sm">No runs yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentRuns.map(run => (
                      <div key={run.id} className="flex items-center gap-3 py-2 border-b border-gray-700/50 last:border-0 text-sm">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${run.status === 'complete' ? 'bg-emerald-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                        <span className="text-gray-300 flex-1">{run.courseFilter || 'All Courses'}</span>
                        <span className="text-gray-500 text-xs">{run.recordsProcessed ?? '—'} records</span>
                        <span className="text-gray-500 text-xs">{formatDate(run.completedAt)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${run.status === 'complete' ? 'bg-emerald-900/40 text-emerald-400' : run.status === 'failed' ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400'}`}>
                          {run.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrainingIntelligenceTab;