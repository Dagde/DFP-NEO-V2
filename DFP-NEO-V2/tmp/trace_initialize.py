with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find initializeData function
pos = content.find(b'initializeData = async')
if pos == -1:
    pos = content.find(b'async function initializeData')
if pos == -1:
    pos = content.find(b'initializeData()')
print(f'initializeData at {pos}:')
print(content[pos:pos+2000].decode('utf-8', errors='replace'))
print()

# Find where courses come from in dataService/initializeData
pos2 = content.find(b'fetchCourses')
print('fetchCourses references in initializeData:')
while pos2 != -1:
    context = content[max(0,pos2-100):pos2+200].decode('utf-8', errors='replace')
    print(f'  [{pos2}]: {context}')
    print('---')
    pos2 = content.find(b'fetchCourses', pos2+1)