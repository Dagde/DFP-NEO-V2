with open('/workspace/App.tsx', 'r') as f:
    content = f.read()

# Find all instances where setSuccessMessage has 16 spaces instead of 13
# but only when preceded by handleNavigation
import re

# Pattern: handleNavigation line followed by setSuccessMessage with wrong indentation
pattern = r"(handleNavigation\(['&quot;]Instructors['&quot;]\);|handleNavigation\(['&quot;]CourseRoster['&quot;]\);)\n                setSuccessMessage\(`Navigated to "

def replacer(m):
    return m.group(1) + '\n             setSuccessMessage(`Navigated to '

content = re.sub(pattern, replacer, content)

with open('/workspace/App.tsx', 'w') as f:
    f.write(content)

print("Fixed setSuccessMessage indentation")