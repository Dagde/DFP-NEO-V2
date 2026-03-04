#!/usr/bin/env python3
import re

# Read the file
with open('components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Update the Archive Staff button with both background color and red pulsing effect
old_button = '''                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md ${isArchiveMode ? 'animate-pulse-red' : 'btn-aluminium-brushed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

new_button = '''                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md ${isArchiveMode ? 'bg-[#a0a0a0a0] animate-pulse-red' : 'btn-aluminium-brushed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

content = content.replace(old_button, new_button)

# Write the file
with open('components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print('✓ Fixed Archive Staff button styling:')
print('  - When pressed (Done): RED text with pulsing animation (bright to dull) + background #a0a0a0a0')
print('  - When normal (Archive Staff): btn-aluminium-brushed style')