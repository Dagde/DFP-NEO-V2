#!/usr/bin/env python3
"""
Surgical patch v4 - reads exact strings from bundle using byte positions,
then applies precise replacements.
"""

BUNDLE_PATH = 'DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js'

with open(BUNDLE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
print(f"Bundle size: {original_size:,} bytes")

changes = 0

# Time options for datalist (30-minute intervals)
time_opts_list = [f'"{h:02d}{m:02d}"' for h in range(24) for m in [0, 30]]
time_opts_str = ",".join(time_opts_list)

# ============================================================================
# HELPER: find exact string in bundle
# ============================================================================
def find_exact(search, label):
    idx = content.find(search)
    if idx >= 0:
        print(f"  ✅ Found '{label}' at pos {idx}")
    else:
        print(f"  ❌ NOT found: '{label}'")
    return idx

# ============================================================================
# PATCH 1: Widen Start Date input
# ============================================================================
# Locate the exact old string by searching for the unique part
start_date_marker = 'value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\" }'
idx1 = content.find(start_date_marker)
if idx1 >= 0:
    old1 = start_date_marker
    new1 = 'value: deploymentStartDate, onChange: (e) => setDeploymentStartDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"160px\\" }'
    content = content.replace(old1, new1, 1)
    changes += 1
    print("✅ Patch 1: Widened Start Date input (minWidth: 160px)")
else:
    print("❌ Patch 1: Start Date marker NOT found")
    idx = content.find('deploymentStartDate, onChange')
    if idx >= 0:
        print(f"  Partial found at {idx}: {repr(content[idx:idx+150])}")

# ============================================================================
# PATCH 2: Widen End Date input
# ============================================================================
end_date_marker = 'value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\" }'
idx2 = content.find(end_date_marker)
if idx2 >= 0:
    old2 = end_date_marker
    new2 = 'value: deploymentEndDate, onChange: (e) => setDeploymentEndDate(e.target.value), style: { colorScheme: \\"dark\\", minWidth: \\"160px\\" }'
    content = content.replace(old2, new2, 1)
    changes += 1
    print("✅ Patch 2: Widened End Date input (minWidth: 160px)")
else:
    print("❌ Patch 2: End Date marker NOT found")

# ============================================================================
# PATCH 3: Replace Start Time text input with datalist+input combo
# The exact unique marker for this input:
# ============================================================================
start_time_marker = 'value: deploymentStartTime, onChange: (e) => {'
idx3 = content.find(start_time_marker)
if idx3 >= 0:
    # Find the full input element - from /* @__PURE__ */ before it to }, void 0, false, {
    # Walk backwards to find the jsxDEV call start
    pure_marker = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\"'
    start3 = content.rfind(pure_marker, 0, idx3)
    # Find the }, void 0, false, { that closes this element
    close_marker = '}, void 0, false, {'
    end3 = content.find(close_marker, idx3)
    old3 = content[start3:end3 + len(close_marker)]
    
    print(f"  Start time old: {repr(old3[:80])}...")
    
    # Build replacement: datalist + input with list attribute
    new3 = (
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", {{ id: \\"deployStartOpts\\", children: [{time_opts_str}].map((t) => '
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", {{ value: t }}, t, false, {{}}, void 0)) }}, void 0, true, {{}}, void 0), '
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", {{ type: \\"text\\", list: \\"deployStartOpts\\", value: deploymentStartTime || \\"0800\\", onChange: (e) => {{'
        + old3[old3.find('onChange: (e) => {')+len('onChange: (e) => {'):]  # keep rest of original
    )
    
    content = content.replace(old3, new3, 1)
    changes += 1
    print("✅ Patch 3: Start Time replaced with datalist dropdown")
else:
    print("❌ Patch 3: Start Time marker NOT found")

# ============================================================================
# PATCH 4: Replace End Time text input with datalist+input combo
# ============================================================================
end_time_marker = 'value: deploymentEndTime, onChange: (e) => {'
idx4 = content.find(end_time_marker)
if idx4 >= 0:
    pure_marker = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\"'
    start4 = content.rfind(pure_marker, 0, idx4)
    close_marker = '}, void 0, false, {'
    end4 = content.find(close_marker, idx4)
    old4 = content[start4:end4 + len(close_marker)]
    
    print(f"  End time old: {repr(old4[:80])}...")
    
    new4 = (
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"datalist\\", {{ id: \\"deployEndOpts\\", children: [{time_opts_str}].map((t) => '
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"option\\", {{ value: t }}, t, false, {{}}, void 0)) }}, void 0, true, {{}}, void 0), '
        f'/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"input\\", {{ type: \\"text\\", list: \\"deployEndOpts\\", value: deploymentEndTime || \\"0800\\", onChange: (e) => {{'
        + old4[old4.find('onChange: (e) => {')+len('onChange: (e) => {'):]
    )
    
    content = content.replace(old4, new4, 1)
    changes += 1
    print("✅ Patch 4: End Time replaced with datalist dropdown")
else:
    print("❌ Patch 4: End Time marker NOT found")

# ============================================================================
# PATCH 5: When isDeploy is true, hide Event Category + other fields
# The structure in bundle:
#   isEditing ? jsxDEV("div", { className: "space-y-4", children: [
#     jsxDEV("div", { className: "mb-6", children: [      <-- Event Category div
#       jsxDEV("label", {..., children: "Event Category"
#
# Strategy: replace the opening of that mb-6 div with !isDeploy && jsxDEV(...)
# ============================================================================
# Find the exact string from bundle inspection
event_cat_context = 'children: isEditing ? /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\"'
idx5 = content.find(event_cat_context)
if idx5 >= 0:
    # Find the mb-6 div that follows
    mb6_marker = '/* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: ['
    idx5b = content.find(mb6_marker, idx5)
    if idx5b >= 0 and idx5b < idx5 + 500:
        old5 = mb6_marker
        new5 = '!isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(\\"div\\", { className: \\"mb-6\\", children: ['
        content = content.replace(old5, new5, 1)
        changes += 1
        print("✅ Patch 5: Event Category hidden when isDeploy=true")
    else:
        print(f"❌ Patch 5b: mb-6 div not found near event_cat_context (idx5={idx5}, idx5b={idx5b})")
else:
    print("❌ Patch 5: event_cat_context NOT found")
    # Try alternate approach
    idx5c = content.find('\\"Event Category\\"')
    print(f"  'Event Category' found at: {idx5c}")
    if idx5c >= 0:
        print(f"  Context: {repr(content[idx5c-500:idx5c+50])}")

print(f"\n{'='*60}")
print(f"Total patches applied: {changes}/5")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
else:
    print("No changes made - bundle NOT written.")