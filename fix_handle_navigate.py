#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Find the handleNavigateToProfile function starting at line 8814 (index 8813)
# and fix the onShowSuccess issues
for i in range(len(lines)):
    # Look for onShowSuccess in the context of handleNavigateToProfile
    if 'onShowSuccess' in lines[i] and i > 8800 and i < 8850:
        # Replace onShowSuccess with setSuccessMessage
        lines[i] = lines[i].replace('onShowSuccess', 'setSuccessMessage')
        # Remove the if wrapper on the next line if it's the opening brace
        if i + 1 < len(lines) and 'if (onShowSuccess)' in lines[i+1]:
            lines[i+1] = ''
        # Remove the closing brace wrapper
        if i + 2 < len(lines) and '}' in lines[i+2] and lines[i+2].strip() == '}':
            lines[i+2] = ''

with open('App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Fixed handleNavigateToProfile function")