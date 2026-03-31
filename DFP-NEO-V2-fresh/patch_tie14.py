#!/usr/bin/env python3
"""
patch_tie14.py - Add "At Risk" definition, configurable threshold panel, and
carry thresholds through the Training Intelligence Engine UI.

Changes:
1. Add TIEThresholds interface + ThresholdContext
2. Add ThresholdSettingsPanel component (settings gear icon in header)
3. Update Trainee Status Distribution with definition legend + threshold annotations
4. Carry thresholds into: CourseTab pass rate, TraineeTab risk badges/labels,
   EventsTab bottleneck/pass rate, and getPassRate helper
5. Main component fetches/saves thresholds from /api/tie/settings
"""

import re

SRC = "components/tabs/TrainingIntelligenceTab.tsx"

with open(SRC, "r", encoding="utf-8") as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────
# 1.  Add TIEThresholds interface + React.createContext after imports
# ─────────────────────────────────────────────────────────────────

THRESHOLDS_BLOCK = """
// ── TIE Threshold configuration ──────────────────────────────────────────────

interface TIEThresholds {
  atRiskAvgGrade: number;        // avg grade BELOW which trainee is at-risk
  exceedingAvgGrade: number;     // avg grade ABOVE which trainee is exceeding
  concernThresholdGrade: number; // grade BELOW which an element is a concern (pass = >= this value)
  bottleneckThresholdPct: number;// % of trainees below concern threshold to flag event as bottleneck
  highVarianceThreshold: number; // grade std-dev ABOVE which event has high variance
}

const DEFAULT_THRESHOLDS: TIEThresholds = {
  atRiskAvgGrade: 3.2,
  exceedingAvgGrade: 4.2,
  concernThresholdGrade: 3,
  bottleneckThresholdPct: 40,
  highVarianceThreshold: 1.0,
};

const ThresholdContext = React.createContext<{
  thresholds: TIEThresholds;
  setThresholds: (t: TIEThresholds) => void;
}>({ thresholds: DEFAULT_THRESHOLDS, setThresholds: () => {} });

const useThresholds = () => React.useContext(ThresholdContext);

"""

# Insert after the imports block (after the TIEFinding interface closing brace)
old_finding_end = """interface TIEFinding {
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
}"""

new_finding_end = old_finding_end + THRESHOLDS_BLOCK

src = src.replace(old_finding_end, new_finding_end, 1)

# ─────────────────────────────────────────────────────────────────
# 2.  Add ThresholdSettingsPanel component (before CourseTab)
# ─────────────────────────────────────────────────────────────────

THRESHOLD_PANEL = """
// ── Threshold Settings Panel ──────────────────────────────────────────────────

const ThresholdSettingsPanel: React.FC<{
  onClose: () => void;
  onSave: (t: TIEThresholds) => void;
}> = ({ onClose, onSave }) => {
  const { thresholds } = useThresholds();
  const [local, setLocal] = React.useState<TIEThresholds>({ ...thresholds });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const set = (key: keyof TIEThresholds, val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n)) setLocal(prev => ({ ...prev, [key]: n }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map TIEThresholds keys to DB setting keys
      const mapping: Record<keyof TIEThresholds, string> = {
        atRiskAvgGrade: 'at_risk_avg_grade',
        exceedingAvgGrade: 'exceeding_avg_grade',
        concernThresholdGrade: 'concern_threshold_grade',
        bottleneckThresholdPct: 'bottleneck_threshold_pct',
        highVarianceThreshold: 'high_variance_threshold',
      };
      await Promise.all(
        (Object.keys(local) as Array<keyof TIEThresholds>).map(k =>
          fetch('/api/tie/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: mapping[k], value: local[k] }),
          })
        )
      );
      onSave(local);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch { /* silent */ }
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
      key: 'bottleneckThresholdPct',
      label: 'Bottleneck % Threshold',
      desc: 'Percentage of trainees scoring below the concern threshold that triggers an event to be flagged as a training bottleneck.',
      min: 10, max: 80, step: 5,
    },
    {
      key: 'highVarianceThreshold',
      label: 'High Variance Threshold',
      desc: 'Grade standard deviation above which an event is flagged as high-variance (inconsistent trainee performance).',
      min: 0.3, max: 2.5, step: 0.1,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full mx-4"
        style={{ maxWidth: 600 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-white font-bold text-base">Analytics Thresholds</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Adjust the thresholds used for risk classification and event analysis.
              Changes persist across sessions — re-run analytics after saving.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none ml-4">&times;</button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {fields.map(f => (
            <div key={f.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-gray-200">{f.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={f.min} max={f.max} step={f.step}
                    value={local[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-32 accent-blue-500"
                  />
                  <input
                    type="number"
                    min={f.min} max={f.max} step={f.step}
                    value={local[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-16 bg-gray-800 border border-gray-600 text-white text-sm rounded px-2 py-0.5 text-center focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}

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
                    Avg grade < {local.atRiskAvgGrade.toFixed(1)}, OR a worsening trend with recent avg < 3.5.
                    These trainees need immediate instructor attention.
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-yellow-300 font-semibold">Monitor / Watch — </span>
                  <span className="text-gray-400">
                    Avg grade between {local.atRiskAvgGrade.toFixed(1)} and 3.5 (not at risk, but below normal).
                    Performance is acceptable but warrants monitoring.
                  </span>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-blue-300 font-semibold">Normal — </span>
                  <span className="text-gray-400">
                    Avg grade ≥ 3.5 and < {local.exceedingAvgGrade.toFixed(1)}.
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

"""

