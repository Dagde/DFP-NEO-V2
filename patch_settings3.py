with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Exact: 12 spaces + )}, + \n + 17 spaces + { id: 'staff-mockdata'
old_menu = "            )},\n                 { id: 'staff-mockdata' as const, label: 'Staff MockData'"
new_menu = (
    "            )},\n"
    "                 { id: 'trainee-database' as const, label: 'Trainee Database', icon: (\n"
    "                     <svg xmlns=&quot;http://www.w3.org/2000/svg&quot; className=&quot;h-5 w-5&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>\n"
    "                         <path d=&quot;M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z&quot; />\n"
    "                     </svg>\n"
    "                 )},\n"
    "                 { id: 'staff-mockdata' as const, label: 'Staff MockData'"
)

if old_menu in content:
    content = content.replace(old_menu, new_menu, 1)
    print("OK menu item")
else:
    # Try to find the exact transition using line-based approach
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'staff-mockdata' in line:
            print(f"Line {i}: {repr(lines[i-1])}")
            print(f"Line {i}: {repr(line)}")
            break

with open('/workspace/DFP-NEO-V2-fresh/components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)
print("Done")