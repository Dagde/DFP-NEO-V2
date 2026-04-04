with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find loadInitialData useEffect
pos = content.find(b'loadInitialData()')
print('loadInitialData() useEffect call:')
while pos != -1:
    ctx = content[max(0,pos-200):pos+100].decode('utf-8', errors='replace')
    print(f'  [{pos}]: {ctx}')
    print('---')
    pos = content.find(b'loadInitialData()', pos+1)

print()
# Find the school useEffect
pos2 = content.find(b'const initialData = school ===')
print(f'school useEffect at {pos2}:')
print(content[max(0,pos2-100):pos2+300].decode('utf-8', errors='replace'))

print()
# Check if there's ANOTHER useEffect that might reset courses
print('All useEffect calls near setCourses:')
pos3 = 0
while True:
    p = content.find(b'setCourses(', pos3)
    if p == -1:
        break
    ctx = content[max(0,p-200):p+100].decode('utf-8', errors='replace')
    if 'useEffect' in ctx or 'ESL_DATA' in ctx or 'school' in ctx:
        print(f'  [{p}]: {ctx}')
        print('---')
    pos3 = p + 1