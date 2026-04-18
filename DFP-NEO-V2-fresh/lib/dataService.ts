// Data Service - Loads data from API (database only, no mock data fallbacks)
// Returns plain objects for React compatibility

import { fetchInstructors, fetchTrainees, fetchAircraft, fetchScores, fetchSchedule, fetchCourses } from './api';
import { assignTraineesToInstructors } from './traineeAssignmentService';

export async function initializeData() {
  console.log('🔧 initializeData() v4.0 - DB-only, no mock data');

  let instructors: any[] = [];
  let trainees: any[] = [];
  let aircraft: any[] = [];
  let scores: Record<string, any[]> = {};
  let events: any[] = [];

  try {
    console.log('🌐 Initializing data from API...');

    // --- Instructors ---
    console.log('👨‍🏫 Fetching instructors from API...');
    const allPersonnel = await fetchInstructors();
    instructors = allPersonnel.map((i: any) => ({ ...i, _dataSource: 'database' as const }));
    console.log('✅ Staff DB loaded:', instructors.length, 'personnel records');
    instructors.forEach((inst: any) => {
      const hasUserId = inst.userId && inst.userId !== '';
      console.log(`  DB Personnel: ${inst.name} | idNumber: ${inst.idNumber} | unit: ${inst.unit || 'N/A'} | role: ${inst.role || 'N/A'} | isQFI: ${inst.isQFI || false} | userId: ${hasUserId ? 'YES' : 'NO'}`);
    });

    if (instructors.length === 0) {
      console.warn('⚠️ No instructors from API - returning empty list');
    }

    // --- Trainees ---
    console.log('👨‍🎓 Fetching trainees from API...');
    trainees = await fetchTrainees();
    trainees = trainees.map((t: any) => ({ ...t, _dataSource: 'database' as const }));
    console.log('✅ Trainee DB loaded:', trainees.length);

    if (trainees.length === 0) {
      console.warn('⚠️ No trainees from API - returning empty list');
    }

    // --- Trainee → Instructor Assignment ---
    try {
      console.log('🔧 Applying trainee assignment logic...');
      const assignmentResult = assignTraineesToInstructors(trainees, instructors);
      trainees = assignmentResult.trainees;
      console.log('✅ Trainee assignment complete');
      console.log('📊 Assignment Summary:', assignmentResult.summary);
    } catch (error) {
      console.error('❌ Error during trainee assignment:', error);
      console.warn('⚠️ Continuing without trainee assignment - trainees will have no instructors assigned');
    }

    // --- Aircraft ---
    // Aircraft are managed as a simple count (availableAircraftCount) in App.tsx.
    // This array is returned but not currently consumed by App.tsx.
    // Kept for API completeness - returns empty array if database has no records.
    console.log('✈️ Fetching aircraft from API...');
    aircraft = await fetchAircraft();
    console.log('✅ Aircraft loaded:', aircraft.length);

    if (aircraft.length === 0) {
      console.log('ℹ️ No aircraft records in database - aircraft count managed via availableAircraftCount setting');
    }

    // --- Scores ---
    console.log('📊 Fetching scores from API...');
    scores = await fetchScores();
    console.log('✅ Scores loaded:', Object.keys(scores).length, 'trainees with scores');

    // --- Schedule ---
    console.log('📅 Fetching schedule from API...');
    events = await fetchSchedule();
    console.log('✅ Schedule loaded:', events.length);

    // --- Courses ---
    console.log('🎓 Fetching courses from API...');
    const courses = await fetchCourses();
    console.log('✅ Courses loaded:', courses.length);

    console.log('📊 Data loaded successfully:', {
      instructors: instructors.length,
      trainees: trainees.length,
      aircraft: aircraft.length,
      scores: Object.keys(scores).length,
      events: events.length,
      courses: courses.length,
    });

    return { instructors, trainees, aircraft, scores, events, courses };

  } catch (error) {
    console.error('❌ Failed to load data from API:', error);
    console.warn('⚠️ API error - returning empty data (no mock data fallback)');

    // Never fall back to mock data on API error.
    // Return empty arrays - the app will show no data until DB connection is restored.
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