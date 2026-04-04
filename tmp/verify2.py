with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

# Check if setShowChoiceDialog(true) or setShowChoiceDialog(!0) exists
for variant in [b'setShowChoiceDialog(true)', b'setShowChoiceDialog(!0)', b'setShowChoiceDialog(!1)', b'setShowChoiceDialog(false)']:
    count = content.count(variant)
    print(f'{variant}: {count}')

# Also look for the full handlePinSubmit
pos = content.find(b'handlePinSubmit = async')
chunk = content[pos:pos+500]
print()
print('Full handlePinSubmit:')
print(chunk.decode('utf-8', errors='replace'))
print()

# Check what's in the CoursesManagementView showChoiceDialog area
pos2 = content.find(b'const [showChoiceDialog')
print('showChoiceDialog state area:')
print(content[pos2-50:pos2+200].decode('utf-8', errors='replace'))