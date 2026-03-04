with open('components/SettingsViewWithMenu.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    
    # After the staff-mockdata heading line, insert trainee-mockdata heading
    if "activeSection === 'staff-mockdata' && 'Staff MockData'" in line:
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + "{activeSection === 'trainee-mockdata' && 'Trainee MockData'}\n")
        print(f"Inserted trainee-mockdata heading after line {i+1}")
    
    # After the closing of the staff-mockdata render block, insert trainee-mockdata render block
    # The staff-mockdata render block ends with:  />
    #                                             )}
    # We detect the )} that closes the staff-mockdata section
    # Look for the pattern: previous lines contain 'staff-mockdata' render, current line is '               )}'
    # Better: look for onDeleteFromMockdata={handleDeleteFromMockdata} line and then find the closing )}
    if 'onDeleteFromMockdata={handleDeleteFromMockdata}' in line:
        # The next non-empty lines should be '/>' and ')}'
        # We'll insert after the ')}' that follows
        # Mark that we need to insert after the next ')}'
        pass

# Second pass: insert render block after staff-mockdata closing )}
new_lines2 = []
skip_next = False
found_staff_mockdata_render = False
close_count = 0

i = 0
while i < len(new_lines):
    line = new_lines[i]
    new_lines2.append(line)
    
    if "activeSection === 'staff-mockdata'" in line and '&&' in line and 'Staff MockData' not in line:
        found_staff_mockdata_render = True
        close_count = 0
    
    if found_staff_mockdata_render:
        stripped = line.strip()
        if stripped in ('(', '{', '/>'):
            pass
        elif stripped == ')}' or stripped == '} )' or stripped == ')}':
            close_count += 1
            if close_count == 1:
                # This closes the staff-mockdata render block - insert trainee-mockdata after
                indent = '                               '
                new_lines2.append(indent + "{activeSection === 'trainee-mockdata' && (\n")
                new_lines2.append(indent + "    <TraineeMockDataTable\n")
                new_lines2.append(indent + "        traineesData={filteredTraineeMockdata}\n")
                new_lines2.append(indent + "        onDeleteFromMockdata={handleDeleteTraineeFromMockdata}\n")
                new_lines2.append(indent + "    />\n")
                new_lines2.append(indent + ")}\n")
                found_staff_mockdata_render = False
                print(f"Inserted trainee-mockdata render block after line {i+1}")
    i += 1

with open('components/SettingsViewWithMenu.tsx', 'w') as f:
    f.writelines(new_lines2)

print("Done.")