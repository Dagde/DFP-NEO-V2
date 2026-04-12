with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find the return statement of initializeData - what does it return for courses?
pos = content.find(b'initializeData = async')
# Get a large chunk of initializeData
chunk = content[pos:pos+10000]

# Find the return statement
ret_pos = chunk.rfind(b'return {')
if ret_pos != -1:
    print(f'initializeData return statement:')
    print(chunk[ret_pos:ret_pos+500].decode('utf-8', errors='replace'))

print()
# Now check how courses are loaded on startup in App
# The setCourses(initialData.courses) at position 4585681
pos2 = 4585681
print('setCourses(initialData.courses) context:')
print(content[max(0,pos2-500):pos2+300].decode('utf-8', errors='replace'))