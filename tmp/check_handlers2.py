with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find handleDeleteCourseFromArchivedView
pos = content.find(b'handleDeleteCourseFromArchivedView')
print(f'handleDeleteCourseFromArchivedView at {pos}:')
print(content[pos:pos+500].decode('utf-8', errors='replace'))
print()

# Also check fetchAPI function to understand its signature
pos2 = content.find(b'async function fetchAPI')
if pos2 == -1:
    pos2 = content.find(b'fetchAPI = async')
if pos2 == -1:
    pos2 = content.find(b'function fetchAPI')
print(f'fetchAPI function at {pos2}:')
if pos2 != -1:
    print(content[pos2:pos2+400].decode('utf-8', errors='replace'))

# Check all fetchAPI call sites
print()
print('All fetchAPI occurrences:')
idx = 0
while True:
    pos3 = content.find(b'fetchAPI', idx)
    if pos3 == -1:
        break
    print(f'  [{pos3}]: {content[pos3:pos3+100].decode("utf-8", errors="replace")}')
    idx = pos3 + 1