with open('/tmp/working_index.js', 'rb') as f:
    working = f.read()

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    patched = f.read()

# Check for saveCourseToDB in both bundles
for label, content in [('working (53c95828)', working), ('patched (fee1030e)', patched)]:
    print(f'=== {label} ===')
    for term in [b'saveCourseToDB', b'saveCourse', b'deleteCourse', b'/api/courses', b'handleAddCourseFromTrainingRecords']:
        count = content.count(term)
        print(f'  {term}: {count}')
    print()

# Find the handleAddCourseFromTrainingRecords in patched bundle
pos = patched.find(b'handleAddCourseFromTrainingRecords')
if pos != -1:
    print(f'handleAddCourseFromTrainingRecords in patched at {pos}:')
    print(patched[pos:pos+800].decode('utf-8', errors='replace'))