with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find handleAddCourseFromTrainingRecords
pos = content.find(b'handleAddCourseFromTrainingRecords = ')
print(f'handleAddCourseFromTrainingRecords at {pos}:')
print(content[pos:pos+600].decode('utf-8', errors='replace'))
print()

# Find handleDeleteCourseFromTrainingRecords  
pos2 = content.find(b'handleDeleteCourseFromTrainingRecords = ')
print(f'handleDeleteCourseFromTrainingRecords at {pos2}:')
print(content[pos2:pos2+1000].decode('utf-8', errors='replace'))
print()

# Find handleUnarchiveCourseFromArchivedView
pos3 = content.find(b'handleUnarchiveCourseFromArchivedView')
print(f'handleUnarchiveCourseFromArchivedView at {pos3}:')
print(content[pos3:pos3+600].decode('utf-8', errors='replace'))

# Check if fetchAPI is in bundle
print()
print(f'fetchAPI occurrences: {content.count(b"fetchAPI")}')
print(f'/api/courses occurrences: {content.count(b"/api/courses")}')
print(f'saveCourseToDB occurrences: {content.count(b"saveCourseToDB")}')