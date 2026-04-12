with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

# Find 'TrainingRecordsExportView' to locate end of CoursesManagementView
pos = content.find(b'const TrainingRecordsExportView')
print(f'TrainingRecordsExportView at: {pos}')

# Show what comes before it (end of CoursesManagementView)
print('Context before TrainingRecordsExportView:')
print(repr(content[pos-400:pos+50]))