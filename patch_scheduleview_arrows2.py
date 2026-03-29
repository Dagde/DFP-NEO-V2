with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 931 (0-indexed: 930) has the raw < character
# Line 939 (0-indexed: 938) probably has the raw > character
print(f"Total lines: {len(lines)}")
for i in range(928, 945):
    print(f"  {i+1}: {repr(lines[i])}")

# Fix line 931 (0-indexed: 930) - the < character
for i in range(928, 935):
    if lines[i].strip() == '<':
        print(f"Fixing line {i+1}: {repr(lines[i])}")
        lines[i] = lines[i].replace('<\n', '<\n')
        print(f"Fixed to: {repr(lines[i])}")

# Fix the > character
for i in range(935, 945):
    if lines[i].strip() == '>':
        print(f"Fixing line {i+1}: {repr(lines[i])}")
        lines[i] = lines[i].replace('>\n', '>\n')
        print(f"Fixed to: {repr(lines[i])}")

with open('/workspace/DFP-NEO-V2-github/DFP-NEO-V2-fresh/components/ScheduleView.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")