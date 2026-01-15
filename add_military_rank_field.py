#!/usr/bin/env python3
import re

with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# 1. Update sessionUser state type definition
content = re.sub(
    r"const \[sessionUser, setSessionUser\] = useState<\{firstName: string \| null, lastName: string \| null, role: string, userId: string\} \| null>\(null\);",
    "const [sessionUser, setSessionUser] = useState<{firstName: string | null, lastName: string | null, role: string, militaryRank: string, userId: string} | null>(null);",
    content
)

# 2. Update setSessionUser call to include militaryRank
old_set_session = """                           setSessionUser({
                               firstName: data.user.firstName || null,
                               lastName: data.user.lastName || null,
                               role: actualRank,
                               userId: data.user.userId || ''
                           });"""

new_set_session = """                           setSessionUser({
                               firstName: data.user.firstName || null,
                               lastName: data.user.lastName || null,
                               role: data.user.role || 'INSTRUCTOR',
                               militaryRank: actualRank,
                               userId: data.user.userId || ''
                           });"""

content = content.replace(old_set_session, new_set_session)

# 3. Update MyDashboard to use militaryRank instead of role
content = re.sub(
    r"userRank=\{sessionUser\?\.role \|\| 'FLTLT'\}",
    "userRank={sessionUser?.militaryRank || sessionUser?.role || 'FLTLT'}",
    content
)

with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("✅ Added militaryRank field to sessionUser state")
print("✅ Updated setSessionUser to include militaryRank from Personnel table")
print("✅ Updated MyDashboard to use militaryRank")