#!/usr/bin/env python3
"""patch_tie14b.py - Apply threshold UI to TrainingIntelligenceTab.tsx"""

SRC = "components/tabs/TrainingIntelligenceTab.tsx"

with open(SRC, "r", encoding="utf-8") as f:
    src = f.read()

original_len = len(src)

# ─────────────────────────────────────────────────────────────────
# 1. Insert TIEThresholds types + context after TIEFinding interface
# ─────────────────────────────────────────────────────────────────

FINDING_CLOSE = """}

// ── Helpers"""

THRESHOLDS_INSERT = """}

// ── TIE Threshold configuration ──────────────────────────────────────────────

interface TIEThresholds {
  atRiskAvgGrade: number;        // avg grade BELOW which trainee is at-risk
  exceedingAvgGrade: number;     // avg grade ABOVE which trainee is exceeding
  concernThresholdGrade: number; // grade value where >= is PASS (default 3 = Satisfactory)
  bottleneckThresholdPct: number;// % of trainees below concern threshold to flag bottleneck
  highVarianceThreshold: number; // grade std-dev above which event has high variance
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

// ── Helpers"""

if FINDING_CLOSE in src:
    src = src.replace(FINDING_CLOSE, THRESHOLDS_INSERT, 1)
    print("✓ TIEThresholds + context inserted")
else:
    print("✗ FINDING_CLOSE not found")

# ─────────────────────────────────────────────────────────────────
# 2. Insert ThresholdSettingsPanel component before CourseTab
# ─────────────────────────────────────────────────────────────────

COURSE_TAB_MARKER = "\n// ── COURSE TAB"

THRESHOLD_PANEL = """
// ── Threshold Settings Panel ─────────────────────────────────────────────────

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
      desc: 'Average grade BELOW which a trainee is classified as At-Risk. Only grades 1 (Unsatisfactory) or 2 (Below Standard) count as failures.',
      min: 1.0, max: 4.5, step: 0.1,
    },
    {
      key: 'exceedingAvgGrade',
      label: 'Exceeding Threshold',
      desc: 'Average grade ABOVE which a trainee is classified as Exceeding (high performer).',
      min: 3.0, max: 5.0, step: 0.1,
    },
    {
      key: 'concernThresholdGrade',
      label: 'Pass / Concern Grade',
      desc: 'Grade at-or-above which an assessment is a PASS. Grade 3 = Satisfactory = Pass on the 1-5 scale. Only grades 1 or 2 are failures.',
      min: 1, max: 4, step: 1,
    },
    {
      key: 'bottleneckThresholdPct',
      label: 'Bottleneck % Threshold',
      desc: 'Percentage of trainees scoring below the pass grade that causes an event to be flagged as a training bottleneck.',
      min: 10, max: 80, step: 5,
    },
    {
      key: 'highVarianceThreshold',
      label: 'High Variance Threshold',
      desc: 'Grade standard deviation above which an event is flagged as high-variance (inconsistent trainee performance across the cohort).',
      min: 0.3, max: 2.5, step: 0.1,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full mx-4"
        style={{ maxWidth: 620 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h3 className="text-white font-bold text-base">Analytics Thresholds</h3>
            <p className="text-gray-400 text-xs mt-0.5">
              Adjust risk classification and event analysis thresholds.
              Re-run analytics after saving for changes to take effect.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none ml-4">&times;</button>
        </div>

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
                    className="w-28 accent-blue-500"
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

          {/* Live status legend */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <h4 className="text-gray-300 font-semibold text-xs uppercase tracking-wide mb-3">
              How Trainee Status Is Determined (live preview)
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-red-300 font-semibold">At Risk — </span>
                  Avg grade < <span className="text-white font-mono">{local.atRiskAvgGrade.toFixed(1)}</span>,
                  OR a worsening trend with recent avg < 3.5. Needs immediate instructor attention.
                </span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-yellow-300 font-semibold">Monitor — </span>
                  Avg grade {local.atRiskAvgGrade.toFixed(1)}–3.5.
                  Not at-risk but below normal. Watch closely.
                </span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-blue-300 font-semibold">Normal — </span>
                  Avg grade 3.5–<span className="text-white font-mono">{local.exceedingAvgGrade.toFixed(1)}</span>.
                  Meeting expectations satisfactorily.
                </span>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-emerald-300 font-semibold">Exceeding — </span>
                  Avg grade ≥ <span className="text-white font-mono">{local.exceedingAvgGrade.toFixed(1)}</span> with
                  stable or improving trend. Performing above standard.
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
              <span className="text-gray-400 font-semibold">Pass grade: </span>
              ≥ {local.concernThresholdGrade} (Satisfactory or above on 1–5 scale). Only grades 1 or 2 are failures.
              <br />
              <span className="text-gray-400 font-semibold">Bottleneck: </span>
              event where >{local.bottleneckThresholdPct}% of trainees score below grade {local.concernThresholdGrade}.
              <br />
              <span className="text-gray-400 font-semibold">High variance: </span>
              event where grade std-dev > {local.highVarianceThreshold.toFixed(1)} (inconsistent cohort performance).
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <p className="text-gray-500 text-xs">Changes apply after re-running analytics</p>
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

if COURSE_TAB_MARKER in src:
    src = src.replace(COURSE_TAB_MARKER, THRESHOLD_PANEL + COURSE_TAB_MARKER, 1)
    print("✓ ThresholdSettingsPanel inserted")
else:
    print("✗ COURSE_TAB_MARKER not found")
    idx = src.find("COURSE TAB")
    print("  Found 'COURSE TAB' at:", idx)
    print("  Context:", repr(src[idx-5:idx+30]))

# ─────────────────────────────────────────────────────────────────
# 3. Add useThresholds() to CourseTab
# ─────────────────────────────────────────────────────────────────

OLD_COURSE_OPEN = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const [eventAvgExpanded, setEventAvgExpanded] = useState(false);"""

