#!/usr/bin/env python3
# Add Staff MockData and Staff Combined Data tabs to SettingsViewWithMenu.tsx

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    lines = f.readlines()

# Step 1: Update the type definition (line 60)
for i, line in enumerate(lines):
    if "type SettingsSection = " in line and "'staff-database'" in line and "'staff-mockdata'" not in line:
        lines[i] = line.replace("';", " | 'staff-mockdata' | 'staff-combined-data';\n")
        print(f"Step 1: Updated type definition at line {i+1}")
        break

# Step 2: Find the menuItems array and add the new items
menu_items_inserted = False
for i in range(len(lines) - 1, 0, -1):
    if "];" in lines[i] and not menu_items_inserted:
        # Check if this is the menuItems array by looking backwards
        found_menu_items = False
        for j in range(max(0, i-10), i):
            if "const menuItems = [" in lines[j]:
                found_menu_items = True
                break
        
        if found_menu_items:
            # Insert the new menu items before the ];
            indent = "                 "
            new_items = [
                f"{indent}{{ id: 'staff-mockdata' as const, label: 'Staff MockData', icon: (\n",
                f"{indent}    <svg xmlns=&quot;http://www.w3.org/2000/svg&quot; className=&quot;h-5 w-5&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>\n",
                f"{indent}        <path d=&quot;M9 2a1 1 0 000 2h2a1 1 0 100-2H9z&quot; />\n",
                f"{indent}        <path fillRule=&quot;evenodd&quot; d=&quot;M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z&quot; clipRule=&quot;evenodd&quot; />\n",
                f"{indent}    </svg>\n",
                f"{indent})}},\n",
                f"{indent}{{ id: 'staff-combined-data' as const, label: 'Staff Combined Data', icon: (\n",
                f"{indent}    <svg xmlns=&quot;http://www.w3.org/2000/svg&quot; className=&quot;h-5 w-5&quot; viewBox=&quot;0 0 20 20&quot; fill=&quot;currentColor&quot;>\n",
                f"{indent}        <path d=&quot;M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z&quot; />\n",
                f"{indent}    </svg>\n",
                f"{indent})}},\n"
            ]
            for item in reversed(new_items):
                lines.insert(i, item)
            print(f"Step 2: Added menu items at line {i+1}")
            menu_items_inserted = True
            break

# Step 3: Add heading displays
for i, line in enumerate(lines):
    if "{activeSection === 'staff-database' && 'Staff Database'}" in line:
        indent = "                                     "
        lines.insert(i+1, f"{indent}{{activeSection === 'staff-mockdata' && 'Staff MockData'}}\n")
        lines.insert(i+2, f"{indent}{{activeSection === 'staff-combined-data' && 'Staff Combined Data'}}\n")
        print(f"Step 3: Added heading displays at line {i+1}")
        break

# Step 4: Add content sections
for i, line in enumerate(lines):
    if "activeSection === 'staff-database' && (" in line:
        # Find the end of this section
        end_line = None
        for j in range(i, min(i+20, len(lines))):
            if ")})" in lines[j]:
                end_line = j
                break
        
        if end_line:
            indent = "                             "
            new_sections = [
                f"{indent}{{activeSection === 'staff-mockdata' && (\n",
                f"{indent}    <div className=&quot;text-center py-12&quot;>\n",
                f"{indent}        <div className=&quot;text-6xl mb-4&quot;>📋</div>\n",
                f"{indent}        <h3 className=&quot;text-xl font-bold text-gray-300 mb-2&quot;>Staff MockData</h3>\n",
                f"{indent}        <p className=&quot;text-gray-400&quot;>This section is under construction.</p>\n",
                f"{indent}    </div>\n",
                f"{indent})}},\n",
                f"{indent}{{activeSection === 'staff-combined-data' && (\n",
                f"{indent}    <div className=&quot;text-center py-12&quot;>\n",
                f"{indent}        <div className=&quot;text-6xl mb-4&quot;>🔗</div>\n",
                f"{indent}        <h3 className=&quot;text-xl font-bold text-gray-300 mb-2&quot;>Staff Combined Data</h3>\n",
                f"{indent}        <p className=&quot;text-gray-400&quot;>This section is under construction.</p>\n",
                f"{indent}    </div>\n",
                f"{indent})}},\n"
            ]
            for item in reversed(new_sections):
                lines.insert(end_line + 1, item)
            print(f"Step 4: Added content sections at line {end_line+1}")
            break

# Write the modified content back
with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.writelines(lines)

print("\nAll changes applied successfully!")