import re

# Read the file
with open('App.tsx', 'r') as f:
    lines = f.readlines()

# Find and replace the instructor comparison logic (around line 8845-8846)
# The old line looks like: "               const instructor = instructorsData.find(i =>"
# We need to replace the entire find() call with the new normalized version

in_replacement = False
instructor_replaced = False
trainee_replaced = False

new_lines = []
i = 0

while i < len(lines):
    line = lines[i]
    
    # Check if this is the instructor find call
    if 'const instructor = instructorsData.find(i =>' in line and not instructor_replaced:
        # Skip the next line (the old comparison logic)
        i += 1
        
        # Add the new normalized comparison
        new_lines.append('               const instructor = instructorsData.find(i => {\n')
        new_lines.append('                   const userName = String(user.name || \'\').trim();\n')
        new_lines.append('                   const instructorName = String(i.name || \'\').trim();\n')
        new_lines.append('                   const userId = String(user.pmkeysId || \'\').trim();\n')
        new_lines.append('                   const instructorId = String(i.idNumber || \'\').trim();\n')
        new_lines.append('\n')
        new_lines.append('                   console.log("Comparing instructor:", {userName, instructorName, userId, instructorId});\n')
        new_lines.append('\n')
        new_lines.append('                   return userName === instructorName && userId === instructorId;\n')
        new_lines.append('               });\n')
        
        instructor_replaced = True
        i += 1
        continue
    
    # Check if this is the trainee find call
    if 'const trainee = traineesData.find(t =>' in line and not trainee_replaced:
        # Skip the next line (the old comparison logic)
        i += 1
        
        # Add the new normalized comparison
        new_lines.append('               const trainee = traineesData.find(t => {\n')
        new_lines.append('                   const userName = String(user.name || \'\').trim();\n')
        new_lines.append('                   const traineeName = String(t.name || \'\').trim();\n')
        new_lines.append('                   const userId = String(user.pmkeysId || \'\').trim();\n')
        new_lines.append('                   const traineeId = String(t.idNumber || \'\').trim();\n')
        new_lines.append('\n')
        new_lines.append('                   console.log("Comparing trainee:", {userName, traineeName, userId, traineeId});\n')
        new_lines.append('\n')
        new_lines.append('                   return userName === traineeName && userId === traineeId;\n')
        new_lines.append('               });\n')
        
        trainee_replaced = True
        i += 1
        continue
    
    # Keep all other lines
    new_lines.append(line)
    i += 1

# Write back
with open('App.tsx', 'w') as f:
    f.writelines(new_lines)

print(f"✅ Replacements made: instructor={instructor_replaced}, trainee={trainee_replaced}")