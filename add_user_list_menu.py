#!/usr/bin/env python3

with open('/workspace/components/SettingsViewWithMenu.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the menu items array
old_permissions_item = '''          { id: 'permissions' as const, label: 'Permissions', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
          )},
      ];'''

new_permissions_item = '''          { id: 'permissions' as const, label: 'Permissions', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
          )},
          { id: 'user-list' as const, label: 'User List', icon: (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
          )},
      ];'''

content = content.replace(old_permissions_item, new_permissions_item)

# Update the type definition
old_type = '''type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone';'''
new_type = '''type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone' | 'user-list';'''

content = content.replace(old_type, new_type)

# Add import for UserListSection
old_import = "import { SettingsView } from './SettingsView';"
new_import = "import { SettingsView } from './SettingsView';\nimport { UserListSection } from './UserListSection';"

content = content.replace(old_import, new_import)

with open('/workspace/components/SettingsViewWithMenu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully added User List menu item")