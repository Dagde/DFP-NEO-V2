import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for syllabus tab or view
search_terms = [
    'activeTab',
    'Syllabus Tab',
    'showSyllabus',
    'viewSyllabus'
]