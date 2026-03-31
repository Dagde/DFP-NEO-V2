import re

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: Add chartModal state to EventsTab
# ─────────────────────────────────────────────────────────────────────────────
old_events_state = """  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);"""

new_events_state = """  const [selected, setSelected] = useState<TIEEventSummary | null>(null);
  const [sortKey, setSortKey] = useState<keyof TIEEventSummary>('avgOverallGrade');
  const [sortAsc, setSortAsc] = useState(true);
  const [struggleSelected, setStruggleSelected] = useState<TIEEventSummary | null>(null);
  const [excelSelected, setExcelSelected] = useState<TIEEventSummary | null>(null);
  const [chartModal, setChartModal] = useState<{ title: string; data: { label: string; value: number; color: string }[]; max: number } | null>(null);"""

assert old_events_state in src, "CHANGE 1: old_events_state not found"
src = src.replace(old_events_state, new_events_state, 1)
print("✓ CHANGE 1: chartModal state added to EventsTab")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Replace the bottom charts block with click-to-expand versions
# ─────────────────────────────────────────────────────────────────────────────
old_charts = """          {/* Bottom charts */}
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
          </div>"""

new_charts = """          {/* Chart expand modal */}
          {chartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setChartModal(null)}>
              <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full max-w-4xl p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold text-lg">{chartModal.title}</h3>
                  <button onClick={() => setChartModal(null)} className="text-gray-400 hover:text-white text-xl leading-none px-2 py-1 rounded hover:bg-gray-700 transition-colors">✕</button>
                </div>
                <div className="overflow-x-auto">
                  <ColChart data={chartModal.data} max={chartModal.max} height={320} />
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
                const data = [...events].sort((a, b) => safeN(a.passRate) - safeN(b.passRate)).map(ev => ({
                  label: ev.eventCode,
                  value: safeN(ev.passRate),
                  color: safeN(ev.passRate) >= 80 ? '#10b981' : safeN(ev.passRate) >= 60 ? '#eab308' : '#ef4444',
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
                    data={[...events].sort((a, b) => safeN(a.passRate) - safeN(b.passRate)).map(ev => ({
                      label: ev.eventCode,
                      value: safeN(ev.passRate),
                      color: safeN(ev.passRate) >= 80 ? '#10b981' : safeN(ev.passRate) >= 60 ? '#eab308' : '#ef4444',
                    }))}
                    max={100} height={120} />
                </div>
              </SCard>
            </div>

            <div
              className="cursor-pointer group"
              title="Click to expand"
              onClick={() => {
                const data = [...events].sort((a, b) => safeN(b.gradeVariance) - safeN(a.gradeVariance)).map(ev => ({
                  label: ev.eventCode,
                  value: safeN(ev.gradeVariance),
                  color: safeN(ev.gradeVariance) > 1.5 ? '#ef4444' : safeN(ev.gradeVariance) > 0.8 ? '#eab308' : '#3b82f6',
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
                      color: safeN(ev.gradeVariance) > 1.5 ? '#ef4444' : safeN(ev.gradeVariance) > 0.8 ? '#eab308' : '#3b82f6',
                    }))}
                    max={Math.max(1, ...events.map(e => safeN(e.gradeVariance)))} height={120} />
                </div>
              </SCard>
            </div>
          </div>"""

assert old_charts in src, "CHANGE 2: old_charts not found"
src = src.replace(old_charts, new_charts, 1)
print("✓ CHANGE 2: Click-to-expand charts implemented")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: Enhance tab nav styling
# ─────────────────────────────────────────────────────────────────────────────
old_tabnav = """          {/* Tab nav */}
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
          </div>"""

new_tabnav = """          {/* Tab nav */}
          <div className="flex items-center gap-1 border-b-2 border-gray-700 mt-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold rounded-t-lg transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white border border-b-0 border-blue-500 shadow-[0_-2px_0_0_#3b82f6_inset] -mb-px pb-[11px]'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/60 border border-transparent hover:border-gray-600 border-b-0'
                }`}>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-sm" />
                )}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="ml-1 bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>"""

assert old_tabnav in src, "CHANGE 3: old_tabnav not found"
src = src.replace(old_tabnav, new_tabnav, 1)
print("✓ CHANGE 3: Tab nav styling enhanced")

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(src)

print("\n✅ All 3 changes applied successfully!")