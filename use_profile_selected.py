# Read the file
with open('App.tsx', 'r') as f:
    content = f.read()

# Find and replace the function
old_code = '''       const handleNavigateToProfile = (user: any) => {
           console.log('Navigating to profile:', user);
              console.log("user.name:", user.name);
              console.log("user.pmkeysId:", user.pmkeysId);
           
           // Find the instructor or trainee in the data
           if (user.userType === 'STAFF') {
               // Find instructor by name or PMKeys ID
               const instructor = instructorsData.find(i => 
                   i.name === user.name && i.idNumber === user.pmkeysId
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
                   t.name === user.name && t.idNumber === user.pmkeysId
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

new_code = '''       const handleNavigateToProfile = (user: any) => {
           console.log('🎹 Navigating to profile:', user);
           console.log('user:', JSON.stringify(user));
           
           // Use setSelectedPersonForProfile to directly open the profile
           // This works the same way as clicking on a trainee name in CourseRoster
           if (user.userType === 'STAFF') {
               console.log('Opening staff profile:', user.name);
               setSelectedPersonForProfile({
                   name: user.name,
                   idNumber: user.pmkeysId,
                   role: 'INSTRUCTOR'
               } as Instructor);
               setSuccessMessage(`Navigating to Staff Profile: ${user.name}`);
           } else if (user.userType === 'TRAINEE') {
               console.log('Opening trainee profile:', user.name);
               setSelectedPersonForProfile({
                   name: user.name,
                   idNumber: user.pmkeysId,
                   role: 'TRAINEE'
               } as Trainee);
               setSuccessMessage(`Navigating to Trainee Profile: ${user.name}`);
           }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    print("✅ Successfully replaced handleNavigateToProfile")
else:
    print("❌ Could not find exact match")

# Write back
with open('App.tsx', 'w') as f:
    f.write(content)