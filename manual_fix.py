with open('/workspace/App.tsx', 'r') as f:
    lines = f.readlines()

# Fix line 2939 (0-indexed: 2939) - setSuccessMessage after handleNavigation('Instructors')
if lines[2939].startswith('                setSuccessMessage(`Navigated to Staff Profile'):
    lines[2939] = '             setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);\n'

# Fix line 2948 (0-indexed: 2948) - setSuccessMessage after handleNavigation('CourseRoster')
if lines[2948].startswith('                setSuccessMessage(`Navigated to Trainee Profile'):
    lines[2948] = '             setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);\n'

with open('/workspace/App.tsx', 'w') as f:
    f.writelines(lines)

print("Manually fixed 2 lines")