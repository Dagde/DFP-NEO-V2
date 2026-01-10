# Read the file
with open('/workspace/components/SettingsViewWithMenu.tsx', 'r') as f:
    lines = f.readlines()

# Find the line with 'permissions' and add 'data-source' after it
for i, line in enumerate(lines):
    if "activeSection === 'permissions' && 'Permissions Manager'" in line:
        # Insert data-source line after this one
        lines.insert(i + 1, "                               {activeSection === 'data-source' && 'Data Source'}\n")
        break

# Write the file back
with open('/workspace/components/SettingsViewWithMenu.tsx', 'w') as f:
    f.writelines(lines)

print("Data Source title added successfully!")