NEW_COURSE_OPEN = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const { thresholds } = useThresholds();
  const [eventAvgExpanded, setEventAvgExpanded] = useState(false);"""

if OLD_COURSE_OPEN in src:
    src = src.replace(OLD_COURSE_OPEN, NEW_COURSE_OPEN, 1)
    print("✓ CourseTab: useThresholds added")
else:
    print("✗ CourseTab open not found")

# ─────────────────────────────────────────────────────────────────
# 4. Fix passRate calc in CourseTab to use thresholds
# ─────────────────────────────────────────────────────────────────

OLD_PASS_RATE = "  const passRate = trainees.length > 0 ? (trainees.filter(t => safeN(t.avgOverallGrade) >= 3.0).length / trainees.length) * 100 : 0;"
NEW_PASS_RATE = "  const passRate = trainees.length > 0 ? (trainees.filter(t => safeN(t.avgOverallGrade) >= thresholds.concernThresholdGrade).length / trainees.length) * 100 : 0;"

if OLD_PASS_RATE in src:
    src = src.replace(OLD_PASS_RATE, NEW_PASS_RATE, 1)
    print("✓ CourseTab: passRate uses thresholds.concernThresholdGrade")
else:
    print("✗ passRate line not found")

# ─────────────────────────────────────────────────────────────────
# 5. Fix "trainees >= 3.0 avg" sub-label
# ─────────────────────────────────────────────────────────────────

OLD_PASS_SUB = '          sub="trainees >= 3.0 avg" />'
NEW_PASS_SUB = '          sub={`trainees avg ≥ ${thresholds.concernThresholdGrade}.0`} />'

if OLD_PASS_SUB in src:
    src = src.replace(OLD_PASS_SUB, NEW_PASS_SUB, 1)
    print("✓ PassRate sub-label updated")
else:
    print("✗ PassRate sub-label not found - trying alternate")
    # Try finding it differently
    idx = src.find("trainees >= 3.0 avg")
    if idx >= 0:
        print("  Found at:", idx, repr(src[idx-30:idx+50]))
    else:
        print("  Not found at all")

# ─────────────────────────────────────────────────────────────────
# 6. Replace Trainee Status Distribution donut card
# ─────────────────────────────────────────────────────────────────

OLD_DONUT = """        <SCard title="Trainee Status Distribution">
          <div className="flex justify-center items-center py-2">
            <DonutChart size={300} segments={[
              { label: 'At Risk', value: atRisk, color: '#ef4444' },
              { label: 'Monitor', value: monitor, color: '#eab308' },
              { label: 'Normal', value: normal, color: '#3b82f6' },
              { label: 'Exceeding', value: exceeding, color: '#10b981' },
            ].filter(s => s.value > 0)} />
          </div>
        </SCard>"""

NEW_DONUT = """        <SCard title="Trainee Status Distribution">
          <div className="flex justify-center items-center py-2">
            <DonutChart size={260} segments={[
              { label: 'At Risk', value: atRisk, color: '#ef4444' },
              { label: 'Monitor', value: monitor, color: '#eab308' },
              { label: 'Normal', value: normal, color: '#3b82f6' },
              { label: 'Exceeding', value: exceeding, color: '#10b981' },
            ].filter(s => s.value > 0)} />
          </div>
          {/* Status definitions */}
          <div className="mt-3 border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Status Definitions</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-red-300 font-semibold">At Risk: </span>
                  Avg grade < <span className="text-white font-mono">{thresholds.atRiskAvgGrade.toFixed(1)}</span>
                  {' '}or worsening trend with recent avg < 3.5. Requires immediate attention.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-yellow-300 font-semibold">Monitor: </span>
                  Avg grade <span className="text-white font-mono">{thresholds.atRiskAvgGrade.toFixed(1)}–3.5</span>.
                  {' '}Below normal — watch closely.
                </span>
              </div>
              <div className="flex gap-2 items-start">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">
                  <span className="text-blue-300 font-semibold">Normal: </span>
                  Avg grade 3.5–<span className="text-white font-mono">{thresholds.exceedingAvgGrade.toFixed(1)}</span>.
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
              {' '}Bottleneck = ><span className="text-gray-400 font-mono">{thresholds.bottleneckThresholdPct}%</span> trainees below pass grade.
            </p>
          </div>
        </SCard>"""

if OLD_DONUT in src:
    src = src.replace(OLD_DONUT, NEW_DONUT, 1)
    print("✓ Donut card replaced with status definitions")
else:
    print("✗ Old donut not found - searching...")
    idx = src.find("Trainee Status Distribution")
    print("  Context:", repr(src[idx:idx+400]))

# ─────────────────────────────────────────────────────────────────
# 7. Add useThresholds to TraineeTab
# ─────────────────────────────────────────────────────────────────

OLD_TRAINEE_OPEN = "const TraineeTab: React.FC<{ trainees: TIETraineeSummary[] }> = ({ trainees }) => {"
NEW_TRAINEE_OPEN = """const TraineeTab: React.FC<{ trainees: TIETraineeSummary[] }> = ({ trainees }) => {
  const { thresholds: _thresholds } = useThresholds(); // available for future threshold-aware rendering"""

if OLD_TRAINEE_OPEN in src:
    src = src.replace(OLD_TRAINEE_OPEN, NEW_TRAINEE_OPEN, 1)
    print("✓ TraineeTab: useThresholds added")
else:
    print("✗ TraineeTab open not found")

# ─────────────────────────────────────────────────────────────────
# 8. Add useThresholds to EventsTab + update getPassRate
# ─────────────────────────────────────────────────────────────────

OLD_EVENTS_OPEN = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);"""

NEW_EVENTS_OPEN = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const { thresholds } = useThresholds();
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);"""

