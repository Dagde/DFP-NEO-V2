import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Split into lines for easier manipulation
lines = content.split('\n')

# Find the function at line 8830 (index 8829)
# Replace lines 8841-8842 (instructor comparison)
# and lines 8856-8857 (trainee comparison)

# The instructor comparison is at lines 8841-8842
lines[8840] = '               const instructor = instructorsData.find(i => {'
lines[8841] = '                   const userName = String(user.name || \'\').trim();'
lines[8842] = '                   const instructorName = String(i.name || \'\').trim();'
lines[8843] = '                   const userId = String(user.pmkeysId || \'\').trim();'
lines[8844] = '                   const instructorId = String(i.idNumber || \'\').trim();'
lines[8845] = ''
lines[8846] = '                   console.log("Comparing instructor:", {userName, instructorName, userId, instructorId});'
lines[8847] = ''
lines[8848] = '                   return userName === instructorName && userId === instructorId;'
lines[8849] = '               });'

# The trainee comparison is at lines 8856-8857 (now shifted due to above changes)
lines[8863] = '               const trainee = traineesData.find(t => {'
lines[8864] = '                   const userName = String(user.name || \'\').trim();'
lines[8865] = '                   const traineeName = String(t.name || \'\').trim();'
lines[8866] = '                   const userId = String(user.pmkeysId || \'\').trim();'
lines[8867] = '                   const traineeId = String(t.idNumber || \'\').trim();'
lines[8868] = ''
lines[8869] = '                   console.log("Comparing trainee:", {userName, traineeName, userId, traineeId});'
lines[8870] = ''
lines[8871] = '                   return userName === traineeName && userId === traineeId;'
lines[8872] = '               });'

# Also add console.log for userType at the beginning
lines[8832] = '           console.log(\'🎹 Navigating to profile:\', user);'
lines[8833] = '           console.log("user.name:", user.name);'
lines[8834] = '           console.log("user.pmkeysId:", user.pmkeysId);'
lines[8835] = '           console.log("user.userType:", user.userType);'

# Also add error messages instead of success messages when not found
lines[8855] = '                   setErrorMessage(`Staff profile not found: ${user.name}`);'
lines[8878] = '                   setErrorMessage(`Trainee profile not found: ${user.name}`);'

# Add success messages with checkmarks
lines[8849] = '                   setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);'
lines[8872] = '                   setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);'

# Write back
with open('App.tsx', 'w') as f:
    f.write('\n'.join(lines))

print("✅ Fixed handleNavigateToProfile at line 8830 with normalized comparison")