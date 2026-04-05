data = open('index.js', 'rb').read()
original_size = len(data)
patches_applied = 0
patches_failed = 0

def apply_patch(data, old, new, name):
    global patches_applied, patches_failed
    count = data.count(old)
    if count == 0:
        print(f'FAIL {name}: pattern not found')
        print(f'  Looking for: {repr(old[:60])}')
        patches_failed += 1
        return data
    elif count > 1:
        print(f'WARN {name}: {count} occurrences found - applying first only')
    data = data.replace(old, new, 1)
    patches_applied += 1
    print(f'OK   {name}')
    return data

# ============================================================
# FIX 1b: currentScheduleForDate -> publishedSchedules[date] || []
# (Fix 1a was already applied in previous run)
# ============================================================

old1b = b'const event = currentScheduleForDate.find((e) => e.id === update.eventId);\n        if (event && event.type === "flight")'
new1b = b'const event = (publishedSchedules[date] || []).find((e) => e.id === update.eventId);\n        if (event && event.type === "flight")'

old1c = b'const deploymentEvent = currentScheduleForDate.find(\n            (e) => e.type === "deployment" && e.resourceId === update.newResourceId\n          );'
new1c = b'const deploymentEvent = (publishedSchedules[date] || []).find(\n            (e) => e.type === "deployment" && e.resourceId === update.newResourceId\n          );'

data = apply_patch(data, old1b, new1b, 'Fix 1b: currentScheduleForDate deployed check')
data = apply_patch(data, old1c, new1c, 'Fix 1c: currentScheduleForDate deployment find')

# ============================================================
# FIX 2: Replace Tailwind color classes with hex values in eslCourses/peaCourses
# Using plain " characters (0x22) in byte strings
# ============================================================

# ESL Courses
old2a = b'{ name: "ADF301", color: "bg-sky-400/50"'
new2a = b'{ name: "ADF301", color: "#7DD3FC"      '

old2b = b'{ name: "ADF302", color: "bg-purple-400/50"'
new2b = b'{ name: "ADF302", color: "#C084FC"         '

old2c = b'{ name: "ADF303", color: "bg-yellow-400/50"'
new2c = b'{ name: "ADF303", color: "#FACC15"         '

old2d = b'{ name: "FIC 210", color: "bg-pink-400/50"'
new2d = b'{ name: "FIC 210", color: "#F472B6"        '

# PEA Courses
old2f = b'{ name: "ADF304", color: "bg-teal-400/50"'
new2f = b'{ name: "ADF304", color: "#2DD4BF"        '

old2g = b'{ name: "ADF305", color: "bg-indigo-400/50"'
new2g = b'{ name: "ADF305", color: "#818CF8"          '

old2h = b'{ name: "IFF 6", color: "bg-cyan-400/50"'
new2h = b'{ name: "IFF 6", color: "#22D3EE"        '

# FIC211 appears in both ESL and PEA - need to handle carefully
# Check if they use the same pattern
count_fic211 = data.count(b'{ name: "FIC211", color: "bg-orange-400/50"')
print(f'FIC211 orange occurrences: {count_fic211}')

old2e = b'{ name: "FIC211", color: "bg-orange-400/50"'
new2e = b'{ name: "FIC211", color: "#FB923C"          '

data = apply_patch(data, old2a, new2a, 'Fix 2a: ADF301 sky->hex')
data = apply_patch(data, old2b, new2b, 'Fix 2b: ADF302 purple->hex')
data = apply_patch(data, old2c, new2c, 'Fix 2c: ADF303 yellow->hex')
data = apply_patch(data, old2d, new2d, 'Fix 2d: FIC 210 pink->hex')
data = apply_patch(data, old2e, new2e, 'Fix 2e: FIC211 orange->hex (ESL)')
data = apply_patch(data, old2e, new2e, 'Fix 2e: FIC211 orange->hex (PEA)')
data = apply_patch(data, old2f, new2f, 'Fix 2f: ADF304 teal->hex')
data = apply_patch(data, old2g, new2g, 'Fix 2g: ADF305 indigo->hex')
data = apply_patch(data, old2h, new2h, 'Fix 2h: IFF 6 cyan->hex')

# ============================================================
# FIX 3: Also update generateDataSet courseColors assignment
# The orange special-case check for FIC211 won't apply now
# But there's an existing check: c.color === "#F97316" -> "#D4722A"
# This was for orange, now we're using #FB923C - let's keep it as-is
# The hex passthrough in convertTailwindToHex handles hex colors fine
# ============================================================

print(f'\nOriginal size: {original_size}')
print(f'New size: {len(data)}')
print(f'Patches applied: {patches_applied}')
print(f'Patches failed: {patches_failed}')

if patches_failed == 0:
    open('index.js', 'wb').write(data)
    print('File written successfully')
else:
    print('NOT writing file due to failures')