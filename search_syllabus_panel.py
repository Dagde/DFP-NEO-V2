import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for syllabus panel/modal rendering
search_terms = [
    'SyllabusPanel',
    'SyllabusModal',
    'MasterLMPModal',
    'selectedSyllabus',
    'viewMode === \'syllabus\''
]

for term in search_terms:
    idx = content.find(term)
    if idx != -1:
        print(f"\n\n{'='*60}")
        print(f"Found '{term}' at position {idx}")
        print('='*60)
        print(content[max(0, idx-600):idx+1000])