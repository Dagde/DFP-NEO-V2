with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

print(f'Total size: {len(content)} bytes')
print()

# Check all key elements
checks = [
    (b'showChoiceDialog', 'showChoiceDialog state var'),
    (b'setShowChoiceDialog(!0)', 'setShowChoiceDialog(true) in handlePinSubmit'),
    (b'handleDeleteCoursePermanently', 'handleDeleteCoursePermanently handler'),
    (b'handleArchiveCourse', 'handleArchiveCourse handler'),
    (b'handleCancelChoice', 'handleCancelChoice handler'),
    (b'What would you like to do?', 'Choice dialog heading'),
    (b'Archive Course', 'Archive Course button'),
    (b'Delete Permanently', 'Delete Permanently button'),
]

for term, desc in checks:
    count = content.count(term)
    if count > 0:
        pos = content.find(term)
        print(f'✓ {desc}: {count} occurrence(s) at pos {pos}')
    else:
        print(f'✗ MISSING: {desc}')

print()

# Verify showPinDialog and showChoiceDialog are in handlePinSubmit
pos = content.find(b'handlePinSubmit = async')
if pos != -1:
    chunk = content[pos:pos+400].decode('utf-8', errors='replace')
    print('handlePinSubmit (CoursesManagement):')
    print(chunk)

print()

# Verify choice dialog JSX appears in the return
pos = content.find(b'What would you like to do?')
if pos != -1:
    print('Choice dialog context:')
    print(content[max(0,pos-200):pos+500].decode('utf-8', errors='replace'))