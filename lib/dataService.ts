// Data Service - Loads runtime data from the API.
// Returns plain objects for React compatibility

import { fetchInstructors, fetchTrainees, fetchAircraft, fetchScores, fetchSchedule, fetchCourses } from './api';

function pushDataServiceDiag(stage: string, details: Record<string, any> = {}): void {
  const perfMs = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? Math.round(performance.now())
    : null;
  const entry = {
    ts: new Date().toISOString(),
    perfMs,
    stage,
    details,
  };
  try {
    const logToConsole = localStorage.getItem('neo_dfp_data_diag_console') === 'true';
    if (logToConsole) console.log(`[DFP-DIAG] ${stage}`, entry);
    const existing = JSON.parse(localStorage.getItem('neo_dfp_data_diag') || '[]');
    const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-300);
    localStorage.setItem('neo_dfp_data_diag', JSON.stringify(next));
    (window as any).neoDfpDataDiag = next;
  } catch {
    // Diagnostics must never interrupt app startup.
  }
}

export async function initializeData() {
  console.log('🔧 initializeData() v3.0 - Starting data initialization (DB-only, no mock data)');
  const initializeStartedAt = performance.now();
  pushDataServiceDiag('startup:data-service:start');
  
    // PERMANENT FIX: Mock data is NEVER loaded at startup regardless of localStorage settings.
    // Commercial runtime data is DB-first; the defensive filters in App.tsx keep any legacy
    // localStorage mock-data flags from contaminating live staff or trainee lists.
    
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
         const instructorsStartedAt = performance.now();
         const allPersonnel = await fetchInstructors();
         pushDataServiceDiag('startup:data-service:instructors', {
           durationMs: Math.round(performance.now() - instructorsStartedAt),
           count: Array.isArray(allPersonnel) ? allPersonnel.length : 0,
         });
         instructors = allPersonnel;
         console.log('✅ Staff DB loaded:', instructors.length, 'personnel records');
         allPersonnel.forEach((inst: any) => {
           const hasUserId = inst.userId && inst.userId !== '';
           console.log(`  DB Personnel: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit || 'N/A'} | role: ${inst.role || 'N/A'} | isQFI: ${inst.isQFI || false} | userId: ${hasUserId ? 'YES' : 'NO'}`);
         });

         // DB-only: tag all personnel with _dataSource: 'database'
         // Mock data is never merged here.
         instructors = instructors.map((i: any) => ({ ...i, _dataSource: 'database' as const }));
         console.log('🔄 Loaded staff from DB only:', instructors.length, 'records (mock data excluded at load time)');
   

         // Fetch trainees - ALWAYS load all data regardless of toggle settings
         // Filtering is handled in App.tsx UI layer, not here at load time
         console.log('👨‍🎓 Fetching trainees from API...');
         const traineesStartedAt = performance.now();
         trainees = await fetchTrainees();
         pushDataServiceDiag('startup:data-service:trainees', {
           durationMs: Math.round(performance.now() - traineesStartedAt),
           count: Array.isArray(trainees) ? trainees.length : 0,
         });
         console.log('✅ Trainee DB loaded:', trainees.length);

         // DB-only: tag all trainees with _dataSource: 'database'
         // Mock data is never merged here.
         trainees = trainees.map((t: any) => ({ ...t, _dataSource: 'database' as const }));
         console.log('🔄 Loaded trainees from DB only:', trainees.length, 'records (mock data excluded at load time)');
       
    // Fetch aircraft
    console.log('✈️ Fetching aircraft from API...');
    const aircraftStartedAt = performance.now();
    aircraft = await fetchAircraft();
    pushDataServiceDiag('startup:data-service:aircraft', {
      durationMs: Math.round(performance.now() - aircraftStartedAt),
      count: Array.isArray(aircraft) ? aircraft.length : 0,
    });
    console.log('✅ Aircraft loaded:', aircraft.length);
    
    // Fetch scores
    console.log('📊 Fetching scores from API...');
    const scoresStartedAt = performance.now();
    scores = await fetchScores();
    pushDataServiceDiag('startup:data-service:scores', {
      durationMs: Math.round(performance.now() - scoresStartedAt),
      traineeCount: scores ? Object.keys(scores).length : 0,
    });
    console.log('✅ Scores loaded:', Object.keys(scores).length, 'trainees with scores');
    
    // Fetch schedule
    console.log('📅 Fetching schedule from API...');
    const scheduleStartedAt = performance.now();
    events = await fetchSchedule();
    pushDataServiceDiag('startup:data-service:schedule', {
      durationMs: Math.round(performance.now() - scheduleStartedAt),
      count: Array.isArray(events) ? events.length : 0,
    });
    console.log('✅ Schedule loaded:', events.length);

    // Fetch courses
    console.log('🎓 Fetching courses from API...');
    const coursesStartedAt = performance.now();
    const courses = await fetchCourses();
    pushDataServiceDiag('startup:data-service:courses', {
      durationMs: Math.round(performance.now() - coursesStartedAt),
      count: Array.isArray(courses) ? courses.length : 0,
    });
    console.log('✅ Courses loaded:', courses.length);
    
    // PERMANENT: Never fall back to mock data - if API returns nothing, use empty arrays.
    // Mock data contaminated real staff lists and must not be loaded at startup under any circumstance.
    if (instructors.length === 0) {
        console.log('⚠️ No instructors from API - returning empty list (no mock data fallback)');
    }
    
    if (trainees.length === 0) {
        console.log('⚠️ No trainees from API - returning empty list (no mock data fallback)');
    }
    
    if (aircraft.length === 0) {
      console.log('⚠️ No aircraft from API - returning empty list (no mock data fallback)');
    }
    
    console.log('📊 Data loaded successfully:', {
      instructors: instructors.length,
      trainees: trainees.length,
      aircraft: aircraft.length,
      scores: Object.keys(scores).length,
      events: events.length,
      courses: courses.length,
    });
    pushDataServiceDiag('startup:data-service:end', {
      durationMs: Math.round(performance.now() - initializeStartedAt),
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
    console.log('⚠️ API error - returning empty data (no mock data fallback)');
    pushDataServiceDiag('startup:data-service:error', {
      durationMs: Math.round(performance.now() - initializeStartedAt),
      error: String(error),
    });
    
    // PERMANENT: Never fall back to mock data on API error.
    // Return empty arrays - the app will show no staff/trainees until DB connection is restored.
    return {
      instructors: [],
      trainees: [],
      aircraft: [],
      scores: {},
      events: [],
      courses: [],
    };
  }
}
