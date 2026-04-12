with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# The current patch sets courses but not courseColors
# We need to also set courseColors from DB courses
# Current code in loadInitialData:
old_set = (
    b'        if (data.courses && data.courses.length > 0) {\n'
    b'          console.log("\\u2705 Setting courses from DB:", data.courses.length);\n'
    b'          setCourses(data.courses);\n'
    b'        } else {\n'
    b'          console.log("\\u26a0\\ufe0f No DB courses, keeping mock courses");\n'
    b'        }\n'
)

new_set = (
    b'        if (data.courses && data.courses.length > 0) {\n'
    b'          console.log("\\u2705 Setting courses from DB:", data.courses.length);\n'
    b'          setCourses(data.courses);\n'
    b'          const dbColors = {};\n'
    b'          data.courses.forEach((c) => { dbColors[c.name] = c.color || "#6366f1"; });\n'
    b'          console.log("\\u2705 Setting courseColors from DB:", Object.keys(dbColors));\n'
    b'          setCourseColors((prev) => ({ ...prev, ...dbColors }));\n'
    b'        } else {\n'
    b'          console.log("\\u26a0\\ufe0f No DB courses, keeping mock courses");\n'
    b'        }\n'
)

if old_set in content:
    content = content.replace(old_set, new_set, 1)
    print('✓ Patch: setCourseColors from DB courses added to loadInitialData')
else:
    print('✗ Patch FAILED - searching...')
    pos = content.find(b'Setting courses from DB:')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[max(0,pos-50):pos+200])}')

print(f'Final size: {len(content)} (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('Written.')

# Verify
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    verify = f.read()
    
print(f'setCourseColors from DB: {verify.count(b"Setting courseColors from DB:")}')
print(f'useState([]) count: {verify.count(b"useState([])")} (expect 54)')
print(f'loadInitialData present: {verify.count(b"loadInitialData")}')
print(f'activeCourses filter: {verify.count(b"courseColors.hasOwnProperty(course.name)")}')