#!/usr/bin/env python3
import re

# Read the file
with open('components/SettingsView.tsx', 'r') as f:
    lines = f.readlines()

# Find the line with "Scoring Matrix Window"
scoring_matrix_line = None
for i, line in enumerate(lines):
    if '{/* Scoring Matrix Window */}' in line:
        scoring_matrix_line = i
        break

if scoring_matrix_line is None:
    print("Could not find Scoring Matrix Window comment")
    exit(1)

# Insert the conditional rendering wrapper
lines[scoring_matrix_line] = '                    {/* Scoring Matrix Section */}\n                    {activeSection === \'scoring-matrix\' && (\n' + lines[scoring_matrix_line]

# Find the closing div for Scoring Matrix section (next section start)
location_line = None
for i in range(scoring_matrix_line + 1, len(lines)):
    if '{/* Location Window */}' in line or 'Location Window' in lines[i]:
        location_line = i
        break

if location_line:
    # Add closing for scoring matrix conditional
    lines[location_line - 1] = lines[location_line - 1].rstrip() + '\n                    )}\n\n'
    # Add conditional for location
    lines[location_line] = '                    {/* Location Section */}\n                    {activeSection === \'location\' && (\n' + lines[location_line]

print(f"Found Scoring Matrix at line {scoring_matrix_line}")
print(f"Found Location at line {location_line}")

# Write back
with open('components/SettingsView.tsx', 'w') as f:
    f.writelines(lines)

print("File modified successfully")