import os
import sys

# Add current directory to path
sys.path.insert(0, '.')

print("Current directory:", os.getcwd())
print("\nDirectory contents:")
for item in os.listdir('.'):
    print(f"  {item}")
    
# Check if DFP-NEO-V2-fresh exists
if os.path.exists('DFP-NEO-V2-fresh'):
    print("\nDFP-NEO-V2-fresh contents:")
    for item in os.listdir('DFP-NEO-V2-fresh'):
        print(f"  {item}")
        
    # Check components directory
    comp_dir = 'DFP-NEO-V2-fresh/components'
    if os.path.exists(comp_dir):
        print("\nComponents directory contents:")
        for item in sorted(os.listdir(comp_dir)):
            print(f"  {item}")
            
            # Look for build-related files
            if 'build' in item.lower() or 'schedule' in item.lower():
                print(f"    -> BUILD/SCHEDULE RELATED FILE")
else:
    print("\nDFP-NEO-V2-fresh directory not found!")