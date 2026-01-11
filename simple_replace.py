#!/usr/bin/env python3
import re

with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Process lines to fix the handleNavigateToProfile function
new_lines = []
skip_next_brace = False

for i, line in enumerate(lines):
    # Look for the handleNavigateToProfile function area
    if i > 8810 and i < 8860:
        # Skip if (onShowSuccess) lines
        if 'if (onShowSuccess)' in line:
            continue
        # Skip closing braces that were part of the if statement
        if skip_next_brace and line.strip() == '}':
            skip_next_brace = False
            continue
        # Replace onShowSuccess with setSuccessMessage
        if 'onShowSuccess(' in line:
            line = line.replace('onShowSuccess(', 'setSuccessMessage(')
            skip_next_brace = True
    new_lines.append(line)

with open('App.tsx', 'w') as f:
    f.writelines(new_lines)

print("✅ Fixed handleNavigateToProfile function")