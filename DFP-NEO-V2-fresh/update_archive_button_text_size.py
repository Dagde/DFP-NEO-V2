#!/usr/bin/env python3
import re

# Read the file
with open('components/InstructorListView.tsx', 'r') as f:
    content = f.read()

# Update the Archive Staff button text size to 12px
old_button = '''                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold rounded-md ${isArchiveMode ? 'text-red-500 bg-[#a0a0a0a0] animate-pulse-red' : 'btn-aluminium-brushed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

new_button = '''                <button
                    onClick={toggleArchiveMode}
                    className={`w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md ${isArchiveMode ? 'text-red-500 bg-[#a0a0a0a0] animate-pulse-red' : 'btn-aluminium-brushed'}`}
                >
                    {isArchiveMode ? 'Done' : 'Archive Staff'}
                </button>'''

content = content.replace(old_button, new_button)

# Write the file
with open('components/InstructorListView.tsx', 'w') as f:
    f.write(content)

print('✓ Updated Archive Staff button text size to 12px')