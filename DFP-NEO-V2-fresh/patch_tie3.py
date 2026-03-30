with open('components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    content = f.read()

# ──────────────────────────────────────────────────────────────────────
# 1. Replace the entire SparkLine component with a fixed version:
#    - Fixed 0-5 Y scale so axis labels always match data positions
#    - Tooltip rendered as absolute-positioned div (not SVG), preventing clip
# ──────────────────────────────────────────────────────────────────────

old_sparkline_start = '// ── SparkLine (SVG) — with optional hover tooltip'
old_sparkline_end = '\n// ── HBarChart'

si = content.find(old_sparkline_start)
ei = content.find(old_sparkline_end)

if si == -1 or ei == -1:
    print(f'ERROR: SparkLine markers not found. si={si}, ei={ei}')
    exit(1)

new_sparkline = r"""// ── SparkLine (SVG) — fixed 0-5 Y scale + floating div tooltip ─────────────────

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
"""

content = content[:si] + new_sparkline + content[ei:]
print('Patch 1 (SparkLine) OK')

# ──────────────────────────────────────────────────────────────────────
# 2. Fix Y-axis labels in ProgressionModal to use fixed 0-5 scale
# ──────────────────────────────────────────────────────────────────────
old_yaxis = """          <div className="flex flex-col justify-between text-xs text-gray-500 py-1 flex-shrink-0 text-right" style={{ width: 28, height: 220 }}>
              <span>5.0</span><span>3.75</span><span>2.5</span><span>1.25</span><span>0</span>
            </div>"""
new_yaxis = """          <div className="flex flex-col justify-between text-xs text-gray-500 py-1 flex-shrink-0 text-right" style={{ width: 28, height: 220 }}>
              <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span>
            </div>"""

if old_yaxis not in content:
    print('WARNING: yaxis patch not found (may already be correct or changed)')
else:
    content = content.replace(old_yaxis, new_yaxis, 1)
    print('Patch 2 (Y-axis labels) OK')

# ──────────────────────────────────────────────────────────────────────
# 3. Fix Grade by Trainee — use first+last name abbreviation instead of
#    split(' ').pop() which gives course codes
# ──────────────────────────────────────────────────────────────────────

# In GradeByTraineeModal render (patch_tie2 modal)
old_trainee_label1 = """          trainees={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => ({
            label: t.traineeFullName.split(' ').pop() || t.traineeFullName,
            value: safeN(t.avgOverallGrade),
          }))}"""
new_trainee_label1 = """          trainees={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
            // Use surname if name has spaces, otherwise truncate the full string
            const parts = t.traineeFullName.trim().split(/\s+/);
            const label = parts.length >= 2
              ? parts[parts.length - 1]  // surname (last word)
              : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;
            return { label, value: safeN(t.avgOverallGrade) };
          })}"""

if old_trainee_label1 not in content:
    print('WARNING: trainee label 1 patch not found')
else:
    content = content.replace(old_trainee_label1, new_trainee_label1, 1)
    print('Patch 3a (trainee label modal) OK')

# In inline ColChart card
old_trainee_label2 = """                    <ColChart
                      data={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => ({
                        label: t.traineeFullName.split(' ').pop() || t.traineeFullName,
                        value: safeN(t.avgOverallGrade),
                      }))}
                      max={5} height={130} />"""
new_trainee_label2 = """                    <ColChart
                      data={[...trainees].sort((a, b) => safeN(a.avgOverallGrade) - safeN(b.avgOverallGrade)).map(t => {
                        const parts = t.traineeFullName.trim().split(/\s+/);
                        const label = parts.length >= 2
                          ? parts[parts.length - 1]
                          : t.traineeFullName.length > 10 ? t.traineeFullName.slice(0, 10) : t.traineeFullName;
                        return { label, value: safeN(t.avgOverallGrade) };
                      })}
                      max={5} height={130} />"""

if old_trainee_label2 not in content:
    print('WARNING: trainee label 2 patch not found')
else:
    content = content.replace(old_trainee_label2, new_trainee_label2, 1)
    print('Patch 3b (trainee label inline) OK')

# ──────────────────────────────────────────────────────────────────────
# 4. Make the GradeByTraineeModal bigger + full name display
# ──────────────────────────────────────────────────────────────────────
old_modal_size = """  <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-4" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">Grade by Trainee (sorted low to high)</h3>
            <p className="text-gray-400 text-sm mt-0.5">{trainees.length} trainees &middot; avg grade per trainee</p>
          </div>"""
new_modal_size = """  <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-2" style={{ maxWidth: '1100px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">Grade by Trainee (sorted low to high)</h3>
            <p className="text-gray-400 text-sm mt-0.5">{trainees.length} trainees &middot; avg grade per trainee</p>
          </div>"""

if old_modal_size not in content:
    print('WARNING: modal size patch not found')
else:
    content = content.replace(old_modal_size, new_modal_size, 1)
    print('Patch 4 (modal wider) OK')

# ──────────────────────────────────────────────────────────────────────
# 5. ColChartExpanded — use full label (not truncated), bigger height
# ──────────────────────────────────────────────────────────────────────
old_expanded_height = """const GradeByTraineeModal: React.FC<{
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
          <ColChartExpanded data={trainees} max={5} height={260} />"""
new_expanded_height = """const GradeByTraineeModal: React.FC<{
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
          <ColChartExpanded data={trainees} max={5} height={300} />"""

if old_expanded_height not in content:
    print('WARNING: expanded height patch not found')
else:
    content = content.replace(old_expanded_height, new_expanded_height, 1)
    print('Patch 5 (ColChartExpanded height) OK')

# ──────────────────────────────────────────────────────────────────────
# Write file
# ──────────────────────────────────────────────────────────────────────
with open('components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(content)

print(f'Done. File length: {len(content)} chars')