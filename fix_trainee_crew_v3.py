#!/usr/bin/env python3

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'r') as f:
    content = f.read()

# Find the exact pattern and replace it
old_pattern = '''<div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || \\\\'N/A\\\\\\'}</span></div>'''
new_pattern = '''<div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || 'N/A'}</span></div>'''

if old_pattern in content:
    content = content.replace(old_pattern, new_pattern)
    print("Found and replaced Crew line")
else:
    print("Pattern not found, trying alternative...")
    # Try with different escape patterns
    content = content.replace("trainee.crew || \\\\'N/A\\\\\\'", "trainee.crew || 'N/A'")
    content = content.replace("trainee.crew || \\'N/A\\'", "trainee.crew || 'N/A'")
    content = content.replace("trainee.crew || \\'N/A'", "trainee.crew || 'N/A'")

with open('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx', 'w') as f:
    f.write(content)

print("Done!")