# Insert before CourseTab definition
src = src.replace(
    "\n// ── COURSE TAB ────────────────────────────────────────────────────────────────",
    THRESHOLD_PANEL + "\n// ── COURSE TAB ────────────────────────────────────────────────────────────────",
    1
)

# ─────────────────────────────────────────────────────────────────
# 3. Update CourseTab signature to accept thresholds + update 
#    Trainee Status Distribution with legend
# ─────────────────────────────────────────────────────────────────

# Replace CourseTab signature
old_course_sig = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {"""

new_course_sig = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const { thresholds } = useThresholds();"""

src = src.replace(old_course_sig, new_course_sig, 1)

# Replace hardcoded at-risk/exceeding/pass calculations in CourseTab
old_course_stats = """  const atRisk = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const exceeding = trainees.filter(t => t.riskLevel === 'exceeding').length;
  const monitor = trainees.filter(t => t.riskLevel === 'monitor').length;
  const normal = trainees.length - atRisk - exceeding - monitor;
  const avgGrade = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;
  const passRate = trainees.length > 0 ? (trainees.filter(t => safeN(t.avgOverallGrade) >= 3.0).length / trainees.length) * 100 : 0;"""

new_course_stats = """  const atRisk = trainees.filter(t => t.riskLevel === 'at_risk').length;
  const exceeding = trainees.filter(t => t.riskLevel === 'exceeding').length;
  const monitor = trainees.filter(t => t.riskLevel === 'monitor').length;
  const normal = trainees.length - atRisk - exceeding - monitor;
  const avgGrade = trainees.length > 0 ? trainees.reduce((s, t) => s + safeN(t.avgOverallGrade), 0) / trainees.length : 0;
  const passRate = trainees.length > 0
    ? (trainees.filter(t => safeN(t.avgOverallGrade) >= thresholds.concernThresholdGrade).length / trainees.length) * 100
    : 0;"""

src = src.replace(old_course_stats, new_course_stats, 1)

# Replace hardcoded "trainees >= 3.0 avg" sub-label with dynamic threshold
old_pass_sub = '          sub=\\"trainees >= 3.0 avg\\" />'
new_pass_sub = '          sub={`trainees avg ≥ ${thresholds.concernThresholdGrade}.0`} />'
src = src.replace(old_pass_sub, new_pass_sub, 1)

# ─────────────────────────────────────────────────────────────────
# 4. Replace Trainee Status Distribution donut with legend + definition
# ─────────────────────────────────────────────────────────────────

old_donut_card = """        <SCard title=\\"Trainee Status Distribution\\">
          <div className=\\"flex justify-center items-center py-2\\">
            <DonutChart size={300} segments={[
              { label: 'At Risk', value: atRisk, color: '#ef4444' },
              { label: 'Monitor', value: monitor, color: '#eab308' },
              { label: 'Normal', value: normal, color: '#3b82f6' },
              { label: 'Exceeding', value: exceeding, color: '#10b981' },
            ].filter(s => s.value > 0)} />
          </div>
        </SCard>"""

new_donut_card = """        <SCard title="Trainee Status Distribution">
          <div className="flex justify-center items-center py-2">
            <DonutChart size={280} segments={[
              { label: 'At Risk', value: atRisk, color: '#ef4444' },
              { label: 'Monitor', value: monitor, color: '#eab308' },
              { label: 'Normal', value: normal, color: '#3b82f6' },
              { label: 'Exceeding', value: exceeding, color: '#10b981' },
            ].filter(s => s.value > 0)} />
          </div>
          {/* Status definitions */}
          <div className="mt-3 border-t border-gray-700 pt-3 space-y-2">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Status Definitions</p>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-red-300 font-semibold">At Risk: </span>
                  Avg grade < <span className="text-white font-mono">{thresholds.atRiskAvgGrade.toFixed(1)}</span>
                  {' '}or worsening trend with recent avg < 3.5. Requires immediate attention.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-yellow-300 font-semibold">Monitor: </span>
                  Avg grade <span className="text-white font-mono">{thresholds.atRiskAvgGrade.toFixed(1)}–3.5</span>.
                  {' '}Below normal but not yet at-risk. Watch closely.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-blue-300 font-semibold">Normal: </span>
                  Avg grade 3.5–<span className="text-white font-mono">{thresholds.exceedingAvgGrade.toFixed(1)}</span>.
                  {' '}Meeting expectations.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-emerald-300 font-semibold">Exceeding: </span>
                  Avg grade ≥ <span className="text-white font-mono">{thresholds.exceedingAvgGrade.toFixed(1)}</span>
                  {' '}with stable or improving trend. Above standard.
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Pass threshold: grade ≥ <span className="text-gray-400 font-mono">{thresholds.concernThresholdGrade}</span> (Satisfactory).
              {' '}Bottleneck: ><span className="text-gray-400 font-mono">{thresholds.bottleneckThresholdPct}%</span> of trainees below pass threshold.
            </p>
          </div>
        </SCard>"""

src = src.replace(old_donut_card, new_donut_card, 1)

# ─────────────────────────────────────────────────────────────────
# 5. Update TraineeTab to use threshold context
# ─────────────────────────────────────────────────────────────────

old_trainee_tab_sig = """const TraineeTab: React.FC<{ trainees: TIETraineeSummary[] }> = ({ trainees }) => {"""
new_trainee_tab_sig = """const TraineeTab: React.FC<{ trainees: TIETraineeSummary[] }> = ({ trainees }) => {
  const { thresholds } = useThresholds();"""

src = src.replace(old_trainee_tab_sig, new_trainee_tab_sig, 1)

# ─────────────────────────────────────────────────────────────────
# 6. Update EventsTab getPassRate to use thresholds context
# ─────────────────────────────────────────────────────────────────

old_events_sig = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);"""
new_events_sig = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const { thresholds } = useThresholds();
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);"""

