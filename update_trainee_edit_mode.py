#!/usr/bin/env python3
import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update TraineeProfileFlyout edit mode Permissions section - change grid-cols-2 to grid-cols-3
    content = re.sub(
        r'(<legend.*?>Permissions</legend>.*?isEditing \? \(\s*<div className=")grid grid-cols-2 gap-x-4 gap-y-3(">)',
        r'\1grid grid-cols-3 gap-x-3 gap-y-2\2',
        content,
        flags=re.DOTALL
    )
    
    # Update TraineeProfileFlyout edit mode Roles section - change grid-cols-2 to grid-cols-3
    content = re.sub(
        r'(<legend.*?>Roles</legend>.*?isEditing \? \(\s*<div className=")grid grid-cols-2 gap-x-4 gap-y-3(">)',
        r'\1grid grid-cols-3 gap-x-3 gap-y-2\2',
        content,
        flags=re.DOTALL
    )
    
    # Update text size in TraineeProfileFlyout edit mode Permissions
    content = re.sub(
        r'(<legend.*?>Permissions</legend>.*?allPermissions\.map\(perm => \(.*?<span className=")text-white(">)',
        r'\1text-white text-[11px]\2',
        content,
        flags=re.DOTALL
    )
    
    # Update text size in TraineeProfileFlyout edit mode Roles
    content = re.sub(
        r'(<legend.*?>Roles</legend>.*?allRoles\.map\(role => \(.*?<span className=")text-white(">)',
        r'\1text-white text-[11px]\2',
        content,
        flags=re.DOTALL
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

# Update TraineeProfileFlyout
update_file('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")