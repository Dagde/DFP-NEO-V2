# Read the file
with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Process all instances
new_lines = []
i = 0
in_function = False
brace_count = 0
start_idx = -1

while i < len(lines):
    line = lines[i]
    
    # Detect start of handleNavigateToProfile function
    if 'const handleNavigateToProfile = (user: any) => {' in line:
        in_function = True
        start_idx = i
        new_lines.append(line)
        i += 1
        continue
    
    # If we're in the function, collect lines until we find the closing brace
    if in_function:
        # Count braces to find end of function
        brace_count += line.count('{') - line.count('}')
        
        if brace_count <= 0:
            # End of function found
            in_function = False
            # Add the new simplified function
            new_lines.append('''       const handleNavigateToProfile = (user: any) => {
           console.log('🎹 Navigating to profile:', user);
           console.log('user:', JSON.stringify(user));
           
           // Use setSelectedPersonForProfile to directly open the profile
           // This works the same way as clicking on a trainee name in CourseRoster
           if (user.userType === 'STAFF') {
               console.log('Opening staff profile:', user.name);
               setSelectedPersonForProfile({
                   name: user.name,
                   idNumber: user.pmkeysId,
                   role: 'INSTRUCTOR'
               } as Instructor);
               setSuccessMessage(`Navigating to Staff Profile: ${user.name}`);
           } else if (user.userType === 'TRAINEE') {
               console.log('Opening trainee profile:', user.name);
               setSelectedPersonForProfile({
                   name: user.name,
                   idNumber: user.pmkeysId,
                   role: 'TRAINEE'
               } as Trainee);
               setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);
           }
       };
''')
            i += 1
            continue
        else:
            # Skip all lines inside the old function
            i += 1
            continue
    
    # Keep all other lines
    new_lines.append(line)
    i += 1

# Write back
with open('App.tsx', 'w') as f:
    f.writelines(new_lines)

print("✅ Replaced all handleNavigateToProfile functions")