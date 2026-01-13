#!/usr/bin/env python3
# Add heading displays for staff-mockdata and staff-combined-data

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

old_heading = """                                  {activeSection === 'user-list' && 'User List'}
                                     {activeSection === 'staff-database' && 'Staff Database'}
                           </h2>"""

new_heading = """                                  {activeSection === 'user-list' && 'User List'}
                                     {activeSection === 'staff-database' && 'Staff Database'}
                                     {activeSection === 'staff-mockdata' && 'Staff MockData'}
                                     {activeSection === 'staff-combined-data' && 'Staff Combined Data'}
                           </h2>"""

content = content.replace(old_heading, new_heading)
print("Step 3: Heading displays added")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)