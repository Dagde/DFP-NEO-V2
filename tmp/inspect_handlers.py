with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Get exact bytes for each handler to match precisely
positions = {
    'handleAddCourse': 4585879,
    'handleDeleteCourse': 4586373,
    'handleUnarchive': 4587385,
    'handleDeleteArchived': 4587972,
}

for name, pos in positions.items():
    print(f'\n=== {name} at {pos} ===')
    chunk = content[pos:pos+600]
    print(repr(chunk))