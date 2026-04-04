with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# =====================================================================
# PATCH 1: initializeData success return - add courses fetch and return
# Current: return { instructors, trainees, aircraft, scores, events };
# New: fetch courses first, then return with courses
# =====================================================================
# The exact bytes at the return (absolute position = 4346727 + 4395 = 4351122)
# Let's verify:
pos_init = 4346727
old_return_success = (
    b'    return {\n'
    b'      instructors,\n'
    b'      trainees,\n'
    b'      aircraft,\n'
    b'      scores,\n'
    b'      events\n'
    b'    };\n'
    b'  } catch (error) {'
)

new_return_success = (
    b'    let dbCourses = [];\n'
    b'    try {\n'
    b'      const cr = await fetch("/api/courses", { credentials: "include" });\n'
    b'      if (cr.ok) {\n'
    b'        const cd = await cr.json();\n'
    b'        dbCourses = Array.isArray(cd.courses) ? cd.courses.map((c) => ({\n'
    b'          name: c.name,\n'
    b'          color: c.color || "#6366f1",\n'
    b'          startDate: c.startDate || "",\n'
    b'          gradDate: c.endDate || "",\n'
    b'          raafStart: c.raafCount || 0,\n'
    b'          navyStart: c.navyCount || 0,\n'
    b'          armyStart: c.armyCount || 0\n'
    b'        })) : [];\n'
    b'        console.log("\\u2705 Courses DB loaded:", dbCourses.length);\n'
    b'      }\n'
    b'    } catch (e) { console.error("Failed to fetch courses:", e); }\n'
    b'    return {\n'
    b'      instructors,\n'
    b'      trainees,\n'
    b'      aircraft,\n'
    b'      scores,\n'
    b'      events,\n'
    b'      courses: dbCourses\n'
    b'    };\n'
    b'  } catch (error) {'
)

if old_return_success in content:
    content = content.replace(old_return_success, new_return_success, 1)
    print(f'✓ Patch 1 (initializeData success return + courses fetch) applied')
else:
    print(f'✗ Patch 1 FAILED - searching...')
    pos = content.find(b'      events\n    };\n  } catch (error) {')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[max(0,pos-100):pos+100])}')

# =====================================================================
# PATCH 2: initializeData fallback return - add courses: []
# =====================================================================
old_return_fallback = (
    b'      events: ESL_DATA.events || []\n'
    b'    };\n'
    b'  }\n'
    b'}\n'
    b'const INITIAL_CURRENCY_REQUIREMENTS'
)

new_return_fallback = (
    b'      events: ESL_DATA.events || [],\n'
    b'      courses: []\n'
    b'    };\n'
    b'  }\n'
    b'}\n'
    b'const INITIAL_CURRENCY_REQUIREMENTS'
)

if old_return_fallback in content:
    content = content.replace(old_return_fallback, new_return_fallback, 1)
    print(f'✓ Patch 2 (initializeData fallback return courses:[]) applied')
else:
    print(f'✗ Patch 2 FAILED')
    pos = content.find(b'events: ESL_DATA.events || []')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[max(0,pos-50):pos+200])}')

# =====================================================================
# PATCH 3: loadInitialData - add setCourses(data.courses) after setEvents
# Current: setEvents(data.events);
# New: setEvents(data.events); if (data.courses && data.courses.length > 0) setCourses(data.courses);
# =====================================================================
old_set_events = (
    b'        setInstructorsData(data.instructors);\n'
    b'        setTraineesData(data.trainees);\n'
    b'        setEvents(data.events);\n'
    b'        {'
)

new_set_events = (
    b'        setInstructorsData(data.instructors);\n'
    b'        setTraineesData(data.trainees);\n'
    b'        setEvents(data.events);\n'
    b'        if (data.courses && data.courses.length > 0) {\n'
    b'          console.log("\\u2705 Setting courses from DB:", data.courses.length);\n'
    b'          setCourses(data.courses);\n'
    b'        } else {\n'
    b'          console.log("\\u26a0\\ufe0f No DB courses, keeping mock courses");\n'
    b'        }\n'
    b'        {'
)

if old_set_events in content:
    content = content.replace(old_set_events, new_set_events, 1)
    print(f'✓ Patch 3 (loadInitialData setCourses) applied')
else:
    print(f'✗ Patch 3 FAILED')
    pos = content.find(b'setInstructorsData(data.instructors);\n        setTraineesData(data.trainees);\n        setEvents(data.events);')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[pos:pos+200])}')

# =====================================================================
# PATCH 4: Fix school useEffect - don't overwrite DB courses
# Current: setEvents(initialData.events); setCourses(initialData.courses);
# New: setEvents(initialData.events); (don't reset courses)
# =====================================================================
old_school_effect = (
    b'  reactExports.useEffect(() => {\n'
    b'    const initialData = school === "ESL" ? ESL_DATA : PEA_DATA;\n'
    b'    setEvents(initialData.events);\n'
    b'    setCourses(initialData.courses);\n'
    b'    const todayStr = getLocalDateString();\n'
    b'    setPublishedSchedules({ [todayStr]: initialData.events.filter((e) => e.date === todayStr) });\n'
    b'  }, [school]);\n'
)

new_school_effect = (
    b'  reactExports.useEffect(() => {\n'
    b'    const initialData = school === "ESL" ? ESL_DATA : PEA_DATA;\n'
    b'    setEvents(initialData.events);\n'
    b'    const todayStr = getLocalDateString();\n'
    b'    setPublishedSchedules({ [todayStr]: initialData.events.filter((e) => e.date === todayStr) });\n'
    b'  }, [school]);\n'
)

if old_school_effect in content:
    content = content.replace(old_school_effect, new_school_effect, 1)
    print(f'✓ Patch 4 (remove setCourses from school useEffect) applied')
else:
    print(f'✗ Patch 4 FAILED')
    pos = content.find(b'const initialData = school ===')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[max(0,pos-80):pos+300])}')

print(f'\nFinal size: {len(content)} (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('Written.')