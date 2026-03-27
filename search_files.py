import os

def find_files_with_keyword(root_dir, keyword, extension='.tsx'):
    matches = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(extension):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        if keyword.lower() in content.lower():
                            matches.append(file_path)
                except Exception as e:
                    pass
    return matches

# Search for build-related files
print("Searching for build-related files...")
build_files = find_files_with_keyword('DFP-NEO-V2-fresh', 'build')
print(f"\nFound {len(build_files)} files with 'build':")
for f in build_files[:20]:
    print(f)

# Search for trainee-related files
print("\n\nSearching for trainee-related files...")
trainee_files = find_files_with_keyword('DFP-NEO-V2-fresh', 'trainee')
print(f"\nFound {len(trainee_files)} files with 'trainee':")
for f in trainee_files[:20]:
    print(f)