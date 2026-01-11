#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Add debug logs after the console.log('Navigating to profile:', user); line
for i in range(len(lines)):
    if i > 8810 and i < 8820 and 'console.log' in lines[i] and 'Navigating to profile' in lines[i]:
        # Insert debug logs after this line
        indent = '           '
        lines.insert(i + 1, f'{indent}console.log("user.name:", user.name);\n')
        lines.insert(i + 2, f'{indent}console.log("user.pmkeysId:", user.pmkeysId);\n')
        print(f"Added debug logs after line {i + 1}")
        break

with open('App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Added debug logs to handleNavigateToProfile")