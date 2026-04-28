with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find loadInitialData and see if it sets courses from DB
pos = content.find(b'loadInitialData = async')
chunk = content[pos:pos+3000].decode('utf-8', errors='replace')
print('loadInitialData:')
print(chunk)

print()
# Check if there's a fetchCourses from /api/courses (not /api/tie/courses)
pos2 = 0
print('All /api/courses references:')
while True:
    p = content.find(b'/api/courses', pos2)
    if p == -1:
        break
    print(f'  [{p}]: {content[max(0,p-50):p+100].decode("utf-8", errors="replace")}')
    pos2 = p + 1