import re

# ── TSX patch ──────────────────────────────────────────────────────────────
with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: Fix passRate in EventsTab — derive from bottleneckScore when null/0
# Add a safePassRate helper used when rendering passRate values
# ─────────────────────────────────────────────────────────────────────────────
# The safeN helper already exists. We need to add a derived passRate helper
# that uses bottleneckScore as fallback.
# We'll add it right after the EventsTab state declarations.

old_events_tab_state = """  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);
  const [chartModal, setChartModal] = useState<{ title: string; data: { label: string; value: number; color: string }[]; max: number } | null>(null);"""

new_events_tab_state = """  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);
  const [chartModal, setChartModal] = useState<{ title: string; data: { label: string; value: number; color: string }[]; max: number } | null>(null);

  // Derive passRate from bottleneckScore when DB value is null/0
  // bottleneckScore = fraction of attempts AT or BELOW concern threshold (fail)
  // so passRate = (1 - bottleneckScore) * 100
  const getPassRate = (ev: TIEEventSummary): number => {
    const stored = safeN(ev.passRate);
    if (stored > 0) return stored;
    // Fallback: derive from bottleneckScore
    const bs = safeN(ev.bottleneckScore);
    if (safeN(ev.totalAttempts) > 0) {
      return Math.round((1 - bs) * 100);
    }
    return 0;
  };"""

assert old_events_tab_state in src, "CHANGE 1: old_events_tab_state not found"
src = src.replace(old_events_tab_state, new_events_tab_state, 1)
print("✓ CHANGE 1: getPassRate() helper added to EventsTab")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Fix Pass Rate chart data to use getPassRate() instead of safeN(ev.passRate)
# There are two places: the click handler and the inline chart
# ─────────────────────────────────────────────────────────────────────────────
old_passrate_click = """              onClick={() => {
                const data = [...events].sort((a, b) => safeN(a.passRate) - safeN(b.passRate)).map(ev => ({
                  label: ev.eventCode,
                  value: safeN(ev.passRate),
                  color: safeN(ev.passRate) >= 80 ? '#10b981' : safeN(ev.passRate) >= 60 ? '#eab308' : '#ef4444',
                }));
                setChartModal({ title: 'Pass Rate by Event (%)', data, max: 100 });
              }}>"""

new_passrate_click = """              onClick={() => {
                const data = [...events].sort((a, b) => getPassRate(a) - getPassRate(b)).map(ev => ({
                  label: ev.eventCode,
                  value: getPassRate(ev),
                  color: getPassRate(ev) >= 80 ? '#10b981' : getPassRate(ev) >= 60 ? '#eab308' : '#ef4444',
                }));
                setChartModal({ title: 'Pass Rate by Event (%)', data, max: 100 });
              }}>"""

assert old_passrate_click in src, "CHANGE 2a: old_passrate_click not found"
src = src.replace(old_passrate_click, new_passrate_click, 1)
print("✓ CHANGE 2a: Pass Rate click handler uses getPassRate()")

old_passrate_inline = """                  <ColChart
                    data={[...events].sort((a, b) => safeN(a.passRate) - safeN(b.passRate)).map(ev => ({
                      label: ev.eventCode,
                      value: safeN(ev.passRate),
                      color: safeN(ev.passRate) >= 80 ? '#10b981' : safeN(ev.passRate) >= 60 ? '#eab308' : '#ef4444',
                    }))}
                    max={100} height={120} />"""

new_passrate_inline = """                  <ColChart
                    data={[...events].sort((a, b) => getPassRate(a) - getPassRate(b)).map(ev => ({
                      label: ev.eventCode,
                      value: getPassRate(ev),
                      color: getPassRate(ev) >= 80 ? '#10b981' : getPassRate(ev) >= 60 ? '#eab308' : '#ef4444',
                    }))}
                    max={100} height={120} />"""

assert old_passrate_inline in src, "CHANGE 2b: old_passrate_inline not found"
src = src.replace(old_passrate_inline, new_passrate_inline, 1)
print("✓ CHANGE 2b: Pass Rate inline chart uses getPassRate()")

# Also fix the table display of passRate
old_passrate_table = """                    <td className={`px-3 py-2.5 text-center text-xs font-medium ${safeN(ev.passRate) >= 80 ? 'text-emerald-400' : safeN(ev.passRate) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {safe(ev.passRate, 0)}%"""

new_passrate_table = """                    <td className={`px-3 py-2.5 text-center text-xs font-medium ${getPassRate(ev) >= 80 ? 'text-emerald-400' : getPassRate(ev) >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {getPassRate(ev).toFixed(0)}%"""

assert old_passrate_table in src, "CHANGE 2c: old_passrate_table not found"
src = src.replace(old_passrate_table, new_passrate_table, 1)
print("✓ CHANGE 2c: Pass Rate table cell uses getPassRate()")

# Fix the selected event detail panel
old_passrate_detail = """                  <span>Pass Rate: <span className={safeN(selected.passRate) >= 80 ? 'text-emerald-400' : 'text-yellow-400'}>{safe(selected.passRate, 0)}%</span></span>"""

new_passrate_detail = """                  <span>Pass Rate: <span className={getPassRate(selected) >= 80 ? 'text-emerald-400' : 'text-yellow-400'}>{getPassRate(selected).toFixed(0)}%</span></span>"""