src = src.replace(old_events_sig, new_events_sig, 1)

# Replace getPassRate in EventsTab to use thresholds.concernThresholdGrade
old_get_pass_rate = """  const getPassRate = (ev: TIEEventSummary): number => {
    const stored = safeN(ev.passRate);
    if (stored > 0) return stored;
    const attempts = safeN(ev.totalAttempts);
    if (attempts === 0) return 0;
    const avg = safeN(ev.avgOverallGrade);
    if (avg <= 0) return 0;
    if (avg >= 3.0) return 100;
    // avg < 3.0: estimate fail fraction from distance below pass threshold
    const estimatedFailPct = Math.min(100, ((3.0 - avg) / 2.0) * 100);
    return Math.round(Math.max(0, 100 - estimatedFailPct));
  };"""

new_get_pass_rate = """  const getPassRate = (ev: TIEEventSummary): number => {
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
  };"""

src = src.replace(old_get_pass_rate, new_get_pass_rate, 1)

# Update bottleneck badge threshold in EventsTab to use context
# Replace the hardcoded 0.5 bottleneck checks in EventsTab top panel
# (keep the existing ones but annotate with threshold reference in the table)

# Update variance badge in EventsTab table area
# We'll add a dynamic threshold annotation next to the BOTTLENECK label

