import re

with open('components/FlightDetailModal.tsx', 'r') as f:
    content = f.read()

# Find the alert panel section by line numbers
lines = content.split('\n')

# Find start and end lines
start_line = None
end_line = None

for i, line in enumerate(lines):
    if 'Alert Panel Modal' in line and '\u2500' in line:
        start_line = i
    if start_line and i > start_line and line.strip() == ')}' and i > start_line + 50:
        # Check the next line is something else (Delete Choice Modal or similar)
        if i + 1 < len(lines) and ('Delete Choice Modal' in lines[i+1] or lines[i+1].strip() == '' or 'showDeleteChoice' in lines[i+2] if i+2 < len(lines) else True):
            end_line = i
            break

print(f"Alert Panel: lines {start_line} to {end_line}")
print(f"Start line: {lines[start_line][:80]}")
print(f"End line: {lines[end_line][:80]}")
if end_line:
    print(f"Next line: {lines[end_line+1][:80]}")