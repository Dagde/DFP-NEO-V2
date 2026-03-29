// Data Service - Loads data from API with fallback to mock data
// Returns plain objects for React compatibility

import { fetchInstructors, fetchTrainees, fetchAircraft, fetchScores, fetchSchedule } from './api';
import { ESL_DATA, PEA_DATA } from '../mockData';
import { assignTraineesToInstructors } from './traineeAssignmentService';


// Merge database instructors with mock data, deduplicating by idNumber
// Adds _dataSource field to track origin ('database' or 'mockdata')
function mergeInstructorData(dbInstructors: any[], mockInstructors: any[], includeMockData: boolean): any[] {
  console.log('\ud83d\udd04 Merging instructor data...');
  console.log('  Database instructors:', dbInstructors.length);
  console.log('  Mock instructors:', mockInstructors.length);
  console.log('  Include MockData:', includeMockData);
  
  // Debug: Log DB instructor details
  console.log('\ud83d\udcca DB INSTRUCTOR DETAILS:');
  dbInstructors.forEach((inst: any) => {
    console.log(`  DB: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit} | role: ${inst.role} | isQFI: ${inst.isQFI}`);
  });
  
  // Create a map of mockData instructors by name for permission inheritance
  const mockByName = new Map();
  mockInstructors.forEach((instructor: any) => {
    mockByName.set(instructor.name, instructor);
  });

  // Create a map of database instructors by idNumber for deduplication
  // Also create a set of DB instructor names for name-based deduplication
  // Tag each database record with _dataSource: 'database'
  const dbInstructorMap = new Map();
  const dbInstructorNames = new Set<string>();
  dbInstructors.forEach((instructor: any) => {
    // If DB instructor has empty permissions, inherit from mockData by name
    if ((!instructor.permissions || instructor.permissions.length === 0) && mockByName.has(instructor.name)) {
      const mockMatch = mockByName.get(instructor.name);
      instructor = { ...instructor, permissions: mockMatch.permissions || [] };
      console.log(`  \u2705 Inherited permissions for ${instructor.name} from mockData:`, instructor.permissions);
    }
    
    // Check for duplicate idNumbers
    if (dbInstructorMap.has(instructor.idNumber)) {
      console.log(`  \u26a0\ufe0f DUPLICATE IDNUMBER: ${instructor.idNumber} - ${instructor.name} overwrites ${dbInstructorMap.get(instructor.idNumber).name}`);
    }
    
    // Tag with dataSource
    const taggedInstructor = { ...instructor, _dataSource: 'database' as const };
    dbInstructorMap.set(instructor.idNumber, taggedInstructor);
    dbInstructorNames.add(instructor.name);
  });
  
  // Start with database instructors (already tagged)
  const merged = Array.from(dbInstructorMap.values());
  let skippedByIdNumber = 0;
  let skippedByName = 0;
  
  // Only add mock instructors if includeMockData is true
  if (includeMockData) {
    mockInstructors.forEach((instructor: any) => {
      if (dbInstructorMap.has(instructor.idNumber)) {
        skippedByIdNumber++;
        console.log(`  \u23ed\ufe0f Skipped mock instructor (idNumber match): ${instructor.name} (${instructor.idNumber})`);
      } else if (dbInstructorNames.has(instructor.name)) {
        skippedByName++;
        console.log(`  \u23ed\ufe0f Skipped mock instructor (name match): ${instructor.name}`);
      } else {
        // Tag with dataSource: 'mockdata'
        merged.push({ ...instructor, _dataSource: 'mockdata' as const });
      }
    });
  }
  
  console.log(`\ud83d\udcca MERGE SUMMARY:`);
  console.log(`  DB instructors after dedup: ${dbInstructorMap.size}`);
  console.log(`  Mock instructors skipped (idNumber): ${skippedByIdNumber}`);
  console.log(`  Mock instructors skipped (name): ${skippedByName}`);
  console.log(`  Mock instructors added: ${mockInstructors.length - skippedByIdNumber - skippedByName}`);
  console.log(`  Total merged: ${merged.length}`);
  
  // Count QFIs by unit
  const qfisByUnit: { [key: string]: number } = {};
  merged.forEach((inst: any) => {
    const isQFI = inst.role === 'QFI' || inst.isQFI === true;
    if (isQFI) {
      const unit = inst.unit || 'Unassigned';
      qfisByUnit[unit] = (qfisByUnit[unit] || 0) + 1;
    }
  });
  console.log('\ud83d\udcca QFIs BY UNIT:', qfisByUnit);
  
  // Sort by: Unit \u2192 Rank \u2192 Name (alphabetical)
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

// Assign trainees to Burns (real database instructor) since mock data doesn't include him
function assignTraineesToBurns(instructors: any[], trainees: any[]): void {
  const burns = instructors.find(i => i.name && i.name.toLowerCase().includes('burns'));
  if (!burns) {
    console.log('\u26a0\ufe0f  Burns not found in instructors - skipping trainee assignment');
    return;
  }
  
  console.log('\ud83d\udc68\u200d\u2708\ufe0f  Assigning trainees to Burns:', burns.name);
  
  // Find unassigned trainees (no primary instructor)
  const unassignedTrainees = trainees.filter(t => !t.primaryInstructor);
  console.log('  Found', unassignedTrainees.length, 'unassigned trainees');
  
  // Assign 2 primary trainees to Burns
  const primaryAssignments = unassignedTrainees.slice(0, 2);
  primaryAssignments.forEach(trainee => {
    trainee.primaryInstructor = burns.name;
    console.log('  Assigned primary:', trainee.name, '\u2192', burns.name);
  });
  
  // Assign 2 secondary trainees to Burns (different from primary)
  const remainingTrainees = unassignedTrainees.slice(2);
  const secondaryAssignments = remainingTrainees.slice(0, 2);
  secondaryAssignments.forEach(trainee => {
    trainee.secondaryInstructor = burns.name;
    console.log('  Assigned secondary:', trainee.name, '\u2192', burns.name);
  });
}

// Merge database trainees with mock data, deduplicating by name
// Adds _dataSource field to track origin ('database' or 'mockdata')
function mergeTraineeData(dbTrainees: any[], mockTrainees: any[], includeMockData: boolean): any[] {
  console.log('\ud83d\udd04 Merging trainee data...');
  console.log('  Database trainees:', dbTrainees.length);
  console.log('  Mock trainees:', mockTrainees.length);
  console.log('  Include MockData:', includeMockData);

  // Log DB trainee courses for debugging
  const dbCourses = [...new Set(dbTrainees.map((t: any) => t.course).filter(Boolean))];
  console.log('  DB trainee courses:', dbCourses);

  // Tag each database record with _dataSource: 'database'
  // Use idNumber as dedup key since it's unique (name could have duplicates)
  const dbTraineeMap = new Map();
  const taggedDbTrainees = dbTrainees.map((trainee: any) => ({
    ...trainee,
    _dataSource: 'database' as const
  }));

  taggedDbTrainees.forEach((trainee: any) => {
    dbTraineeMap.set(trainee.idNumber, trainee);
  });

  // Start with database trainees (already tagged)
  const merged = [...taggedDbTrainees];

  // Only add mock trainees if includeMockData is true
  if (includeMockData) {
    mockTrainees.forEach((trainee: any) => {
      // Only add mock trainee if no DB trainee with same idNumber exists
      if (!dbTraineeMap.has(trainee.idNumber)) {
        // Tag with dataSource: 'mockdata'
        merged.push({ ...trainee, _dataSource: 'mockdata' as const });
      }
    });
  }

  // Sort by name (alphabetical)
  merged.sort((a: any, b: any) => a.name.localeCompare(b.name));

  console.log('  Merged result:', merged.length, 'trainees');
  console.log('  Merged courses:', [...new Set(merged.map((t: any) => t.course).filter(Boolean))]);
  return merged;
}

export async function initializeData() {
  console.log('\ud83d\udd27 initializeData() v2.3-debug - Starting data initialization');
  
    // Read data source settings from localStorage
    // Defaults match DataSourcesSettings.tsx: all ON by default
    let dataSourceSettings: { staff: boolean; trainee: boolean; course: boolean; staffDb: boolean; traineeDb: boolean } = {
      staff: true,
      trainee: true,
      course: false,
      staffDb: true,
      traineeDb: true,
    };
    try {
      const settingsStr = localStorage.getItem('dataSourceSettings');
      if (settingsStr) {
        const parsed = JSON.parse(settingsStr);
        dataSourceSettings = {
          staff: parsed.staff !== false,
          trainee: parsed.trainee !== false,
          course: parsed.course === true,
          staffDb: parsed.staffDb !== false,
          traineeDb: parsed.traineeDb !== false,
        };
      }
      console.log('\ud83c\udf9b\ufe0f Data source settings:', dataSourceSettings);
    } catch (e) {
      console.log('\u26a0\ufe0f Could not read dataSourceSettings, using defaults');
    }
    
  let instructors: any[] = [];
  let trainees: any[] = [];
  let aircraft: any[] = [];
  let scores: Record<string, any[]> = {};
  let events: any[] = [];

  try {
    console.log('\ud83c\udf10 Initializing data from API...');
    
         // Fetch instructors - ALWAYS load all data regardless of toggle settings
         // Filtering is handled in App.tsx UI layer, not here at load time
         // This ensures toggling ON after app load shows data correctly
         console.log('\ud83d\udc68\u200d\ud83c\udfeb Fetching instructors from API...');
         const allPersonnel = await fetchInstructors();
         instructors = allPersonnel;
         console.log('\u2705 Staff DB loaded:', instructors.length, 'personnel records');
         allPersonnel.forEach((inst: any) => {
           const hasUserId = inst.userId && inst.userId !== '';
           console.log(`  DB Personnel: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit || 'N/A'} | role: ${inst.role || 'N/A'} | isQFI: ${inst.isQFI || false} | userId: ${hasUserId ? 'YES' : 'NO'}`);
         });

         // Always merge both DB and mock data with _dataSource tags
         // App.tsx filtering will decide what to show based on toggle state
         // Merge both ESL and PEA mock instructors so both locations are available
         const allMockInstructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors];
         instructors = mergeInstructorData(instructors, allMockInstructors, true);
         console.log('\ud83d\udd04 Loaded all staff (DB + mock) with _dataSource tags for UI filtering');
   

         // Fetch trainees - ALWAYS load all data regardless of toggle settings
         // Filtering is handled in App.tsx UI layer, not here at load time
         console.log('\ud83d\udc68\u200d\ud83c\udf93 Fetching trainees from API...');
         trainees = await fetchTrainees();
         console.log('\u2705 Trainee DB loaded:', trainees.length);

         // Exclude mock data - only load database trainees
         trainees = mergeTraineeData(trainees, ESL_DATA.trainees, false);
         console.log('\ud83d\udd04 Loaded trainees (DB only - mock data excluded)');
       
       // Assign trainees to instructors using the new assignment service
       // This ensures all instructors have minimum 2 primary and 2 secondary trainees
       console.log('\ud83d\udd27 Applying trainee assignment logic...');
       const assignmentResult = assignTraineesToInstructors(trainees, instructors);
       trainees = assignmentResult.trainees;
       console.log('\u2705 Trainee assignment complete');
       console.log('\ud83d\udcca Assignment Summary:', assignmentResult.summary);
   
    // Fetch aircraft
    console.log('\u2708\ufe0f Fetching aircraft from API...');
    aircraft = await fetchAircraft();
    console.log('\u2705 Aircraft loaded:', aircraft.length);
    
    // Fetch scores
    console.log('\ud83d\udcca Fetching scores from API...');
    scores = await fetchScores();
    console.log('\u2705 Scores loaded:', Object.keys(scores).length, 'trainees with scores');
    
    // Fetch schedule
    console.log('\ud83d\udcc5 Fetching schedule from API...');
    events = await fetchSchedule();
    console.log('\u2705 Schedule loaded:', events.length);
    
    // If API returned no data, fallback to mock data (always tagged with _dataSource)
    if (instructors.length === 0) {
        console.log('\u26a0\ufe0f No instructors from API, falling back to mock data');
        instructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors].map((i: any) => ({ ...i, _dataSource: 'mockdata' }));
    }
    
    if (trainees.length === 0) {
        console.log('\u26a0\ufe0f No trainees from API, falling back to mock data');
        trainees = ESL_DATA.trainees.map((t: any) => ({ ...t, _dataSource: 'mockdata' }));
    }
    
    if (aircraft.length === 0) {
      console.log('\u26a0\ufe0f No aircraft from API, using mock data');
      aircraft = ESL_DATA.aircraft || [];
    }
    
    console.log('\ud83d\udcca Data loaded successfully:', {
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
    console.error('\u274c Error loading data from API:', error);
    
    // Fallback to mock data
    console.log('\ud83d\ude80 Falling back to mock data...');
    const mockInstructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors];
    const mockTrainees = ESL_DATA.trainees;
    
    return {
      instructors: mockInstructors,
      trainees: mockTrainees,
      aircraft: ESL_DATA.aircraft || [],
      scores: {},
      events: [],
    };
  }
}