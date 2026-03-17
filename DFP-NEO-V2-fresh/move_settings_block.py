with open('App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

total_lines = len(lines)
print(f"Total lines: {total_lines}")

# Find all key line numbers
start_line = None
end_line = None
insertion_line = None

for i, line in enumerate(lines):
    if 'SETTINGS: Load from DB on startup' in line and start_line is None:
        start_line = i
    if 'Show commit alert on app mount - DISABLED' in line and end_line is None:
        end_line = i  # First line AFTER our block
    if '// Baseline schedule state' in line and insertion_line is None:
        insertion_line = i

print(f"Settings block: lines {start_line+1} to {end_line} (0-indexed: {start_line} to {end_line-1})")
print(f"Insertion point (Baseline schedule): line {insertion_line+1}")

if start_line is None or end_line is None or insertion_line is None:
    print("ERROR: Could not find all markers!")
    exit(1)

# Include the blank line before the settings comment
actual_start = start_line - 1
settings_block_lines = lines[actual_start:end_line]

print(f"\nSettings block ({len(settings_block_lines)} lines):")
print(f"  First line: {repr(settings_block_lines[0])}")
print(f"  Last line:  {repr(settings_block_lines[-1])}")

# Build new file:
# Part 1: before the settings block  
part1 = lines[:actual_start]
# Part 2: lines between old block end and insertion point
part2 = lines[end_line:insertion_line]
# Part 3: settings block inserted here
part3 = settings_block_lines
# Part 4: from insertion point to end
part4 = lines[insertion_line:]

new_lines = part1 + part2 + part3 + part4

print(f"\nNew file: {len(new_lines)} lines (original: {total_lines})")

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ File written!")

# Verify
with open('App.tsx', 'r', encoding='utf-8') as f:
    verify_lines = f.readlines()

settings_new_line = None
locations_new_line = None
for i, line in enumerate(verify_lines):
    if 'SETTINGS: Load from DB on startup' in line:
        settings_new_line = i + 1
    if "const [locations, setLocations]" in line:
        locations_new_line = i + 1

print(f"Settings block now at line: {settings_new_line}")
print(f"locations declared at line:  {locations_new_line}")
if settings_new_line and locations_new_line:
    if settings_new_line > locations_new_line:
        print("✅ CORRECT: Settings block is now AFTER locations declaration")
    else:
        print("❌ WRONG: Settings block is BEFORE locations declaration")