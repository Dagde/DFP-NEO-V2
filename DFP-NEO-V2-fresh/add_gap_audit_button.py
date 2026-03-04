#!/usr/bin/env python3
import re

# Read the file
with open('components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Add a 5px gap between Archived Courses and Audit Button by adding a div spacer
old_pattern = '''                        <ViewToggleButton label="Archived Courses" value="archived" />
                           <AuditButton pageName="Trainee Roster" />'''

new_pattern = '''                        <ViewToggleButton label="Archived Courses" value="archived" />
                        <div className="w-[5px]"></div>
                        <AuditButton pageName="Trainee Roster" />'''

content = content.replace(old_pattern, new_pattern)

# Write the file
with open('components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print("✓ Added 5px gap between Archived Courses and Audit button")
print("✓ Add Trainee button size: 75px wide × 55px high (w-[75px] h-[55px])")