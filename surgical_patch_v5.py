#!/usr/bin/env python3
"""
Surgical patch v5 - uses actual file content characters.
The bundle uses \\" for quotes inside JS strings (escaped double quotes).
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# In this file, quotes inside JS objects are escaped as \"
# So we use \" in our Python strings (which is just a double quote)

Q = '\\"'  # This is the escaped quote as it appears in the file: \"

# ============================================================================
# PATCH 1: Widen Start Date input
# ============================================================================
old1 = f'deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: {{ colorScheme: {Q}dark{Q} }}'
new1 = f'deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: {{ colorScheme: {Q}dark{Q}, minWidth: {Q}160px{Q} }}'

if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("✅ Patch 1: Widened Start Date input")
else:
    print("❌ Patch 1: Start Date NOT found")
    # Debug: check what's actually there
    idx = content.find('deploymentStartDate, onChange: (e) => setDeploymentStartDate')
    if idx >= 0:
        print(f"  Segment: {repr(content[idx:idx+150])}")

# ============================================================================
# PATCH 2: Widen End Date input
# ============================================================================
old2 = f'deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: {{ colorScheme: {Q}dark{Q} }}'
new2 = f'deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: {{ colorScheme: {Q}dark{Q}, minWidth: {Q}160px{Q} }}'

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("✅ Patch 2: Widened End Date input")
else:
    print("❌ Patch 2: End Date NOT found")
    idx = content.find('deploymentEndDate, onChange: (e) => setDeploymentEndDate')
    if idx >= 0:
        print(f"  Segment: {repr(content[idx:idx+150])}")

# ============================================================================
# PATCH 5: When isDeploy=true, hide Event Category section
# From bundle inspection, the exact text is:
#   children: isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [
#     /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [
#       /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"
# We want to add !isDeploy && before the mb-6 div
# ============================================================================
old5 = (
    f'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}div{Q}, {{ className: {Q}space-y-4{Q}, children: [\n'
    f'          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}div{Q}, {{ className: {Q}mb-6{Q}, children: [\n'
    f'            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}label{Q}, {{ className: {Q}block text-sm font-medium text-gray-400 mb-3{Q}, children: {Q}Event Category{Q}'
)
new5 = (
    f'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}div{Q}, {{ className: {Q}space-y-4{Q}, children: [\n'
    f'          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}div{Q}, {{ className: {Q}mb-6{Q}, children: [\n'
    f'            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}label{Q}, {{ className: {Q}block text-sm font-medium text-gray-400 mb-3{Q}, children: {Q}Event Category{Q}'
)

if old5 in content:
    content = content.replace(old5, new5, 1)
    changes += 1
    print("✅ Patch 5: Event Category hidden when isDeploy=true")
else:
    print("❌ Patch 5: Event Category section NOT found - debugging...")
    # Try to find the component pieces
    p1 = f'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV({Q}div{Q}, {{ className: {Q}space-y-4{Q}'
    p2 = f'className: {Q}mb-6{Q}'
    p3 = f'children: {Q}Event Category{Q}'
    print(f"  p1 found: {p1 in content}")
    print(f"  p2 found: {p2 in content}")
    print(f"  p3 found: {p3 in content}")
    
    idx5 = content.find(p1)
    if idx5 >= 0:
        print(f"  p1 at {idx5}: {repr(content[idx5:idx5+300])}")

print(f"\n{'='*60}")
print(f"Total patches applied: {changes}/3 (time patches already done)")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
else:
    print("No changes made - bundle NOT written.")