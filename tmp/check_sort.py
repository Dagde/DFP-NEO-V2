with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find the groupedCourses logic in CoursesManagementView
pos = content.find(b'groupedCourses = reactExports.useMemo')
print(f'groupedCourses at {pos}:')
print(content[pos:pos+1500].decode('utf-8', errors='replace'))