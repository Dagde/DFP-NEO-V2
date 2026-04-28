import re

# Read the file
with open('/workspace/components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Find the permissions menu item and add data-source after it
# Pattern to match the closing of permissions item
pattern = r"(\{ id: 'permissions' as const, label: 'Permissions', icon: \([^}]+\)\},)\n(\s+\];)"

replacement = r"""\1
           { id: 'data-source' as const, label: 'Data Source', icon: (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
               </svg>
           )},
\2"""

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write the file back
with open('/workspace/components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(new_content)

print("Data Source menu item added successfully!")