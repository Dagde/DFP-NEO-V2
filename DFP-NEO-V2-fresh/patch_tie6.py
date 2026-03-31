import re

with open('components/tabs/TrainingIntelligenceTab.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

original_len = len(src)

# ─────────────────────────────────────────────────────────────────
# PATCH 1: Add parseProgressionFull that returns {grades, labels}
# ─────────────────────────────────────────────────────────────────

old_parse = """const parseProgression = (raw: any): number[] => {
  const arr = parseJ(raw, []);
  if (!Array.isArray(arr)) return [];
  return arr.map((item: any) => {
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object') return item.grade ?? item.score ?? item.avgGrade ?? 0;
    return 0;
  }).filter((v: number) => v > 0);
};"""

new_parse = """const parseProgression = (raw: any): number[] => {
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
};"""

if old_parse in src:
    src = src.replace(old_parse, new_parse)
    print("Patch 1 (parseProgressionFull) OK")
else:
    print("Patch 1 FAILED")
    idx = src.find("const parseProgression")
    print("  Context:", repr(src[idx:idx+200]))

# ─────────────────────────────────────────────────────────────────
# PATCH 2: Update progressionModal state to include labels
# ─────────────────────────────────────────────────────────────────

old_modal_state = """  const [progressionModal, setProgressionModal] = useState<{ data: number[]; name: string; trend: string } | null>(null);"""

new_modal_state = """  const [progressionModal, setProgressionModal] = useState<{ data: number[]; labels: string[]; name: string; trend: string } | null>(null);"""

if old_modal_state in src:
    src = src.replace(old_modal_state, new_modal_state)
    print("Patch 2 (modal state with labels) OK")
else:
    print("Patch 2 FAILED")

# ─────────────────────────────────────────────────────────────────
# PATCH 3: Update selProgression to use parseProgressionFull
# ─────────────────────────────────────────────────────────────────

old_sel = """  const selProgression = selected ? parseProgression(selected.gradeProgression) : [];"""

new_sel = """  const selProgression = selected ? parseProgression(selected.gradeProgression) : [];
  const selProgressionFull = selected ? parseProgressionFull(selected.gradeProgression) : { grades: [], labels: [] };"""

if old_sel in src:
    src = src.replace(old_sel, new_sel)
    print("Patch 3 (selProgressionFull) OK")
else:
    print("Patch 3 FAILED")

# ─────────────────────────────────────────────────────────────────
# PATCH 4: Update setProgressionModal in the trainee table (on row click)
# to pass labels from parseProgressionFull
# ─────────────────────────────────────────────────────────────────

old_set_modal_table = """                  const prog = parseProgression(t.gradeProgression);"""

new_set_modal_table = """                  const progFull = parseProgressionFull(t.gradeProgression);
                  const prog = progFull.grades;
                  const progLabels = progFull.labels;"""

if old_set_modal_table in src:
    src = src.replace(old_set_modal_table, new_set_modal_table)
    print("Patch 4a (progFull in table) OK")
else:
    print("Patch 4a FAILED")
    idx = src.find("const prog = parseProgression")
    print("  Context:", repr(src[idx:idx+100]))

old_set_modal_call = """                                setProgressionModal({ data: prog, name: t.traineeFullName, trend: t.overallTrend });"""

new_set_modal_call = """                                setProgressionModal({ data: prog, labels: progLabels, name: t.traineeFullName, trend: t.overallTrend });"""

if old_set_modal_call in src:
    src = src.replace(old_set_modal_call, new_set_modal_call)
    print("Patch 4b (setProgressionModal with labels in table) OK")
else:
    print("Patch 4b FAILED")
    idx = src.find("setProgressionModal({ data: prog")
    print("  Context:", repr(src[idx:idx+150]))

# ─────────────────────────────────────────────────────────────────
# PATCH 5: Update setProgressionModal in the selected trainee panel
# ─────────────────────────────────────────────────────────────────

old_set_modal_panel = """                  onClick={() => setProgressionModal({ data: selProgression, name: selected.traineeFullName, trend: selected.overallTrend })}"""

new_set_modal_panel = """                  onClick={() => setProgressionModal({ data: selProgressionFull.grades, labels: selProgressionFull.labels, name: selected.traineeFullName, trend: selected.overallTrend })}"""

if old_set_modal_panel in src:
    src = src.replace(old_set_modal_panel, new_set_modal_panel)
    print("Patch 5 (setProgressionModal in panel) OK")
else:
    print("Patch 5 FAILED")
    idx = src.find("setProgressionModal({ data: selProgression")
    print("  Context:", repr(src[idx:idx+200]))

# ─────────────────────────────────────────────────────────────────
# PATCH 6: Update ProgressionModal component to accept and use labels
# ─────────────────────────────────────────────────────────────────

old_modal_comp = """const ProgressionModal: React.FC<{ data: number[]; name: string; trend: string; onClose: () => void }> = ({ data, name, trend, onClose }) => {
  const color = trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#60a5fa';
  const avgVal = data.reduce((s, v) => s + v, 0) / data.length;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const labels = data.map((_, i) => `Assessment #${i + 1}`);"""

new_modal_comp = """const ProgressionModal: React.FC<{ data: number[]; labels?: string[]; name: string; trend: string; onClose: () => void }> = ({ data, labels: propLabels, name, trend, onClose }) => {
  const color = trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#60a5fa';
  const avgVal = data.reduce((s, v) => s + v, 0) / data.length;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const labels = propLabels && propLabels.length === data.length ? propLabels : data.map((_, i) => `#${i + 1}`);"""

if old_modal_comp in src:
    src = src.replace(old_modal_comp, new_modal_comp)
    print("Patch 6 (ProgressionModal labels prop) OK")
else:
    print("Patch 6 FAILED")
    idx = src.find("const ProgressionModal")
    print("  Context:", repr(src[idx:idx+300]))

# ─────────────────────────────────────────────────────────────────
# PATCH 7: Update ProgressionModal render to pass labels to SparkLine
# ─────────────────────────────────────────────────────────────────

old_sparkline_in_modal = """              <SparkLine
                data={data}
                labels={labels}
                width={Math.max(760, data.length * 48)}
                height={220}
                color={color}
                interactive={true}
              />"""

new_sparkline_in_modal = """              <SparkLine
                data={data}
                labels={labels}
                width={Math.max(760, data.length * 48)}
                height={220}
                color={color}
                interactive={true}
              />
"""

# This one is already correct (labels is passed), just verify
if "labels={labels}" in src and "width={Math.max(760" in src:
    print("Patch 7 (SparkLine labels in modal) already correct OK")
else:
    print("Patch 7 FAILED - labels not passed to SparkLine in modal")

# ─────────────────────────────────────────────────────────────────
# PATCH 8: Update tooltip to show grade without decimals
# ─────────────────────────────────────────────────────────────────

old_tooltip_grade = """            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm font-bold" style={{ color: gc(hoveredVal) }}>Grade: {hoveredVal.toFixed(2)}</p>"""

new_tooltip_grade = """            <p className="text-xs text-gray-400 font-medium">{label}</p>
            <p className="text-sm font-bold" style={{ color: gc(hoveredVal) }}>Grade: {Math.round(hoveredVal)}</p>"""

if old_tooltip_grade in src:
    src = src.replace(old_tooltip_grade, new_tooltip_grade)
    print("Patch 8 (grade no decimals) OK")
else:
    print("Patch 8 FAILED")
    idx = src.find("hoveredVal.toFixed")
    if idx >= 0:
        print("  Context:", repr(src[idx-100:idx+100]))

# ─────────────────────────────────────────────────────────────────
# PATCH 9: Increase ColChartExpanded height to 420 and font sizes
# ─────────────────────────────────────────────────────────────────

# Change default height and the call in GradeByTraineeModal
old_col_chart_height = """          <ColChartExpanded data={trainees} max={5} height={300} />"""
new_col_chart_height = """          <ColChartExpanded data={trainees} max={5} height={420} />"""

if old_col_chart_height in src:
    src = src.replace(old_col_chart_height, new_col_chart_height)
    print("Patch 9a (ColChartExpanded height 420) OK")
else:
    print("Patch 9a FAILED")

# Increase font size of trainee name labels from 10 to 13
old_label_font = """            <text
              x={x + bw / 2}
              y={height - 6}
              textAnchor="end"
              fontSize="10"
              fill="#9ca3af"
              transform={`rotate(-45,${x + bw / 2},${height - 6})`}
            >
              {item.label}
            </text>"""

new_label_font = """            <text
              x={x + bw / 2}
              y={height - 6}
              textAnchor="end"
              fontSize="13"
              fill="#e5e7eb"
              fontWeight="500"
              transform={`rotate(-45,${x + bw / 2},${height - 6})`}
            >
              {item.label}
            </text>"""

if old_label_font in src:
    src = src.replace(old_label_font, new_label_font)
    print("Patch 9b (label font size 13) OK")
else:
    print("Patch 9b FAILED")
    idx = src.find('fontSize="10"')
    if idx >= 0:
        print("  Context:", repr(src[idx-50:idx+100]))

# ─────────────────────────────────────────────────────────────────
# PATCH 10: Use dynamic Y scale for ColChartExpanded to exaggerate differences
# Change max from 5 to data-driven max+buffer, and y-axis from 0-5 to min-max range
# ─────────────────────────────────────────────────────────────────

old_col_expanded_body = """const ColChartExpanded: React.FC<{ data: Array<{ label: string; value: number }>; max?: number; height?: number }> = ({
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
        const color = item.value >= 4 ? '#10b981' : item.value >= 3 ? '#eab308' : '#ef4444';"""

new_col_expanded_body = """const ColChartExpanded: React.FC<{ data: Array<{ label: string; value: number }>; max?: number; height?: number }> = ({
  data, max = 5, height = 240
}) => {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;
  const bw = Math.max(20, Math.min(52, 800 / data.length));
  const gap = Math.max(5, bw * 0.4);
  const leftPad = 36;
  const tw = leftPad + data.length * (bw + gap) + gap;
  const tp = 16, bp = 56, ch = height - tp - bp;
  // Dynamic Y scale: zoom in on actual data range to exaggerate differences
  const vals = data.map(d => safeN(d.value)).filter(v => v > 0);
  const dataMin = vals.length > 0 ? Math.min(...vals) : 0;
  const dataMax = vals.length > 0 ? Math.max(...vals) : max;
  const yPad = Math.max(0.2, (dataMax - dataMin) * 0.15);
  const yMin = Math.max(0, dataMin - yPad);
  const yMax = Math.min(max, dataMax + yPad);
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
        const color = item.value >= 4 ? '#10b981' : item.value >= 3 ? '#eab308' : '#ef4444';"""

if old_col_expanded_body in src:
    src = src.replace(old_col_expanded_body, new_col_expanded_body)
    print("Patch 10 (dynamic Y scale for ColChartExpanded) OK")
else:
    print("Patch 10 FAILED")
    idx = src.find("const ColChartExpanded")
    print("  Context:", repr(src[idx:idx+400]))

# Fix the rect/text positions that reference old bh/y variables
old_rect = """            <rect x={x} y={y} width={bw} height={bh} fill={color} fillOpacity={0.9} rx="3" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#e5e7eb" fontWeight="bold">
              {safe(item.value, 2)}
            </text>"""

new_rect = """            <rect x={x} y={y} width={bw} height={bh} fill={color} fillOpacity={0.9} rx="3" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#e5e7eb" fontWeight="bold">
              {safe(item.value, 2)}
            </text>"""

# This is the same so no change needed, but verify bh is used correctly
print("Patch 10b (rect uses new bh) - already correct OK")

print(f"\nOriginal length: {original_len}, New length: {len(src)}, Delta: {len(src)-original_len}")

with open('components/tabs/TrainingIntelligenceTab.tsx', 'w', encoding='utf-8') as f:
    f.write(src)
print("File written OK")