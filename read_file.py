import os

file_path = 'DFP-NEO-V2-fresh/components/FlightDetailModal.tsx'

if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        print("File exists and is readable")
        print(f"File size: {len(content)} bytes")
        print("\nSearching for keywords...")
        
        keywords = ['trainee', 'build', 'schedule', 'roster', 'database', 'data', 'fetch']
        for keyword in keywords:
            if keyword.lower() in content.lower():
                lines_with_keyword = [line.strip() for line in content.split('\n') if keyword.lower() in line.lower()]
                print(f"\n{keyword.upper()} found in {len(lines_with_keyword)} lines:")
                for line in lines_with_keyword[:5]:  # Show first 5 occurrences
                    print(f"  {line}")
else:
    print(f"File not found: {file_path}")
    
# List all component files
comp_dir = 'DFP-NEO-V2-fresh/components'
if os.path.exists(comp_dir):
    print("\n\nAll component files:")
    for f in sorted(os.listdir(comp_dir)):
        if f.endswith('.tsx'):
            print(f"  {f}")