#!/usr/bin/env python3
import re

# Read the file
with open('/workspace/lib/dataService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the initializeData function
old_function = r'''export async function initializeData\(\) \{
    console\.log\('🔧 initializeData\(\) - Starting data initialization'\);
    
    let instructors: any\[\] = \[\];
    let trainees: any\[\] = \[\];
    let aircraft: any\[\] = \[\];
    let scores: Record<string, any\[\]> = \{\};
    let events: any\[\] = \[\];

  try \{
      console\.log\('🌐 Initializing data from API\.\.\.'\);
      
      // Fetch instructors
      console\.log\('👨‍🏫 Fetching instructors from API\.\.\.'\);
      instructors = await fetchInstructors\(\);
      console\.log\('✅ Instructors loaded:', instructors\.length\);
      
      // Fetch trainees
      console\.log\('👨‍🎓 Fetching trainees from API\.\.\.'\);
      trainees = await fetchTrainees\(\);
      console\.log\('✅ Trainees loaded:', trainees\.length\);
      
      // Fetch aircraft
      console\.log\('✈️ Fetching aircraft from API\.\.\.'\);
      aircraft = await fetchAircraft\(\);
      console\.log\('✅ Aircraft loaded:', aircraft\.length\);
      
      // Fetch scores
      console\.log\('📊 Fetching scores from API\.\.\.'\);
      scores = await fetchScores\(\);
      console\.log\('✅ Scores loaded:', Object\.keys\(scores\)\.length, 'trainees with scores'\);
      
      // Fetch schedule
      console\.log\('📅 Fetching schedule from API\.\.\.'\);
      events = await fetchSchedule\(\);
      console\.log\('✅ Schedule loaded:', events\.length\);
      
      // If API returned no data, fallback to mock data
      if \(instructors\.length === 0\) \{
        console\.log\('⚠️ No instructors from API, using mock data'\);
        instructors = ESL_DATA\.instructors;
      \}
      
      if \(trainees\.length === 0\) \{
        console\.log\('⚠️ No trainees from API, using mock data'\);
        trainees = ESL_DATA\.trainees;
      \}
      
      if \(aircraft\.length === 0\) \{
        console\.log\('⚠️ No aircraft from API, using mock data'\);
        aircraft = ESL_DATA\.aircraft \|\| \[\];
      \}
      
      console\.log\('📊 Data loaded successfully:', \{
        instructors: instructors\.length,
        trainees: trainees\.length,
        aircraft: aircraft\.length,
        scores: Object\.keys\(scores\)\.length,
        events: events\.length,
      \}\);
      
      return \{
        instructors,
        trainees,
        aircraft,
        scores,
        events,
      \};
      
    \} catch \(error\) \{
      console\.error\('❌ Failed to load data from API:', error\);
      console\.log\('⚠️ Falling back to mock data'\);
      
      return \{
        instructors: ESL_DATA\.instructors,
        trainees: ESL_DATA\.trainees,
        aircraft: ESL_DATA\.aircraft \|\| \[\],
        scores: \{\},
        events: ESL_DATA\.events \|\| \[\],
      \};
    \}
  \}'''

new_function = '''export async function initializeData() {
    console.log('🔧 initializeData() v2.2 - Starting data initialization');
    
    // Read data source settings from localStorage
    let dataSourceSettings = { staff: false, trainee: false, course: false };
    try {
      const settingsStr = localStorage.getItem('dataSourceSettings');
      if (settingsStr) {
        dataSourceSettings = JSON.parse(settingsStr);
      }
      console.log('🎛️ Data source settings:', dataSourceSettings);
    } catch (e) {
      console.log('⚠️ Could not read dataSourceSettings, using defaults');
    }
    
    let instructors: any[] = [];
    let trainees: any[] = [];
    let aircraft: any[] = [];
    let scores: Record<string, any[]> = {};
    let events: any[] = [];

  try {
      console.log('🌐 Initializing data from API...');
      
      // Fetch instructors
      console.log('👨‍🏫 Fetching instructors from API...');
      instructors = await fetchInstructors();
      console.log('✅ Instructors loaded:', instructors.length);
      
      // Merge with mock data if staff toggle is ON
      if (dataSourceSettings.staff) {
        console.log('🔄 Staff toggle is ON - merging database + mock data');
        instructors = mergeInstructorData(instructors, ESL_DATA.instructors);
      }
      
      // Fetch trainees
      console.log('👨‍🎓 Fetching trainees from API...');
      trainees = await fetchTrainees();
      console.log('✅ Trainees loaded:', trainees.length);
      
      // Merge with mock data if trainee toggle is ON
      if (dataSourceSettings.trainee) {
        console.log('🔄 Trainee toggle is ON - merging database + mock data');
        trainees = mergeTraineeData(trainees, ESL_DATA.trainees);
      }
      
      // Fetch aircraft
      console.log('✈️ Fetching aircraft from API...');
      aircraft = await fetchAircraft();
      console.log('✅ Aircraft loaded:', aircraft.length);
      
      // Fetch scores
      console.log('📊 Fetching scores from API...');
      scores = await fetchScores();
      console.log('✅ Scores loaded:', Object.keys(scores).length, 'trainees with scores');
      
      // Fetch schedule
      console.log('📅 Fetching schedule from API...');
      events = await fetchSchedule();
      console.log('✅ Schedule loaded:', events.length);
      
      // If API returned no data, fallback to mock data
      if (instructors.length === 0) {
        console.log('⚠️ No instructors from API, using mock data');
        instructors = ESL_DATA.instructors;
      }
      
      if (trainees.length === 0) {
        console.log('⚠️ No trainees from API, using mock data');
        trainees = ESL_DATA.trainees;
      }
      
      if (aircraft.length === 0) {
        console.log('⚠️ No aircraft from API, using mock data');
        aircraft = ESL_DATA.aircraft || [];
      }
      
      console.log('📊 Data loaded successfully:', {
        instructors: instructors.length,
        trainees: trainees.length,
        aircraft: aircraft.length,
        scores: Object.keys(scores).length,
        events: events.length,
      });
      
      return {
        instructors,
        trainees,
        aircraft,
        scores,
        events,
      };
      
    } catch (error) {
      console.error('❌ Failed to load data from API:', error);
      console.log('⚠️ Falling back to mock data');
      
      return {
        instructors: ESL_DATA.instructors,
        trainees: ESL_DATA.trainees,
        aircraft: ESL_DATA.aircraft || [],
        scores: {},
        events: ESL_DATA.events || [],
      };
    }
  }'''

# Replace the function
content = re.sub(old_function, new_function, content)

# Write the file back
with open('/workspace/lib/dataService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Successfully updated initializeData function")