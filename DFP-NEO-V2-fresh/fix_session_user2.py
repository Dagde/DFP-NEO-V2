with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

# Fix line 3189 - add comma and fix indentation
lines[3188] = "                               role: data.user.role || 'INSTRUCTOR',\n"
lines.insert(3189, "                               militaryRank: actualRank,\n")

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(lines)

print("Fixed sessionUser state")