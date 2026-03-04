import os

# Search for prisma schema files
for root, dirs, files in os.walk('/workspace'):
    for file in files:
        if file.endswith('.prisma'):
            print(f"Found: {os.path.join(root, file)}")

# Search for .env files
for root, dirs, files in os.walk('/workspace'):
    for file in files:
        if file == '.env' or file.startswith('.env.'):
            print(f"Found env: {os.path.join(root, file)}")