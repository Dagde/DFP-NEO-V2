#!/usr/bin/env python3

with open('/workspace/components/SettingsViewWithMenu.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with permissions in the title
for i, line in enumerate(lines):
    if "activeSection === 'permissions'" in line and "'Permissions Manager'" in line:
        # Add the user-list line after permissions
        indent = '                               '
        user_list_line = f'{indent}{{activeSection === \'user-list\' && \'User List\'}}\n'
        lines.insert(i + 1, user_list_line)
        break

# Find the SettingsView component call and add UserListSection after it
for i, line in enumerate(lines):
    if '<SettingsView {...props} hideHeader={true} activeSection={activeSection} />' in line:
        # Add UserListSection after SettingsView
        indent = '                       '
        user_list_component = f'{indent}{{activeSection === \'user-list\' && (\n{indent}    <UserListSection\n{indent}        currentUserPermission={{props.currentUserPermission}}\n{indent}        onShowSuccess={{props.onShowSuccess}}\n{indent}    />\n{indent})}}\n'
        lines.insert(i + 1, user_list_component)
        break

with open('/workspace/components/SettingsViewWithMenu.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Successfully added User List rendering")