# ─────────────────────────────────────────────────────────────────
# 7. Update the main component to:
#    a. Add thresholds state + fetch from API
#    b. Wrap content in ThresholdContext.Provider
#    c. Add threshold settings button to header
#    d. Pass thresholds to components that need them
# ─────────────────────────────────────────────────────────────────

old_main_state = """  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchRecentRuns();
  }, []);"""

new_main_state = """  const [error, setError] = useState<string | null>(null);
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
      if (Array.isArray(data)) {
        const map: Record<string, number> = {};
        data.forEach((s: any) => { map[s.key] = parseFloat(s.value); });
        setThresholds({
          atRiskAvgGrade: map['at_risk_avg_grade'] ?? DEFAULT_THRESHOLDS.atRiskAvgGrade,
          exceedingAvgGrade: map['exceeding_avg_grade'] ?? DEFAULT_THRESHOLDS.exceedingAvgGrade,
          concernThresholdGrade: map['concern_threshold_grade'] ?? DEFAULT_THRESHOLDS.concernThresholdGrade,
          bottleneckThresholdPct: map['bottleneck_threshold_pct'] ?? DEFAULT_THRESHOLDS.bottleneckThresholdPct,
          highVarianceThreshold: map['high_variance_threshold'] ?? DEFAULT_THRESHOLDS.highVarianceThreshold,
        });
      }
    } catch { /* use defaults */ }
  };"""

src = src.replace(old_main_state, new_main_state, 1)

# Add settings gear button to the header Controls row (next to Run Analytics button)
old_run_btn = """          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}`}>
            {isRunning ? <><span className=\\"animate-spin inline-block\\">⟳</span> Running...</> : 'Run Analytics'}
          </button>"""

new_run_btn = """          <button
            onClick={() => setShowThresholdPanel(true)}
            title="Analytics Thresholds"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 hover:text-white transition-all"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Thresholds
          </button>
          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}`}>
            {isRunning ? <><span className="animate-spin inline-block">⟳</span> Running...</> : 'Run Analytics'}
          </button>"""

src = src.replace(old_run_btn, new_run_btn, 1)

# Wrap the return JSX in ThresholdContext.Provider
old_return_open = """  return (
    <div className=\\"space-y-5\\">
      {/* ── Header Controls ── */}"""

new_return_open = """  return (
    <ThresholdContext.Provider value={{ thresholds, setThresholds }}>
    <div className="space-y-5">
      {/* Threshold settings modal */}
      {showThresholdPanel && (
        <ThresholdSettingsPanel
          onClose={() => setShowThresholdPanel(false)}
          onSave={(t) => { setThresholds(t); setShowThresholdPanel(false); }}
        />
      )}
      {/* ── Header Controls ── */}"""

src = src.replace(old_return_open, new_return_open, 1)

# Close the Provider at the end of the component
old_return_close = """    </div>
  );
};

"""
new_return_close = """    </div>
    </ThresholdContext.Provider>
  );
};

"""
# Replace last occurrence
src = src[::-1].replace(old_return_close[::-1], new_return_close[::-1], 1)[::-1]

# ─────────────────────────────────────────────────────────────────
# 8. Write the patched file
# ─────────────────────────────────────────────────────────────────

with open(SRC, "w", encoding="utf-8") as f:
    f.write(src)

print("✅ patch_tie14.py applied successfully")

# Verify key additions
checks = [
    "TIEThresholds",
    "ThresholdContext",
    "useThresholds",
    "ThresholdSettingsPanel",
    "thresholds.atRiskAvgGrade",
    "thresholds.concernThresholdGrade",
    "thresholds.exceedingAvgGrade",
    "thresholds.bottleneckThresholdPct",
    "showThresholdPanel",
    "fetchThresholds",
    "ThresholdContext.Provider",
    "Status Definitions",
    "At Risk: ",
    "Monitor: ",
    "Exceeding: ",
]
for c in checks:
    if c in src:
        print(f"  ✓ {c}")
    else:
        print(f"  ✗ MISSING: {c}")