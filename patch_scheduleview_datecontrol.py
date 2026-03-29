with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the exact date control block by line number approach
lines = content.split('\n')

# Find the date control start and end lines
start_line = None
end_line = None
for i, line in enumerate(lines):
    if '/* Date Control (Top Left) */' in line:
        start_line = i
    if start_line is not None and i > start_line and '</div>' in line and i <= start_line + 15:
        # Count opening/closing divs from start_line
        open_divs = 0
        for j in range(start_line, i+1):
            open_divs += lines[j].count('<div')
            open_divs -= lines[j].count('</div>')
        if open_divs == 0:
            end_line = i
            break

if start_line is None:
    print("ERROR: Could not find Date Control block")
    exit(1)

print(f"Date control block: lines {start_line}-{end_line}")
for i in range(start_line, end_line+1):
    print(f"  {i}: {repr(lines[i])}")

# Build new date control
new_date_control_lines = [
    '                {/* Date Control (Top Left) */}',
    '                <div className="sticky top-0 left-0 z-40 bg-gray-800 border-r border-b border-gray-700 p-1">',
    '                    <div className="bg-gray-700 rounded-md w-full h-full flex items-center justify-center px-2 space-x-2 relative">',
    '                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">',
    '                            <',
    '                        </button>',
    '                        <button',
    '                            onClick={() => setShowCalendarDropdown(v => !v)}',
    '                            className="flex-grow min-w-0 text-center font-semibold text-white hover:bg-gray-600 rounded px-1 truncate text-xs"',
    '                            title="Click to select date"',
    '                        >{formattedDisplayDate}</button>',
    '                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">',
    '                            >',
    '                        </button>',
    '                        {/* Calendar dropdown */}',
    '                        {showCalendarDropdown && (',
    '                            <div className="absolute top-full left-0 z-50 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-64" style={{minWidth:\'220px\'}}>',
    '                                <div className="text-xs text-gray-400 mb-2 font-semibold">Select Date</div>',
    '                                <input',
    '                                    type="date"',
    '                                    defaultValue={date}',
    '                                    className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-500 mb-2"',
    '                                    onChange={e => {',
    '                                        if (e.target.value) {',
    '                                            if (onDateSelect) {',
    '                                                onDateSelect(e.target.value);',
    '                                            } else {',
    '                                                const target = new Date(`${e.target.value}T00:00:00Z`);',
    '                                                const current = new Date(`${date}T00:00:00Z`);',
    '                                                const diff = Math.round((target.getTime() - current.getTime()) / (86400000));',
    '                                                if (diff !== 0) onDateChange(diff);',
    '                                            }',
    '                                            setShowCalendarDropdown(false);',
    '                                        }',
    '                                    }}',
    '                                />',
    '                                {snapshotDates && snapshotDates.length > 0 && (',
    '                                    <>',
    '                                        <div className="text-xs text-gray-400 mb-1 font-semibold">Saved Schedules</div>',
    '                                        <div className="max-h-40 overflow-y-auto space-y-1">',
    '                                            {snapshotDates.slice(0, 30).map(d => (',
    '                                                <button',
    '                                                    key={d}',
    '                                                    onClick={() => {',
    '                                                        if (onDateSelect) {',
    '                                                            onDateSelect(d);',
    '                                                        } else {',
    '                                                            const target = new Date(`${d}T00:00:00Z`);',
    '                                                            const current = new Date(`${date}T00:00:00Z`);',
    '                                                            const diff = Math.round((target.getTime() - current.getTime()) / (86400000));',
    '                                                            if (diff !== 0) onDateChange(diff);',
    '                                                        }',
    '                                                        setShowCalendarDropdown(false);',
    '                                                    }}',
    '                                                    className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-gray-600 ${d === date ? \'bg-blue-700 text-white\' : \'text-gray-300\'}`}',
    '                                                >',
    '                                                    {new Date(`${d}T00:00:00Z`).toLocaleDateString(\'en-AU\', { weekday: \'short\', day: \'2-digit\', month: \'short\', year: \'numeric\' })}',
    '                                                </button>',
    '                                            ))}',
    '                                        </div>',
    '                                    </>',
    '                                )}',
    '                                <button',
    '                                    onClick={() => setShowCalendarDropdown(false)}',
    '                                    className="mt-2 w-full text-xs text-gray-400 hover:text-white text-center"',
    '                                >Close</button>',
    '                            </div>',
    '                        )}',
    '                    </div>',
    '                </div>',
]

# Replace the lines
new_lines = lines[:start_line] + new_date_control_lines + lines[end_line+1:]
new_content = '\n'.join(new_lines)

print(f"SUCCESS: Replaced date control. New content length={len(new_content)}")
with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("ScheduleView.tsx written")