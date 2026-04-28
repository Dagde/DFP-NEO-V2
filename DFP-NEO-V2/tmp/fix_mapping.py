with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)

# Fix the field mapping - API returns raafStart/navyStart/armyStart already mapped
# Our patch incorrectly used c.raafCount/c.navyCount/c.armyCount
old_map = (
    b'dbCourses = Array.isArray(cd.courses) ? cd.courses.map((c) => ({\n'
    b'          name: c.name,\n'
    b'          color: c.color || "#6366f1",\n'
    b'          startDate: c.startDate || "",\n'
    b'          gradDate: c.endDate || "",\n'
    b'          raafStart: c.raafCount || 0,\n'
    b'          navyStart: c.navyCount || 0,\n'
    b'          armyStart: c.armyCount || 0\n'
    b'        })) : [];'
)

# The server GET /api/courses already maps: raafCount->raafStart, navyCount->navyStart, armyCount->armyStart, endDate->gradDate
# So the response already has raafStart/navyStart/armyStart/gradDate
new_map = (
    b'dbCourses = Array.isArray(cd.courses) ? cd.courses.map((c) => ({\n'
    b'          name: c.name,\n'
    b'          color: c.color || "#6366f1",\n'
    b'          startDate: c.startDate || "",\n'
    b'          gradDate: c.gradDate || c.endDate || "",\n'
    b'          raafStart: c.raafStart || c.raafCount || 0,\n'
    b'          navyStart: c.navyStart || c.navyCount || 0,\n'
    b'          armyStart: c.armyStart || c.armyCount || 0\n'
    b'        })) : [];'
)

if old_map in content:
    content = content.replace(old_map, new_map, 1)
    print('✓ Fix mapping: use raafStart/navyStart/armyStart from API response')
else:
    print('✗ FAILED')
    pos = content.find(b'dbCourses = Array.isArray')
    if pos != -1:
        print(repr(content[pos:pos+400]))

print(f'Size: {len(content)} (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('Written.')