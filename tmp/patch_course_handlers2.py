with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# =====================================================================
# PATCH A: handleAddCourseFromTrainingRecords
# The pattern uses \n (real newlines) and specific indentation
# =====================================================================

old_add = (
    b'handleAddCourseFromTrainingRecords = (data) => {\n'
    b'    setCourseColors((prev) => ({ ...prev, [data.number]: data.color }));\n'
    b'    const newCourse = {\n'
    b'      name: data.number,\n'
    b'      color: data.color,\n'
    b'      startDate: data.startDate,\n'
    b'      gradDate: data.gradDate,\n'
    b'      raafStart: data.raafStart,\n'
    b'      navyStart: data.navyStart,\n'
    b'      armyStart: data.armyStart\n'
    b'    };\n'
    b'    setCourses((prev) => [...prev, newCourse]);\n'
    b'    setSuccessMessage(`Course ${data.number} added successfully!`);\n'
    b'  };'
)

new_add = (
    b'handleAddCourseFromTrainingRecords = async (data) => {\n'
    b'    setCourseColors((prev) => ({ ...prev, [data.number]: data.color }));\n'
    b'    const newCourse = {\n'
    b'      name: data.number,\n'
    b'      color: data.color,\n'
    b'      startDate: data.startDate,\n'
    b'      gradDate: data.gradDate,\n'
    b'      raafStart: data.raafStart,\n'
    b'      navyStart: data.navyStart,\n'
    b'      armyStart: data.armyStart\n'
    b'    };\n'
    b'    setCourses((prev) => [...prev, newCourse]);\n'
    b'    try {\n'
    b'      await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newCourse, status: "ACTIVE" }) });\n'
    b'    } catch (e) { console.error("Failed to save course to DB:", e); }\n'
    b'    setSuccessMessage(`Course ${data.number} added successfully!`);\n'
    b'  };'
)

if old_add in content:
    content = content.replace(old_add, new_add, 1)
    print(f'✓ Patch A (handleAddCourseFromTrainingRecords) applied')
else:
    print(f'✗ Patch A FAILED')

# =====================================================================
# PATCH B: handleDeleteCourseFromTrainingRecords
# =====================================================================

old_delete = (
    b'handleDeleteCourseFromTrainingRecords = async (courseName, archive) => {\n'
    b'    const color = courseColors[courseName];\n'
    b'    if (!color) return;\n'
    b'    if (archive) {\n'
    b'      const newActive = { ...courseColors };\n'
    b'      delete newActive[courseName];\n'
    b'      setCourseColors(newActive);\n'
    b'      setArchivedCourses((prev) => ({ ...prev, [courseName]: color }));\n'
    b'      setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'      setSuccessMessage(`Course ${courseName} archived successfully!`);\n'
    b'    } else {\n'
    b'      const newActive = { ...courseColors };\n'
    b'      delete newActive[courseName];\n'
    b'      setCourseColors(newActive);\n'
    b'      setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'      setSuccessMessage(`Course ${courseName} deleted permanently!`);\n'
    b'    }\n'
    b'  };'
)

