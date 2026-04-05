#!/usr/bin/env python3
"""
Surgical patch FINAL - works in binary mode to ensure exact byte matching.
File confirmed to use plain " (0x22) characters, real newlines (0x0a).
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'rb') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

def patch(old_str, new_str, label):
    global content, changes
    old = old_str.encode('utf-8')
    new = new_str.encode('utf-8')
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print(f"✅ {label}")
        return True
    else:
        print(f"❌ {label} - NOT FOUND")
        # Debug: find nearest match
        # Try finding first 40 chars
        partial = old[:40]
        idx = content.find(partial)
        if idx >= 0:
            print(f"   Partial match at {idx}: {content[idx:idx+80]}")
        return False

# ============================================================================
# PATCH 1: Widen Start Date - add minWidth to style object
# Exact bytes: value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: "dark" }
# ============================================================================
patch(
    'value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: "dark" }',
    'value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: "dark", minWidth: "160px" }',
    "Patch 1: Start Date wider"
)

# ============================================================================
# PATCH 2: Widen End Date
# ============================================================================
patch(
    'value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: "dark" }',
    'value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: "dark", minWidth: "160px" }',
    "Patch 2: End Date wider"
)

# ============================================================================
# PATCH 3: Replace Start Time input with datalist+input combo
# The exact input element from byte inspection:
# /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("input", { type: "text", value: deploymentStartTime, onChange: (e) => {
#                   const value = e.target.value.replace(/:/g, "").replace(/\D/g, "").slice(0, 4);
#                   setDeploymentStartTime(value);
#                 }, placeholder: "0800", className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center" }, void 0, false, {
# ============================================================================

# Build time options - plain string, no escaping needed
time_options = ','.join([f'"{h:02d}{m:02d}"' for h in range(24) for m in [0, 30]])

# The old input element (exact bytes from file)
old_start_time = (
    '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("input", { type: "text", value: deploymentStartTime, onChange: (e) => {\n'
    '                  const value = e.target.value.replace(/:/g, "").replace(/\\D/g, "").slice(0, 4);\n'
    '                  setDeploymentStartTime(value);\n'
    '                }, placeholder: "0800", className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center" }, void 0, false, {'
)

new_start_time = (
    f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("datalist", {{ id: "deployStartOpts", children: [{time_options}].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("option", {{ value: t }}, t, false, {{}}, void 0)) }}, void 0, true, {{}}, void 0),\n'
    '                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("input", { type: "text", list: "deployStartOpts", value: deploymentStartTime || "0800", onChange: (e) => {\n'
    '                  const value = e.target.value.replace(/:/g, "").replace(/\\D/g, "").slice(0, 4);\n'
    '                  setDeploymentStartTime(value);\n'
    '                }, placeholder: "0800", className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center" }, void 0, false, {'
)

patch(old_start_time, new_start_time, "Patch 3: Start Time datalist dropdown")

# ============================================================================
# PATCH 4: Replace End Time input with datalist+input combo
# ============================================================================
old_end_time = (
    '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("input", { type: "text", value: deploymentEndTime, onChange: (e) => {\n'
    '                  const value = e.target.value.replace(/:/g, "").replace(/\\D/g, "").slice(0, 4);\n'
    '                  setDeploymentEndTime(value);\n'
    '                }, placeholder: "1700", className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center" }, void 0, false, {'
)

new_end_time = (
    f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("datalist", {{ id: "deployEndOpts", children: [{time_options}].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("option", {{ value: t }}, t, false, {{}}, void 0)) }}, void 0, true, {{}}, void 0),\n'
    '                /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("input", { type: "text", list: "deployEndOpts", value: deploymentEndTime || "0800", onChange: (e) => {\n'
    '                  const value = e.target.value.replace(/:/g, "").replace(/\\D/g, "").slice(0, 4);\n'
    '                  setDeploymentEndTime(value);\n'
    '                }, placeholder: "0800", className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center" }, void 0, false, {'
)

patch(old_end_time, new_end_time, "Patch 4: End Time datalist dropdown")

# ============================================================================
# PATCH 5: Hide Event Category section when isDeploy=true
# From actual file bytes:
# isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [
#           /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [
#             /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"
# ============================================================================
old_event_cat = (
    'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [\n'
    '          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [\n'
    '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"'
)

new_event_cat = (
    'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [\n'
    '          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [\n'
    '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"'
)

patch(old_event_cat, new_event_cat, "Patch 5: Hide Event Category when isDeploy=true")

print(f"\n{'='*60}")
print(f"Total patches applied: {changes}/5")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'wb') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
    
    # Quick sanity check - verify JS is not totally broken
    # Check that the file still has key markers
    checks = [
        b'jsxDevRuntimeExports',
        b'reactExports',
        b'EventDetailModal',
        b'deploymentStartTime',
        b'deploymentEndTime',
    ]
    print("\nSanity checks:")
    for check in checks:
        found = check in content
        print(f"  {'✅' if found else '❌'} {check.decode()}")
else:
    print("No changes made - bundle NOT written.")