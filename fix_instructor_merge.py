with open('/workspace/lib/dataService.ts', 'r') as f:
    lines = f.readlines()

# Find the mergeInstructorData line and fix it
for i, line in enumerate(lines):
    if 'instructors = mergeInstructorData(instructors, ESL_DATA.instructors);' in line:
        # Fix indentation and add comment
        lines[i] = '         // Always merge with mock data for staff\n         instructors = mergeInstructorData(instructors, ESL_DATA.instructors);\n'

with open('/workspace/lib/dataService.ts', 'w') as f:
    f.writelines(lines)

print("Fixed instructor merge logic")