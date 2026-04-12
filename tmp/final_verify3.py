with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

print(f'Bundle size: {len(content):,} bytes')
print(f'useState([]) count: {content.count(b"useState([])")} (expect 54)')
print()

print('--- API calls in bundle ---')
idx = 0
while True:
    pos = content.find(b'await fetch("/api/courses"', idx)
    if pos == -1:
        break
    print(f'  POST at {pos}: {content[pos:pos+100].decode("utf-8")}')
    idx = pos + 1

idx = 0
while True:
    pos = content.find(b'await fetch(`/api/courses/', idx)
    if pos == -1:
        break
    print(f'  DELETE at {pos}: {content[pos:pos+100].decode("utf-8")}')
    idx = pos + 1

print()
print('--- Safety checks ---')
for term, desc in [
    (b'loadInitialData', 'loadInitialData'),
    (b'What would you like to do?', 'Choice dialog'),
    (b'setShowChoiceDialog(true)', 'setShowChoiceDialog'),
    (b'Failed to save course to DB', 'Error handling save'),
    (b'Failed to delete course from DB', 'Error handling delete'),
]:
    c = content.count(term)
    print(f'  {"OK" if c>0 else "MISSING"} {desc}: {c}')