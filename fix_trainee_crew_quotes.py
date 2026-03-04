#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    content = f.read()

# Fix the escaped quotes in Crew field
content = content.replace("trainee.crew || \\\\'N/A\\\\\\'", "trainee.crew || 'N/A'")

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Fixed Crew quotes in TraineeProfileFlyout.tsx")