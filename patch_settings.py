with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# 1. Add menu item after staff-database closing )},
old_menu = "                 )},\n                    { id: 'staff-mockdata' as const, label: 'Staff MockData'"
new_menu = (
    "                 )},\n"
    "                 { id: 'trainee-database' as const, label: 'Trainee Database', icon: (\n"
    "                     <svg xmlns=&quot;http://www.w3.org/2000/svg&quot; className=&quot;h-5 w-5&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>\n"
    "                         <path d=&quot;M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z&quot; />\n"
    "                     </svg>\n"
    "                 )},\n"
    "                    { id: 'staff-mockdata' as const, label: 'Staff MockData'"
)
if old_menu in content:
    content = content.replace(old_menu, new_menu, 1)
    print("OK menu item")
else:
    print("FAIL menu item")
    idx = content.find("staff-mockdata' as const")
    print(repr(content[idx-40:idx+40]))

# 2. Add title heading
old_title = "                                  {activeSection === 'staff-database' && 'Staff Database'}\n                                  {activeSection === 'staff-mockdata'"
new_title = (
    "                                  {activeSection === 'staff-database' && 'Staff Database'}\n"
    "                                  {activeSection === 'trainee-database' && 'Trainee Database'}\n"
    "                                  {activeSection === 'staff-mockdata'"
)
if old_title in content:
    content = content.replace(old_title, new_title, 1)
    print("OK title")
else:
    print("FAIL title")
    idx = content.find("staff-database' && 'Staff Database'")
    print(repr(content[idx-5:idx+100]))

# 3. Add render section
old_render = "                          {activeSection === 'staff-database' && (\n                                <StaffDatabaseTable />\n                            )}"
new_render = (
    "                          {activeSection === 'staff-database' && (\n"
    "                                <StaffDatabaseTable />\n"
    "                            )}\n"
    "                               {activeSection === 'trainee-database' && (\n"
    "                                   <TraineeDatabaseTable />\n"
    "                               )}"
)
if old_render in content:
    content = content.replace(old_render, new_render, 1)
    print("OK render")
else:
    print("FAIL render")
    idx = content.find("staff-database' && (")
    print(repr(content[idx-5:idx+120]))

with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)
print("Done")