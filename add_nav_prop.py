#!/usr/bin/env python3

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Find and replace the UserListSection component
old_section = """                          {activeSection === 'user-list' && (
                              <UserListSection
                                  currentUserPermission={props.currentUserPermission}
                                  onShowSuccess={props.onShowSuccess}
                              />
                          )}"""

new_section = """                          {activeSection === 'user-list' && (
                              <UserListSection
                                  currentUserPermission={props.currentUserPermission}
                                  onShowSuccess={props.onShowSuccess}
                                  onNavigateToProfile={props.onNavigateToProfile}
                              />
                          )}"""

# Count occurrences
count = content.count(old_section)
print(f"Found {count} occurrences of the old section")

if count > 0:
    content = content.replace(old_section, new_section)
    with open('components/SettingsViewWithMenu.tsx', 'w') as f:
        f.write(content)
    print("✅ Successfully added onNavigateToProfile prop")
else:
    # Let's show what's around line 195
    lines = content.split('\n')
    print("\n=== Lines around UserListSection (192-200) ===")
    for i, line in enumerate(lines[191:200], start=192):
        print(f"{i}: {repr(line)}")