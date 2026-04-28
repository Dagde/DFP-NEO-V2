with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find all occurrences of initializeData
idx = 0
count = 0
while count < 10:
    pos = content.find(b'initializeData', idx)
    if pos == -1:
        break
    print(f'  [{pos}]: {repr(content[max(0,pos-20):pos+80])}')
    idx = pos + 1
    count += 1

print()
# Find the async function that loads staff/trainees - might have different name
# Look for the function that contains fetchInstructors
pos2 = content.find(b'async function initializeData')
print(f'async function initializeData: {pos2}')

pos3 = content.find(b'function initializeData')
print(f'function initializeData: {pos3}')

# Look for where initializeData is defined
for pattern in [b'initializeData =', b'initializeData(', b'async initializeData']:
    p = content.find(pattern)
    print(f'{repr(pattern)}: {p}')
    if p != -1:
        print(f'  Context: {repr(content[p:p+100])}')