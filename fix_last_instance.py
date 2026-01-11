# Read the file
with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Replace lines 8766-8800 with new code
# Line 8766 starts the if (user.userType === 'STAFF')
# We need to find the function start first

func_start = 8755  # Approximate based on grep results
for i in range(8750, 8770):
    if 'const handleNavigateToProfile = (user: any) =>' in lines[i]:
        func_start = i
        break

# Find the end of the function
brace_count = 0
func_end = -1
for i in range(func_start, len(lines)):
    brace_count += lines[i].count('{') - lines[i].count('}')
    if brace_count <= 0:
        func_end = i
        break

print(f"Found function at lines {func_start}-{func_end}")

# Get indentation
indent = len(lines[func_start]) - len(lines[func_start].lstrip())

# Create new function
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

# Replace
lines[func_start:func_end+1] = new_lines
print(f"✅ Replaced function at lines {func_start}-{func_end}")

# Write back
with open('App.tsx', 'w') as f:
    f.writelines(lines)