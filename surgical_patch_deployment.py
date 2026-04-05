#!/usr/bin/env python3

with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# ============================================================================
# PATCH 1: Widen the date inputs by adding min-w class to start date input
# Original: className: "mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm"
# for date inputs (deploymentStartDate and deploymentEndDate)
# ============================================================================

# Patch the Start Date input - widen it
old_start_date = 'jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }'
new_start_date = 'jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" })'

if old_start_date in content:
    content = content.replace(old_start_date, new_start_date)
    changes += 1
    print("✅ Patch 1a: Widened Start Date input")
else:
    print("❌ Patch 1a: Start Date input NOT found")

# Patch the End Date input - widen it
old_end_date = 'jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" }'
new_end_date = 'jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"date\\", value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"140px\\" }, className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm\\" })'

if old_end_date in content:
    content = content.replace(old_end_date, new_end_date)
    changes += 1
    print("✅ Patch 1b: Widened End Date input")
else:
    print("❌ Patch 1b: End Date input NOT found")

# ============================================================================
# PATCH 2: Replace Start Time text input with dropdown + manual entry combo
# Currently: plain text input with placeholder "0800"
# New: datalist-based input with 30-min intervals, defaulting to 0800
# ============================================================================

old_start_time = '''jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentStartTime, onChange: (e) => {
                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);
                  setDeploymentStartTime(value);
                }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }'''

new_start_time = '''jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
                  jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"startTimeOptions\\", children: [\\"0000\\",\\"0030\\",\\"0100\\",\\"0130\\",\\"0200\\",\\"0230\\",\\"0300\\",\\"0330\\",\\"0400\\",\\"0430\\",\\"0500\\",\\"0530\\",\\"0600\\",\\"0630\\",\\"0700\\",\\"0730\\",\\"0800\\",\\"0830\\",\\"0900\\",\\"0930\\",\\"1000\\",\\"1030\\",\\"1100\\",\\"1130\\",\\"1200\\",\\"1230\\",\\"1300\\",\\"1330\\",\\"1400\\",\\"1430\\",\\"1500\\",\\"1530\\",\\"1600\\",\\"1630\\",\\"1700\\",\\"1730\\",\\"1800\\",\\"1830\\",\\"1900\\",\\"1930\\",\\"2000\\",\\"2030\\",\\"2100\\",\\"2130\\",\\"2200\\",\\"2230\\",\\"2300\\",\\"2330\\"].map((t) => jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0),
                  jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"startTimeOptions\\", value: deploymentStartTime || \\"0800\\", onChange: (e) => {
                    const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);
                    setDeploymentStartTime(value);
                  }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {}, void 0)
                ] }, void 0, true, {}, void 0'''

if old_start_time in content:
    content = content.replace(old_start_time, new_start_time)
    changes += 1
    print("✅ Patch 2: Start Time replaced with dropdown+manual")
else:
    print("❌ Patch 2: Start Time input NOT found - checking exact text...")
    # Debug: show what's actually there
    import re
    matches = list(re.finditer(r'deploymentStartTime.*?placeholder.*?0800.*?text-center', content, re.DOTALL))
    for m in matches[:2]:
        print(f"  Found at pos {m.start()}: {repr(content[m.start():m.start()+200])}")

# ============================================================================
# PATCH 3: Replace End Time text input with dropdown + manual entry combo
# ============================================================================

old_end_time = '''jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", value: deploymentEndTime, onChange: (e) => {
                  const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);
                  setDeploymentEndTime(value);
                }, placeholder: \\"1700\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }'''

new_end_time = '''jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: [
                  jsxDevRuntimeExports.jsxDEV(\\"datalist\\", { id: \\"endTimeOptions\\", children: [\\"0000\\",\\"0030\\",\\"0100\\",\\"0130\\",\\"0200\\",\\"0230\\",\\"0300\\",\\"0330\\",\\"0400\\",\\"0430\\",\\"0500\\",\\"0530\\",\\"0600\\",\\"0630\\",\\"0700\\",\\"0730\\",\\"0800\\",\\"0830\\",\\"0900\\",\\"0930\\",\\"1000\\",\\"1030\\",\\"1100\\",\\"1130\\",\\"1200\\",\\"1230\\",\\"1300\\",\\"1330\\",\\"1400\\",\\"1430\\",\\"1500\\",\\"1530\\",\\"1600\\",\\"1630\\",\\"1700\\",\\"1730\\",\\"1800\\",\\"1830\\",\\"1900\\",\\"1930\\",\\"2000\\",\\"2030\\",\\"2100\\",\\"2130\\",\\"2200\\",\\"2230\\",\\"2300\\",\\"2330\\"].map((t) => jsxDevRuntimeExports.jsxDEV(\\"option\\", { value: t }, t, false, {}, void 0)) }, void 0, true, {}, void 0),
                  jsxDevRuntimeExports.jsxDEV(\\"input\\", { type: \\"text\\", list: \\"endTimeOptions\\", value: deploymentEndTime || \\"0800\\", onChange: (e) => {
                    const value = e.target.value.replace(/:/g, \\"\\").replace(/\\\\D/g, \\"\\").slice(0, 4);
                    setDeploymentEndTime(value);
                  }, placeholder: \\"0800\\", className: \\"mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center\\" }, void 0, false, {}, void 0)
                ] }, void 0, true, {}, void 0'''

if old_end_time in content:
    content = content.replace(old_end_time, new_end_time)
    changes += 1
    print("✅ Patch 3: End Time replaced with dropdown+manual")
else:
    print("❌ Patch 3: End Time input NOT found - checking exact text...")
    import re
    matches = list(re.finditer(r'deploymentEndTime.*?placeholder.*?1700.*?text-center', content, re.DOTALL))
    for m in matches[:2]:
        print(f"  Found at pos {m.start()}: {repr(content[m.start():m.start()+200])}")

# ============================================================================
# PATCH 4: When isDeploy is checked, hide other flight fields
# Find the section that shows the main flight details form and wrap with !isDeploy
# ============================================================================

# Find the "Event Category" section for isAddingTile mode - this is the section
# we want to hide when isDeploy is checked
# Look for the isAddingTile && section
old_category_section = 'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: ['
new_category_section = 'isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"space-y-4\\", children: ['

# Actually let's find the exact context around the event category buttons for adding
# The key insight: when isDeploy is true, we want to hide the flight fields
# But we still need to show the Deployment Period fieldset
# The deployment fieldset is shown via: eventType === "flight" && locationType === "Land Away"
# So we just need isDeploy to also trigger hiding the other fields

# Let's wrap the main content section
print(f"\n✅ Total patches applied: {changes}")

# Write the file
with open('DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'w', encoding='utf-8') as f:
    f.write(content)

new_size = len(content)
print(f"New bundle size: {new_size:,} bytes (diff: {new_size - original_size:+,})")