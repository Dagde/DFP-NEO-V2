import re

# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Define the old function code
old_function = '''       const handleNavigateToProfile = (user: any) => {
           console.log('Navigating to profile:', user);
              console.log("user.name:", user.name);
              console.log("user.pmkeysId:", user.pmkeysId);
           
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
                       setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);
               } else {
                       setSuccessMessage(`Staff profile not found: ${user.name}`);
               }
           } else if (user.userType === 'TRAINEE') {
               // Find trainee by name or PMKeys ID
               const trainee = traineesData.find(t => 
                   t.name === user.name || t.idNumber === parseInt(user.pmkeysId || '0')
               );
               
                  console.log("First 3 trainees:", traineesData.slice(0, 3).map(t => ({name: t.name, idNumber: t.idNumber})));
                  console.log("Trainees count:", traineesData.length);
                  console.log("Trainee search result:", trainee);
               if (trainee) {
                   // Navigate to CourseRoster view and select the trainee
                   setSelectedTrainee(trainee);
                   setActiveView('CourseRoster');
                       setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);
               } else {
                       setSuccessMessage(`Trainee profile not found: ${user.name}`);
               }
           }'''

# Define the new function code
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
                   setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);
               } else {
                   console.log("❌ Instructor not found:", user.name);
                   console.log("Instructors count:", instructorsData.length);
                   console.log("First 3 instructors:", instructorsData.slice(0, 3).map(i => ({name: i.name, idNumber: i.idNumber})));
                   setErrorMessage(`Staff profile not found: ${user.name}`);
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
                   setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);
               } else {
                   console.log("❌ Trainee not found:", user.name);
                   setErrorMessage(`Trainee profile not found: ${user.name}`);
               }
           }'''

# Replace the function
if old_function in content:
    content = content.replace(old_function, new_function)
    print("✅ Successfully replaced handleNavigateToProfile function")
else:
    print("❌ Could not find the exact function to replace")
    # Try to find it with more flexibility
    if 'handleNavigateToProfile' in content:
        print("Found handleNavigateToProfile in file, but format doesn't match exactly")
        # Show a snippet for debugging
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'handleNavigateToProfile' in line:
                print(f"Found at line {i+1}: {line[:100]}")
                break

# Write the file back
with open('App.tsx', 'w') as f:
    f.write(content)