if OLD_EVENTS_OPEN in src:
    src = src.replace(OLD_EVENTS_OPEN, NEW_EVENTS_OPEN, 1)
    print("✓ EventsTab: useThresholds added")
else:
    print("✗ EventsTab open not found")

# Update getPassRate to use thresholds.concernThresholdGrade
OLD_GETPASSRATE = """    if (avg >= 3.0) return 100;
    // avg < 3.0: estimate fail fraction from distance below pass threshold
    const estimatedFailPct = Math.min(100, ((3.0 - avg) / 2.0) * 100);"""

NEW_GETPASSRATE = """    const passThreshold = thresholds.concernThresholdGrade;
    if (avg >= passThreshold) return 100;
    // avg < passThreshold: estimate fail fraction from distance below pass threshold
    const estimatedFailPct = Math.min(100, ((passThreshold - avg) / (passThreshold - 1)) * 100);"""

if OLD_GETPASSRATE in src:
    src = src.replace(OLD_GETPASSRATE, NEW_GETPASSRATE, 1)
    print("✓ EventsTab: getPassRate uses thresholds.concernThresholdGrade")
else:
    print("✗ getPassRate internals not found")

# ─────────────────────────────────────────────────────────────────
# 9. Add thresholds state + fetchThresholds to main component
# ─────────────────────────────────────────────────────────────────

OLD_MAIN_STATE = """  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchCourses();
    fetchRecentRuns();
  }, []);"""

NEW_MAIN_STATE = """  const [error, setError] = useState<string | null>(null);
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
          atRiskAvgGrade:        map['at_risk_avg_grade']        ?? DEFAULT_THRESHOLDS.atRiskAvgGrade,
          exceedingAvgGrade:     map['exceeding_avg_grade']      ?? DEFAULT_THRESHOLDS.exceedingAvgGrade,
          concernThresholdGrade: map['concern_threshold_grade']  ?? DEFAULT_THRESHOLDS.concernThresholdGrade,
          bottleneckThresholdPct:map['bottleneck_threshold_pct'] ?? DEFAULT_THRESHOLDS.bottleneckThresholdPct,
          highVarianceThreshold: map['high_variance_threshold']  ?? DEFAULT_THRESHOLDS.highVarianceThreshold,
        });
      }
    } catch { /* use defaults */ }
  };"""

