import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Find and replace the handleNavigateToProfile function
# Pattern to match the function with the simple find logic
old_pattern = r'''const handleNavigateToProfile = \(user: User, userType: 'STAFF' \| 'TRAINEE'\) => \{[\s\S]*?if \(userType === 'STAFF'\) \{[\s\S]*?const instructor = instructorsData\.find\(i =>[\s\S]*?i\.name === user\.name && i\.idNumber === user\.pmkeysId[\s\S]*?\);'''

# New normalized comparison code
new_code = '''const handleNavigateToProfile = (user: User, userType: 'STAFF' | 'TRAINEE') => {
    console.log("🎹 HandleNavigateToProfile called for:", user.name, "(type:", userType + ")");

    if (userType === 'STAFF') {
      // Find instructor in instructorsData with normalized comparison
      const instructor = instructorsData.find(i => {
        const userName = String(user.name || '').trim();
        const instructorName = String(i.name || '').trim();
        const userId = String(user.pmkeysId || '').trim();
        const instructorId = String(i.idNumber || '').trim();

        console.log("Comparing:", {userName, instructorName, userId, instructorId});

        return userName === instructorName && userId === instructorId;
      });'''

# Replace the instructor search part
content = re.sub(old_pattern, new_code, content)

# Now find and replace the trainee search part
old_trainee_pattern = r'''const trainee = traineesData\.find\(t =>[\s\S]*?t\.name === user\.name && t\.idNumber === user\.pmkeysId[\s\S]*?\);'''

new_trainee_code = '''// Find trainee in traineesData with normalized comparison
      const trainee = traineesData.find(t => {
        const userName = String(user.name || '').trim();
        const traineeName = String(t.name || '').trim();
        const userId = String(user.pmkeysId || '').trim();
        const traineeId = String(t.idNumber || '').trim();

        console.log("Comparing:", {userName, traineeName, userId, traineeId});

        return userName === traineeName && userId === traineeId;
      });'''

content = re.sub(old_trainee_pattern, new_trainee_code, content)

# Write the file back
with open('App.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed handleNavigateToProfile with normalized comparison")