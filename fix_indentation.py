with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

# Fix line 3188 indentation
if len(lines) > 3188:
    lines[3188] = "                               militaryRank: actualRank,\n"

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(lines)

print("Fixed indentation")