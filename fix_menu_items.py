#!/usr/bin/env python3
# Fix menu items insertion

with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    lines = f.readlines()

# Find the line number of "];" in the menuItems array
found_menu_items = False
menu_items_end = -1
for i, line in enumerate(lines):
    if "const menuItems = [" in line:
        found_menu_items = True
    if found_menu_items and "];" in line:
        menu_items_end = i
        break

print(f"Found menuItems array ending at line {menu_items_end + 1}")

# Read the new menu items
with open('new_menu_items.txt', 'r') as f:
    new_items = f.readlines()

# Insert the new items before the "];" line
for item in reversed(new_items):
    lines.insert(menu_items_end, item)

# Write back
with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.writelines(lines)

print(f"Inserted {len(new_items)} lines before line {menu_items_end + 1}")