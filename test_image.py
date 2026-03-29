import os
files = os.listdir('.')
for f in files:
    if 'Screenshot' in f and '2026-03-28' in f:
        print(f"Found: {f}")
        print(f"Exists: {os.path.exists(f)}")