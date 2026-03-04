import re

with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Find and replace the setSessionUser call
old_pattern = r"(setSessionUser\(\{[^}]*role:\s*)actualRank(,[^}]*userId: data\.user\.userId[^}]*\}\);)"
new_content = re.sub(old_pattern, r"\1data.user.role || 'INSTRUCTOR'\n                               militaryRank: actualRank\2", content)

with open('/workspace/App.tsx', 'w') as f:
    f.write(new_content)

print("Fixed sessionUser state")