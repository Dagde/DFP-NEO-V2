#!/usr/bin/env python3

with open('/workspace/components/InstructorListView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the filter that only checks for role === 'QFI'
old_filter = ".filter(i => i.role === 'QFI')"
new_filter = ".filter(i => i.role === 'QFI' || i.isQFI === true)"

content = content.replace(old_filter, new_filter)

# Write back
with open('/workspace/components/InstructorListView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully updated InstructorListView.tsx to check both role and isQFI")