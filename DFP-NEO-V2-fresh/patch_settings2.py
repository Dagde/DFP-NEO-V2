with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# Find the staff-mockdata menu item block and insert trainee-mockdata after it
old_menu = """                    { id: 'staff-mockdata' as const, label: 'Staff MockData', icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                    )},"""

new_menu = """                    { id: 'staff-mockdata' as const, label: 'Staff MockData', icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                    )},
                    { id: 'trainee-mockdata' as const, label: 'Trainee MockData', icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                    )},"""

if old_menu in content:
    content = content.replace(old_menu, new_menu)
    print("Menu item inserted successfully.")
else:
    # Try line-by-line search
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "'staff-mockdata' as const" in line and 'Staff MockData' in line:
            print(f"Found staff-mockdata at line {i}: {line}")
    print("WARNING: exact match not found, trying flexible approach...")
    # Find the staff-mockdata block end and insert after
    idx = content.find("'staff-mockdata' as const")
    if idx >= 0:
        # Find the closing )}," after this
        end_idx = content.find(')},', idx)
        if end_idx >= 0:
            insert_pos = end_idx + 3
            trainee_menu = """
                    { id: 'trainee-mockdata' as const, label: 'Trainee MockData', icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                    )},"""
            content = content[:insert_pos] + trainee_menu + content[insert_pos:]
            print("Inserted via flexible approach.")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)

print("Done.")