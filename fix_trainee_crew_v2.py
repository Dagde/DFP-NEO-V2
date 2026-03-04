#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    lines = f.readlines()

# Find and fix the Crew line
for i, line in enumerate(lines):
    if "trainee.crew ||" in line and "\\\\'N/A\\\\\\'" in line:
        lines[i] = line.replace("trainee.crew || \\\\'N/A\\\\\\'", "trainee.crew || 'N/A'")
        print(f"Fixed line {i+1}")

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.writelines(lines)

print("Done!")