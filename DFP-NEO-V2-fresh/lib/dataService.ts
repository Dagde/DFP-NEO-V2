// Data Service - Loads data from API with fallback to mock data
// Returns plain objects for React compatibility

import { fetchInstructors, fetchTrainees, fetchAircraft, fetchScores, fetchSchedule, fetchCourses } from './api';
import { ESL_DATA, PEA_DATA } from '../mockData';
import { assignTraineesToInstructors } from './traineeAssignmentService';


// Merge database instructors with mock data, deduplicating by idNumber
// Adds _dataSource field to track origin ('database' or 'mockdata')
function mergeInstructorData(dbInstructors: any[], mockInstructors: any[], includeMockData: boolean): any[] {
  console.log('🔄 Merging instructor data...');
  console.log('  Database instructors:', dbInstructors.length);
  console.log('  Mock instructors:', mockInstructors.length);
  console.log('  Include MockData:', includeMockData);
  
  // Debug: Log DB instructor details
  console.log('📊 DB INSTRUCTOR DETAILS:');
  dbInstructors.forEach((inst: any) => {
    console.log(`  DB: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit} | role: ${inst.role} | isQFI: ${inst.isQFI}`);
  });
  
  // Create a map of mockData instructors by name for permission inheritance
  const mockByName = new Map();
  mockInstructors.forEach((instructor: any) => {
    mockByName.set(instructor.name, instructor);
  });

  // Create a map of database instructors for deduplication
  // Key: use idNumber when non-null, otherwise fall back to the Prisma CUID (id field)
  // This prevents all null-idNumber records from collapsing to a single map entry.
  // Also create a set of DB instructor names for name-based mockdata deduplication.
  // Tag each database record with _dataSource: 'database'
  const dbInstructorMap = new Map();
  const dbInstructorNames = new Set<string>();
  // Separate map keyed by idNumber (only for non-null idNumbers) used for mockdata dedup
  const dbByIdNumber = new Map();
  dbInstructors.forEach((instructor: any) => {
    // NOTE: Permissions are NOT inherited from mock data.
    // Real DB instructors keep their own permissions (even if empty).
    // Empty permissions = no permissions assigned yet, which is correct.
    
    // Use idNumber as key if available, otherwise use CUID (id) to avoid null-key collisions
    // All 102 restored staff have idNumber=null — without this fix they'd all overwrite each other
    const mapKey = instructor.idNumber != null ? instructor.idNumber : (instructor.id || instructor.name);
    
    // Check for duplicate keys
    if (dbInstructorMap.has(mapKey)) {
      console.log(`  ⚠️ DUPLICATE KEY: ${mapKey} - ${instructor.name} overwrites ${dbInstructorMap.get(mapKey).name}`);
    }
    
    // Tag with dataSource
    const taggedInstructor = { ...instructor, _dataSource: 'database' as const };
    dbInstructorMap.set(mapKey, taggedInstructor);
    dbInstructorNames.add(instructor.name);
    
    // Track by idNumber for mockdata deduplication (only when non-null)
    if (instructor.idNumber != null) {
      dbByIdNumber.set(instructor.idNumber, taggedInstructor);
    }
  });
  
  // Start with database instructors (already tagged)
  const merged = Array.from(dbInstructorMap.values());
  let skippedByIdNumber = 0;
  let skippedByName = 0;
  
  // Only add mock instructors if includeMockData is true
  if (includeMockData) {
    mockInstructors.forEach((instructor: any) => {
      if (instructor.idNumber != null && dbByIdNumber.has(instructor.idNumber)) {
        skippedByIdNumber++;
        console.log(`  ⏭️ Skipped mock instructor (idNumber match): ${instructor.name} (${instructor.idNumber})`);
      } else if (dbInstructorNames.has(instructor.name)) {
        skippedByName++;
        console.log(`  ⏭️ Skipped mock instructor (name match): ${instructor.name}`);
      } else {
        // Tag with dataSource: 'mockdata'
        merged.push({ ...instructor, _dataSource: 'mockdata' as const });
      }
    });
  }
  
  console.log(`📊 MERGE SUMMARY:`);
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
  console.log('📊 QFIs BY UNIT:', qfisByUnit);
  
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

// Assign trainees to Burns (real database instructor) since mock data doesn't include him
function assignTraineesToBurns(instructors: any[], trainees: any[]): void {
  const burns = instructors.find(i => i.name && i.name.toLowerCase().includes('burns'));
  if (!burns) {
    console.log('⚠️  Burns not found in instructors - skipping trainee assignment');
    return;
  }
  
  console.log('👨‍✈️  Assigning trainees to Burns:', burns.name);
  
  // Find unassigned trainees (no primary instructor)
  const unassignedTrainees = trainees.filter(t => {
    const p = t.primaryInstructor;
    return !p || (Array.isArray(p) && p.length === 0);
  });
  console.log('  Found', unassignedTrainees.length, 'unassigned trainees');
  
  // Assign 2 primary trainees to Burns
  const primaryAssignments = unassignedTrainees.slice(0, 2);
  primaryAssignments.forEach(trainee => {
    if (Array.isArray(trainee.primaryInstructor)) {
      if (!trainee.primaryInstructor.includes(burns.name)) trainee.primaryInstructor.push(burns.name);
    } else {
      trainee.primaryInstructor = [burns.name];
    }
    console.log('  Assigned primary:', trainee.name, '→', burns.name);
  });
  
  // Assign 2 secondary trainees to Burns (different from primary)
  const remainingTrainees = unassignedTrainees.slice(2);
  const secondaryAssignments = remainingTrainees.slice(0, 2);
  secondaryAssignments.forEach(trainee => {
    if (Array.isArray(trainee.secondaryInstructor)) {
      if (!trainee.secondaryInstructor.includes(burns.name)) trainee.secondaryInstructor.push(burns.name);
    } else {
      trainee.secondaryInstructor = [burns.name];
    }
    console.log('  Assigned secondary:', trainee.name, '→', burns.name);
  });
}

// Merge database trainees with mock data, deduplicating by name
// Adds _dataSource field to track origin ('database' or 'mockdata')
function mergeTraineeData(dbTrainees: any[], mockTrainees: any[], includeMockData: boolean): any[] {
  console.log('🔄 Merging trainee data...');
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
  console.log('🔧 initializeData() v2.3-debug - Starting data initialization');
  
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
    
         // Fetch instructors - ALWAYS load all data regardless of toggle settings
         // Filtering is handled in App.tsx UI layer, not here at load time
         // This ensures toggling ON after app load shows data correctly
         console.log('👨‍🏫 Fetching instructors from API...');
         const allPersonnel = await fetchInstructors();
         instructors = allPersonnel;
         console.log('✅ Staff DB loaded:', instructors.length, 'personnel records');
         allPersonnel.forEach((inst: any) => {
           const hasUserId = inst.userId && inst.userId !== '';
           console.log(`  DB Personnel: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit || 'N/A'} | role: ${inst.role || 'N/A'} | isQFI: ${inst.isQFI || false} | userId: ${hasUserId ? 'YES' : 'NO'}`);
         });

         // Merge DB and mock instructor data based on the staff mock data toggle setting.
         // Real DB data always takes priority. Mock data is only added if the toggle is ON.
         const allMockInstructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors];
         const includeStaffMockData = dataSourceSettings.staff !== false;
         instructors = mergeInstructorData(instructors, allMockInstructors, includeStaffMockData);
         console.log('🔄 Loaded staff - DB always included, mock data:', includeStaffMockData ? 'ENABLED' : 'DISABLED');
   

         // Fetch trainees - ALWAYS load all data regardless of toggle settings
         // Filtering is handled in App.tsx UI layer, not here at load time
         console.log('👨‍🎓 Fetching trainees from API...');
         trainees = await fetchTrainees();
         console.log('✅ Trainee DB loaded:', trainees.length);

         // Use the dataSourceSettings already loaded at the top of initializeData()
         const includeTraineeMockData = dataSourceSettings.trainee !== false; // Default to true if not set
         
         console.log('🔄 Data Sources - Trainee MockData:', includeTraineeMockData ? 'ENABLED' : 'DISABLED');
         trainees = mergeTraineeData(trainees, ESL_DATA.trainees, includeTraineeMockData);
         console.log('🔄 Loaded trainees (DB' + (includeTraineeMockData ? ' + mock' : ' only') + ') with _dataSource tags for UI filtering');
       
       // Assign trainees to instructors using the new assignment service
       // This ensures all instructors have minimum 2 primary and 2 secondary trainees
       try {
       console.log('\ud83d\udd27 Applying trainee assignment logic...');
       const assignmentResult = assignTraineesToInstructors(trainees, instructors);
       trainees = assignmentResult.trainees;
       console.log('\u2705 Trainee assignment complete');
       console.log('\ud83d\udcca Assignment Summary:', assignmentResult.summary);
       } catch (error) {
         console.error('\\u274c Error during trainee assignment:', error);
         console.warn('\\u26a0\ufe0f Continuing without trainee assignment - trainees will have no instructors assigned');
         // Continue without assignment - trainees will keep their existing instructor assignments (if any)
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

    // Fetch courses
    console.log('🎓 Fetching courses from API...');
    const courses = await fetchCourses();
    console.log('✅ Courses loaded:', courses.length);
    
    // If API returned no data, fallback to mock data (always tagged with _dataSource)
    if (instructors.length === 0) {
        console.log('⚠️ No instructors from API, falling back to mock data');
        instructors = [...ESL_DATA.instructors, ...PEA_DATA.instructors].map((i: any) => ({ ...i, _dataSource: 'mockdata' }));
    }
    
    if (trainees.length === 0) {
        console.log('⚠️ No trainees from API, falling back to mock data');
        trainees = ESL_DATA.trainees.map((t: any) => ({ ...t, _dataSource: 'mockdata' }));
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
      courses: courses.length,
    });
    
    return {
      instructors,
      trainees,
      aircraft,
      scores,
      events,
      courses,
    };
    
  } catch (error) {
    console.error('❌ Failed to load data from API:', error);
    console.log('⚠️ Falling back to mock data (tagged with _dataSource: mockdata)');
    
    // Tag all fallback mock data so the UI filtering still works correctly
    return {
      instructors: ESL_DATA.instructors.map((i: any) => ({ ...i, _dataSource: 'mockdata' as const })),
      trainees: ESL_DATA.trainees.map((t: any) => ({ ...t, _dataSource: 'mockdata' as const })),
      aircraft: ESL_DATA.aircraft || [],
      scores: {},
      events: (ESL_DATA.events || []).map((e: any) => ({ ...e, _dataSource: 'mockdata' as const })),
      courses: [],
    };
  }
}