if OLD_MAIN_STATE in src:
    src = src.replace(OLD_MAIN_STATE, NEW_MAIN_STATE, 1)
    print("✓ Main component: thresholds state + fetchThresholds added")
else:
    print("✗ Main component state block not found")

# ─────────────────────────────────────────────────────────────────
# 10. Add Thresholds button to header (before Run Analytics)
# ─────────────────────────────────────────────────────────────────

OLD_RUN_BTN = """          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}`}>
            {isRunning ? <><span className="animate-spin inline-block">⟳</span> Running...</> : 'Run Analytics'}
          </button>"""

NEW_RUN_BTN = """          <button
            onClick={() => setShowThresholdPanel(true)}
            title="Configure analytics thresholds"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 hover:text-white transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" className="flex-shrink-0">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Thresholds
          </button>
          <button onClick={handleRunAnalytics} disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${isRunning ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}`}>
            {isRunning ? <><span className="animate-spin inline-block">⟳</span> Running...</> : 'Run Analytics'}
          </button>"""

if OLD_RUN_BTN in src:
    src = src.replace(OLD_RUN_BTN, NEW_RUN_BTN, 1)
    print("✓ Thresholds button added to header")
else:
    print("✗ Run Analytics button not found - searching...")
    idx = src.find("Run Analytics")
    print("  Context:", repr(src[max(0,idx-200):idx+50]))

# ─────────────────────────────────────────────────────────────────
# 11. Wrap main return in ThresholdContext.Provider
# ─────────────────────────────────────────────────────────────────

OLD_RETURN_OPEN = """  return (
    <div className="space-y-5">
      {/* ── Header Controls ── */}"""

NEW_RETURN_OPEN = """  return (
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

if OLD_RETURN_OPEN in src:
    src = src.replace(OLD_RETURN_OPEN, NEW_RETURN_OPEN, 1)
    print("✓ ThresholdContext.Provider wraps main return")
else:
    print("✗ Main return open not found")
    idx = src.find("Header Controls")
    print("  Context:", repr(src[max(0,idx-80):idx+50]))

# ─────────────────────────────────────────────────────────────────
# 12. Close the Provider before component end
# ─────────────────────────────────────────────────────────────────

# Find the last `    </div>\n  );\n};` in the file and add Provider close
OLD_CLOSE = "    </div>\n  );\n};\n\n"
NEW_CLOSE = "    </div>\n    </ThresholdContext.Provider>\n  );\n};\n\n"

# Replace the last occurrence
last_idx = src.rfind(OLD_CLOSE)
if last_idx >= 0:
    src = src[:last_idx] + NEW_CLOSE + src[last_idx + len(OLD_CLOSE):]
    print("✓ ThresholdContext.Provider closing tag added")
else:
    print("✗ Could not find component closing pattern")

# ─────────────────────────────────────────────────────────────────
# Write out
# ─────────────────────────────────────────────────────────────────
with open(SRC, "w", encoding="utf-8") as f:
    f.write(src)

print(f"\n✅ Done. Length: {original_len} → {len(src)} chars")

# Verify
checks = [
    ("TIEThresholds interface", "interface TIEThresholds {"),
    ("ThresholdContext", "const ThresholdContext = React.createContext"),
    ("useThresholds hook", "const useThresholds = () =>"),
    ("ThresholdSettingsPanel", "const ThresholdSettingsPanel"),
    ("thresholds.atRiskAvgGrade in donut", "thresholds.atRiskAvgGrade.toFixed"),
    ("thresholds.exceedingAvgGrade in donut", "thresholds.exceedingAvgGrade.toFixed"),
    ("thresholds.bottleneckThresholdPct in donut", "thresholds.bottleneckThresholdPct"),
    ("Status Definitions heading", "Status Definitions"),
    ("At Risk definition", "At Risk: </span>"),
    ("Monitor definition", "Monitor: </span>"),
    ("Exceeding definition", "Exceeding: </span>"),
    ("showThresholdPanel state", "showThresholdPanel"),
    ("fetchThresholds fn", "const fetchThresholds = async"),
    ("ThresholdContext.Provider", "ThresholdContext.Provider"),
    ("Thresholds button", "Configure analytics thresholds"),
    ("getPassRate uses passThreshold", "const passThreshold = thresholds.concernThresholdGrade"),
]
print("\nVerification:")
all_ok = True
for label, check in checks:
    ok = check in src
    print(f"  {'✓' if ok else '✗'} {label}")
    if not ok:
        all_ok = False
print(f"\n{'ALL OK ✓' if all_ok else 'SOME CHECKS FAILED ✗'}")