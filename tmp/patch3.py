with open('/tmp/patched_index.js', 'rb') as f:
    content = f.read()

# Find the end of CoursesManagementView return - the closing of the array
# It's at lineNumber 199 in CoursesManagementView.tsx
# The pattern is: ] }, void 0, true, {\n    fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx",\n    lineNumber: 199,\n    columnNumber: 9\n  }, void 0);\n};

# Find the specific pattern for line 199
import re

# Look for the end of CoursesManagementView
search_bytes = b'  ] }, void 0, true, {\n    fileName: "/workspace/DFP-NEO-V2-fresh/components/CoursesManagementView.tsx",\n    lineNumber: 199,\n    columnNumber: 9\n  }, void 0);\n};\nconst TrainingRecordsExportView'

pos = content.find(search_bytes)
print(f'Exact insertion point found: {pos}')
if pos != -1:
    print('Before:')
    print(repr(content[pos-100:pos]))
    print('Match:')
    print(repr(content[pos:pos+200]))