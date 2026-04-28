with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

print(f'Bundle size: {len(content):,} bytes')
print(f'useState([]) count: {content.count(b"useState([])")} (expect 54)')
print()

# Check working bundle markers still intact
print('--- Working bundle markers ---')
for term in [b'loadInitialData', b'ESL_DATA', b'mergeInstructorData']:
    print(f'  {term}: {content.count(term)}')

print()
print('--- Course dialog patches ---')
for term, desc in [
    (b'setShowChoiceDialog(true)', 'setShowChoiceDialog(true)'),
    (b'What would you like to do?', 'Choice dialog heading'),
    (b'handleDeleteCoursePermanently', 'handleDeleteCoursePermanently'),
]:
    c = content.count(term)
    print(f'  {"✓" if c>0 else "✗"} {desc}: {c}')

print()
print('--- DB persistence patches ---')
for term, desc in [
    (b'await fetch("/api/courses"', 'PUT /api/courses (add/unarchive)'),
    (b'await fetch(`/api/courses/${encodeURIComponent', 'DELETE /api/courses/:name'),
    (b'Failed to save course to DB', 'error handling - save'),
    (b'Failed to delete course from DB', 'error handling - delete'),
    (b'Failed to restore course to DB', 'error handling - restore'),
    (b'Failed to delete archived course from DB', 'error handling - delete archived'),
]:
    c = content.count(term)
    print(f'  {"✓" if c>0 else "✗"} {desc}: {c}')

print()
# Verify the handlers look correct
for handler, name in [
    (b'handleAddCourseFromTrainingRecords = async', 'handleAddCourse is async'),
    (b'handleDeleteCourseFromTrainingRecords = async', 'handleDeleteCourse is async'),
    (b'handleUnarchiveCourseFromArchivedView = async', 'handleUnarchive is async'),
    (b'handleDeleteCourseFromArchivedView = async', 'handleDeleteArchived is async'),
]:
    c = content.count(handler)
    print(f'  {"✓" if c>0 else "✗"} {name}: {c}')