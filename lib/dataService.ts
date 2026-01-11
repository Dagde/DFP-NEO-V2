// Data Service - Loads data from API with fallback to mock data
// Returns plain objects for React compatibility

import { fetchInstructors, fetchTrainees, fetchAircraft, fetchScores, fetchSchedule } from './api';
import { ESL_DATA } from '../mockData';


// Merge database instructors with mock data, deduplicating by idNumber
function mergeInstructorData(dbInstructors: any[], mockInstructors: any[]): any[] {
  console.log('🔄 Merging instructor data...');
  console.log('  Database instructors:', dbInstructors.length);
  console.log('  Mock instructors:', mockInstructors.length);
  
  // Create a map of database instructors by idNumber for deduplication
  const dbInstructorMap = new Map();
  dbInstructors.forEach((instructor: any) => {
    dbInstructorMap.set(instructor.idNumber, instructor);
  });
  
  // Merge mock instructors, skipping duplicates
  const merged = [...dbInstructors];
  mockInstructors.forEach((instructor: any) => {
    if (!dbInstructorMap.has(instructor.idNumber)) {
      merged.push(instructor);
    }
  });
  
  // Sort by: Unit → Rank → Name (alphabetical)
  merged.sort((a: any, b: any) => {
    // First by unit
    if (a.unit !== b.unit) {
      return a.unit.localeCompare(b.unit);
    }
    // Then by rank (higher rank first)
    const rankOrder = { 'QFI': 1, 'SIM IP': 2, 'INSTRUCTOR': 3 };
    const aRank = rankOrder[a.role] || 99;
    const bRank = rankOrder[b.role] || 99;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    // Finally by name (alphabetical)
    return a.name.localeCompare(b.name);
  });
  
  console.log('  Merged result:', merged.length, 'instructors');
  return merged;
}

// Merge database trainees with mock data, deduplicating by name
function mergeTraineeData(dbTrainees: any[], mockTrainees: any[]): any[] {
  console.log('🔄 Merging trainee data...');
  console.log('  Database trainees:', dbTrainees.length);
  console.log('  Mock trainees:', mockTrainees.length);
  
  // Create a map of database trainees by name for deduplication
  const dbTraineeMap = new Map();
  dbTrainees.forEach((trainee: any) => {
    dbTraineeMap.set(trainee.name, trainee);
  });
  
  // Merge mock trainees, skipping duplicates
  const merged = [...dbTrainees];
  mockTrainees.forEach((trainee: any) => {
    if (!dbTraineeMap.has(trainee.name)) {
      merged.push(trainee);
    }
  });
  
  // Sort by name (alphabetical)
  merged.sort((a: any, b: any) => a.name.localeCompare(b.name));
  
  console.log('  Merged result:', merged.length, 'trainees');
  return merged;
}

export async function initializeData() {
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
       // Always merge with mock data for staff
       console.log('🔁 Merging database + mock data for staff');
       instructors = mergeInstructorData(instructors, ESL_DATA.instructors);
   

       // Fetch trainees
       console.log('👨‍🎓 Fetching trainees from API...');
       trainees = await fetchTrainees();
       console.log('✅ Trainees loaded:', trainees.length);
       // Always merge with mock data for trainees
       console.log('🔁 Merging database + mock data for trainees');
       trainees = mergeTraineeData(trainees, ESL_DATA.trainees);
   
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
}