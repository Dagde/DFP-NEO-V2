with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

# Lines that need fixing (0-indexed)
lines_to_fix = [2939, 2948, 2993, 3002, 3592, 3601, 8779, 8788]

for i in lines_to_fix:
    if i < len(lines) and lines[i].startswith('                setSuccessMessage'):
        lines[i] = '             ' + lines[i][16:]

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(lines)

print(f"Fixed {len(lines_to_fix)} lines")