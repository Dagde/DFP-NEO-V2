import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Define the old function code exactly as it appears
old_function = '''       const handleNavigateToProfile = (user: any) => {
           console.log('Navigating to profile:', user);
           
           // Find the instructor or trainee in the data
           if (user.userType === 'STAFF') {
               // Find instructor by name or PMKeys ID
               const instructor = instructorsData.find(i => 
                   i.name === user.name || i.idNumber === parseInt(user.pmkeysId || '0')
               );
               
               if (instructor) {
                   // Navigate to Instructors view and select the instructor
                   setSelectedInstructor(instructor);
                   setActiveView('Instructors');
                   if (onShowSuccess) {
                       onShowSuccess(`Navigated to Staff Profile: ${user.name}`);
                   }
               } else {
                   if (onShowSuccess) {
                       onShowSuccess(`Staff profile not found: ${user.name}`);
                   }
               }
           } else if (user.userType === 'TRAINEE') {
               // Find trainee by name or PMKeys ID
               const trainee = traineesData.find(t => 
                   t.name === user.name || t.idNumber === parseInt(user.pmkeysId || '0')
               );
               
               if (trainee) {
                   // Navigate to CourseRoster view and select the trainee
                   setSelectedTrainee(trainee);
                   setActiveView('CourseRoster');
                   if (onShowSuccess) {
                       onShowSuccess(`Navigated to Trainee Profile: ${user.name}`);
                   }
               } else {
                   if (onShowSuccess) {
                       onShowSuccess(`Trainee profile not found: ${user.name}`);
                   }
               }
           }'''

# Define the new function code with normalized comparison
new_function = '''       const handleNavigateToProfile = (user: any) => {
           console.log('🎹 Navigating to profile:', user);
           console.log("user.name:", user.name);
           console.log("user.pmkeysId:", user.pmkeysId);
           console.log("user.userType:", user.userType);
           
           // Find the instructor or trainee in the data
           if (user.userType === 'STAFF') {
               // Find instructor by name or PMKeys ID with normalized comparison
               const instructor = instructorsData.find(i => {
                   const userName = String(user.name || '').trim();
                   const instructorName = String(i.name || '').trim();
                   const userId = String(user.pmkeysId || '').trim();
                   const instructorId = String(i.idNumber || '').trim();

                   console.log("Comparing instructor:", {userName, instructorName, userId, instructorId});

                   return userName === instructorName && userId === instructorId;
               });
               
               if (instructor) {
                   console.log("✅ Instructor found, navigating to profile");
                   // Navigate to Instructors view and select the instructor
                   setSelectedInstructor(instructor);
                   setActiveView('Instructors');
                   if (onShowSuccess) {
                       onShowSuccess(`Navigated to Staff Profile: ${user.name}`);
                   }
               } else {
                   console.log("❌ Instructor not found:", user.name);
                   console.log("Instructors count:", instructorsData.length);
                   console.log("First 3 instructors:", instructorsData.slice(0, 3).map(i => ({name: i.name, idNumber: i.idNumber})));
                   if (onShowSuccess) {
                       onShowSuccess(`Staff profile not found: ${user.name}`);
                   }
               }
           } else if (user.userType === 'TRAINEE') {
               // Find trainee by name or PMKeys ID with normalized comparison
               const trainee = traineesData.find(t => {
                   const userName = String(user.name || '').trim();
                   const traineeName = String(t.name || '').trim();
                   const userId = String(user.pmkeysId || '').trim();
                   const traineeId = String(t.idNumber || '').trim();

                   console.log("Comparing trainee:", {userName, traineeName, userId, traineeId});

                   return userName === traineeName && userId === traineeId;
               });
               
               console.log("First 3 trainees:", traineesData.slice(0, 3).map(t => ({name: t.name, idNumber: t.idNumber})));
               console.log("Trainees count:", traineesData.length);
               console.log("Trainee search result:", trainee);
               
               if (trainee) {
                   console.log("✅ Trainee found, navigating to profile");
                   // Navigate to CourseRoster view and select the trainee
                   setSelectedTrainee(trainee);
                   setActiveView('CourseRoster');
                   if (onShowSuccess) {
                       onShowSuccess(`Navigated to Trainee Profile: ${user.name}`);
                   }
               } else {
                   console.log("❌ Trainee not found:", user.name);
                   if (onShowSuccess) {
                       onShowSuccess(`Trainee profile not found: ${user.name}`);
                   }
               }
           }'''

# Try to replace
if old_function in content:
    content = content.replace(old_function, new_function)
    print("✅ Successfully replaced handleNavigateToProfile function")
else:
    print("❌ Could not find exact match")
    # Show what we found around that line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'handleNavigateToProfile' in line and i > 0:
            print(f"\nFound at line {i+1}:")
            print("".join(lines[i-1:i+35]))

# Write back
with open('App.tsx', 'w') as f:
    f.write(content)