with open('/workspace/lib/dataService.ts', 'r') as f:
    lines = f.readlines()

# Remove the conditional check for trainees
new_lines = []
skip_next_brace = False

for i, line in enumerate(lines):
    # Skip the if (dataSourceSettings.trainee) line
    if 'if (dataSourceSettings.trainee)' in line:
        skip_next_brace = True
        continue
    
    # Skip the console.log about trainee toggle
    if 'Trainee toggle is ON' in line:
        continue
    
    # Skip the closing brace of the if statement
    if skip_next_brace and line.strip() == '}':
        skip_next_brace = False
        continue
    
    new_lines.append(line)

# Now add the trainee merge unconditionally
for i, line in enumerate(new_lines):
    if '// Fetch aircraft' in line:
        # Add trainee merge before this line
        indent = '         '
        merge_lines = [
            f"{indent}// Always merge with mock data for trainees\n",
            f"{indent}trainees = mergeTraineeData(trainees, ESL_DATA.trainees);\n",
            "\n"
        ]
        new_lines = new_lines[:i] + merge_lines + new_lines[i:]
        break

with open('/workspace/lib/dataService.ts', 'w') as f:
    f.writelines(new_lines)

print("Fixed trainee merge logic")