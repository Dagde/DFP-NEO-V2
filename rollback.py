import subprocess
import os

os.chdir('/workspace')

# Create new branch from stable commit
subprocess.run(['git', 'checkout', '-b', 'rollback-stable'], check=True)

# Build the stable version
subprocess.run(['npm', 'run', 'build'], check=True)

# Copy to deployment directory
subprocess.run('cp -r dist/* dfp-neo-platform/public/flight-school-app/', shell=True, check=True)

# Force push to feature branch
subprocess.run(['git', 'push', '-f', 'origin', 'rollback-stable:feature/comprehensive-build-algorithm'], check=True)

print("✓ Rollback complete!")