with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    content = f.read()

# 1. Add CircularGauge and InstrumentGauge after ExperienceDisplay
gauge_components = """
const CircularGauge: React.FC<{ title: string; mainValue: number; subItems: { label: string; value: number }[] }> = ({ title, mainValue, subItems }) => (
  <div className="flex flex-col items-center bg-gray-800/60 rounded-lg p-2 min-w-[80px]">
    <div className="text-[10px] text-gray-400 font-semibold mb-1 text-center">{title}</div>
    <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-1">
      <span className="text-white font-bold text-sm">{mainValue.toFixed(1)}</span>
    </div>
    <div className="space-y-0.5 w-full">
      {subItems.map(item => (
        <div key={item.label} className="flex justify-between text-[9px]">
          <span className="text-gray-400">{item.label}</span>
          <span className="text-white font-medium">{item.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  </div>
);

const InstrumentGauge: React.FC<{ sim: number; actual: number }> = ({ sim, actual }) => (
  <div className="flex flex-col items-center bg-gray-800/60 rounded-lg p-2 min-w-[80px]">
    <div className="text-[10px] text-gray-400 font-semibold mb-1 text-center">Instrument</div>
    <div className="w-14 h-14 rounded-full border-4 border-purple-500/60 flex items-center justify-center mb-1">
      <span className="text-white font-bold text-sm">{(sim + actual).toFixed(1)}</span>
    </div>
    <div className="space-y-0.5 w-full">
      <div className="flex justify-between text-[9px]"><span className="text-gray-400">Sim</span><span className="text-white font-medium">{sim.toFixed(1)}</span></div>
      <div className="flex justify-between text-[9px]"><span className="text-gray-400">Actual</span><span className="text-white font-medium">{actual.toFixed(1)}</span></div>
    </div>
  </div>
);

"""

# Find ExperienceDisplay and insert after it
idx = content.find('const ExperienceDisplay')
if idx >= 0:
    end_idx = content.find('\n\n', idx)
    if end_idx < 0:
        end_idx = content.find('\nconst ', idx + 10)
    content = content[:end_idx] + '\n' + gauge_components + content[end_idx:]
    print("Added CircularGauge and InstrumentGauge")
else:
    print("ExperienceDisplay not found!")

# 2. Add exp alias
old_exp = '    const [priorExperience, setPriorExperience] = useState<LogbookExperience>(trainee.priorExperience || initialExperience);'
new_exp = old_exp + '\n    const exp = priorExperience;'
if old_exp in content:
    content = content.replace(old_exp, new_exp)
    print("Added exp alias")
else:
    print("priorExperience state not found!")

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Done!")