assert old_passrate_detail in src, "CHANGE 2d: old_passrate_detail not found"
src = src.replace(old_passrate_detail, new_passrate_detail, 1)
print("✓ CHANGE 2d: Selected event detail panel uses getPassRate()")

# Also fix the skill weakness table passRate column
old_passrate_skill = """                              {safe(ev.passRate, 0)}%"""
new_passrate_skill = """                              {getPassRate(ev).toFixed(0)}%"""

if old_passrate_skill in src:
    src = src.replace(old_passrate_skill, new_passrate_skill, 1)
    print("✓ CHANGE 2e: Skill weakness table uses getPassRate()")
else:
    print("  CHANGE 2e: skill table passRate not found (skipping)")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: Add click-to-expand modal for Event Average Scores in CourseTab
# ─────────────────────────────────────────────────────────────────────────────
# Need to add state to CourseTab and wrap the chart

old_course_tab_open = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const atRisk = trainees.filter(t => t.riskLevel === 'at_risk').length;"""

new_course_tab_open = """const CourseTab: React.FC<{
  summary: TIECourseSummary;
  trainees: TIETraineeSummary[];
  events: TIEEventSummary[];
}> = ({ summary, trainees, events }) => {
  const [eventAvgExpanded, setEventAvgExpanded] = useState(false);
  const atRisk = trainees.filter(t => t.riskLevel === 'at_risk').length;"""

assert old_course_tab_open in src, "CHANGE 3a: old_course_tab_open not found"
src = src.replace(old_course_tab_open, new_course_tab_open, 1)
print("✓ CHANGE 3a: eventAvgExpanded state added to CourseTab")

# Replace the Event Average Scores card with clickable + modal version
old_event_avg_card = """      {/* Row 3: Event avg bar chart */}
      {topByAttempts.length > 0 && (
        <SCard title="Event Average Scores (Top 12 by Attempts)">
          <div className="overflow-x-auto">
            <ColChart data={topByAttempts.map(ev => ({ label: ev.eventCode, value: safeN(ev.avgOverallGrade) }))} max={5} height={130} />
          </div>
        </SCard>
      )}"""

new_event_avg_card = """      {/* Row 3: Event avg bar chart — click to expand */}
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
                    max={5} height={420} />
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
      )}"""

assert old_event_avg_card in src, "CHANGE 3b: old_event_avg_card not found"
src = src.replace(old_event_avg_card, new_event_avg_card, 1)
print("✓ CHANGE 3b: Event Average Scores card now click-to-expand with ColChartExpanded modal")

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(src)

print()

# ── TIE engine patch — fix ON CONFLICT to UPSERT passRate ──────────────────
with open('DFP-NEO-V2-fresh/tie-engine.cjs', 'r') as f:
    eng = f.read()

# Change ON CONFLICT DO NOTHING -> ON CONFLICT (id) DO UPDATE for TIEEventSummary INSERT
old_conflict = """        ON CONFLICT DO NOTHING
      `, evtSumId, runId, eventCode, courseName, grades.length,
         Number(avgGrade), Number(variance),
         JSON.stringify(weakEls), JSON.stringify(strongEls),
         JSON.stringify(negTagsEvt), JSON.stringify(posTagsEvt),
         Number(difficultyScore), Number(bottleneckScore), Boolean(isOverService), Number(differentiationScore),
         narrative, Number(passRate)
      );"""

new_conflict = """        ON CONFLICT (id) DO UPDATE SET
          "avgOverallGrade" = EXCLUDED."avgOverallGrade",
          "gradeVariance" = EXCLUDED."gradeVariance",
          "totalAttempts" = EXCLUDED."totalAttempts",
          "passRate" = EXCLUDED."passRate",
          "weakElementsByAvg" = EXCLUDED."weakElementsByAvg",
          "strongElementsByAvg" = EXCLUDED."strongElementsByAvg",
          "dominantNegativeTags" = EXCLUDED."dominantNegativeTags",
          "dominantPositiveTags" = EXCLUDED."dominantPositiveTags",
          "difficultyScore" = EXCLUDED."difficultyScore",
          "bottleneckScore" = EXCLUDED."bottleneckScore",
          "overServiceIndicator" = EXCLUDED."overServiceIndicator",
          "differentiationScore" = EXCLUDED."differentiationScore",
          "narrativeSummary" = EXCLUDED."narrativeSummary"
      `, evtSumId, runId, eventCode, courseName, grades.length,
         Number(avgGrade), Number(variance),
         JSON.stringify(weakEls), JSON.stringify(strongEls),
         JSON.stringify(negTagsEvt), JSON.stringify(posTagsEvt),
         Number(difficultyScore), Number(bottleneckScore), Boolean(isOverService), Number(differentiationScore),
         narrative, Number(passRate)
      );"""

assert old_conflict in eng, "ENGINE CHANGE: old_conflict not found"
eng = eng.replace(old_conflict, new_conflict, 1)
print("✓ ENGINE: ON CONFLICT DO NOTHING → UPSERT with passRate update")

with open('DFP-NEO-V2-fresh/tie-engine.cjs', 'w') as f:
    f.write(eng)

print("\n✅ All changes applied successfully!")