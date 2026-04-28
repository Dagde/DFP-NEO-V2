with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find CoursesManagementView and see how it uses courseColors vs courses
pos = content.find(b'CoursesManagementView = ({')
print(f'CoursesManagementView at {pos}:')
print(content[pos:pos+500].decode('utf-8', errors='replace'))

print()
# Check what courseColors is passed as prop to CoursesManagementView
pos2 = content.find(b'onAddCourse={handleAddCourseFromTrainingRecords}')
print(f'CoursesManagementView render at {pos2}:')
print(content[max(0,pos2-500):pos2+200].decode('utf-8', errors='replace'))

print()
# Check if CoursesManagementView uses courseColors or courses prop
pos3 = content.find(b'CoursesManagementView = ({')
chunk = content[pos3:pos3+3000].decode('utf-8', errors='replace')
# Look for courseColors usage
if 'courseColors' in chunk:
    print('CoursesManagementView uses courseColors!')
    for i, line in enumerate(chunk.split('\n')):
        if 'courseColors' in line:
            print(f'  line {i}: {line}')
if 'courses' in chunk:
    print('CoursesManagementView uses courses prop')
    for i, line in enumerate(chunk.split('\n')[:30]):
        if 'courses' in line.lower():
            print(f'  line {i}: {line}')