import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for JSX patterns that might display flight hours
patterns = [
    r'selectedSyllabusItem\?\.(flightOrSimHours|totalEventHours|duration)',
    r'syllabusItem\?\.(flightOrSimHours|totalEventHours)',
    r'<[^>]*>(?:TOTAL EVENT|Flight/Sim|DURATION)[^<]*<[^>]*>',
]

for pattern in patterns:
    matches = list(re.finditer(pattern, content, re.IGNORECASE))
    if matches:
        print(f"\n\n{'='*60}")
        print(f"Pattern: {pattern}")
        print(f"Found {len(matches)} matches")
        print('='*60)
        for i, match in enumerate(matches[:3]):  # Show first 3 matches
            print(f"\n--- Match {i+1} ---")
            start = max(0, match.start() - 400)
            end = min(len(content), match.end() + 400)
            print(content[start:end])