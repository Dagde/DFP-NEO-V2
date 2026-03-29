import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for where events are created in the DFP build
search_terms = [
    'duration: syllabusItem',
    'duration: item',
    'startTime:',
    'new ScheduleEvent',
    'event.startTime +'
]

print("=" * 80)
print("SEARCHING FOR EVENT CREATION IN DFP BUILD")
print("=" * 80)

for term in search_terms:
    occurrences = []
    start = 0
    while True:
        idx = content.find(term, start)
        if idx == -1:
            break
        occurrences.append(idx)
        start = idx + 1
    
    if occurrences:
        print(f"\n{'='*60}")
        print(f"Found '{term}' {len(occurrences)} time(s)")
        print('='*60)
        for i, idx in enumerate(occurrences[:3]):  # Show first 3
            print(f"\n--- Occurrence {i+1} at position {idx} ---")
            print(content[max(0, idx-600):idx+800])