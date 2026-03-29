with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find loadInitialData or the lmp-sync call
idx = content.find('lmp-sync')
count = 0
while idx != -1 and count < 10:
    print(f"\n{'='*60}")
    print(f"Found 'lmp-sync' at position {idx}")
    print('='*60)
    print(content[max(0, idx-300):idx+800])
    idx = content.find('lmp-sync', idx+1)
    count += 1