new_delete = (
    b'handleDeleteCourseFromTrainingRecords = async (courseName, archive) => {\n'
    b'    const color = courseColors[courseName];\n'
    b'    if (!color) return;\n'
    b'    if (archive) {\n'
    b'      const newActive = { ...courseColors };\n'
    b'      delete newActive[courseName];\n'
    b'      setCourseColors(newActive);\n'
    b'      setArchivedCourses((prev) => ({ ...prev, [courseName]: color }));\n'
    b'      setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'      try {\n'
    b'        await fetch(`/api/courses/${encodeURIComponent(courseName)}`, { method: "DELETE", credentials: "include" });\n'
    b'      } catch (e) { console.error("Failed to delete course from DB:", e); }\n'
    b'      setSuccessMessage(`Course ${courseName} archived successfully!`);\n'
    b'    } else {\n'
    b'      const newActive = { ...courseColors };\n'
    b'      delete newActive[courseName];\n'
    b'      setCourseColors(newActive);\n'
    b'      setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'      try {\n'
    b'        await fetch(`/api/courses/${encodeURIComponent(courseName)}`, { method: "DELETE", credentials: "include" });\n'
    b'      } catch (e) { console.error("Failed to delete course from DB:", e); }\n'
    b'      setSuccessMessage(`Course ${courseName} deleted permanently!`);\n'
    b'    }\n'
    b'  };'
)

if old_delete in content:
    content = content.replace(old_delete, new_delete, 1)
    print(f'✓ Patch B (handleDeleteCourseFromTrainingRecords) applied')
else:
    print(f'✗ Patch B FAILED')
    # Show exact bytes around there for debugging
    pos = content.find(b'handleDeleteCourseFromTrainingRecords = async')
    if pos != -1:
        print(f'  Exact bytes at pos {pos}:')
        print(repr(content[pos:pos+800]))

# =====================================================================
# PATCH C: handleUnarchiveCourseFromArchivedView
# =====================================================================

old_unarchive = (
    b'handleUnarchiveCourseFromArchivedView = async (courseName) => {\n'
    b'    const color = archivedCourses[courseName];\n'
    b'    if (!color) return;\n'
    b'    const newArchived = { ...archivedCourses };\n'
    b'    delete newArchived[courseName];\n'
    b'    setArchivedCourses(newArchived);\n'
    b'    setCourseColors((prev) => ({ ...prev, [courseName]: color }));\n'
    b'    const courseFromMockData = ESL_DATA.courses.find((c) => c.name === courseName);\n'
    b'    if (courseFromMockData) {\n'
    b'      setCourses((prev) => [...prev, courseFromMockData]);\n'
    b'    }\n'
    b'    setSuccessMessage(`Course ${courseName} unarchived successfully!`);\n'
    b'  };'
)

new_unarchive = (
    b'handleUnarchiveCourseFromArchivedView = async (courseName) => {\n'
    b'    const color = archivedCourses[courseName];\n'
    b'    if (!color) return;\n'
    b'    const newArchived = { ...archivedCourses };\n'
    b'    delete newArchived[courseName];\n'
    b'    setArchivedCourses(newArchived);\n'
    b'    setCourseColors((prev) => ({ ...prev, [courseName]: color }));\n'
    b'    const restoredCourse = { name: courseName, color, startDate: "", gradDate: "", raafStart: 0, navyStart: 0, armyStart: 0 };\n'
    b'    setCourses((prev) => [...prev, restoredCourse]);\n'
    b'    try {\n'
    b'      await fetch("/api/courses", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" }) });\n'
    b'    } catch (e) { console.error("Failed to restore course to DB:", e); }\n'
    b'    setSuccessMessage(`Course ${courseName} unarchived successfully!`);\n'
    b'  };'
)

if old_unarchive in content:
    content = content.replace(old_unarchive, new_unarchive, 1)
    print(f'✓ Patch C (handleUnarchiveCourseFromArchivedView) applied')
else:
    print(f'✗ Patch C FAILED')
    pos = content.find(b'handleUnarchiveCourseFromArchivedView = async')
    if pos != -1:
        print(f'  Exact bytes:')
        print(repr(content[pos:pos+500]))

# =====================================================================
# PATCH D: handleDeleteCourseFromArchivedView
# =====================================================================

old_delete_archived = (
    b'handleDeleteCourseFromArchivedView = async (courseName) => {\n'
    b'    const newArchived = { ...archivedCourses };\n'
    b'    delete newArchived[courseName];\n'
    b'    setArchivedCourses(newArchived);\n'
    b'    setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'    setSuccessMessage(`Course ${courseName} deleted permanently!`);\n'
    b'  };'
)

new_delete_archived = (
    b'handleDeleteCourseFromArchivedView = async (courseName) => {\n'
    b'    const newArchived = { ...archivedCourses };\n'
    b'    delete newArchived[courseName];\n'
    b'    setArchivedCourses(newArchived);\n'
    b'    setCourses((prev) => prev.filter((c) => c.name !== courseName));\n'
    b'    try {\n'
    b'      await fetch(`/api/courses/${encodeURIComponent(courseName)}`, { method: "DELETE", credentials: "include" });\n'
    b'    } catch (e) { console.error("Failed to delete archived course from DB:", e); }\n'
    b'    setSuccessMessage(`Course ${courseName} deleted permanently!`);\n'
    b'  };'
)

if old_delete_archived in content:
    content = content.replace(old_delete_archived, new_delete_archived, 1)
    print(f'✓ Patch D (handleDeleteCourseFromArchivedView) applied')
else:
    print(f'✗ Patch D FAILED')
    pos = content.find(b'handleDeleteCourseFromArchivedView = async')
    if pos != -1:
        print(f'  Exact bytes:')
        print(repr(content[pos:pos+400]))

print(f'\nFinal size: {len(content)} bytes (+{len(content)-original_size})')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('File written.')