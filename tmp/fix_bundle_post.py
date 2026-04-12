with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# Count current PUT /api/courses references
put_count = content.count(b'method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse')
put_count2 = content.count(b'method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse')
print(f'PUT /api/courses (newCourse): {put_count}')
print(f'PUT /api/courses (restoredCourse): {put_count2}')

# Fix 1: handleAddCourseFromTrainingRecords - change PUT to POST
old1 = b'await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse, status: "ACTIVE" }) });'
new1 = b'await fetch("/api/courses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse, status: "ACTIVE" }) });'

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('✓ Fix 1: handleAddCourse PUT→POST')
else:
    print('✗ Fix 1 FAILED - searching...')
    pos = content.find(b'await fetch("/api/courses"')
    if pos != -1:
        print(repr(content[pos:pos+200]))

# Fix 2: handleUnarchiveCourseFromArchivedView - change PUT to POST  
old2 = b'await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" }) });'
new2 = b'await fetch("/api/courses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" }) });'

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('✓ Fix 2: handleUnarchive PUT→POST')
else:
    print('✗ Fix 2 FAILED')

print(f'Final size: {len(content)} bytes (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('File written.')

# Verify
print()
print('Verification:')
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    verify = f.read()
print(f'POST /api/courses: {verify.count(b"method: \\"POST\\", credentials: \\"include\\", headers: { \\"Content-Type\\": \\"application/json\\" }, body: JSON.stringify({ ...newCourse")}')
print(f'PUT /api/courses remaining: {verify.count(b"PUT.*api/courses")}')
print(f'DELETE /api/courses: {verify.count(b"method: \\"DELETE\\", credentials: \\"include\\" });")}')