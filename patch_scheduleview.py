with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add optional props to the interface
old_interface = """interface ScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;"""

new_interface = """interface ScheduleViewProps {
  date: string;
  onDateChange: (increment: number) => void;
  onDateSelect?: (date: string) => void;
  snapshotDates?: string[];"""

if old_interface not in content:
    print("ERROR: Could not find ScheduleViewProps interface")
    exit(1)
content = content.replace(old_interface, new_interface, 1)
print("Step 1: Added props to interface")

# 2. Update the component function signature to accept the new props
old_sig = "const ScheduleView: React.FC<ScheduleViewProps> = ({"
# Find the full destructuring signature
idx = content.find(old_sig)
if idx == -1:
    print("ERROR: Could not find component signature")
    exit(1)

# Find the closing of the destructuring
end_sig = content.find("}) => {", idx)
if end_sig == -1:
    print("ERROR: Could not find end of destructuring")
    exit(1)
end_sig += len("}) => {")

old_sig_full = content[idx:end_sig]
print("Old sig (last 100):", repr(old_sig_full[-100:]))

# Add new props to destructuring - find the right place
if 'isVisualAdjustMode,' in old_sig_full or 'onVisualAdjustTimeChange,' in old_sig_full:
    # Add before the closing
    old_closing = "}) => {"
    new_closing = "  onDateSelect,\n  snapshotDates = [],\n}) => {"
    new_sig_full = old_sig_full.replace(old_closing, new_closing, 1)
else:
    # Add after date, onDateChange
    old_part = "  date, onDateChange,"
    new_part = "  date, onDateChange, onDateSelect, snapshotDates = [],"
    new_sig_full = old_sig_full.replace(old_part, new_part, 1)
    if new_sig_full == old_sig_full:
        print("WARNING: Couldn't add via date, onDateChange pattern")

content = content[:idx] + new_sig_full + content[end_sig:]
print("Step 2: Updated component signature")

# 3. Add calendar dropdown state variable inside the component
old_state_section = "const ScheduleView: React.FC<ScheduleViewProps>"
# Find formattedDisplayDate to insert near there
old_insert = "const formattedDisplayDate = useMemo(() => {"
idx_insert = content.find(old_insert)
if idx_insert == -1:
    print("ERROR: Could not find formattedDisplayDate in ScheduleView")
    # Find another anchor
    old_insert = "const PIXELS_PER_HOUR = 200;"
    idx_insert = content.find(old_insert)

# Look for a good place to insert state - inside the component
# Find "const scheduleGridRef = useRef" or similar
old_state_anchor = "const scheduleGridRef = useRef"
idx_anchor = content.find(old_state_anchor)
if idx_anchor == -1:
    old_state_anchor = "const [isDragging, setIsDragging] = useState"
    idx_anchor = content.find(old_state_anchor)

if idx_anchor != -1:
    new_state = "const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);\n    "
    content = content[:idx_anchor] + new_state + content[idx_anchor:]
    print(f"Step 3: Added calendar state at {idx_anchor}")
else:
    print("WARNING: Could not find anchor for state - skipping state insertion")

# 4. Update the date control UI
old_date_control = '''                {/* Date Control (Top Left) */}
                <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">
                    <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2">
                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            <
                        </button>
                        <span className="flex-grow min-w-0 text-center font-semibold text-white cursor-default truncate text-xs">{formattedDisplayDate}</span>
                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            >
                        </button>
                    </div>
                </div>'''

new_date_control = '''                {/* Date Control (Top Left) */}
                <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">
                    <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2 relative">
                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            <
                        </button>
                        <button
                            onClick={() => setShowCalendarDropdown(v => !v)}
                            className="flex-grow min-w-0 text-center font-semibold text-white hover:bg-gray-600 rounded px-1 truncate text-xs"
                            title="Click to select date from calendar"
                        >{formattedDisplayDate}</button>
                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            >
                        </button>
                        {/* Calendar dropdown */}
                        {showCalendarDropdown && (
                            <div className="absolute top-full left-0 z-50 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-64">
                                <div className="text-xs text-gray-400 mb-2 font-semibold">Select Date</div>
                                <input
                                    type="date"
                                    defaultValue={date}
                                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-500 mb-2"
                                    onChange={e => {
                                        if (e.target.value) {
                                            onDateSelect ? onDateSelect(e.target.value) : (() => {
                                                const target = new Date(`${e.target.value}T00:00:00Z`);
                                                const current = new Date(`${date}T00:00:00Z`);
                                                const diff = Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
                                                if (diff !== 0) onDateChange(diff);
                                            })();
                                            setShowCalendarDropdown(false);
                                        }
                                    }}
                                />
                                {snapshotDates && snapshotDates.length > 0 && (
                                    <>
                                        <div className="text-xs text-gray-400 mb-1 font-semibold">Saved Schedules</div>
                                        <div className="max-h-40 overflow-y-auto space-y-1">
                                            {snapshotDates.slice(0, 30).map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => {
                                                        onDateSelect ? onDateSelect(d) : (() => {
                                                            const target = new Date(`${d}T00:00:00Z`);
                                                            const current = new Date(`${date}T00:00:00Z`);
                                                            const diff = Math.round((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
                                                            if (diff !== 0) onDateChange(diff);
                                                        })();
                                                        setShowCalendarDropdown(false);
                                                    }}
                                                    className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-600 ${d === date ? 'bg-blue-700 text-white' : 'text-gray-300'}`}
                                                >
                                                    {new Date(`${d}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                                <button
                                    onClick={() => setShowCalendarDropdown(false)}
                                    className="mt-2 w-full text-xs text-gray-400 hover:text-white text-center"
                                >Close</button>
                            </div>
                        )}
                    </div>
                </div>'''

if old_date_control not in content:
    print("ERROR: Could not find date control block in ScheduleView")
    # Show context
    idx = content.find('Date Control (Top Left)')
    print(repr(content[idx:idx+600]))
else:
    content = content.replace(old_date_control, new_date_control, 1)
    print("Step 4: Updated date control UI")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("ScheduleView.tsx written successfully")