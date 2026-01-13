#!/usr/bin/env python3
# Update SettingsViewWithMenu.tsx to add staff-mockdata and staff-combined-data tabs

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Step 1: Update the type definition
old_type = "type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone' | 'user-list' | 'staff-database';"
new_type = "type SettingsSection = 'validation' | 'scoring-matrix' | 'location' | 'units' | 'duty-turnaround' | 'sct-events' | 'currencies' | 'data-loaders' | 'event-limits' | 'permissions' | 'business-rules' | 'timezone' | 'user-list' | 'staff-database' | 'staff-mockdata' | 'staff-combined-data';"
content = content.replace(old_type, new_type)
print("Step 1: Type definition updated")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)