with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find initializeData return statement
pos = content.find(b'initializeData = async')
chunk = content[pos:pos+12000]

# Find the return { ... } in initializeData
ret_pos = chunk.find(b'return {\n      instructors,\n      trainees,\n      aircraft,\n      scores,\n      events\n    }')
if ret_pos != -1:
    print(f'Found return at offset {ret_pos} from start of initializeData:')
    print(repr(chunk[ret_pos:ret_pos+200]))
else:
    # Try other patterns
    for pattern in [b'return {\n      instructors', b'return { instructors', b'return {\n    instructors']:
        rp = chunk.find(pattern)
        if rp != -1:
            print(f'Found return with pattern {repr(pattern)} at offset {rp}:')
            print(repr(chunk[rp:rp+200]))
            break
    else:
        # Search for all return statements
        print('Searching for return statements in initializeData:')
        idx = 0
        while True:
            rp = chunk.find(b'return {', idx)
            if rp == -1 or rp > 10000:
                break
            print(f'  return at offset {rp}: {repr(chunk[rp:rp+100])}')
            idx = rp + 1

print()
# Find the school useEffect that resets courses
pos2 = content.find(b'const initialData = school ===')
print(f'school useEffect at {pos2}:')
print(repr(content[max(0,pos2-100):pos2+300]))