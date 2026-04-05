import re

# Read the index.js bundle
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace clientExports.useState with reactExports.useState
content = content.replace('clientExports.useState', 'reactExports.useState')

# Replace clientExports.useEffect with reactExports.useEffect
content = content.replace('clientExports.useEffect', 'reactExports.useEffect')

# Write back
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed useState and useEffect imports in DataLoadingMonitor")
print("Changed clientExports.useState → reactExports.useState")
print("Changed clientExports.useEffect → reactExports.useEffect")

# Verify the fix
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    fixed_content = f.read()

if 'reactExports.useState' in fixed_content and 'reactExports.useEffect' in fixed_content:
    print("✅ Verification passed: reactExports.useState and reactExports.useEffect found")
else:
    print("❌ Verification failed!")

if 'clientExports.useState' not in fixed_content and 'clientExports.useEffect' not in fixed_content:
    print("✅ No more clientExports hooks in the bundle")
else:
    print("❌ Warning: clientExports hooks still present!")