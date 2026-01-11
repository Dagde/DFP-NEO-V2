#!/usr/bin/env python3

with open('App.tsx', 'r') as f:
    content = f.read()

# Find the handleNavigateToProfile function and replace it
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
           }
       };'''

new_function = '''       const handleNavigateToProfile = (user: any) => {
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
                   setSuccessMessage(`Navigated to Staff Profile: ${user.name}`);
               } else {
                   setSuccessMessage(`Staff profile not found: ${user.name}`);
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
                   setSuccessMessage(`Navigated to Trainee Profile: ${user.name}`);
               } else {
                   setSuccessMessage(`Trainee profile not found: ${user.name}`);
               }
           }
       };'''

if old_function in content:
    content = content.replace(old_function, new_function)
    with open('App.tsx', 'w') as f:
        f.write(content)
    print("✅ Successfully replaced handleNavigateToProfile function")
else:
    print("❌ Could not find the exact function to replace")