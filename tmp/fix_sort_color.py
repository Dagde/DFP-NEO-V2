with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)

# Fix sort within groups - add sort by name after grouping
old_sort = (
    b'    Object.keys(groups).forEach((key) => {\n'
    b'      if (groups[key].length === 0) {\n'
    b'        delete groups[key];\n'
    b'      }\n'
    b'    });\n'
    b'    return groups;\n'
    b'  }, [courses, courseColors]);'
)

new_sort = (
    b'    Object.keys(groups).forEach((key) => {\n'
    b'      if (groups[key].length === 0) {\n'
    b'        delete groups[key];\n'
    b'      } else {\n'
    b'        groups[key].sort((a, b) => a.name.localeCompare(b.name));\n'
    b'      }\n'
    b'    });\n'
    b'    return groups;\n'
    b'  }, [courses, courseColors]);'
)

if old_sort in content:
    content = content.replace(old_sort, new_sort, 1)
    print('✓ Fix sort: courses sorted by name within groups')
else:
    print('✗ Sort fix FAILED')
    pos = content.find(b'Object.keys(groups).forEach')
    if pos != -1:
        print(repr(content[pos:pos+200]))

print(f'Size: {len(content)} (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('Written.')

# Verify
with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    verify = f.read()
print(f'sort by name: {verify.count(b"sort((a, b) => a.name.localeCompare(b.name))")}')
print(f'raafStart mapping: {verify.count(b"c.raafStart || c.raafCount || 0")}')
print(f'useState([]) count: {verify.count(b"useState([])")} (expect 54)')