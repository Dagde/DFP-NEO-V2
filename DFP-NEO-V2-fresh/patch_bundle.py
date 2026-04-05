#!/usr/bin/env python3
"""
Surgical patch to index.js bundle for FIC211 hex color (#F97316) support.
We NEVER rebuild the bundle - only do targeted string replacements.

COMPLETE PATCH LOG:
===================
SESSION 1 (Patches 1-5): Fix hex color display in UI components
SESSION 2 (Patches A-I): Fix FlightTile/FTD tile colors + dull orange

ROOT CAUSE:
-----------
Railway Docker Stage 15 (COPY . /app) overwrites the Railway-built bundle
with the committed bundle from the git repo. The committed bundle in ce0ee32c
was pre-built from a future working version. Every local rebuild diverges
(different initialization order -> instructorsData.length=0).
SOLUTION: Never rebuild. Only apply surgical string replacements to index.js.

HEX COLOR PROBLEM:
------------------
FIC211 course color (#F97316 hex) was stored in DB as a hex string.
All UI components used `color` as a Tailwind CSS className (e.g., `bg-orange-500`)
which doesn't work for hex values. Fix: check startsWith("#") and use inline style.

COLOR DULLING:
--------------
#F97316 (Tailwind orange-500, very bright) -> #D4722A (muted earthy orange)
Applied at ALL courseColors loading points so it takes effect everywhere.
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
    print('⚠️  Patch 1 already applied or not needed: Sidebar legend dot')

# ============================================================
# PATCH 2: CourseRosterView - course card header
# ============================================================
old2 = 'className: `px-4 py-2 text-white font-bold text-lg ${color} flex justify-between items-center`,'
new2 = 'className: `px-4 py-2 text-white font-bold text-lg ${color.startsWith("#") ? "" : color} flex justify-between items-center`, style: color.startsWith("#") ? { backgroundColor: color } : {},'

if old2 in content:
    content = content.replace(old2, new2, 1)
    patches_applied += 1
    print('✅ Patch 2 applied: CourseRosterView card header')
else:
    print('⚠️  Patch 2 already applied or not needed: CourseRosterView card header')

# ============================================================
# PATCH 3: CourseDataWindow - course header div
# ============================================================
old3 = 'className: `p-4 border-b border-gray-700 rounded-t-lg ${courseColor}`,'
new3 = 'className: `p-4 border-b border-gray-700 rounded-t-lg ${courseColor && courseColor.startsWith("#") ? "" : (courseColor || "")}`, style: courseColor && courseColor.startsWith("#") ? { backgroundColor: courseColor } : {},'

if old3 in content:
    content = content.replace(old3, new3, 1)
    patches_applied += 1
    print('✅ Patch 3 applied: CourseDataWindow header')
else:
    print('⚠️  Patch 3 already applied or not needed: CourseDataWindow header')

# ============================================================
# PATCH 4: CourseDataWindow - per-trainee progress bar
# ============================================================
old4 = 'className: `${courseColor} h-1.5 rounded-full`,\n          style: { width: `${percentage}%` }'
new4 = 'className: `${courseColor && courseColor.startsWith("#") ? "" : (courseColor || "")} h-1.5 rounded-full`,\n          style: { width: `${percentage}%`, ...(courseColor && courseColor.startsWith("#") ? { backgroundColor: courseColor } : {}) }'

if old4 in content:
    content = content.replace(old4, new4, 1)
    patches_applied += 1
    print('✅ Patch 4 applied: CourseDataWindow progress bar')
else:
    print('⚠️  Patch 4 already applied or not needed: CourseDataWindow progress bar')

# ============================================================
# PATCH 5: ArchivedCoursesView - color swatch
# ============================================================
old5 = 'jsxDevRuntimeExports.jsxDEV("div", { className: `w-4 h-4 rounded ${color}` }, void 0, false, {\n            fileName: "/workspace/DFP-NEO-V2-fresh/components/ArchivedCoursesView.tsx",\n            lineNumber: 95,'
new5 = 'jsxDevRuntimeExports.jsxDEV("div", { className: `w-4 h-4 rounded ${color && color.startsWith("#") ? "" : (color || "")}`, style: color && color.startsWith("#") ? { backgroundColor: color } : {} }, void 0, false, {\n            fileName: "/workspace/DFP-NEO-V2-fresh/components/ArchivedCoursesView.tsx",\n            lineNumber: 95,'

if old5 in content:
    content = content.replace(old5, new5, 1)
    patches_applied += 1
    print('✅ Patch 5 applied: ArchivedCoursesView swatch')
else:
    print('⚠️  Patch 5 already applied or not needed: ArchivedCoursesView swatch')

# ============================================================
# PATCH A: FlightTile backgroundClass - handle hex color
# (flight tiles AND FTD tiles - both use FlightTile component)
# ============================================================
old_A = 'isUnavailabilityConflict ? "bg-red-800/90" : isConflicting ? "bg-red-600/70" : event.color;'
new_A = 'isUnavailabilityConflict ? "bg-red-800/90" : isConflicting ? "bg-red-600/70" : (event.color && event.color.startsWith("#") ? "" : event.color);'

if old_A in content:
    content = content.replace(old_A, new_A, 1)
    patches_applied += 1
    print('✅ Patch A applied: FlightTile backgroundClass hex fix')
else:
    print('⚠️  Patch A already applied or not needed: FlightTile backgroundClass hex fix')

# ============================================================
# PATCH B: FlightTile isPreview branch - handle hex color
# ============================================================
old_B = 'finalClasses.push(event.color);\n    finalClasses.push("border-2 border-dashed border-sky-300");'
new_B = 'finalClasses.push(event.color && event.color.startsWith("#") ? "" : (event.color || ""));\n    finalClasses.push("border-2 border-dashed border-sky-300");'

if old_B in content:
    content = content.replace(old_B, new_B, 1)
    patches_applied += 1
    print('✅ Patch B applied: FlightTile isPreview hex fix')
else:
    print('⚠️  Patch B already applied or not needed: FlightTile isPreview hex fix')

# ============================================================
# PATCH C: FlightTile main div - merge backgroundColor into style when hex
# ============================================================
old_C = '"data-is-flight-tile": "true",\n      style,'
new_C = '"data-is-flight-tile": "true",\n      style: event.color && event.color.startsWith("#") ? Object.assign({}, style, { backgroundColor: event.color }) : style,'

if old_C in content:
    content = content.replace(old_C, new_C, 1)
    patches_applied += 1
    print('✅ Patch C applied: FlightTile style backgroundColor')
else:
    print('⚠️  Patch C already applied or not needed: FlightTile style backgroundColor')

# ============================================================
# PATCH D: courseColors assignment - normalize #F97316 -> #D4722A
# ============================================================
old_D = 'courseColors[c.name] = c.color;'
new_D = 'courseColors[c.name] = (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : c.color;'

if old_D in content:
    content = content.replace(old_D, new_D, 1)
    patches_applied += 1
    print('✅ Patch D applied: courseColors normalize #F97316 -> #D4722A')
else:
    print('⚠️  Patch D already applied or not needed: courseColors normalize')

# ============================================================
# PATCH E: DB load path 1 - normalize color in dbCourses.map()
# ============================================================
old_E = 'color: c.color || "#6366f1",'
new_E = 'color: ((c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : (c.color || "#6366f1")),'

if old_E in content:
    content = content.replace(old_E, new_E, 1)
    patches_applied += 1
    print('✅ Patch E applied: DB load path 1 normalize')
else:
    print('⚠️  Patch E already applied or not needed: DB load path 1 normalize')

# ============================================================
# PATCH F: DB load path 2 - normalize in setCourseColors forEach
# ============================================================
old_F = 'data.courses.forEach((c) => { dbColors[c.name] = c.color || "#6366f1"; });'
new_F = 'data.courses.forEach((c) => { dbColors[c.name] = (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : (c.color || "#6366f1"); });'

if old_F in content:
    content = content.replace(old_F, new_F, 1)
    patches_applied += 1
    print('✅ Patch F applied: DB load path 2 normalize')
else:
    print('⚠️  Patch F already applied or not needed: DB load path 2 normalize')

# ============================================================
# PATCH G: dbArchivedCourses - normalize in reduce()
# ============================================================
old_G = 'acc[c.name] = c.color || "#6366f1";'
new_G = 'acc[c.name] = (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : (c.color || "#6366f1");'

if old_G in content:
    content = content.replace(old_G, new_G, 1)
    patches_applied += 1
    print('✅ Patch G applied: dbArchivedCourses normalize')
else:
    print('⚠️  Patch G already applied or not needed: dbArchivedCourses normalize')

# ============================================================
# PATCH H: Object.fromEntries demo path - normalize
# ============================================================
old_H = 'const courseColors = Object.fromEntries(courses.map((c) => [c.name, c.color]));'
new_H = 'const courseColors = Object.fromEntries(courses.map((c) => [c.name, (c.color === "#F97316" || c.color === "#f97316") ? "#D4722A" : c.color]));'

if old_H in content:
    content = content.replace(old_H, new_H, 1)
    patches_applied += 1
    print('✅ Patch H applied: Object.fromEntries demo path normalize')
else:
    print('⚠️  Patch H already applied or not needed: Object.fromEntries demo path normalize')

# ============================================================
# PATCH I: handleAddCourseFromTrainingRecords - normalize color on add
# ============================================================
old_I = 'setCourseColors((prev) => ({ ...prev, [data.number]: data.color }));\n    const newCourse = {\n      name: data.number,\n      color: data.color,'
new_I = 'const _addColor = (data.color === "#F97316" || data.color === "#f97316") ? "#D4722A" : data.color;\n    setCourseColors((prev) => ({ ...prev, [data.number]: _addColor }));\n    const newCourse = {\n      name: data.number,\n      color: _addColor,'

if old_I in content:
    content = content.replace(old_I, new_I, 1)
    patches_applied += 1
    print('✅ Patch I applied: handleAddCourse normalize color')
else:
    print('⚠️  Patch I already applied or not needed: handleAddCourse normalize color')

print(f'\nTotal patches applied this run: {patches_applied}')

if content != original:
    open(BUNDLE_PATH, 'w', encoding='utf-8').write(content)
    print(f'✅ Bundle updated: {BUNDLE_PATH}')
else:
    print('ℹ️  Bundle unchanged (all patches already present)')