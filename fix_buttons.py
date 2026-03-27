import subprocess
import os
import sys

# Clone the repo
result = subprocess.run(
    ['git', 'clone', 
     f'https://x-access-token:{os.environ.get("GITHUB_TOKEN")}@github.com/Dagde/DFP-NEO-V2.git',
     '/tmp/repo',
     '--branch', 'feature/comprehensive-build-algorithm',
     '--single-branch',
     '--depth=1'],
    capture_output=True, text=True
)
print("CLONE STDOUT:", result.stdout)
print("CLONE STDERR:", result.stderr)
print("CLONE RC:", result.returncode)

if result.returncode != 0:
    print("Clone failed!")
    sys.exit(1)

# Read the file
file_path = '/tmp/repo/components/FlightDetailModal.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"\nFile read successfully. Length: {len(content)}")

# Search for PT-051, LMP, Trainee Scores buttons
import re

# Find occurrences of these button labels
for label in ['PT-051', 'PT051', 'LMP', 'Trainee Scores', 'handlePt051', 'handleLmp', 'handleTraineeScores']:
    indices = [m.start() for m in re.finditer(label, content, re.IGNORECASE)]
    print(f"\n'{label}' found at positions: {indices}")
    for idx in indices:
        print(f"  Context: ...{content[max(0,idx-100):idx+200]}...")
        print("  ---")