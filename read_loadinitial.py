with open('DFP-NEO-V2-fresh/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find syllabusData construction before lmp-sync
idx = content.find('syllabusData')
count = 0
while idx != -1 and count < 5:
    print(f"\n{'='*60}")
    print(f"Found 'syllabusData' at position {idx}")
    print('='*60)
    print(content[max(0, idx-100):idx+600])
    idx = content.find('syllabusData', idx+1)
    count += 1