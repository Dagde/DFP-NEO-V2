with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# Fix 1: handleAddCourseFromTrainingRecords - change PUT to POST
old1 = b'await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse, status: "ACTIVE" }) });'
new1 = b'await fetch("/api/courses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse, status: "ACTIVE" }) });'

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 OK: handleAddCourse PUT->POST')
else:
    print('Fix 1 FAILED')
    idx = 0
    while True:
        pos = content.find(b'await fetch("/api/courses"', idx)
        if pos == -1:
            break
        print(f'  Found at {pos}: {repr(content[pos:pos+150])}')
        idx = pos + 1

# Fix 2: handleUnarchiveCourseFromArchivedView - change PUT to POST  
old2 = b'await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" }) });'
new2 = b'await fetch("/api/courses", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" }) });'

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 OK: handleUnarchive PUT->POST')
else:
    print('Fix 2 FAILED')

print(f'Final size: {len(content)} bytes (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('File written.')

# Verify
post_count = content.count(b'method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }')
put_count = content.count(b'method: "PUT"')
delete_count = content.count(b'method: "DELETE"')
print(f'POST /api/courses calls: {post_count}')
print(f'PUT calls remaining: {put_count}')
print(f'DELETE calls: {delete_count}')