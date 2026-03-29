import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for Master LMP or syllabus display
if 'Master LMP' in content:
    print("Found 'Master LMP' in App.tsx")
    # Find context around it
    idx = content.find('Master LMP')
    print(content[max(0, idx-300):idx+500])

# Search for where duration is displayed in syllabus
if 'DURATION' in content:
    print("\n\nFound 'DURATION' in App.tsx")
    # Find first occurrence
    idx = content.find('DURATION')
    print(content[max(0, idx-200):idx+400])

# Search for where totalEventHours is used
if 'totalEventHours' in content:
    print("\n\nFound 'totalEventHours' in App.tsx")
    start = 0
    count = 0
    while True:
        idx = content.find('totalEventHours', start)
        if idx == -1:
            break
        print(f"\n--- Occurrence {count+1} ---")
        print(content[max(0, idx-150):idx+200])
        start = idx + 1
        count += 1
        if count >= 3:
            break