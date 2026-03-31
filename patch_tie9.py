import re

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    src = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: Add ColChartModal component right after ColChartExpanded
# This is a zoomed, large-font, per-bar-colour chart for use in modals
# ─────────────────────────────────────────────────────────────────────────────

# Insert after the ColChartExpanded closing brace (before GradeByTraineeModal)
old_anchor = """const GradeByTraineeModal: React.FC<{
  trainees: Array<{ label: string; value: number }>;
  onClose: () => void;
}>"""

new_colchartmodal = """// ── ColChartModal (zoomed Y-axis, per-bar colour, large fonts) ──────────────

const ColChartModal: React.FC<{
  data: Array<{ label: string; value: number; color?: string }>;
  max?: number;
  height?: number;
  /** If true, Y-axis zooms into actual data range for exaggerated differences */
  zoomY?: boolean;
}> = ({ data, max = 100, height = 380, zoomY = true }) => {
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
  onClose: () => void;
}>"""

assert old_anchor in src, "CHANGE 1: anchor not found"
src = src.replace(old_anchor, new_colchartmodal, 1)
print("✓ CHANGE 1: ColChartModal component added")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Replace ColChart in modal with ColChartModal
# Also fix the modal size: make it wider/taller, and use zoomY
# ─────────────────────────────────────────────────────────────────────────────

old_modal_block = """          {/* Chart expand modal */}
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
          )}"""

new_modal_block = """          {/* Chart expand modal */}
          {chartModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setChartModal(null)}>
              <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl w-full max-w-6xl p-6" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-white font-bold text-xl">{chartModal.title}</h3>
                    <p className="text-gray-400 text-sm mt-0.5">{chartModal.data.length} events &mdash; click outside to close</p>
                  </div>
                  <button onClick={() => setChartModal(null)} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 overflow-x-auto mt-3">
                  <ColChartModal data={chartModal.data} max={chartModal.max} height={420} zoomY={true} />
                </div>
              </div>
            </div>
          )}"""

assert old_modal_block in src, "CHANGE 2: old_modal_block not found"
src = src.replace(old_modal_block, new_modal_block, 1)
print("✓ CHANGE 2: Modal upgraded to use ColChartModal with Y-zoom")

with open('DFP-NEO-V2-fresh/components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(src)

print("\n✅ All changes applied successfully!")