import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Replace the inline callback functions in the Instructors case
old_pattern = r"case 'Instructors':\s+return <InstructorListView \s+onClose=\{\(\) => handleNavigation\('Program Schedule'\)\}"

# This is a complex multi-line replacement - let me do it piece by piece
# First replace onClose
content = re.sub(
    r"case 'Instructors':\s+return <InstructorListView \s+onClose=\{\(\) => handleNavigation\('Program Schedule'\)\}",
    """case 'Instructors':
                return <InstructorListView 
                            onClose={handleCloseStaffView}""",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Replace onArchiveInstructor
content = re.sub(
    r"onArchiveInstructor=\{\(id\) => \{\s+const instructorToArchive = instructorsData\.find\(i => i\.idNumber === id\);\s+if \(instructorToArchive\) \{\s+setInstructorsData\(prev => prev\.filter\(i => i\.idNumber !== id\)\);\s+setArchivedInstructorsData\(prev => \[\.\.\.prev, instructorToArchive\]\);\s+\}\s+\}\}",
    "onArchiveInstructor={handleArchiveInstructor}",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Replace onRestoreInstructor
content = re.sub(
    r"onRestoreInstructor=\{\(id\) => \{\s+const instructorToRestore = archivedInstructorsData\.find\(i => i\.idNumber === id\);\s+if \(instructorToRestore\) \{\s+setArchivedInstructorsData\(prev => prev\.filter\(i => i\.idNumber !== id\)\);\s+setInstructorsData\(prev => \[\.\.\.prev, instructorToRestore\]\);\s+\}\s+\}\}",
    "onRestoreInstructor={handleRestoreInstructor}",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Replace onProfileOpened
content = re.sub(
    r"onProfileOpened=\{\(\) => setSelectedPersonForProfile\(null\)\}",
    "onProfileOpened={handleProfileOpened}",
    content
)

# Replace onRequestSct
content = re.sub(
    r"onRequestSct=\{\(instructor\) => \{\s+setInstructorForSct\(instructor\);\s+setShowSctRequest\(true\);\s+\}\}",
    "onRequestSct={handleRequestSct}",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Write the file back
with open('App.tsx', 'w') as f:
    f.write(content)

print("Replacements completed successfully!")