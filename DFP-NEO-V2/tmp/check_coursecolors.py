with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find "Rebuild courseColors from loaded courses"
pos = content.find(b'Rebuild courseColors')
print(f'Rebuild courseColors at {pos}:')
if pos != -1:
    print(content[max(0,pos-100):pos+400].decode('utf-8', errors='replace'))

print()
# Find "Register any DB trainee courses"
pos2 = content.find(b'Register any DB trainee')
print(f'Register any DB trainee courses at {pos2}:')
if pos2 != -1:
    print(content[max(0,pos2-100):pos2+500].decode('utf-8', errors='replace'))

print()
# Find courseColors initial state in bundle
pos3 = content.find(b'courseColors, setCourseColors] = reactExports.useState(')
print(f'courseColors initial state at {pos3}:')
if pos3 != -1:
    print(content[pos3:pos3+100].decode('utf-8', errors='replace'))

# Check if courseColors is populated from DB courses in loadInitialData
pos4 = content.find(b'Setting courses from DB:')
print(f'\nloadInitialData setCourses area at {pos4}:')
if pos4 != -1:
    print(content[max(0,pos4-50):pos4+400].decode('utf-8', errors='replace'))