with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find the part of initializeData that handles courses
pos = content.find(b'initializeData = async')
chunk = content[pos:pos+5000].decode('utf-8', errors='replace')

# Find 'course' mentions in initializeData
lines = chunk.split('\n')
for i, line in enumerate(lines):
    if 'course' in line.lower() or 'Course' in line:
        print(f'  line {i}: {line}')

print()
print('--- Looking for courses fetch in initializeData ---')
# Look for fetchCourses or /api/courses in initializeData
pos2 = content.find(b'initializeData = async')
chunk2 = content[pos2:pos2+8000]
if b'/api/courses' in chunk2:
    idx = chunk2.find(b'/api/courses')
    print(f'Found /api/courses in initializeData at offset {idx}:')
    print(chunk2[max(0,idx-100):idx+200].decode('utf-8', errors='replace'))
else:
    print('NO /api/courses found in initializeData!')
    
# Look at the return statement of initializeData
# Find what it returns for courses
pos3 = content.find(b'return {', pos)
while pos3 < pos + 8000 and pos3 != -1:
    ctx = content[pos3:pos3+300].decode('utf-8', errors='replace')
    if 'course' in ctx.lower():
        print(f'Return statement with courses at {pos3}:')
        print(ctx)
        break
    pos3 = content.find(b'return {', pos3+1)