with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# 1. Add import
old_import = 'import TraineeMockDataTable from "./TraineeMockDataTable";'
new_import = 'import TraineeMockDataTable from "./TraineeMockDataTable";\nimport DataSourcesSettings from "./DataSourcesSettings";'
if old_import in content:
    content = content.replace(old_import, new_import)
    print("Import added.")

# 2. Add 'data-sources' to SettingsSection type
old_type = "'staff-mockdata' | 'trainee-mockdata' | 'staff-combined-data';"
new_type = "'staff-mockdata' | 'trainee-mockdata' | 'staff-combined-data' | 'data-sources';"
if old_type in content:
    content = content.replace(old_type, new_type)
    print("SettingsSection type updated.")

# 3. Add Data Sources menu item before staff-combined-data menu item
# Find the staff-combined-data menu item and insert Data Sources before it
data_sources_menu = """                    { id: 'data-sources' as const, label: 'Data Sources', icon: (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                        </svg>
                    )},
"""

# Find the staff-combined-data menu item line
idx = content.find("{ id: 'staff-combined-data' as const")
if idx >= 0:
    content = content[:idx] + data_sources_menu + content[idx:]
    print("Data Sources menu item added.")

# 4. Add heading for data-sources
old_heading = "{activeSection === 'staff-combined-data' && 'Staff Combined Data'}"
new_heading = "{activeSection === 'staff-combined-data' && 'Staff Combined Data'}\n                                     {activeSection === 'data-sources' && 'Data Sources'}"
if old_heading in content:
    content = content.replace(old_heading, new_heading)
    print("Heading added.")

# 5. Add render block for data-sources after staff-combined-data render block
# Find the staff-combined-data render block closing
old_render_end = "{activeSection === 'staff-combined-data' && (\n                                   <StaffCombinedDataTable instructorsData={props.instructorsData} />\n                               )}"
new_render_end = """{activeSection === 'staff-combined-data' && (
                                   <StaffCombinedDataTable instructorsData={props.instructorsData} />
                               )}
                               {activeSection === 'data-sources' && (
                                   <DataSourcesSettings
                                       onShowSuccess={props.onShowSuccess}
                                   />
                               )}"""
if old_render_end in content:
    content = content.replace(old_render_end, new_render_end)
    print("Render block added.")
else:
    # Flexible approach - find the staff-combined-data render and insert after
    idx = content.find("activeSection === 'staff-combined-data'")
    # Find second occurrence (the render one, not the heading)
    idx2 = content.find("activeSection === 'staff-combined-data'", idx + 1)
    if idx2 >= 0:
        # Find the closing )} 
        end_idx = content.find('})', idx2)
        if end_idx >= 0:
            insert_pos = end_idx + 2
            trainee_render = """\n                               {activeSection === 'data-sources' && (
                                   <DataSourcesSettings
                                       onShowSuccess={props.onShowSuccess}
                                   />
                               )}"""
            content = content[:insert_pos] + trainee_render + content[insert_pos:]
            print("Render block added via flexible approach.")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)

print("Done.")