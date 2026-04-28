with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find our DB courses mapping patch
pos = content.find(b'dbCourses = Array.isArray(cd.courses)')
print('Our initializeData DB courses mapping:')
print(content[pos:pos+500].decode('utf-8', errors='replace'))

print()
# Find how CoursesManagementView calculates totalStudents
pos2 = content.find(b'totalStudents')
print('totalStudents calculations:')
while pos2 != -1 and pos2 < 4300000:  # Only in CoursesManagementView area
    ctx = content[max(0,pos2-50):pos2+150].decode('utf-8', errors='replace')
    print(f'  [{pos2}]: {ctx}')
    pos2 = content.find(b'totalStudents', pos2+1)

# Check around CoursesManagementView
pos3 = content.find(b'CoursesManagementView = ({')
chunk = content[pos3:pos3+5000].decode('utf-8', errors='replace')
# Find totalStudents in this chunk
for i, line in enumerate(chunk.split('\n')):
    if 'totalStudents' in line or 'raafStart' in line or 'raaf' in line.lower():
        print(f'CMV line {i}: {line}')