with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find fetchCourses function in bundle
pos = content.find(b'fetchCourses')
print(f'fetchCourses at {pos}:')
while pos != -1:
    print(f'  [{pos}]: {content[pos:pos+150].decode("utf-8", errors="replace")}')
    pos = content.find(b'fetchCourses', pos+1)

print()
# Find loadInitialData and how it handles courses
pos = content.find(b'loadInitialData')
print(f'loadInitialData at {pos}:')
print(content[pos:pos+1000].decode('utf-8', errors='replace'))

print()
# Find where courses state is set from DB data
pos = content.find(b'setCourses')
print('All setCourses calls:')
while pos != -1:
    context = content[max(0,pos-50):pos+100].decode('utf-8', errors='replace')
    print(f'  [{pos}]: {context}')
    pos = content.find(b'setCourses', pos+1)