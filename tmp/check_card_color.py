with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

# Find CourseCard component
pos = content.find(b'const CourseCard = ({ course })')
print(f'CourseCard at {pos}:')
print(content[pos:pos+800].decode('utf-8', errors='replace'))

print()
# Check how course color is applied in the card
pos2 = content.find(b'courseColors[course.name]')
print(f'courseColors[course.name] usage at {pos2}:')
if pos2 != -1:
    print(content[max(0,pos2-100):pos2+200].decode('utf-8', errors='replace'))
else:
    print('Not found - checking course.color usage')
    pos3 = content.find(b'course.color')
    while pos3 != -1 and pos3 < 4200000:
        print(f'  [{pos3}]: {content[max(0,pos3-50):pos3+100].decode("utf-8", errors="replace")}')
        pos3 = content.find(b'course.color', pos3+1)