#!/usr/bin/env python3
import re

with open('components/SettingsView.tsx', 'r') as f:
    lines = f.readlines()

# Find and remove header divs with h2 tags
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if this is a header div with h2
    if 'p-4 flex justify-between items-center border-b border-gray-700' in line:
        # Check if next line has h2
        if i + 1 < len(lines) and '<h2 className="text-lg font-semibold text-gray-200">' in lines[i + 1]:
            # This is a section header we want to remove
            # Find the closing </div> for this header
            depth = 1
            start = i
            i += 1
            
            while i < len(lines) and depth > 0:
                if '<div' in lines[i]:
                    depth += 1
                if '</div>' in lines[i]:
                    depth -= 1
                i += 1
            
            # Remove these lines
            del lines[start:i]
            i = start
            continue
    
    i += 1

# Also fix the inner div padding
for i in range(len(lines)):
    if '<div className="p-4 space-y-4">' in lines[i]:
        lines[i] = lines[i].replace('<div className="p-4 space-y-4">', '<div className="space-y-4">')

with open('components/SettingsView.tsx', 'w') as f:
    f.writelines(lines)

print("All section headers cleaned")