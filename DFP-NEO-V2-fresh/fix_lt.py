#!/usr/bin/env python3
"""Fix JSX text content: replace bare < with < before { or <span"""

with open("components/tabs/TrainingIntelligenceTab.tsx", "rb") as f:
    content = f.read()

lines = content.split(b'\n')
lt = b'<'
fixed = 0

for i, line in enumerate(lines):
    changed = False
    # Fix \< back to < first (previous botched attempt)
    if b'\\<' in line:
        line = line.replace(b'\\<', b'<')
        changed = True

    # Now fix any remaining bare " < {" or " < <span"
    if b' < {' in line and b'< {' not in line:
        line = line.replace(b' < {', b' < {')
        changed = True
    if b' < <span' in line and b'< <span' not in line:
        line = line.replace(b' < <span', b' < <span')
        changed = True
    # Fix "avg < 3.5" type patterns in text
    if b'< 3.5' in line:
        line = line.replace(b'< 3.5', b'< 3.5')
        changed = True

    if changed:
        lines[i] = line
        fixed += 1
        print(f"  Line {i+1}: {line.strip()!r}")

content = b'\n'.join(lines)
with open("components/tabs/TrainingIntelligenceTab.tsx", "wb") as f:
    f.write(content)

print(f"\n✓ Fixed {fixed} lines")

# Verify no remaining issues
import re
remaining = [i+1 for i, l in enumerate(content.split(b'\n'))
             if re.search(b'[^&!] < [\x7b\x3c]', l)]
print(f"Remaining lines with bare ' < [{{<]': {remaining}")