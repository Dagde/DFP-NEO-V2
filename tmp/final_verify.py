with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

# Count useState([]) calls - should be 54 (working) not 59 (broken)
count_empty_state = content.count(b'useState([])')
print(f'useState([]) count: {count_empty_state} (expect 54 from working bundle)')

# Count total size
print(f'Total size: {len(content)} bytes')

# Verify key identifiers from the working bundle
working_markers = [
    b'mergeInstructorData',
    b'loadInitialData',
    b'ESL_DATA',
    b'instructors: ESL_DATA',  # pre-Step3 initial state
]
print()
print('Working bundle markers:')
for marker in working_markers:
    count = content.count(marker)
    print(f'  {marker}: {count}')

# Verify our patches
print()
print('Our patches:')
patches = [
    (b'showChoiceDialog', 'showChoiceDialog state'),
    (b'setShowChoiceDialog(true)', 'setShowChoiceDialog(true)'),
    (b'What would you like to do?', 'Choice dialog JSX'),
    (b'handleArchiveCourse', 'handleArchiveCourse'),
    (b'handleDeleteCoursePermanently', 'handleDeleteCoursePermanently'),
    (b'handleCancelChoice', 'handleCancelChoice'),
]
for term, desc in patches:
    count = content.count(term)
    status = '✓' if count > 0 else '✗ MISSING'
    print(f'  {status} {desc}: {count}')