import { Instructor, Trainee, ScheduleEvent, Course, SyllabusItemDetail, Score, Pt051Assessment } from '../types';
import { fetchInstructors, fetchTrainees, fetchSchedule, saveSchedule as saveScheduleAPI } from './api';
import { INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK } from '../mockData';

// LocalStorage keys
const STORAGE_KEYS = {
  INSTRUCTORS: 'dfp-neo-instructors',
  TRAINEES: 'dfp-neo-trainees',
  SCHEDULE: 'dfp-neo-schedule',
  COURSES: 'dfp-neo-courses',
  COURSE_COLORS: 'dfp-neo-course-colors',
  ARCHIVED_COURSES: 'dfp-neo-archived-courses',
  COURSE_PRIORITIES: 'dfp-neo-course-priorities',
  COURSE_PERCENTAGES: 'dfp-neo-course-percentages',
  TRAINEE_LMPS: 'dfp-neo-trainee-lmps',
  SCORES: 'dfp-neo-scores',
  PT051_ASSESSMENTS: 'dfp-neo-pt051-assessments',
};

// Configuration
const USE_API = true; // Toggle this to switch between API and localStorage

// Helper: Save to localStorage
function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
}

// Helper: Load from localStorage
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Handle Map deserialization
      if (defaultValue instanceof Map) {
        return new Map(parsed) as T;
      }
      
      // Handle Array deserialization - ensure we return an array if defaultValue is an array
      if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
        console.warn(`Storage key "${key}" expected array but got ${typeof parsed}, returning empty array`);
        return defaultValue;
      }
      
      return parsed;
    }
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
  }
  return defaultValue;
}

// Initialize data from API or fallback to localStorage or mock data
export async function initializeData() {
  // Load other data from localStorage first (these are always stored locally for now)
  const scores = loadFromStorage<Map<string, Score[]>>(STORAGE_KEYS.SCORES, new Map());
  const pt051Assessments = loadFromStorage<Map<string, Pt051Assessment>>(
    STORAGE_KEYS.PT051_ASSESSMENTS, 
    new Map()
  );
  let courses = loadFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
  const courseColors = loadFromStorage<{ [key: string]: string }>(
    STORAGE_KEYS.COURSE_COLORS, 
    {}
  );
  const archivedCourses = loadFromStorage<{ [key: string]: string }>(
    STORAGE_KEYS.ARCHIVED_COURSES, 
    {}
  );
  let coursePriorities = loadFromStorage<string[]>(
    STORAGE_KEYS.COURSE_PRIORITIES, 
    []
  );
  const coursePercentages = loadFromStorage<Map<string, number>>(
    STORAGE_KEYS.COURSE_PERCENTAGES, 
    new Map()
  );
  const traineeLMPs = loadFromStorage<Map<string, SyllabusItemDetail[]>>(
    STORAGE_KEYS.TRAINEE_LMPS, 
    new Map()
  );

  // Ensure arrays are actually arrays
  courses = Array.isArray(courses) ? courses : [];
  coursePriorities = Array.isArray(coursePriorities) ? coursePriorities : [];

  let instructors: Instructor[] = [];
  let trainees: Trainee[] = [];
  let events: ScheduleEvent[] = [];

  if (USE_API) {
    console.log('Initializing data from API...');
    
    try {
      // Try to fetch from API
      const [instructorsResult, traineesResult, scheduleResult] = await Promise.all([
        fetchInstructors(),
        fetchTrainees(),
        fetchSchedule(),
      ]);

      // Ensure arrays
      instructors = Array.isArray(instructorsResult) ? instructorsResult : [];
      trainees = Array.isArray(traineesResult) ? traineesResult : [];
      events = Array.isArray(scheduleResult) ? scheduleResult : [];

      console.log('Data loaded from API:', {
        instructors: instructors.length,
        trainees: trainees.length,
        events: events.length,
        courses: courses.length,
        coursePriorities: coursePriorities.length,
        scores: scores.size,
        pt051Assessments: pt051Assessments.size,
        coursePercentages: coursePercentages.size,
        traineeLMPs: traineeLMPs.size,
      });
      
      console.log('✅ Instructors sample:', instructors.slice(0, 3));
      console.log('✅ Trainees sample:', trainees.slice(0, 3));

      // Save to localStorage for faster next load
      saveToStorage(STORAGE_KEYS.INSTRUCTORS, instructors);
      saveToStorage(STORAGE_KEYS.TRAINEES, trainees);
      saveToStorage(STORAGE_KEYS.SCHEDULE, events);
    } catch (error) {
      console.warn('API fetch failed, falling back to localStorage or mock data:', error);
      console.error('Full error details:', error);
      
      // Try localStorage first
      instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
      trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
      events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);

      // Ensure arrays
      instructors = Array.isArray(instructors) ? instructors : [];
      trainees = Array.isArray(trainees) ? trainees : [];
      events = Array.isArray(events) ? events : [];
      
      console.log('Loaded from localStorage:', {
        instructors: instructors.length,
        trainees: trainees.length,
        events: events.length,
      });

      // If localStorage is empty, use empty arrays
      if (instructors.length === 0) {
        console.log('Using empty data as fallback');
        instructors = [];
        trainees = [];
        events = [];
        
        // Save empty data to localStorage
        saveToStorage(STORAGE_KEYS.INSTRUCTORS, instructors);
        saveToStorage(STORAGE_KEYS.TRAINEES, trainees);
        saveToStorage(STORAGE_KEYS.SCHEDULE, events);
      }
    }
  } else {
    // Load from localStorage or use empty arrays
    console.log('Loading data from localStorage (API disabled)');
    instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
    trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
    events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);
  }

  return {
    instructors,
    trainees,
    events,
    scores,
    pt051Assessments,
    courses,
    courseColors,
    archivedCourses,
    coursePriorities,
    coursePercentages,
    traineeLMPs,
  };
}

