#!/usr/bin/env python3
import re

# Read the file
with open('components/CourseRosterView.tsx', 'r') as f:
    content = f.read()

# Replace Add Trainee button size and text size
content = re.sub(
    r'className="w-\[75px\] h-\[55px\] flex items-center justify-center text-center px-1 py-1 text-\[12px\] font-semibold rounded-md btn-aluminium-brushed text-green-500"',
    'className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-green-500"',
    content
)

# Replace Delete Trainee button size and text size
content = re.sub(
    r'className="w-\[75px\] h-\[55px\] flex items-center justify-center text-center px-1 py-1 text-\[12px\] font-semibold rounded-md btn-aluminium-brushed text-red-500"',
    'className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed text-red-500"',
    content
)

# Find ViewToggleButton component definition and update its default className
# Looking for the ViewToggleButton component in the file
# It likely has a className prop that we need to update

# Write the file
with open('components/CourseRosterView.tsx', 'w') as f:
    f.write(content)

print('✓ Updated Add Trainee, Delete Trainee button sizes to 56x41px, text to 10px')
print('✓ Need to manually check ViewToggleButton component for Active/Archived Courses buttons')