#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx', 'r') as f:
    content = f.read()

# Fix the escaped quotes in Crew field
content = content.replace("instructor.crew || \\\\'N/A\\\\\\'", "instructor.crew || 'N/A'")
content = content.replace("instructor.crew || \\'N/A\\'", "instructor.crew || 'N/A'")
content = content.replace("instructor.crew || \\'N/A'", "instructor.crew || 'N/A'")

with open('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Fixed Crew quotes in InstructorProfileFlyout.tsx")