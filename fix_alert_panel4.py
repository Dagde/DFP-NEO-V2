with open('components/FlightDetailModal.tsx', 'r') as f:
    content = f.read()

lines = content.split('\n')

# Find the alert panel start and end again (it moved after previous edits)
start_line = None
end_line = None

for i, line in enumerate(lines):
    if 'Alert Panel Modal' in line and '\u2500' in line:
        start_line = i
        break

# Find end - look for the closing )} after the panel
if start_line:
    depth = 0
    for i in range(start_line + 1, len(lines)):
        stripped = lines[i].strip()
        # Count opening braces/parens in JSX context
        depth += stripped.count('{') - stripped.count('}')
        depth += stripped.count('(') - stripped.count(')')
        if depth <= 0 and stripped == ')}':
            end_line = i
            break

print(f"Alert Panel: lines {start_line} to {end_line}")
print(f"Start: {lines[start_line][:80]}")
print(f"End: {lines[end_line][:80]}")
if end_line:
    print(f"After: {lines[end_line+1][:80]}")