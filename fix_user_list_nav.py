#!/usr/bin/env python3

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    lines = f.readlines()

# Find line 196 (the onShowSuccess line) and add onNavigateToProfile after it
for i, line in enumerate(lines):
    if i == 195 and 'onShowSuccess' in line:  # Line 195 (0-indexed)
        # Insert the new prop after this line
        indent = '                                  '
        new_line = f'{indent}onNavigateToProfile={props.onNavigateToProfile}\n'
        lines.insert(i + 1, new_line)
        print(f"✅ Added onNavigateToProfile prop at line {i+2}")
        break

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.writelines(lines)
    
print("✅ File updated successfully")