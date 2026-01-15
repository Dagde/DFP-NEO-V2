#!/usr/bin/env python3

with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

# 1. Update sessionUser state type (line 3140)
lines[3139] = "    const [sessionUser, setSessionUser] = useState<{firstName: string | null, lastName: string | null, role: string, militaryRank: string, userId: string} | null>(null);\n"

# 2. Update setSessionUser call (around line 3184-3191)
# Find the block that sets role: actualRank and replace it
for i in range(len(lines)):
    if 'role: actualRank,' in lines[i] and i > 3180 and i < 3200:
        # Replace the role line
        lines[i] = "                               role: data.user.role || 'INSTRUCTOR',\n"
        # Insert militaryRank line after it
        lines.insert(i + 1, "                               militaryRank: actualRank,\n")
        break

# 3. Update MyDashboard to use militaryRank (line 8327)
for i in range(len(lines)):
    if "userRank={sessionUser?.role || 'FLTLT'}" in lines[i]:
        lines[i] = lines[i].replace(
            "userRank={sessionUser?.role || 'FLTLT'}",
            "userRank={sessionUser?.militaryRank || sessionUser?.role || 'FLTLT'}"
        )
        break

# 4. Update other currentUserRank usages (lines 8948, 9231)
for i in range(len(lines)):
    if "currentUserRank={sessionUser?.role || currentUser?.rank" in lines[i]:
        lines[i] = lines[i].replace(
            "sessionUser?.role || currentUser?.rank",
            "sessionUser?.militaryRank || sessionUser?.role || currentUser?.rank"
        )

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Added militaryRank field to sessionUser state")
print("✅ Updated setSessionUser to include militaryRank from Personnel table")
print("✅ Updated MyDashboard to use militaryRank")
print("✅ Updated all currentUserRank usages")