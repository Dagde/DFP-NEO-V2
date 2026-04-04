with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'rb') as f:
    content = f.read()

original_size = len(content)
print(f'Original size: {original_size}')

# =====================================================================
# PATCH A: handleAddCourseFromTrainingRecords
# Add PUT /api/courses call when adding a course
# =====================================================================

old_add = b'''  handleAddCourseFromTrainingRecords = (data) => {
    setCourseColors((prev) => ({ ...prev, [data.number]: data.color }));
    const newCourse = {
      name: data.number,
      color: data.color,
      startDate: data.startDate,
      gradDate: data.gradDate,
      raafStart: data.raafStart,
      navyStart: data.navyStart,
      armyStart: data.armyStart
    };
    setCourses((prev) => [...prev, newCourse]);
    setSuccessMessage(`Course ${data.number} added successfully!`);
  };'''

new_add = b'''  handleAddCourseFromTrainingRecords = async (data) => {
    setCourseColors((prev) => ({ ...prev, [data.number]: data.color }));
    const newCourse = {
      name: data.number,
      color: data.color,
      startDate: data.startDate,
      gradDate: data.gradDate,
      raafStart: data.raafStart,
      navyStart: data.navyStart,
      armyStart: data.armyStart
    };
    setCourses((prev) => [...prev, newCourse]);
    try {
      await fetch(`${fetchAPI.__apiBase || ""}/api/courses`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newCourse, status: "ACTIVE" })
      });
    } catch (e) { console.error("Failed to save course to DB:", e); }
    setSuccessMessage(`Course ${data.number} added successfully!`);
  };'''

if old_add in content:
    content = content.replace(old_add, new_add, 1)
    print(f'✓ Patch A (handleAddCourseFromTrainingRecords) applied')
else:
    print(f'✗ Patch A - could not find old_add pattern')
    # debug
    pos = content.find(b'handleAddCourseFromTrainingRecords = (data)')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[pos:pos+200])}')

# =====================================================================
# PATCH B: handleDeleteCourseFromTrainingRecords
# Add DELETE /api/courses/:name call for both archive and delete
# =====================================================================

old_delete = b'''  handleDeleteCourseFromTrainingRecords = async (courseName, archive) => {
    const color = courseColors[courseName];
    if (!color) return;
    if (archive) {
      const newActive = { ...courseColors };
      delete newActive[courseName];
      setCourseColors(newActive);
      setArchivedCourses((prev) => ({ ...prev, [courseName]: color }));
      setCourses((prev) => prev.filter((c) => c.name !== courseName));
      setSuccessMessage(`Course ${courseName} archived successfully!`);
    } else {
      const newActive = { ...courseColors };
      delete newActive[courseName];
      setCourseColors(newActive);
      setCourses((prev) => prev.filter((c) => c.name !== courseName));
      setSuccessMessage(`Course ${courseName} deleted permanently!`);
    }
  };'''

new_delete = b'''  handleDeleteCourseFromTrainingRecords = async (courseName, archive) => {
    const color = courseColors[courseName];
    if (!color) return;
    if (archive) {
      const newActive = { ...courseColors };
      delete newActive[courseName];
      setCourseColors(newActive);
      setArchivedCourses((prev) => ({ ...prev, [courseName]: color }));
      setCourses((prev) => prev.filter((c) => c.name !== courseName));
      try {
        await fetch(`/api/courses/${encodeURIComponent(courseName)}`, {
          method: "DELETE",
          credentials: "include"
        });
      } catch (e) { console.error("Failed to delete course from DB:", e); }
      setSuccessMessage(`Course ${courseName} archived successfully!`);
    } else {
      const newActive = { ...courseColors };
      delete newActive[courseName];
      setCourseColors(newActive);
      setCourses((prev) => prev.filter((c) => c.name !== courseName));
      try {
        await fetch(`/api/courses/${encodeURIComponent(courseName)}`, {
          method: "DELETE",
          credentials: "include"
        });
      } catch (e) { console.error("Failed to delete course from DB:", e); }
      setSuccessMessage(`Course ${courseName} deleted permanently!`);
    }
  };'''

