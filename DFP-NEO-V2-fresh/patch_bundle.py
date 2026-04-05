#!/usr/bin/env python3
"""
Surgical patch to index.js bundle for FIC211 hex color (#F97316) support.
We NEVER rebuild the bundle - only do targeted string replacements.
"""

import re
import sys

BUNDLE_PATH = 'dfp-neo-platform/public/flight-school-app/assets/index.js'

content = open(BUNDLE_PATH, encoding='utf-8').read()
original = content
patches_applied = 0

# ============================================================
# PATCH 1: Sidebar - course legend dot
# Old: className: `h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0`
# New: conditional hex support
# ============================================================
old1 = 'jsxDevRuntimeExports.jsxDEV("span", { className: `h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0` }, void 0, false, {\n              fileName: "/workspace/DFP-NEO-V2-fresh/components/Sidebar.tsx",\n              lineNumber: 221,'
new1 = 'color.startsWith("#") ? jsxDevRuntimeExports.jsxDEV("span", { className: "h-3 w-3 rounded-full mr-2 flex-shrink-0", style: { backgroundColor: color } }, void 0, false, { fileName: "/workspace/DFP-NEO-V2-fresh/components/Sidebar.tsx", lineNumber: 221, columnNumber: 21 }) : jsxDevRuntimeExports.jsxDEV("span", { className: `h-3 w-3 rounded-full ${color} mr-2 flex-shrink-0` }, void 0, false, {\n              fileName: "/workspace/DFP-NEO-V2-fresh/components/Sidebar.tsx",\n              lineNumber: 221,'

if old1 in content:
    content = content.replace(old1, new1, 1)
    patches_applied += 1
    print('✅ Patch 1 applied: Sidebar legend dot')
else:
    print('❌ Patch 1 NOT found: Sidebar legend dot')
    # Try to find a close match
    idx = content.find('h-3 w-3 rounded-full')
    if idx >= 0:
        print(f'   Found similar at {idx}: {repr(content[idx:idx+120])}')

# ============================================================
# PATCH 2: CourseRosterView - course card header
# Old: className: `px-4 py-2 text-white font-bold text-lg ${color} flex justify-between items-center`
# New: conditional hex support
# ============================================================
old2 = 'className: `px-4 py-2 text-white font-bold text-lg ${color} flex justify-between items-center`,'
new2 = 'className: `px-4 py-2 text-white font-bold text-lg ${color.startsWith("#") ? "" : color} flex justify-between items-center`, style: color.startsWith("#") ? { backgroundColor: color } : {},'

if old2 in content:
    content = content.replace(old2, new2, 1)
    patches_applied += 1
    print('✅ Patch 2 applied: CourseRosterView card header')
else:
    print('❌ Patch 2 NOT found: CourseRosterView card header')
    idx = content.find('px-4 py-2 text-white font-bold text-lg')
    if idx >= 0:
        print(f'   Found similar at {idx}: {repr(content[idx:idx+120])}')

# ============================================================
# PATCH 3: CourseDataWindow - course header div
# Old: className: `p-4 border-b border-gray-700 rounded-t-lg ${courseColor}`
# New: conditional hex support
# ============================================================
old3 = 'className: `p-4 border-b border-gray-700 rounded-t-lg ${courseColor}`,'
new3 = 'className: `p-4 border-b border-gray-700 rounded-t-lg ${courseColor && courseColor.startsWith("#") ? "" : (courseColor || "")}`, style: courseColor && courseColor.startsWith("#") ? { backgroundColor: courseColor } : {},'

if old3 in content:
    content = content.replace(old3, new3, 1)
    patches_applied += 1
    print('✅ Patch 3 applied: CourseDataWindow header')
else:
    print('❌ Patch 3 NOT found: CourseDataWindow header')
    idx = content.find('p-4 border-b border-gray-700 rounded-t-lg')
    if idx >= 0:
        print(f'   Found similar at {idx}: {repr(content[idx:idx+120])}')

# ============================================================
# PATCH 4: CourseDataWindow - per-trainee progress bar
# Old: className: `${courseColor} h-1.5 rounded-full`, style: { width: `${percentage}%` }
# New: conditional hex support
# ============================================================
old4 = 'className: `${courseColor} h-1.5 rounded-full`,\n          style: { width: `${percentage}%` }'
new4 = 'className: `${courseColor && courseColor.startsWith("#") ? "" : (courseColor || "")} h-1.5 rounded-full`,\n          style: { width: `${percentage}%`, ...(courseColor && courseColor.startsWith("#") ? { backgroundColor: courseColor } : {}) }'

if old4 in content:
    content = content.replace(old4, new4, 1)
    patches_applied += 1
    print('✅ Patch 4 applied: CourseDataWindow progress bar')
else:
    print('❌ Patch 4 NOT found: CourseDataWindow progress bar')
    idx = content.find('courseColor} h-1.5 rounded-full')
    if idx >= 0:
        print(f'   Found similar at {idx}: {repr(content[max(0,idx-50):idx+150])}')

# ============================================================
# PATCH 5: ArchivedCoursesView - color swatch
# Old: className: `w-4 h-4 rounded ${color}`  (at ArchivedCoursesView.tsx line 95)
# New: conditional hex support
# The bundle has this exact pattern — we need to target it precisely
# ============================================================
old5 = 'jsxDevRuntimeExports.jsxDEV("div", { className: `w-4 h-4 rounded ${color}` }, void 0, false, {\n            fileName: "/workspace/DFP-NEO-V2-fresh/components/ArchivedCoursesView.tsx",\n            lineNumber: 95,'
new5 = 'jsxDevRuntimeExports.jsxDEV("div", { className: `w-4 h-4 rounded ${color && color.startsWith("#") ? "" : (color || "")}`, style: color && color.startsWith("#") ? { backgroundColor: color } : {} }, void 0, false, {\n            fileName: "/workspace/DFP-NEO-V2-fresh/components/ArchivedCoursesView.tsx",\n            lineNumber: 95,'

if old5 in content:
    content = content.replace(old5, new5, 1)
    patches_applied += 1
    print('✅ Patch 5 applied: ArchivedCoursesView swatch')
else:
    print('❌ Patch 5 NOT found: ArchivedCoursesView swatch')
    idx = content.find('ArchivedCoursesView.tsx')
    if idx >= 0:
        print(f'   Found ArchivedCoursesView ref at {idx}: {repr(content[max(0,idx-200):idx+50])}')

print(f'\nTotal patches applied: {patches_applied}/5')

if patches_applied == 5:
    open(BUNDLE_PATH, 'w', encoding='utf-8').write(content)
    print(f'✅ Bundle patched successfully: {BUNDLE_PATH}')
elif patches_applied > 0:
    print(f'⚠️  Only {patches_applied}/5 patches applied. Writing partial patch anyway.')
    open(BUNDLE_PATH, 'w', encoding='utf-8').write(content)
else:
    print('❌ No patches applied — bundle unchanged')
    sys.exit(1)