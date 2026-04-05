#!/usr/bin/env python3

with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# ============================================================================
# PATCH 1: Widen Start Date input (add minWidth style)
# ============================================================================
old1 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2111,'
new1 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2111,'

if old1 in content:
    content = content.replace(old1, new1)
    changes += 1
    print("✅ Patch 1a: Widened Start Date input")
else:
    print("❌ Patch 1a: Start Date NOT found - trying alternate...")
    # Try finding by line numbers
    idx = content.find('value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\" }')
    if idx >= 0:
        print(f"  Found at pos {idx}")
        print(f"  Context: {repr(content[idx-50:idx+200])}")

# ============================================================================
# PATCH 2: Widen End Date input (add minWidth style)
# ============================================================================
old2 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2123,'
new2 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2123,'

if old2 in content:
    content = content.replace(old2, new2)
    changes += 1
    print("✅ Patch 1b: Widened End Date input")
else:
    print("❌ Patch 1b: End Date NOT found - trying alternate...")
    idx = content.find('value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\" }')
    if idx >= 0:
        print(f"  Found at pos {idx}")
        print(f"  Context: {repr(content[idx-50:idx+200])}")

# ============================================================================
# PATCH 3: Replace Start Time text input with input+datalist combo
# ============================================================================
old3 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentStartTime, onChange: (e) => {\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\n                  setDeploymentStartTime(value);\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2103,'

new3 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"startTimeOpts\\", children: [\\"0000\\",\\"0030\\",\\"0100\\",\\"0130\\",\\"0200\\",\\"0230\\",\\"0300\\",\\"0330\\",\\"0400\\",\\"0430\\",\\"0500\\",\\"0530\\",\\"0600\\",\\"0630\\",\\"0700\\",\\"0730\\",\\"0800\\",\\"0830\\",\\"0900\\",\\"0930\\",\\"1000\\",\\"1030\\",\\"1100\\",\\"1130\\",\\"1200\\",\\"1230\\",\\"1300\\",\\"1330\\",\\"1400\\",\\"1430\\",\\"1500\\",\\"1530\\",\\"1600\\",\\"1630\\",\\"1700\\",\\"1730\\",\\"1800\\",\\"1830\\",\\"1900\\",\\"1930\\",\\"2000\\",\\"2030\\",\\"2100\\",\\"2130\\",\\"2200\\",\\"2230\\",\\"2300\\",\\"2330\\"].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0), /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"startTimeOpts\\", value: deploymentStartTime || \\"0800\\", onChange: (e) => {\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\n                  setDeploymentStartTime(value);\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2103,'

if old3 in content:
    content = content.replace(old3, new3)
    changes += 1
    print("✅ Patch 3: Start Time replaced with dropdown+manual")
else:
    print("❌ Patch 3: Start Time NOT found - searching...")
    idx = content.find('value: deploymentStartTime, onChange: (e) => {')
    if idx >= 0:
        print(f"  Found at pos {idx}: {repr(content[idx:idx+300])}")

# ============================================================================
# PATCH 4: Replace End Time text input with input+datalist combo  
# ============================================================================
old4 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentEndTime, onChange: (e) => {\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\n                  setDeploymentEndTime(value);\n                }, placeholder: \\"1700\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2115,'

new4 = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"endTimeOpts\\", children: [\\"0000\\",\\"0030\\",\\"0100\\",\\"0130\\",\\"0200\\",\\"0230\\",\\"0300\\",\\"0330\\",\\"0400\\",\\"0430\\",\\"0500\\",\\"0530\\",\\"0600\\",\\"0630\\",\\"0700\\",\\"0730\\",\\"0800\\",\\"0830\\",\\"0900\\",\\"0930\\",\\"1000\\",\\"1030\\",\\"1100\\",\\"1130\\",\\"1200\\",\\"1230\\",\\"1300\\",\\"1330\\",\\"1400\\",\\"1430\\",\\"1500\\",\\"1530\\",\\"1600\\",\\"1630\\",\\"1700\\",\\"1730\\",\\"1800\\",\\"1830\\",\\"1900\\",\\"1930\\",\\"2000\\",\\"2030\\",\\"2100\\",\\"2130\\",\\"2200\\",\\"2230\\",\\"2300\\",\\"2330\\"].map((t) => /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0), /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"endTimeOpts\\", value: deploymentEndTime || \\"0800\\", onChange: (e) => {\n                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);\n                  setDeploymentEndTime(value);\n                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {\n                  fileName: \\"/workspace/DFP-NEO-V2-fresh/components/FlightDetailModal.tsx\\",\n                  lineNumber: 2115,'

if old4 in content:
    content = content.replace(old4, new4)
    changes += 1
    print("✅ Patch 4: End Time replaced with dropdown+manual")
else:
    print("❌ Patch 4: End Time NOT found - searching...")
    idx = content.find('value: deploymentEndTime, onChange: (e) => {')
    if idx >= 0:
        print(f"  Found at pos {idx}: {repr(content[idx:idx+300])}")

# ============================================================================
# PATCH 5: When isDeploy is checked AND isAddingTile, hide other flight fields
# Find: isAddingTile section showing the flight details
# We need to make the main form content conditional on !isDeploy
# The key: when isDeploy, only show the Deployment Period fieldset
# The deployment section is shown via: eventType === "flight" && locationType === "Land Away"
# Since isDeploy already sets locationType to "Land Away", the deployment fieldset shows automatically
# We need to HIDE the Event Category, crew fields, etc when isDeploy is true
# ============================================================================

# Find the isAddingTile section: the Event Category buttons
# Look for the unique rendering of event category section in the modal
old5 = 'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: [\n          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: [\n            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"label\\", { className: \\"block text-sm font-medium text-gray-400 mb-3\\", children: \\"Event Category\\"'
new5 = 'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: [\n          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: [\n            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"label\\", { className: \\"block text-sm font-medium text-gray-400 mb-3\\", children: \\"Event Category\\"'

if old5 in content:
    content = content.replace(old5, new5)
    changes += 1
    print("✅ Patch 5: Event Category hidden when isDeploy")
else:
    print("❌ Patch 5: Event Category section NOT found - searching...")
    idx = content.find('"Event Category"')
    print(f"  'Event Category' found at positions: {[m.start() for m in __import__('re').finditer(chr(34)+'Event Category'+chr(34), content)][:5]}")

print(f"\n✅ Total patches applied: {changes}/5")

# Write the file
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

new_size = len(content)
print(f"New bundle size: {new_size:,} bytes (diff: {new_size - original_size:+,})")