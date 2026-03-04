import os

# Find the exact filename
filename = None
for f in os.listdir('/workspace'):
    if '1.48' in f and 'Screenshot' in f:
        filename = f
        print(f"Found file: {filename}")
        print(f"Full path: /workspace/{filename}")
        break

if filename:
    # Try to read it as binary to confirm it exists
    try:
        with open(f'/workspace/{filename}', 'rb') as f:
            size = len(f.read())
            print(f"File size: {size} bytes")
    except Exception as e:
        print(f"Error reading file: {e}")
else:
    print("File not found")