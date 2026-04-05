#!/usr/bin/env python3
"""
Surgical patch v3 - uses EXACT strings from bundle inspection.
All strings verified against actual bundle content.
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# ============================================================================
# PATCH 1: Widen Start Date input (add minWidth style)
# Exact string from bundle inspection
# ============================================================================
old1 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\\\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\\\n                  lineNumber: 2111,'
new1 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\\\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\\\n                  lineNumber: 2111,'

if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("✅ Patch 1: Widened Start Date input")
else:
    print("❌ Patch 1: Start Date NOT found")
    idx = content.find('value: deploymentStartDate, onChange: (e) => setDeploymentStartDate')
    if idx >= 0:
        print(f"  deploymentStartDate found at {idx}: {repr(content[idx-50:idx+200])}")

# ============================================================================
# PATCH 2: Widen End Date input (add minWidth style)
# ============================================================================
old2 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\\\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\\\n                  lineNumber: 2123,'
new2 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\\\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\\\n                  lineNumber: 2123,'

if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("✅ Patch 2: Widened End Date input")
else:
    print("❌ Patch 2: End Date NOT found")
    idx = content.find('value: deploymentEndDate, onChange: (e) => setDeploymentEndDate')
    if idx >= 0:
        print(f"  deploymentEndDate found at {idx}: {repr(content[idx-50:idx+200])}")

# ============================================================================
# PATCH 3: Replace Start Time text input with input+datalist combo
# Exact string from bundle (note: \\\n is actual newline in file as \\n)
# ============================================================================
old3 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentStartTime, onChange: (e) => {\\\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\\\n                  setDeploymentStartTime(value);\\\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {'

# Build the time options string
time_opts = ",".join([f'\\"{h:02d}{m:02d}\\"' for h in range(24) for m in [0, 30]])

new3 = (
    '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"deployStartTimeOpts\\", children: ['
    + time_opts
    + '].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0), /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"deployStartTimeOpts\\", value: deploymentStartTime || \\"0800\\", onChange: (e) => {\\\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\\\n                  setDeploymentStartTime(value);\\\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {'
)

if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("✅ Patch 3: Start Time replaced with dropdown+manual")
else:
    print("❌ Patch 3: Start Time NOT found")
    idx = content.find('value: deploymentStartTime, onChange: (e) => {')
    if idx >= 0:
        print(f"  Found at {idx}: {repr(content[idx-100:idx+300])}")

# ============================================================================
# PATCH 4: Replace End Time text input with input+datalist combo
# ============================================================================
old4 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentEndTime, onChange: (e) => {\\\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\\\n                  setDeploymentEndTime(value);\\\n                }, placeholder: \\"1700\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {'

new4 = (
    '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"deployEndTimeOpts\\", children: ['
    + time_opts
    + '].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0), /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"deployEndTimeOpts\\", value: deploymentEndTime || \\"0800\\", onChange: (e) => {\\\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\\\n                  setDeploymentEndTime(value);\\\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px_2 text-sm text-center\\" }, void 0, false, {'
)

if old4 in content:
    content = content.replace(old4, new4)
    changes += 1
    print("✅ Patch 4: End Time replaced with dropdown+manual")
else:
    print("❌ Patch 4: End Time NOT found")
    idx = content.find('value: deploymentEndTime, onChange: (e) => {')
    if idx >= 0:
        print(f"  Found at {idx}: {repr(content[idx-100:idx+300])}")

# ============================================================================
# PATCH 5: When isDeploy is true, hide the Event Category section
# Wrap the mb-6 div (Event Category) with !isDeploy &&
# Exact string from bundle:
#   "isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "space-y-4", children: [
#     /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6", children: [
#       /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400 mb-3", children: "Event Category"
# ============================================================================
old5 = ('isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: [\\\n'
        '          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: [\\\n'
        '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"label\\", { className: \\"block text-sm font-medium text-gray-400 mb-3\\", children: \\"Event Category\\"')

new5 = ('isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: [\\\n'
        '          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: [\\\n'
        '            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"label\\", { className: \\"block text-sm font-medium text-gray-400 mb-3\\", children: \\"Event Category\\"')

if old5 in content:
    content = content.replace(old5, new5)
    changes += 1
    print("✅ Patch 5: Event Category hidden when isDeploy=true")
else:
    print("❌ Patch 5: Event Category section NOT found - searching...")
    idx = content.find('"Event Category"')
    if idx >= 0:
        print(f"  'Event Category' found at {idx}: {repr(content[idx-400:idx+100])}")

print(f"\n✅ Total patches applied: {changes}/5")

if changes > 0:
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    new_size = len(content)
    print(f"New bundle size: {new_size:,} bytes (diff: {new_size - original_size:+,})")
    print("Bundle written successfully.")
else:
    print("No changes made - bundle NOT written.")