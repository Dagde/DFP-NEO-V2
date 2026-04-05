import sys

data = open('index.js', 'rb').read()
original_size = len(data)

# ============================================================
# FIX 1: Replace currentScheduleForDate with publishedSchedules[date] || []
# There are 3 occurrences inside handleScheduleUpdate
# ============================================================

old1 = b'const event = currentScheduleForDate.find((e) => e.id === update.eventId);\n      if (event) {'
new1 = b'const event = (publishedSchedules[date] || []).find((e) => e.id === update.eventId);\n      if (event) {'

old2 = b'const event = currentScheduleForDate.find((e) => e.id === update.eventId);\n        if (event && event.type === \\"flight\\")'
new2 = b'const event = (publishedSchedules[date] || []).find((e) => e.id === update.eventId);\n        if (event && event.type === \\"flight\\")'

old3 = b'const deploymentEvent = currentScheduleForDate.find(\n            (e) => e.type === \\"deployment\\" && e.resourceId === update.newResourceId\n          );'
new3 = b'const deploymentEvent = (publishedSchedules[date] || []).find(\n            (e) => e.type === \\"deployment\\" && e.resourceId === update.newResourceId\n          );'

# ============================================================
# FIX 2: Replace Tailwind color classes with hex+alpha in eslCourses
# bg-sky-400/50 -> #7DD3FC80 (sky-400 with 50% opacity = rgba(125,211,252,0.5))
# bg-purple-400/50 -> #C084FC80
# bg-yellow-400/50 -> #FACC1580
# bg-pink-400/50 -> #F472B680
# bg-orange-400/50 -> #FB923C80
# For peaCourses:
# bg-teal-400/50 -> #2DD4BF80
# bg-indigo-400/50 -> #818CF880
# bg-cyan-400/50 -> #22D3EE80
# bg-blue-400/50 -> #60A5FA80
# bg-green-400/50 -> #4ADE8080
# ============================================================

old4 = b'{ name: \\"ADF301\\", color: \\"bg-sky-400/50\\"'
new4 = b'{ name: \\"ADF301\\", color: \\"#7DD3FC\\"'

old5 = b'{ name: \\"ADF302\\", color: \\"bg-purple-400/50\\"'
new5 = b'{ name: \\"ADF302\\", color: \\"#C084FC\\"'

old6 = b'{ name: \\"ADF303\\", color: \\"bg-yellow-400/50\\"'
new6 = b'{ name: \\"ADF303\\", color: \\"#FACC15\\"'

old7 = b'{ name: \\"FIC 210\\", color: \\"bg-pink-400/50\\"'
new7 = b'{ name: \\"FIC 210\\", color: \\"#F472B6\\"'

old8 = b'{ name: \\"FIC211\\", color: \\"bg-orange-400/50\\", startDate: \\"2025-12-01\\"'
new8 = b'{ name: \\"FIC211\\", color: \\"#FB923C\\", startDate: \\"2025-12-01\\"'

old9 = b'{ name: \\"ADF304\\", color: \\"bg-teal-400/50\\"'
new9 = b'{ name: \\"ADF304\\", color: \\"#2DD4BF\\"'

old10 = b'{ name: \\"ADF305\\", color: \\"bg-indigo-400/50\\"'
new10 = b'{ name: \\"ADF305\\", color: \\"#818CF8\\"'

old11 = b'{ name: \\"IFF 6\\", color: \\"bg-cyan-400/50\\"'
new11 = b'{ name: \\"IFF 6\\", color: \\"#22D3EE\\"'

old12 = b'{ name: \\"FIC211\\", color: \\"bg-orange-400/50\\", startDate: \\"2025-12-01\\"'
# Already handled by old8/new8 - this would be the peaCourses entry if different
# Let's check if it's the same or different
print('FIC211 peaCourses check:')
idx_fic211 = data.find(b'{ name: \\"FIC211\\", color: \\"bg-orange-400/50\\", startDate: \\"2025-12-01\\"')
print(f'  Found at: {idx_fic211}')
# Count occurrences
count = data.count(b'{ name: \\"FIC211\\", color: \\"bg-orange-400/50\\", startDate: \\"2025-12-01\\"')
print(f'  Count: {count}')

patches = [
    (old1, new1, 'Fix 1a: currentScheduleForDate audit log'),
    (old2, new2, 'Fix 1b: currentScheduleForDate deployed check'),
    (old3, new3, 'Fix 1c: currentScheduleForDate deployment find'),
    (old4, new4, 'Fix 2a: ADF301 color hex'),
    (old5, new5, 'Fix 2b: ADF302 color hex'),
    (old6, new6, 'Fix 2c: ADF303 color hex'),
    (old7, new7, 'Fix 2d: FIC 210 color hex'),
    (old8, new8, 'Fix 2e: FIC211 color hex'),
    (old9, new9, 'Fix 2f: ADF304 color hex'),
    (old10, new10, 'Fix 2g: ADF305 color hex'),
    (old11, new11, 'Fix 2h: IFF 6 color hex'),
]

for old, new, name in patches:
    count = data.count(old)
    print(f'{name}: found {count} occurrences')
    if count == 0:
        print(f'  WARNING: Pattern not found!')
        # Show nearby context
        # try partial search
        partial = old[:40]
        pidx = data.find(partial)
        if pidx != -1:
            print(f'  Partial match at {pidx}: {repr(data[pidx:pidx+100])}')
    elif count > 1:
        print(f'  WARNING: Multiple matches found!')
    else:
        data = data.replace(old, new, 1)
        print(f'  OK: Applied successfully')

print(f'\nOriginal size: {original_size}')
print(f'New size: {len(data)}')

open('index.js', 'wb').write(data)
print('File written successfully')