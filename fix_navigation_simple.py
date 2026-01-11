# Read the file
with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Simple find and replace for staff - look for the specific pattern
# We'll find lines with "setSelectedPersonForProfile" followed by "INSTRUCTOR"
# and "setSuccessMessage" and insert handleNavigation between them

# Split into lines
lines = content.split('\n')
new_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    new_lines.append(line)
    
    # Check if this line has setSelectedPersonForProfile with INSTRUCTOR
    if "setSelectedPersonForProfile" in line and i + 4 < len(lines):
        # Check the next few lines for INSTRUCTOR and setSuccessMessage
        next_lines = lines[i+1:i+5]
        has_instructor = any("INSTRUCTOR" in l for l in next_lines)
        has_set_success = any("Navigated to Staff Profile" in l for l in next_lines)
        
        if has_instructor and has_set_success:
            # Add handleNavigation before the setSuccessMessage line
            for j in range(i+1, i+5):
                if "Navigated to Staff Profile" in lines[j]:
                    new_lines.append("             handleNavigation('Instructors');")
                    break
    
    # Check for trainee
    if "setSelectedPersonForProfile" in line and i + 4 < len(lines):
        next_lines = lines[i+1:i+5]
        has_trainee = any("TRAINEE" in l for l in next_lines)
        has_set_success = any("Navigated to Trainee Profile" in l for l in next_lines)
        
        if has_trainee and has_set_success:
            for j in range(i+1, i+5):
                if "Navigated to Trainee Profile" in lines[j]:
                    new_lines.append("             handleNavigation('CourseRoster');")
                    break
    
    i += 1

with open('/workspace/App.tsx', 'w') as f:
    f.write('\n'.join(new_lines))

print("Fixed handleNavigateToProfile with simple line-by-line approach")