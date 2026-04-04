with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

print(f'Bundle size: {len(content):,}')
print(f'useState([]) count: {content.count(b"useState([])")} (expect 54)')
print()

checks = [
    # Patch 1
    (b'dbCourses = Array.isArray(cd.courses)', 'P1: DB courses fetch in initializeData'),
    (b'courses: dbCourses', 'P1: courses in initializeData return'),
    (b'Courses DB loaded:', 'P1: console.log for courses'),
    # Patch 2
    (b'courses: []\n    };\n  }\n}\nconst INITIAL_CURRENCY_REQUIREMENTS', 'P2: fallback return has courses:[]'),
    # Patch 3
    (b'Setting courses from DB:', 'P3: setCourses in loadInitialData'),
    (b'setCourses(data.courses)', 'P3: setCourses(data.courses) call'),
    # Patch 4
    (b'setCourses(initialData.courses)', 'P4-REMOVED: setCourses NOT in school useEffect'),
    # Safety
    (b'loadInitialData', 'Safety: loadInitialData present'),
    (b'What would you like to do?', 'Safety: choice dialog present'),
    (b'setShowChoiceDialog(true)', 'Safety: setShowChoiceDialog present'),
    (b'Failed to save course to DB', 'Safety: save error handler'),
]

for term, desc in checks:
    count = content.count(term)
    if desc.startswith('P4-REMOVED'):
        status = '✓ REMOVED' if count == 0 else f'✗ STILL PRESENT ({count})'
    else:
        status = f'✓ ({count})' if count > 0 else '✗ MISSING'
    print(f'  {status} {desc}')

print()
# Show the school useEffect to confirm setCourses is gone
pos = content.find(b'const initialData = school ===')
print('School useEffect:')
print(content[max(0,pos-50):pos+300].decode('utf-8', errors='replace'))

print()
# Show the initializeData return
pos2 = content.find(b'dbCourses = Array.isArray')
print('initializeData courses section:')
print(content[max(0,pos2-50):pos2+400].decode('utf-8', errors='replace'))