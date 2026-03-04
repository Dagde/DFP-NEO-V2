with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    content = f.read()

# 1. Add heading for trainee-mockdata after staff-mockdata heading
old_heading = "                                     {activeSection === 'staff-mockdata' && 'Staff MockData'}\n                                     {activeSection === 'staff-combined-data' && 'Staff Combined Data'}"
new_heading = "                                     {activeSection === 'staff-mockdata' && 'Staff MockData'}\n                                     {activeSection === 'trainee-mockdata' && 'Trainee MockData'}\n                                     {activeSection === 'staff-combined-data' && 'Staff Combined Data'}"

if old_heading in content:
    content = content.replace(old_heading, new_heading)
    print("Heading inserted successfully.")
else:
    print("WARNING: heading block not found!")

# 2. Add render block for trainee-mockdata after staff-mockdata render block
old_render = "                               {activeSection === 'staff-mockdata' && (\n                                   <StaffMockDataTable \n                                       instructorsData={filteredMockdata}\n                                       onDeleteFromMockdata={handleDeleteFromMockdata}\n                                   />\n                               )}"
new_render = "                               {activeSection === 'staff-mockdata' && (\n                                   <StaffMockDataTable \n                                       instructorsData={filteredMockdata}\n                                       onDeleteFromMockdata={handleDeleteFromMockdata}\n                                   />\n                               )}\n                               {activeSection === 'trainee-mockdata' && (\n                                   <TraineeMockDataTable\n                                       traineesData={filteredTraineeMockdata}\n                                       onDeleteFromMockdata={handleDeleteTraineeFromMockdata}\n                                   />\n                               )}"

if old_render in content:
    content = content.replace(old_render, new_render)
    print("Render block inserted successfully.")
else:
    print("WARNING: render block not found, trying flexible approach...")
    idx = content.find("activeSection === 'staff-mockdata'")
    # find second occurrence (the render one)
    idx2 = content.find("activeSection === 'staff-mockdata'", idx + 1)
    if idx2 >= 0:
        # find the closing )} after this
        end_idx = content.find('})', idx2)
        if end_idx >= 0:
            insert_pos = end_idx + 2
            trainee_render = "\n                               {activeSection === 'trainee-mockdata' && (\n                                   <TraineeMockDataTable\n                                       traineesData={filteredTraineeMockdata}\n                                       onDeleteFromMockdata={handleDeleteTraineeFromMockdata}\n                                   />\n                               )}"
            content = content[:insert_pos] + trainee_render + content[insert_pos:]
            print("Render block inserted via flexible approach.")

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.write(content)

print("Done.")