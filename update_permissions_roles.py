#!/usr/bin/env python3
import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update Permissions panel - change grid-cols-2 to grid-cols-3, increase text size
    content = re.sub(
        r'(\{/\* Permissions panel \*/\}\s*<div[^>]*>\s*<div[^>]*>Permissions</div>\s*<div className=")grid grid-cols-2 gap-x-1 gap-y-0\.5(">)',
        r'\1grid grid-cols-3 gap-x-1.5 gap-y-0.5\2',
        content
    )
    
    # Update text size in Permissions panel from text-[9px] to text-[10px]
    content = re.sub(
        r'(\{/\* Permissions panel \*/\}.*?<div className="text-white )text-\[9px\]',
        r'\1text-[10px]',
        content,
        flags=re.DOTALL
    )
    
    # Update Roles panel - change grid-cols-2 to grid-cols-3, increase text size
    content = re.sub(
        r'(\{/\* Roles panel \*/\}\s*<div[^>]*>\s*<div[^>]*>Roles</div>\s*<div className=")grid grid-cols-2 gap-x-1 gap-y-0\.5(">)',
        r'\1grid grid-cols-3 gap-x-1.5 gap-y-0.5\2',
        content
    )
    
    # Update text size in Roles panel from text-[9px] to text-[10px]
    content = re.sub(
        r'(\{/\* Roles panel \*/\}.*?<div className="text-white )text-\[9px\]',
        r'\1text-[10px]',
        content,
        flags=re.DOTALL
    )
    
    # Update "None" text from text-[9px] to text-[10px] in both panels
    content = re.sub(
        r'(text-gray-500 )text-\[9px\]( italic)',
        r'\1text-[10px]\2',
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Updated {filepath}")

# Update both files
update_file('/workspace/DFP-NEO-V2-fresh/components/InstructorProfileFlyout.tsx')
update_file('/workspace/DFP-NEO-V2-fresh/components/TraineeProfileFlyout.tsx')

print("Done!")