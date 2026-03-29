import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for the Master LMP view/modal
search_terms = [
    'Master LMP',
    'BPC+IPC',
    'syllabus-table',
    'selectedSyllabusItemDetails',
    'Syllabus Details'
]

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
        print(f"\n\n{'='*60}")
        print(f"Found '{term}' {len(occurrences)} time(s)")
        print('='*60)
        for i, idx in enumerate(occurrences[:2]):  # Show first 2 occurrences
            print(f"\n--- Occurrence {i+1} ---")
            print(content[max(0, idx-500):idx+800])