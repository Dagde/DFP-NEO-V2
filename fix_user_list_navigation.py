#!/usr/bin/env python3

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Find the UserListSection section and add the onNavigateToProfile prop
old_text = """                          {activeSection === 'user-list' && (
                              <UserListSection
                                  currentUserPermission={props.currentUserPermission}
                                  onShowSuccess={props.onShowSuccess}
                              />
                          )}"""

new_text = """                          {activeSection === 'user-list' && (
                              <UserListSection
                                  currentUserPermission={props.currentUserPermission}
                                  onShowSuccess={props.onShowSuccess}
                                  onNavigateToProfile={props.onNavigateToProfile}
                              />
                          )}"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open('components/SettingsViewWithMenu.tsx', 'w') as f:
        f.write(content)
    print("✅ Successfully added onNavigateToProfile prop to UserListSection")
else:
    print("❌ Could not find the target text")
    # Let's find what's actually there
    import re
    match = re.search(r'\{activeSection === \'user-list\' &&.*?<UserListSection.*?/\>', content, re.DOTALL)
    if match:
        print(f"Found: {match.group()[:200]}")