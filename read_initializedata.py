with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find initializeData function or loadInitialData
for term in ['loadInitialData', 'initializeData', 'data.scores']:
    idx = content.find(term)
    if idx != -1:
        print(f"\n{'='*60}")
        print(f"Found '{term}' at position {idx}")
        print('='*60)
        print(content[max(0, idx-200):idx+1000])
        break