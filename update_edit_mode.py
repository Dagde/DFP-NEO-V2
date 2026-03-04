#!/usr/bin/env python3
import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update edit mode Permissions section - change grid-cols-2 to grid-cols-3
    content = re.sub(
        r'(/\* Permissions \*/.*?<label.*?>Permissions</label>\s*<div className=")grid grid-cols-2 gap-2(">)',
        r'\1grid grid-cols-3 gap-2\2',
        content,
        flags=re.DOTALL
    )
    
    # Update edit mode Roles section - change grid-cols-2 to grid-cols-3
    content = re.sub(
        r'(/\* Roles \*/.*?<label.*?>Roles</label>\s*<div className=")grid grid-cols-2 gap-2(">)',
        r'\1grid grid-cols-3 gap-2\2',
        content,
        flags=re.DOTALL
    )
    
    # Update text size in edit mode from text-xs to text-[11px] for Permissions and Roles
    content = re.sub(
        r'(/\* Permissions \*/.*?allPermissions\.map\(perm => \(.*?<span className=")text-white text-xs(">)',
        r'\1text-white text-[11px]\2',
        content,
        flags=re.DOTALL
    )
    
    content = re.sub(
        r'(/\* Roles \*/.*?<label className="flex items-center space-x-1 cursor-pointer">.*?<span className=")text-white text-xs(">)',
        r'\1text-white text-[11px]\2',
        content,
        flags=re.DOTALL
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

# Update both files
update_file('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx')
update_file('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")