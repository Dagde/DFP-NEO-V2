# Read the file
with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Process each instance
# Instance 1: line 2930
# Instance 2: line 3000  
# Instance 3: line 3615
# Instance 4: line 8820

for line_num in [2930, 3000, 3615, 8820]:
    # Find the start of the function (look backwards for "const handleNavigateToProfile")
    func_start = -1
    for i in range(line_num - 50, line_num):
        if 'const handleNavigateToProfile = (user: any) =>' in lines[i]:
            func_start = i
            break
    
    if func_start == -1:
        continue
    
    # Find the end of the function (count braces)
    brace_count = 0
    func_end = -1
    for i in range(func_start, len(lines)):
        brace_count += lines[i].count('{') - lines[i].count('}')
        if brace_count <= 0:
            func_end = i
            break
    
    if func_end == -1:
        continue
    
    # Get the indentation from the first line
    indent = len(lines[func_start]) - len(lines[func_start].lstrip())
    
    # Create the new function
    new_lines = []
    new_lines.append(' ' * indent + 'const handleNavigateToProfile = (user: any) => {\n')
    new_lines.append(' ' * (indent + 3) + "console.log('🎹 Navigating to profile:', user);\n")
    new_lines.append(' ' * (indent + 3) + "console.log('user:', JSON.stringify(user));\n")
    new_lines.append(' ' * (indent + 3) + '\n')
    new_lines.append(' ' * (indent + 3) + "// Use setSelectedPersonForProfile to directly open the profile\n")
    new_lines.append(' ' * (indent + 3) + "// This works the same way as clicking on a trainee name in CourseRoster\n")
    new_lines.append(' ' * (indent + 3) + "if (user.userType === 'STAFF') {\n")
    new_lines.append(' ' * (indent + 6) + "console.log('Opening staff profile:', user.name);\n")
    new_lines.append(' ' * (indent + 6) + "setSelectedPersonForProfile({\n")
    new_lines.append(' ' * (indent + 9) + "name: user.name,\n")
    new_lines.append(' ' * (indent + 9) + "idNumber: user.pmkeysId,\n")
    new_lines.append(' ' * (indent + 9) + "role: 'INSTRUCTOR'\n")
    new_lines.append(' ' * (indent + 6) + "} as Instructor);\n")
    new_lines.append(' ' * (indent + 6) + f"setSuccessMessage(`Navigated to Staff Profile: ${{user.name}}`);\n")
    new_lines.append(' ' * (indent + 3) + "} else if (user.userType === 'TRAINEE') {\n")
    new_lines.append(' ' * (indent + 6) + "console.log('Opening trainee profile:', user.name);\n")
    new_lines.append(' ' * (indent + 6) + "setSelectedPersonForProfile({\n")
    new_lines.append(' ' * (indent + 9) + "name: user.name,\n")
    new_lines.append(' ' * (indent + 9) + "idNumber: user.pmkeysId,\n")
    new_lines.append(' ' * (indent + 9) + "role: 'TRAINEE'\n")
    new_lines.append(' ' * (indent + 6) + "} as Trainee);\n")
    new_lines.append(' ' * (indent + 6) + f"setSuccessMessage(`Navigated to Trainee Profile: ${{user.name}}`);\n")
    new_lines.append(' ' * (indent + 3) + "}\n")
    new_lines.append(' ' * indent + "};\n")
    
    # Replace the old function with the new one
    lines[func_start:func_end+1] = new_lines
    print(f"✅ Replaced function starting at line {func_start}")

# Write back
with open('App.tsx', 'w') as f:
    f.writelines(lines)

print("✅ All instances replaced")