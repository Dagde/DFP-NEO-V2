with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add onDateSelect and snapshotDates after each onDateChange={handleDateChange}
# But only for the main schedule views (Program Schedule, TraineeSchedule, InstructorSchedule)
# We need to be careful not to add to build views

import re

# Do a targeted replacement by finding each schedule view
replacements = [
    # ScheduleView (Program Schedule) - line ~9970
    (
        '''            case 'Program Schedule':
                return <ScheduleView 
                           date={date}
                           onDateChange={handleDateChange}''',
        '''            case 'Program Schedule':
                return <ScheduleView 
                           date={date}
                           onDateChange={handleDateChange}
                           onDateSelect={handleDateSelect}
                           snapshotDates={snapshotDates}'''
    ),
    # TraineeScheduleView - line ~10122
    (
        '''            case 'TraineeSchedule':
                return <TraineeScheduleView
                            date={date}
                            onDateChange={handleDateChange}''',
        '''            case 'TraineeSchedule':
                return <TraineeScheduleView
                            date={date}
                            onDateChange={handleDateChange}
                            onDateSelect={handleDateSelect}
                            snapshotDates={snapshotDates}'''
    ),
]

new_content = content
changes = 0
for old, new in replacements:
    if old in new_content:
        new_content = new_content.replace(old, new, 1)
        changes += 1
        print(f"Replaced occurrence {changes}")
    else:
        print(f"WARNING: Could not find:\n{repr(old[:100])}")

# For InstructorScheduleView - it's inside a try block, need to find it differently
# Find the try block with InstructorScheduleView
old_inst = '''                    return <InstructorScheduleView
                      date={date}
                      onDateChange={handleDateChange}'''
new_inst = '''                    return <InstructorScheduleView
                      date={date}
                      onDateChange={handleDateChange}
                      onDateSelect={handleDateSelect}
                      snapshotDates={snapshotDates}'''

if old_inst in new_content:
    new_content = new_content.replace(old_inst, new_inst, 1)
    changes += 1
    print(f"Replaced InstructorScheduleView ({changes})")
else:
    print(f"WARNING: Could not find InstructorScheduleView")

print(f"Total changes: {changes}")
print(f"New length: {len(new_content)}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
print("File written")