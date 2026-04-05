#!/usr/bin/env python3
"""
Surgical patch v6 - uses actual plain double quotes as they appear in file.
Verified: file uses plain " characters (0x22), not escaped backslash-quote.
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# ============================================================================
# PATCH 1: Widen Start Date input - add minWidth to style
# File content uses plain double quotes "
# ============================================================================
old1 = 'deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: "dark" }'
new1 = 'deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: "dark", minWidth: "160px" }'

if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("✅ Patch 1: Widened Start Date input")
else:
    print("❌ Patch 1: Start Date NOT found")
    idx = content.find('deploymentStartDate, onChange: (e) => setDeploymentStartDate')
    if idx >= 0:
        print(f"  Actual segment: {content[idx:idx+130]!r}")

# ============================================================================
# PATCH 2: Widen End Date input
# ============================================================================
old2 = 'deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: "dark" }'
new2 = 'deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: "dark", minWidth: "160px" }'

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("✅ Patch 2: Widened End Date input")
else:
    print("❌ Patch 2: End Date NOT found")
    idx = content.find('deploymentEndDate, onChange: (e) => setDeploymentEndDate')
    if idx >= 0:
        print(f"  Actual segment: {content[idx:idx+130]!r}")

# ============================================================================
# PATCH 5: Hide Event Category section when isDeploy=true
# From actual file inspection:
# isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [
#           /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [
#             /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"
# ============================================================================
old5 = ('isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [\n'
        '          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [\n'
        '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"')

new5 = ('isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [\n'
        '          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [\n'
        '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"')

if old5 in content:
    content = content.replace(old5, new5, 1)
    changes += 1
    print("✅ Patch 5: Event Category hidden when isDeploy=true")
else:
    print("❌ Patch 5: Event Category section NOT found - debugging...")
    # Check each piece
    p1 = 'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: ['
    p2 = 'className: "mb-6", children: ['
    p3 = 'children: "Event Category"'
    print(f"  p1 (isEditing+space-y-4): {p1 in content}")
    print(f"  p2 (mb-6): {p2 in content}")
    print(f"  p3 (Event Category): {p3 in content}")
    
    # Show actual context
    idx5 = content.find('Event Category')
    if idx5 >= 0:
        print(f"  Event Category context:\n{content[idx5-500:idx5+50]}")

print(f"\n{'='*60}")
print(f"Total new patches: {changes}/3")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
else:
    print("No changes - bundle NOT written.")