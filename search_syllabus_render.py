import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for where syllabus items are rendered
search_terms = [
    'syllabusItem.flightOrSimHours',
    'selectedSyllabusItem',
    'syllabusDetails.map',
    'Syllabus Item Detail'
]

for term in search_terms:
    idx = content.find(term)
    if idx != -1:
        print(f"\n\n{'='*60}")
        print(f"Found '{term}'")
        print('='*60)
        print(content[max(0, idx-400):idx+600])