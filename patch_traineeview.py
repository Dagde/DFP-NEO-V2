with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/TraineeScheduleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add optional props to the interface
old_interface = """  onDateChange: (increment: number) => void;"""
new_interface = """  onDateChange: (increment: number) => void;
  onDateSelect?: (date: string) => void;
  snapshotDates?: string[];"""

content = content.replace(old_interface, new_interface, 1)
print("Step 1: Added props to interface")

# 2. Update the component function signature
old_sig = "const TraineeScheduleView: React.FC<TraineeScheduleViewProps> = ({ date, onDateChange, events, trainees, onSelectEvent, onUpdateEvent, zoomLevel, daylightTimes, personnelData, seatConfigs, syllabusDetails, conflictingEventIds, showValidation, unavailabilityConflicts, onSelectTrainee, traineesData, courseColors }) => {"
new_sig = "const TraineeScheduleView: React.FC<TraineeScheduleViewProps> = ({ date, onDateChange, onDateSelect, snapshotDates = [], events, trainees, onSelectEvent, onUpdateEvent, zoomLevel, daylightTimes, personnelData, seatConfigs, syllabusDetails, conflictingEventIds, showValidation, unavailabilityConflicts, onSelectTrainee, traineesData, courseColors }) => {"

if old_sig in content:
    content = content.replace(old_sig, new_sig, 1)
    print("Step 2: Updated component signature")
else:
    print("WARNING: Could not find exact component signature - trying partial match")
    idx = content.find("const TraineeScheduleView: React.FC<TraineeScheduleViewProps>")
    print(repr(content[idx:idx+300]))

# 3. Add calendar dropdown state
old_state_anchor = "const formattedDisplayDate = useMemo(() => {"
if old_state_anchor in content:
    new_state = "const [showCalendarDropdown, setShowCalendarDropdown] = React.useState(false);\n  " + old_state_anchor
    content = content.replace(old_state_anchor, new_state, 1)
    print("Step 3: Added calendar state")

# 4. Update the date control UI using line-by-line replacement
lines = content.split('\n')
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1' in line and i > 400:
        start_line = i
        open_divs = 0
        for j in range(i, min(i+25, len(lines))):
            open_divs += lines[j].count('<div')
            open_divs -= lines[j].count('</div>')
            if open_divs == 0 and j > i:
                end_line = j
                break
        if end_line:
            break

if start_line is not None and end_line is not None:
    print(f"Found date control at lines {start_line}-{end_line}")
    
    new_date_control_lines = [
        '        <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">',
        '            <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2 relative">',
        '                <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">',
        '                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>',
        '                </button>',
        '                <button',
        '                    onClick={() => setShowCalendarDropdown(v => !v)}',
        '                    className="flex-grow min-w-0 text-center font-semibold text-white hover:bg-gray-600 rounded px-1 truncate"',
        '                    title="Click to select date"',
        '                >{formattedDisplayDate}</button>',
        '                <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">',
        '                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>',
        '                </button>',
        '                {/* Calendar dropdown */}',
        '                {showCalendarDropdown && (',
        '                    <div className="absolute top-full left-0 z-50 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3" style={{minWidth:\'220px\',width:\'256px\'}}>',
        '                        <div className="text-xs text-gray-400 mb-2 font-semibold">Select Date</div>',
        '                        <input',
        '                            type="date"',
        '                            defaultValue={date}',
        '                            className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-500 mb-2"',
        '                            onChange={e => {',
        '                                if (e.target.value) {',
        '                                    if (onDateSelect) { onDateSelect(e.target.value); }',
        '                                    else { const diff = Math.round((new Date(`${e.target.value}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000); if (diff !== 0) onDateChange(diff); }',
        '                                    setShowCalendarDropdown(false);',
        '                                }',
        '                            }}',
        '                        />',
        '                        {snapshotDates && snapshotDates.length > 0 && (',
        '                            <>',
        '                                <div className="text-xs text-gray-400 mb-1 font-semibold">Saved Schedules</div>',
        '                                <div className="max-h-40 overflow-y-auto space-y-1">',
        '                                    {snapshotDates.slice(0, 30).map(d => (',
        '                                        <button key={d}',
        '                                            onClick={() => {',
        '                                                if (onDateSelect) { onDateSelect(d); }',
        '                                                else { const diff = Math.round((new Date(`${d}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86400000); if (diff !== 0) onDateChange(diff); }',
        '                                                setShowCalendarDropdown(false);',
        '                                            }}',
        '                                            className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-600 ${d === date ? \'bg-blue-700 text-white\' : \'text-gray-300\'}`}',
        '                                        >{new Date(`${d}T00:00:00Z`).toLocaleDateString(\'en-AU\', { weekday: \'short\', day: \'2-digit\', month: \'short\', year: \'numeric\' })}</button>',
        '                                    ))}',
        '                                </div>',
        '                            </>',
        '                        )}',
        '                        <button onClick={() => setShowCalendarDropdown(false)} className="mt-2 w-full text-xs text-gray-400 hover:text-white text-center">Close</button>',
        '                    </div>',
        '                )}',
        '            </div>',
        '        </div>',
    ]
    
    new_lines = lines[:start_line] + new_date_control_lines + lines[end_line+1:]
    content = '\n'.join(new_lines)
    print(f"Step 4: Updated date control UI")
else:
    print(f"WARNING: Could not find date control block (start={start_line}, end={end_line})")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/TraineeScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("TraineeScheduleView.tsx written successfully")