if old_delete in content:
    content = content.replace(old_delete, new_delete, 1)
    print(f'✓ Patch B (handleDeleteCourseFromTrainingRecords) applied')
else:
    print(f'✗ Patch B - could not find old_delete pattern')
    pos = content.find(b'handleDeleteCourseFromTrainingRecords = async')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[pos:pos+400])}')

# =====================================================================
# PATCH C: handleUnarchiveCourseFromArchivedView
# Add PUT /api/courses call to restore course to DB
# Also fix: use courseColors instead of ESL_DATA.courses for the course obj
# =====================================================================

old_unarchive = b'''  handleUnarchiveCourseFromArchivedView = async (courseName) => {
    const color = archivedCourses[courseName];
    if (!color) return;
    const newArchived = { ...archivedCourses };
    delete newArchived[courseName];
    setArchivedCourses(newArchived);
    setCourseColors((prev) => ({ ...prev, [courseName]: color }));
    const courseFromMockData = ESL_DATA.courses.find((c) => c.name === courseName);
    if (courseFromMockData) {
      setCourses((prev) => [...prev, courseFromMockData]);
    }
    setSuccessMessage(`Course ${courseName} unarchived successfully!`);
  };'''

new_unarchive = b'''  handleUnarchiveCourseFromArchivedView = async (courseName) => {
    const color = archivedCourses[courseName];
    if (!color) return;
    const newArchived = { ...archivedCourses };
    delete newArchived[courseName];
    setArchivedCourses(newArchived);
    setCourseColors((prev) => ({ ...prev, [courseName]: color }));
    const restoredCourse = { name: courseName, color, startDate: "", gradDate: "", raafStart: 0, navyStart: 0, armyStart: 0 };
    setCourses((prev) => [...prev, restoredCourse]);
    try {
      await fetch(`/api/courses`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...restoredCourse, status: "ACTIVE" })
      });
    } catch (e) { console.error("Failed to restore course to DB:", e); }
    setSuccessMessage(`Course ${courseName} unarchived successfully!`);
  };'''

if old_unarchive in content:
    content = content.replace(old_unarchive, new_unarchive, 1)
    print(f'✓ Patch C (handleUnarchiveCourseFromArchivedView) applied')
else:
    print(f'✗ Patch C - could not find old_unarchive pattern')
    pos = content.find(b'handleUnarchiveCourseFromArchivedView = async')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[pos:pos+400])}')

# =====================================================================
# PATCH D: handleDeleteCourseFromArchivedView
# Add DELETE /api/courses/:name call
# =====================================================================

old_delete_archived = b'''  handleDeleteCourseFromArchivedView = async (courseName) => {
    const newArchived = { ...archivedCourses };
    delete newArchived[courseName];
    setArchivedCourses(newArchived);
    setCourses((prev) => prev.filter((c) => c.name !== courseName));
    setSuccessMessage(`Course ${courseName} deleted permanently!`);
  };'''

new_delete_archived = b'''  handleDeleteCourseFromArchivedView = async (courseName) => {
    const newArchived = { ...archivedCourses };
    delete newArchived[courseName];
    setArchivedCourses(newArchived);
    setCourses((prev) => prev.filter((c) => c.name !== courseName));
    try {
      await fetch(`/api/courses/${encodeURIComponent(courseName)}`, {
        method: "DELETE",
        credentials: "include"
      });
    } catch (e) { console.error("Failed to delete archived course from DB:", e); }
    setSuccessMessage(`Course ${courseName} deleted permanently!`);
  };'''

if old_delete_archived in content:
    content = content.replace(old_delete_archived, new_delete_archived, 1)
    print(f'✓ Patch D (handleDeleteCourseFromArchivedView) applied')
else:
    print(f'✗ Patch D - could not find old_delete_archived pattern')
    pos = content.find(b'handleDeleteCourseFromArchivedView = async')
    if pos != -1:
        print(f'  Found at {pos}: {repr(content[pos:pos+300])}')

print(f'\nFinal size: {len(content)} bytes')
print(f'Difference: +{len(content) - original_size} bytes')

with open('/workspace/DFP-NEO-V2-fresh/dfp-neo-platform/public/flight-school-app/assets/index.js', 'wb') as f:
    f.write(content)
print('File written.')