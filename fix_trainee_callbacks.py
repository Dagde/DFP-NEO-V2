import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Replace onClose in Trainees case
content = re.sub(
    r"case 'Trainees':\s+return <TraineeListView \s+onClose=\{\(\) => handleNavigation\('Program Schedule'\)\}",
    """case 'Trainees':
                    return <TraineeListView 
                                onClose={handleCloseStaffView}""",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Replace onArchiveTrainee
content = re.sub(
    r"onArchiveTrainee=\{\(id\) => \{\s+const trainee = traineesData\.find\(t => t\.idNumber === id\);\s+if \(trainee\) \{\s+setArchivedTraineesData\(prev => \[\.\.\.prev, trainee\]\);\s+setTraineesData\(prev => prev\.filter\(t => t\.idNumber !== id\)\);\s+\}\s+\}\}",
    "onArchiveTrainee={handleArchiveTrainee}",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Replace onRequestSct for trainee
content = re.sub(
    r"onRequestSct=\{\(trainee\) => \{\s+setTraineeForSct\(trainee\);\s+setShowSctRequest\(true\);\s+\}\}",
    "onRequestSct={handleRequestSctForTrainee}",
    content,
    flags=re.MULTILINE | re.DOTALL
)

# Write the file back
with open('App.tsx', 'w') as f:
    f.write(content)

print("Trainee callback replacements completed successfully!")