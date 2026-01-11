with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    # Fix lines that have exactly 16 spaces before setSuccessMessage (should be 13)
    if line.startswith('                setSuccessMessage(') and len(line) >= 16 and line[:16] == ' ' * 16:
        # Keep 13 spaces instead of 16
        new_lines.append('             ' + line[16:])
    # Fix lines that have exactly 13 spaces before handleNavigation (should be 13)
    elif line.startswith('handleNavigation(') and not line.startswith('             handleNavigation('):
        new_lines.append('             ' + line)
    else:
        new_lines.append(line)

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(new_lines)

print("Fixed indentation")