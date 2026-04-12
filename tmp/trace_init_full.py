with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find initializeData and search for its return value
pos = content.find(b'initializeData = async')
chunk = content[pos:pos+15000]

# Find all occurrences of 'instructors' in the return area
print('Looking for return statement with instructors:')
search_pos = 0
while True:
    rp = chunk.find(b'instructors,\n      trainees', search_pos)
    if rp == -1:
        break
    print(f'  Found at chunk offset {rp}:')
    print(repr(chunk[max(0,rp-20):rp+200]))
    search_pos = rp + 1

# Also check if it ends with just events
print()
search_pos = 0
while True:
    rp = chunk.find(b'events\n    }', search_pos)
    if rp == -1:
        break
    print(f'  "events" return pattern at chunk offset {rp}:')
    print(repr(chunk[max(0,rp-100):rp+50]))
    search_pos = rp + 1
    
# Also search for the final return { in initializeData
print()
print('Last few return { in initializeData:')
search_pos = 0
while True:
    rp = chunk.find(b'return {', search_pos)
    if rp == -1:
        break
    print(f'  return at chunk offset {rp}: {repr(chunk[rp:rp+200])}')
    search_pos = rp + 1