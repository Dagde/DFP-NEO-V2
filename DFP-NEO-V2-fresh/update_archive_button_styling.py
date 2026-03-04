#!/usr/bin/env python3
import re

# Read the file
with open('components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Update the Archive Staff button with conditional styling
old_button = '''                <button
                    onClick={toggleArchiveMode}
                    className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md btn-aluminium-brushed"
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

new_button = '''                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md ${isArchiveMode ? 'text-white bg-[#a0a0a0a0]' : 'btn-aluminium-brushed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

content = content.replace(old_button, new_button)

# Write the file
with open('components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print('✓ Updated Archive Staff button styling:')
print('  - When pressed (Done): white text, background color #a0a0a0a0')
print('  - When normal (Archive Staff): btn-aluminium-brushed style')