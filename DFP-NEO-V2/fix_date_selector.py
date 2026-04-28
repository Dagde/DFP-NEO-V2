import re

with open('components/ScheduleView.tsx', 'r') as f:
    content = f.read()

old = '''                        <div className={`bg-gray-700 rounded-md flex items-center justify-center px-1 gap-1 ${isNeoBuild ? 'neo-build-date-indicator' : ''}`} style={{height: "100%"}}>
                            <button onClick={() => onDateChange(-1)} className="p-0.5 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                                <
                            </button>
                            <span className="min-w-0 text-center font-semibold text-white cursor-default text-xs whitespace-nowrap">{formattedDisplayDate}</span>
                            <button onClick={() => onDateChange(1)} className="p-0.5 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                                >
                            </button>
                        </div>'''

new = '''                        <div className={`bg-gray-700 rounded-md flex items-center justify-center px-3 gap-2 ${isNeoBuild ? 'neo-build-date-indicator' : ''}`} style={{height: "100%", width: "100%"}}>
                            <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0 text-sm font-bold">
                                <
                            </button>
                            <span className="min-w-0 text-center font-semibold text-white cursor-default text-sm whitespace-nowrap">{formattedDisplayDate}</span>
                            <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0 text-sm font-bold">
                                >
                            </button>
                        </div>'''

if old in content:
    content = content.replace(old, new)
    with open('components/ScheduleView.tsx', 'w') as f:
        f.write(content)
    print("SUCCESS: Replacement done")
else:
    print("FAILED: String not found")
    # Show lines around the area
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'neo-build-date-indicator' in line and 'px-1' in line:
            print(f"Line {i+1}: {repr(line)}")