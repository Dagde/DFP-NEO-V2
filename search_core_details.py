import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for "Core Details" or similar UI sections
search_terms = ['Core Details', 'TOTAL EVENT HRS', 'flightOrSimHours', 'Flight/Sim Hrs']

for term in search_terms:
    idx = content.find(term)
    if idx != -1:
        print(f"\n\n=== Found '{term}' ===")
        print(content[max(0, idx-300):idx+500])