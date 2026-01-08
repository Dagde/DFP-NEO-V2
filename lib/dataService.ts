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
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
  }
  return defaultValue;
}

// Initialize data from API or fallback to localStorage or mock data
export async function initializeData() {
  let instructors: Instructor[] = [];
  let trainees: Trainee[] = [];
  let events: ScheduleEvent[] = [];

  if (USE_API) {
    console.log('🔄 Initializing data from API...');
    
    try {
      // Try to fetch from API
      const [instructorsResult, traineesResult, scheduleResult] = await Promise.all([
        fetchInstructors(),
        fetchTrainees(),
        fetchSchedule(),
      ]);

      instructors = instructorsResult;
      trainees = traineesResult;
      events = scheduleResult;

      console.log('✅ Data loaded from API:', {
        instructors: instructors.length,
        trainees: trainees.length,
        events: events.length,
      });

      // Save to localStorage for faster next load
      saveToStorage(STORAGE_KEYS.INSTRUCTORS, instructors);
      saveToStorage(STORAGE_KEYS.TRAINEES, trainees);
      saveToStorage(STORAGE_KEYS.SCHEDULE, events);
    } catch (error) {
      console.warn('⚠️ API fetch failed, falling back to localStorage or mock data:', error);
      
      // Try localStorage first
      instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
      trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
      events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);

      // If localStorage is empty, use empty arrays
      if (instructors.length === 0) {
        console.log('📦 Using empty data as fallback');
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
    console.log('📦 Loading data from localStorage (API disabled)');
    instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
    trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
    events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);
  }

  // Load other data from localStorage (these are always stored locally for now)
  const scores = loadFromStorage<Map<string, Score[]>>(STORAGE_KEYS.SCORES, new Map());
  const pt051Assessments = loadFromStorage<Map<string, Pt051Assessment>>(
    STORAGE_KEYS.PT051_ASSESSMENTS, 
    new Map()
  );
  const courses = loadFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
  const courseColors = loadFromStorage<{ [key: string]: string }>(
    STORAGE_KEYS.COURSE_COLORS, 
    {}
  );
  const archivedCourses = loadFromStorage<{ [key: string]: string }>(
    STORAGE_KEYS.ARCHIVED_COURSES, 
    {}
  );
  const coursePriorities = loadFromStorage<string[]>(
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
}): void {
  saveToStorage(STORAGE_KEYS.COURSES, data.courses);
  saveToStorage(STORAGE_KEYS.COURSE_COLORS, data.courseColors);
  saveToStorage(STORAGE_KEYS.ARCHIVED_COURSES, data.archivedCourses);
  saveToStorage(STORAGE_KEYS.COURSE_PRIORITIES, data.coursePriorities);
  saveToStorage(STORAGE_KEYS.COURSE_PERCENTAGES, data.coursePercentages);
}

// Save scores data (to localStorage)
export function saveScoresData(scores: Map<string, Score[]>): void {
  saveToStorage(STORAGE_KEYS.SCORES, scores);
}

// Save PT051 assessments (to localStorage)
export function savePT051AssessmentsData(assessments: Map<string, Pt051Assessment>): void {
  saveToStorage(STORAGE_KEYS.PT051_ASSESSMENTS, assessments);
}

// Save trainee LMPs (to localStorage)
export function saveTraineeLMPsData(traineeLMPs: Map<string, SyllabusItemDetail[]>): void {
  saveToStorage(STORAGE_KEYS.TRAINEE_LMPS, traineeLMPs);
}

// Export mock data constants for reference
export { INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK };