import re

with open('components/tabs/TrainingIntelligenceTab.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

original_len = len(src)

# ─────────────────────────────────────────────────────────────────
# PATCH 1: Replace the entire EventsTab component with enhanced version
# that includes Top 5 Struggle / Top 5 Excel click panels
# ─────────────────────────────────────────────────────────────────

old_events_tab_start = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);"""

new_events_tab_start = """const EventsTab: React.FC<{ events: TIEEventSummary[] }> = ({ events }) => {
  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);"""

if old_events_tab_start in src:
    src = src.replace(old_events_tab_start, new_events_tab_start)
    print("Patch 1 (add state vars) OK")
else:
    print("Patch 1 FAILED")
    idx = src.find("const EventsTab")
    print("  Context:", repr(src[idx:idx+200]))

# ─────────────────────────────────────────────────────────────────
# PATCH 2: Add top5Struggle and top5Excel computed arrays after existing hardest/easiest
# ─────────────────────────────────────────────────────────────────

old_after_reduce = """  const hardest = events.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, events[0]);
  const easiest = events.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, events[0]);
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);"""

new_after_reduce = """  const hardest = events.reduce((h, ev) => safeN(ev.avgOverallGrade) < safeN(h.avgOverallGrade) ? ev : h, events[0]);
  const easiest = events.reduce((e, ev) => safeN(ev.avgOverallGrade) > safeN(e.avgOverallGrade) ? ev : e, events[0]);
  const mostAttempts = events.reduce((m, ev) => safeN(ev.totalAttempts) > safeN(m.totalAttempts) ? ev : m, events[0]);
  const mostVariable = events.reduce((m, ev) => safeN(ev.gradeVariance) > safeN(m.gradeVariance) ? ev : m, events[0]);

  // Top 5 events trainees struggle with (lowest avg grade, min 2 attempts)
  const top5Struggle = [...events]
    .filter(ev => safeN(ev.totalAttempts) >= 2 && safeN(ev.avgOverallGrade) > 0)
    .sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade))
    .slice(0, 5);

  // Top 5 events trainees excel at (highest avg grade, min 2 attempts)
  const top5Excel = [...events]
    .filter(ev => safeN(ev.totalAttempts) >= 2 && safeN(ev.avgOverallGrade) > 0)
    .sort((a, b) => safeN(b.avgOverallGrade) - safeN(a.avgOverallGrade))
    .slice(0, 5);"""

if old_after_reduce in src:
    src = src.replace(old_after_reduce, new_after_reduce)
    print("Patch 2 (top5 arrays) OK")
else:
    print("Patch 2 FAILED")

# ─────────────────────────────────────────────────────────────────
# PATCH 3: Add Top 5 panels BEFORE the main table section
# Insert after the KPI tiles grid
# ─────────────────────────────────────────────────────────────────

old_after_kpi = """      <div className="flex gap-4">
        {/* Table */}
        <div className="flex-1 min-w-0">"""

new_after_kpi = """      {/* ── Top 5 Struggle / Excel Panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top 5 Struggle */}
        <div className="bg-gray-800 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
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
                        {safeN(ev.bottleneckScore) > 0.5 && (
                          <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">BOTTLENECK</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade))}`}>
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
                          {ev.narrativeSummary || `${ev.eventCode} has a mean grade of ${safe(ev.avgOverallGrade, 2)} across ${ev.totalAttempts} assessments, placing it among the most challenging events in this course.${safeN(ev.bottleneckScore) > 0.5 ? ` It is classified as a training bottleneck — a high proportion of trainees are scoring below the satisfactory threshold.` : ''} ${safeN(ev.gradeVariance) > 1 ? `The high grade variance (${safe(ev.gradeVariance, 2)}) indicates inconsistent performance, suggesting the event exposes gaps in preparation or foundational skills.` : ''}`}
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
                                    <span className={`text-sm font-bold font-mono ${gradeColor(elAvg)}`}>{safe(elAvg, 2)}</span>
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
                          <p className={`text-base font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade))}`}>{safe(ev.avgOverallGrade, 2)}</p>
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
            <span className="text-lg">🏆</span>
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
                        <span className={`text-lg font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade))}`}>
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
                          {ev.narrativeSummary || `${ev.eventCode} has a mean grade of ${safe(ev.avgOverallGrade, 2)} across ${ev.totalAttempts} assessments, making it one of the strongest-performing events in this course.${ev.overServiceIndicator ? ` This event shows signs of being over-serviced — trainees consistently perform at or near mastery before reaching it, which may indicate that preceding training adequately prepares them or that the event itself is not sufficiently challenging.` : ''} ${safeN(ev.gradeVariance) < 0.5 ? `The low grade variance (${safe(ev.gradeVariance, 2)}) shows consistent high performance across the cohort.` : ''}`}
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
                                    <span className={`text-sm font-bold font-mono ${gradeColor(elAvg)}`}>{safe(elAvg, 2)}</span>
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
                          <p className={`text-base font-bold font-mono ${gradeColor(safeN(ev.avgOverallGrade))}`}>{safe(ev.avgOverallGrade, 2)}</p>
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
        <div className="flex-1 min-w-0">"""

if old_after_kpi in src:
    src = src.replace(old_after_kpi, new_after_kpi)
    print("Patch 3 (Top 5 panels) OK")
else:
    print("Patch 3 FAILED")
    idx = src.find('flex gap-4')
    print("  Context:", repr(src[idx:idx+100]))

print(f"\nOriginal length: {original_len}, New length: {len(src)}, Delta: {len(src)-original_len}")

with open('components/tabs/TrainingIntelligenceTab.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
print("File written OK")