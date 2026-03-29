import re

# Read App.tsx
with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Search for where TOTAL EVENT HRS is displayed
if 'TOTAL EVENT HRS' in content:
    print("Found 'TOTAL EVENT HRS' in App.tsx")
    # Find the context around it
    idx = content.find('TOTAL EVENT HRS')
    print(content[max(0, idx-200):idx+300])

# Search for where flightOrSimHours is used
if 'flightOrSimHours' in content:
    print("\n\nFound 'flightOrSimHours' in App.tsx")
    # Find a few occurrences
    start = 0
    count = 0
    while True:
        idx = content.find('flightOrSimHours', start)
        if idx == -1:
            break
        print(f"\nOccurrence {count+1}:")
        print(content[max(0, idx-100):idx+150])
        start = idx + 1
        count += 1
        if count >= 5:
            break