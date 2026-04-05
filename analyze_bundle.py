import re

# Read the index.js bundle
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find how useState is imported/defined in the bundle
# Look for patterns like: const useState = ... or react.useState = ...

# 1. Find all useState assignments
useState_assignments = re.findall(r'const\s+(\w+)\s*=\s*useState;', content[:50000])
print("useState assignments found:", useState_assignments[:10])

# 2. Find reactExports.useState pattern
react_exports_pattern = re.findall(r'reactExports\.useState', content[:10000])
print("reactExports.useState occurrences:", len(react_exports_pattern))

# 3. Find clientExports.useState pattern
client_exports_pattern = re.findall(r'clientExports\.useState', content[:10000])
print("clientExports.useState occurrences:", len(client_exports_pattern))

# 4. Find where App's useState calls are (should be near the beginning of App function)
# Look for the context around isBuildingDfp state which is definitely correct
is_building_pattern = re.search(r'isBuildingDfp.*?useState[^;]*;', content[:200000], re.DOTALL)
if is_building_pattern:
    print("\nContext around isBuildingDfp useState:")
    print(is_building_pattern.group(0)[:500])

# 5. Find the actual import/declaration of reactExports
react_import = re.search(r'const reactExports[^;]*;', content[:10000])
if react_import:
    print("\nreactExports declaration:")
    print(react_import.group(0))

# 6. Search for all variables containing 'useState'
all_usestate_refs = re.findall(r'(\w+)\.useState', content[:10000])
print("\nObjects with .useState access:", set(all_usestate_refs))