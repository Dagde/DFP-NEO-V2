import re

with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Find and replace the staff section
old_staff = '''            setSelectedPersonForProfile({
               name: user.name,
               idNumber: user.pmkeysId,
               role: 'INSTRUCTOR'
            } as Instructor);
            setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);'''

new_staff = '''            setSelectedPersonForProfile({
               name: user.name,
               idNumber: user.pmkeysId,
               role: 'INSTRUCTOR'
            } as Instructor);
            handleNavigation('Instructors');
            setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);'''

content = content.replace(old_staff, new_staff)

# Find and replace the trainee section
old_trainee = '''            setSelectedPersonForProfile({
               name: user.name,
               idNumber: user.pmkeysId,
               role: 'TRAINEE'
            } as Trainee);
            setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);'''

new_trainee = '''            setSelectedPersonForProfile({
               name: user.name,
               idNumber: user.pmkeysId,
               role: 'TRAINEE'
            } as Trainee);
            handleNavigation('CourseRoster');
            setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);'''

content = content.replace(old_trainee, new_trainee)

with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("Fixed handleNavigateToProfile to include navigation")