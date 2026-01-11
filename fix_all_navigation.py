import re

# Read the file
with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Pattern 1: Staff without navigation - add handleNavigation before setSuccessMessage
pattern1 = r'''(\s+setSelectedPersonForProfile\(\{
                name: user\.name,
                idNumber: user\.pmkeysId,
                role: 'INSTRUCTOR'
             \} as Instructor\);)\s+(setSuccessMessage\(`Navigated to Staff Profile: \${user\.name}`\);)'''

def replace_staff(m):
    return m.group(1) + '\n             handleNavigation(\'Instructors\');\n             ' + m.group(2)

content = re.sub(pattern1, replace_staff, content)

# Pattern 2: Trainee without navigation - add handleNavigation before setSuccessMessage
pattern2 = r'''(\s+setSelectedPersonForProfile\(\{
                name: user\.name,
                idNumber: user\.pmkeysId,
                role: 'TRAINEE'
             \} as Trainee\);)\s+(setSuccessMessage\(`Navigated to Trainee Profile: \${user\.name}`\);)'''

def replace_trainee(m):
    return m.group(1) + '\n             handleNavigation(\'CourseRoster\');\n             ' + m.group(2)

content = re.sub(pattern2, replace_trainee, content)

with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("Fixed all handleNavigateToProfile instances to include navigation calls")