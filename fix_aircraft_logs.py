#!/usr/bin/env python3
"""Remove noisy debug console.log statements from AircraftAvailabilityOverlay.tsx"""

filepath = '/workspace/DFP-NEO-V2-fresh/components/AircraftAvailabilityOverlay.tsx'

with open(filepath, 'r') as f:
    lines = f.readlines()

def remove_console_log_block(lines, start_idx):
    """Remove a multi-line console.log(...) block starting at start_idx.
    Returns the index after the closing semicolon line."""
    depth = 0
    j = start_idx
    found_open = False
    while j < len(lines):
        for ch in lines[j]:
            if ch == '(':
                depth += 1
                found_open = True
            elif ch == ')' and found_open:
                depth -= 1
                if depth == 0:
                    return j + 1
        j += 1
    return start_idx + 1

new_lines = []
i = 0

# Patterns that indicate a noisy console.log to remove
noisy_patterns = [
    "[LAST_SET] SET TO",
    "TIMESTAMP DEBUG",
    "CREATING NEW SNAPSHOT",
    "SNAPSHOTS UPDATED",
    "RENDER HISTORICAL LINES",
    "Skipping Line",
    "TIMESTAMP COMPARISON",
    "SOLID LINE CALCULATION",
    "Line ${i}:",
]

removed_blocks = []

while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    if stripped.startswith('console.log('):
        is_noisy = any(pattern in line for pattern in noisy_patterns)
        
        if is_noisy:
            end_idx = remove_console_log_block(lines, i)
            removed_blocks.append((i+1, end_idx, stripped[:70]))
            i = end_idx
            continue
    
    new_lines.append(line)
    i += 1

print(f"Removed {len(removed_blocks)} console.log blocks:")
for start, end, preview in removed_blocks:
    print(f"  Lines {start}-{end}: {preview}")

print(f"\nLines before: {len(lines)}, after: {len(new_lines)}")

with open(filepath, 'w') as f:
    f.writelines(new_lines)

print("File written successfully.")

print("\nRemaining console.logs:")
with open(filepath, 'r') as f:
    for i, line in enumerate(f, 1):
        if 'console.log' in line:
            print(f"  Line {i}: {line.rstrip()[:80]}")