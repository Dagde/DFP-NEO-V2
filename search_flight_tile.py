import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for where flight tiles are rendered
search_terms = [
    'flightOrSimHours',
    'duration',
    'totalEventHours',
    'event.startTime',
    'flightNumber'
]

print("=" * 80)
print("SEARCHING FOR FLIGHT HOURS IN FLIGHT TILE RENDERING")
print("=" * 80)

# Find where ScheduleEvent objects are created or rendered
if 'ScheduleEvent' in content:
    idx = content.find('ScheduleEvent')
    print(f"\nFound 'ScheduleEvent' at position {idx}")
    print(content[max(0, idx-500):idx+800])

# Search for where flightOrSimHours is used in event rendering
start = 0
count = 0
while True:
    idx = content.find('flightOrSimHours', start)
    if idx == -1:
        break
    print(f"\n{'='*60}")
    print(f"Occurrence {count+1} of 'flightOrSimHours'")
    print('='*60)
    print(content[max(0, idx-400):idx+600])
    start = idx + 1
    count += 1
    if count >= 5:
        break