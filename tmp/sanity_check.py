with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

print('=== SANITY CHECK ===')
print(f'Bundle size: {len(content):,} bytes')
print()

# Critical working bundle markers
print('--- Working bundle markers (must be present) ---')
markers = {
    'loadInitialData': b'loadInitialData',
    'ESL_DATA': b'ESL_DATA',
    'mergeInstructorData': b'mergeInstructorData',
    'instructors: ESL_DATA': b'instructors: ESL_DATA',
    'useState([]) count = 54': None,  # special check below
}

for name, term in markers.items():
    if term is None:
        count = content.count(b'useState([])')
        status = '✓' if count == 54 else f'✗ (got {count})'
        print(f'  {status} useState([]) count: {count}')
    else:
        count = content.count(term)
        status = '✓' if count > 0 else '✗ MISSING'
        print(f'  {status} {name}: {count}')

print()
print('--- Our patches (must be present) ---')
patches = [
    ('showChoiceDialog state', b'const [showChoiceDialog, setShowChoiceDialog]'),
    ('setShowChoiceDialog(true) in handlePinSubmit', b'setShowChoiceDialog(true)'),
    ('handleArchiveCourse handler', b'const handleArchiveCourse'),
    ('handleDeleteCoursePermanently handler', b'const handleDeleteCoursePermanently'),
    ('handleCancelChoice handler', b'const handleCancelChoice'),
    ('Choice dialog heading', b'What would you like to do?'),
    ('Archive Course button', b'Archive Course'),
    ('Delete Permanently button', b'Delete Permanently'),
]

all_ok = True
for name, term in patches:
    count = content.count(term)
    status = '✓' if count > 0 else '✗ MISSING'
    if count == 0:
        all_ok = False
    print(f'  {status} {name}: {count}')

print()
if all_ok:
    print('✅ ALL CHECKS PASSED - Bundle is ready to deploy!')
else:
    print('❌ SOME CHECKS FAILED - Bundle needs review')