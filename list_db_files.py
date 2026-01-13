import os

# List all files in utils/db
db_path = '/workspace/utils/db'
if os.path.exists(db_path):
    for root, dirs, files in os.walk(db_path):
        for file in files:
            filepath = os.path.join(root, file)
            print(f"{filepath} ({os.path.getsize(filepath)} bytes)")
else:
    print(f"Directory {db_path} does not exist")

# Also check for prisma directory
prisma_path = '/workspace/prisma'
if os.path.exists(prisma_path):
    for root, dirs, files in os.walk(prisma_path):
        for file in files:
            filepath = os.path.join(root, file)
            print(f"PRISMA: {filepath}")