// Save schedule
export async function saveSchedule(events: ScheduleEvent[]): Promise<boolean> {
  if (USE_API) {
    const success = await saveScheduleAPI(events);
    if (success) {
      // Also save to localStorage for backup
      saveToStorage(STORAGE_KEYS.SCHEDULE, events);
    }
    return success;
  } else {
    saveToStorage(STORAGE_KEYS.SCHEDULE, events);
    return true;
  }
}

// Save courses data (to localStorage)
export function saveCoursesData(data: {
  courses: Course[];
  courseColors: { [key: string]: string };
  archivedCourses: { [key: string]: string };
  coursePriorities: string[];
  coursePercentages: Map<string, number>;
}) {
  saveToStorage(STORAGE_KEYS.COURSES, data.courses);
  saveToStorage(STORAGE_KEYS.COURSE_COLORS, data.courseColors);
  saveToStorage(STORAGE_KEYS.ARCHIVED_COURSES, data.archivedCourses);
  saveToStorage(STORAGE_KEYS.COURSE_PRIORITIES, data.coursePriorities);
  saveToStorage(STORAGE_KEYS.COURSE_PERCENTAGES, Array.from(data.coursePercentages.entries()));
}

// Save scores data (to localStorage)
export function saveScoresData(scores: Map<string, Score[]>) {
  saveToStorage(STORAGE_KEYS.SCORES, Array.from(scores.entries()));
}

// Save PT051 assessments (to localStorage)
export function savePT051AssessmentsData(assessments: Map<string, Pt051Assessment>) {
  saveToStorage(STORAGE_KEYS.PT051_ASSESSMENTS, Array.from(assessments.entries()));
}

// Save trainee LMPs (to localStorage)
export function saveTraineeLMPsData(lmps: Map<string, SyllabusItemDetail[]>) {
  saveToStorage(STORAGE_KEYS.TRAINEE_LMPS, Array.from(lmps.entries()));
}

// Export mock data for use in other parts of the app
export { INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK };