with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# initializeData starts at 4346727
pos = 4346727
chunk = content[pos:pos+12000]

# Find all return statements
print('Return statements in initializeData:')
search = 0
while True:
    rp = chunk.find(b'return', search)
    if rp == -1 or rp > 11000:
        break
    ctx = chunk[rp:rp+150].decode('utf-8', errors='replace')
    print(f'  offset {rp}: {repr(ctx[:100])}')
    search = rp + 1

print()
# Find events in the return 
print('Searching for events in returns:')
search = 0
while True:
    rp = chunk.find(b'events', search)
    if rp == -1 or rp > 11000:
        break
    ctx = chunk[rp:rp+100].decode('utf-8', errors='replace')
    print(f'  offset {rp}: {ctx}')
    search = rp + 1