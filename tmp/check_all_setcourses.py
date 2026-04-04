with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find ALL setCourses calls
print('ALL setCourses calls:')
pos = 0
count = 0
while True:
    p = content.find(b'setCourses(', pos)
    if p == -1:
        break
    count += 1
    ctx = content[max(0,p-100):p+150].decode('utf-8', errors='replace')
    print(f'\n[{count}] at {p}:')
    print(ctx)
    pos = p + 1

print(f'\nTotal setCourses calls: {count}')

# Also check the initial useState
pos2 = content.find(b'useState(ESL_DATA.courses)')
print(f'\nESL_DATA.courses initial state at: {pos2}')
if pos2 != -1:
    print(content[max(0,pos2-50):pos2+100].decode('utf-8', errors='replace'))