# Read the file
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r') as f:
    content = f.read()

import re

# Find and remove remaining drag-related console.logs with emoji characters
# These use actual unicode so search with regex
patterns = [
    r'console\.log\("🔍 Drag conflict check:", \{[^}]+\}\);',
    r'console\.log\("🐍 DRAG COMPLETE - Calling onUpdateEvent with", updates\.length, "updates:"\);',
    r'console\.log\("🐍 Updates:", updates\);',
]

changes = 0
for pattern in patterns:
    new_content = re.sub(pattern, '', content, flags=re.DOTALL)
    if new_content != content:
        content = new_content
        changes += 1
        print(f"Removed emoji console.log matching: {pattern[:50]}")
    else:
        print(f"NOT FOUND: {pattern[:50]}")

# Also search for any remaining console.logs in the drag section more broadly
# Find all console.log lines near draggingState
lines = content.split('\n')
new_lines = []
removed_count = 0
for i, line in enumerate(lines):
    # Remove console.log lines that are in the drag handler context
    stripped = line.strip()
    if (stripped.startswith('console.log(') and 
        any(kw in stripped for kw in [
            'Drag conflict', 'DRAG COMPLETE', 'Updates:', 
            'drag', 'Drag', 'dragging', 'draggingState',
            'handleMouse', 'mouseMove', 'mouseUp', 'mouseDown'
        ])):
        removed_count += 1
        print(f"Removed line {i}: {stripped[:80]}")
        new_lines.append('')
    else:
        new_lines.append(line)

content = '\n'.join(new_lines)
changes += removed_count

print(f"\nTotal additional changes: {changes}")

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'w') as f:
    f.write(content)

print("Done!")