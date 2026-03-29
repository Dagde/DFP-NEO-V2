with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken signature - the issue is that the closing }) => { was replaced
# but the new props were added separately without proper comma
old_broken = """    timezoneOffset = 11 // Default to UTC+11
  onDateSelect,
  snapshotDates = [],
}) => {"""

new_fixed = """    timezoneOffset = 11, // Default to UTC+11
    onDateSelect,
    snapshotDates = [],
}) => {"""

if old_broken in content:
    content = content.replace(old_broken, new_fixed, 1)
    print("Fixed broken signature")
else:
    print("WARNING: Could not find broken signature")
    # Show context
    idx = content.find("timezoneOffset = 11")
    print(repr(content[idx:idx+200]))

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")