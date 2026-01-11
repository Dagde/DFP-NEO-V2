#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Add debug logs for trainee search
for i in range(len(lines)):
    if i > 8830 and i < 8850 and 'const trainee = traineesData.find' in lines[i]:
        # Find the closing of the trainee variable
        for j in range(i, min(i + 10, len(lines))):
            if 'if (trainee)' in lines[j]:
                # Insert debug logs before the if
                indent = '               '
                lines.insert(j, f'{indent}console.log("Trainee search result:", trainee);\n')
                lines.insert(j, f'{indent}console.log("Trainees count:", traineesData.length);\n')
                lines.insert(j, f'{indent}console.log("First 3 trainees:", traineesData.slice(0, 3).map(t => ({{name: t.name, idNumber: t.idNumber}})));\n')
                break
        break

with open('App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ Added more debug logs")