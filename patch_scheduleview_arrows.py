with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken < and > characters in the date nav buttons
old_prev = '''                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            <
                        </button>'''

new_prev = '''                        <button onClick={() => onDateChange(-1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            <
                        </button>'''

old_next = '''                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            >
                        </button>'''

new_next = '''                        <button onClick={() => onDateChange(1)} className="p-1 rounded-full hover:bg-gray-600 text-white flex-shrink-0">
                            >
                        </button>'''

found_prev = old_prev in content
found_next = old_next in content

if found_prev:
    content = content.replace(old_prev, new_prev, 1)
    print("Fixed prev button")
else:
    print("WARNING: prev button not found")

if found_next:
    content = content.replace(old_next, new_next, 1)
    print("Fixed next button")
else:
    print("WARNING: next button not found")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")