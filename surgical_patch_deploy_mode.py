#!/usr/bin/env python3
"""
Surgical patch: Deploy mode - hide all non-deployment fields when isDeploy=true,
widen modal 25%, fix deployment period to show when isDeploy=true.

All strings verified against actual file bytes (plain " chars, real newlines).
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
    count = content.count(old)
    if count == 1:
        content = content.replace(old, new)
        changes += 1
        print(f"✅ {label}")
        return True
    elif count == 0:
        print(f"❌ {label} - NOT FOUND")
        # Debug: show first 50 chars of old and search for partial
        partial = old[:60]
        idx = content.find(partial)
        if idx >= 0:
            print(f"   Partial match at {idx}: {content[idx:idx+80]}")
        return False
    else:
        print(f"⚠️  {label} - FOUND {count} times (skipping)")
        return False

# ============================================================================
# PATCH A: Widen modal from max-w-2xl to max-w-[840px] (25% wider: 672→840px)
# ============================================================================
patch(
    'bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 transform transition-all animate-fade-in flex flex-col max-h-[85vh]',
    'bg-gray-800 rounded-lg shadow-xl w-full max-w-[840px] border border-gray-700 transform transition-all animate-fade-in flex flex-col max-h-[85vh]',
    "Patch A: Modal widened to max-w-[840px] (25% wider)"
)

# ============================================================================
# PATCH B: Hide the main flight grid (Syllabus/Area/Aircraft/StartTime/Duration)
# This is the `grid grid-cols-1 ... md:grid-cols-4 ... gap-4` section
# It appears right after Event Category closes at lineNumber 1931
# ============================================================================
patch(
    '}, void 0),\n          /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: `grid grid-cols-1 ${eventType === "flight" ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`,',
    '}, void 0),\n          !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: `grid grid-cols-1 ${eventType === "flight" ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`,',
    "Patch B: Hide Syllabus/Area/Aircraft/StartTime/Duration grid when isDeploy"
)

# ============================================================================
# PATCH C: Hide Location section (eventType === "flight" && ...)
# The location section: eventType === "flight" && jsxDEV("div", { children: [
#   jsxDEV("label", {..., children: "Location"
# Need to add !isDeploy &&
# ============================================================================
patch(
    'eventType === "flight" && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [\n            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400", childre',
    'eventType === "flight" && !isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { children: [\n            /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("label", { className: "block text-sm font-medium text-gray-400", childre',
    "Patch C: Hide Location section when isDeploy"
)

# ============================================================================
# PATCH D: Fix Deployment Period condition
# Current: eventType === "flight" && locationType === "Land Away" && /* @__PURE__ */
# Change to: (isDeploy || (eventType === "flight" && locationType === "Land Away")) && /* @__PURE__ */
# ============================================================================
patch(
    'eventType === "flight" && locationType === "Land Away" && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("fieldset", { className: "p-4 border border-gray-600 rounded-lg mb-4"',
    '(isDeploy || (eventType === "flight" && locationType === "Land Away")) && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV(jsxDevRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("fieldset", { className: "p-4 border border-gray-600 rounded-lg mb-4"',
    "Patch D: Show Deployment Period when isDeploy=true (not just Land Away)"
)

# ============================================================================
# PATCH E: Hide Formation Details section (flightNumber === "SCT FORM" && ...)
# ============================================================================
patch(
    'flightNumber === "SCT FORM" && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "p-3 bg-gray-900/50 rounded-lg space',
    '!isDeploy && flightNumber === "SCT FORM" && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "p-3 bg-gray-900/50 rounded-lg space',
    "Patch E: Hide Formation Details when isDeploy"
)

# ============================================================================
# PATCH F: Hide Add to Deployment section
# (eventType === "flight" || eventType === "ftd" || eventType === "cpt") && jsxDEV("div", { className: "border-t border-gray-600 pt-6 mt-6"
# ============================================================================
patch(
    '(eventType === "flight" || eventType === "ftd" || eventType === "cpt") && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t border-gray-600 pt-6 mt-6"',
    '!isDeploy && (eventType === "flight" || eventType === "ftd" || eventType === "cpt") && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "border-t border-gray-600 pt-6 mt-6"',
    "Patch F: Hide Add to Deployment section when isDeploy"
)

# ============================================================================
# PATCH G: Remove the existing !isDeploy condition from Origin/Destination
# (this was already conditioned: eventType === "flight" && locationType === "Land Away" && !isDeploy)
# since we now hide Origin/Destination as part of Location (Patch C hides location type selector)
# Actually keep it - it's fine, !isDeploy is already there
# ============================================================================

print(f"\n{'='*60}")
print(f"Total patches applied: {changes}/6")
print(f"{'='*60}")

if changes > 0:
    with open(BUNDLE_PATH, 'wb') as f:
        f.write(content)
    new_size = len(content)
    print(f"Bundle written: {new_size:,} bytes (diff: {new_size - original_size:+,})")
    
    # Verify key patches
    print("\nVerification:")
    checks = [
        (b'max-w-[840px]', 'Modal width 840px'),
        (b'!isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: `grid', 'Grid hidden when isDeploy'),
        (b'!isDeploy && /* @__PURE__ */ jsxDevRuntimeExports.jsxDEV("div", { className: "mb-6"', 'Event Category hidden'),
        (b'!isDeploy && (eventType === "flight"', 'Add to Deployment hidden'),
        (b'isDeploy || (eventType === "flight" && locationType === "Land Away")', 'Deployment Period shows for isDeploy'),
    ]
    for search, label in checks:
        found = search in content
        print(f"  {'✅' if found else '❌'} {label}")
else:
    print("No changes - bundle NOT written.")