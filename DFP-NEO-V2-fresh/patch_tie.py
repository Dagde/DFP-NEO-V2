import re

with open('components/tabs/TrainingIntelligenceTab.tsx', 'r') as f:
    content = f.read()

# Find the section to replace: from Grade Progression Modal up to (but not including) COURSE TAB
start_marker = '// \u2500\u2500 Grade Progression Modal'
end_marker = '\n// \u2500\u2500 COURSE TAB'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f'ERROR: markers not found. start={start_idx}, end={end_idx}')
    exit(1)

new_section = r"""// ── Grade Progression Modal (interactive, enlarged) ─────────────────────────────

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
              <span>5.0</span><span>3.75</span><span>2.5</span><span>1.25</span><span>0</span>
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
      <div className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-4" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">Grade by Trainee (sorted low to high)</h3>
            <p className="text-gray-400 text-sm mt-0.5">{trainees.length} trainees &middot; avg grade per trainee</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 overflow-x-auto">
          <ColChartExpanded data={trainees} max={5} height={260} />
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

"""

content = content[:start_idx] + new_section + content[end_idx:]

with open('components/tabs/TrainingIntelligenceTab.tsx', 'w') as f:
    f.write(content)

print('DONE - replaced section successfully')
print(f'New file length: {len(content)} chars')