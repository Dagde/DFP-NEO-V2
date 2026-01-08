import { Instructor, Trainee, ScheduleEvent, Course, SyllabusItemDetail, Score, Pt051Assessment } from '../types';
import { fetchInstructors, fetchTrainees, fetchSchedule, fetchScores, saveSchedule as saveScheduleAPI } from './api';
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
  const pt051Assessments = loadFromStorage<Map<string, Pt051Assessment>>(
    STORAGE_KEYS.PT051_ASSESSMENTS, 
    new Map()
  );
  let courses = loadFromStorage<Course[]>(STORAGE_KEYS.COURSES, []);
  let courseColors = loadFromStorage<{ [key: string]: string }>(
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
      // Fetch data sequentially to avoid overwhelming the browser
      console.log('📥 Fetching instructors...');
      const instructorsResult = await fetchInstructors();
      console.log('✅ Instructors loaded:', instructorsResult.length);
      
      console.log('📥 Fetching trainees...');
      const traineesResult = await fetchTrainees();
      console.log('✅ Trainees loaded:', traineesResult.length);
      
      console.log('📥 Fetching schedule...');
      const scheduleResult = await fetchSchedule();
      console.log('✅ Schedule loaded:', scheduleResult.length);
      
      // TEMPORARY: Skip scores loading due to large response size (371KB) causing browser hang
      // TODO: Implement pagination or lazy loading for scores
      console.log('⚠️ Skipping scores fetch (too large, causes browser hang)');
      console.log('📝 App will work without scores, but NEO Build will be limited');
      const scoresResult = new Map<string, Score[]>();

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
        scores: scoresResult.size,
        scoresSample: Array.from(scoresResult.entries()).slice(0, 1),
        pt051Assessments: pt051Assessments.size,
        coursePercentages: coursePercentages.size,
        traineeLMPs: traineeLMPs.size,
        traineeSample: trainees.slice(0, 3).map(t => ({ fullName: t.fullName, course: t.course })),
      });
      
      console.log('✅ Instructors sample:', instructors.slice(0, 3));
      console.log('✅ Trainees sample:', trainees.slice(0, 3));
      
      // Log all unique course names from trainees
      const uniqueCourses = [...new Set(trainees.map(t => t.course).filter(c => c))];
      console.log('📋 Unique trainee courses:', uniqueCourses);
      
      // Log trainees with empty/missing courses
      const traineesWithoutCourse = trainees.filter(t => !t.course || t.course.trim() === '');
      console.log('⚠️ Trainees without course:', traineesWithoutCourse.length, traineesWithoutCourse.slice(0, 5));

      // Auto-generate courseColors based on trainee courses
      if (trainees.length > 0 && Object.keys(courseColors).length === 0) {
        const uniqueCourses = [...new Set(trainees.map(t => t.course).filter(c => c))];
        const predefinedColors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
          '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
          '#F8B500', '#00CED1', '#FF69B4', '#32CD32',
          '#FF6347', '#40E0D0', '#9370DB', '#20B2AA'
        ];
        
        courseColors = {};
        uniqueCourses.forEach((course, index) => {
          courseColors[course] = predefinedColors[index % predefinedColors.length];
        });
        
        console.log('🎨 Auto-generated courseColors:', courseColors);
        try {
          saveToStorage(STORAGE_KEYS.COURSE_COLORS, courseColors);
        } catch (error) {
          console.warn('Failed to save courseColors to localStorage (continuing anyway):', error);
        }
      }

      // Auto-populate traineeLMPs with master syllabus for each trainee
      if (trainees.length > 0 && traineeLMPs.size === 0) {
        console.log('📚 Initializing traineeLMPs with master syllabus for', trainees.length, 'trainees');
        
        trainees.forEach(trainee => {
          traineeLMPs.set(trainee.fullName, INITIAL_SYLLABUS_DETAILS);
        });
        
        console.log('✅ traineeLMPs initialized with', traineeLMPs.size, 'entries');
        // Don't save traineeLMPs to localStorage - too large, always fetch from API or use master syllabus
      }

      // Save to localStorage for faster next load (non-critical if it fails)
      try {
        saveToStorage(STORAGE_KEYS.INSTRUCTORS, instructors);
        saveToStorage(STORAGE_KEYS.TRAINEES, trainees);
        saveToStorage(STORAGE_KEYS.SCHEDULE, events);
        saveToStorage(STORAGE_KEYS.SCORES, Array.from(scoresResult.entries()));
      } catch (error) {
        console.warn('Failed to save some data to localStorage (continuing anyway):', error);
      }
      
      // Return data from API
      console.log('🎯 About to return data from initializeData');
      const returnData = {
        instructors,
        trainees,
        events,
        scores: scoresResult,
        pt051Assessments,
        courses,
        courseColors,
        archivedCourses,
        coursePriorities,
        coursePercentages,
        traineeLMPs,
      };
      console.log('🎯 Return data prepared:', {
        instructors: returnData.instructors.length,
        trainees: returnData.trainees.length,
        scores: returnData.scores.size
      });
      return returnData;
    } catch (error) {
      console.warn('API fetch failed, falling back to localStorage or mock data:', error);
      console.error('Full error details:', error);
      
      // Try localStorage first
      instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
      trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
      events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);
      const fallbackScores = loadFromStorage<Map<string, Score[]>>(STORAGE_KEYS.SCORES, new Map());

      // Ensure arrays
      instructors = Array.isArray(instructors) ? instructors : [];
      trainees = Array.isArray(trainees) ? trainees : [];
      events = Array.isArray(events) ? events : [];
      
      console.log('Loaded from localStorage:', {
        instructors: instructors.length,
        trainees: trainees.length,
        events: events.length,
        scores: fallbackScores.size,
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
        saveToStorage(STORAGE_KEYS.SCORES, []);
      }

      // Auto-generate courseColors based on trainee courses
      if (trainees.length > 0 && Object.keys(courseColors).length === 0) {
        const uniqueCourses = [...new Set(trainees.map(t => t.course).filter(c => c))];
        const predefinedColors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
          '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
          '#F8B500', '#00CED1', '#FF69B4', '#32CD32',
          '#FF6347', '#40E0D0', '#9370DB', '#20B2AA'
        ];
        
        courseColors = {};
        uniqueCourses.forEach((course, index) => {
          courseColors[course] = predefinedColors[index % predefinedColors.length];
        });
        
        console.log('🎨 Auto-generated courseColors:', courseColors);
        try {
          saveToStorage(STORAGE_KEYS.COURSE_COLORS, courseColors);
        } catch (error) {
          console.warn('Failed to save courseColors to localStorage (continuing anyway):', error);
        }
      }

      // Auto-populate traineeLMPs with master syllabus for each trainee
      if (trainees.length > 0 && traineeLMPs.size === 0) {
        console.log('📚 Initializing traineeLMPs with master syllabus for', trainees.length, 'trainees');
        
        trainees.forEach(trainee => {
          traineeLMPs.set(trainee.fullName, INITIAL_SYLLABUS_DETAILS);
        });
        
        console.log('✅ traineeLMPs initialized with', traineeLMPs.size, 'entries');
        // Don't save traineeLMPs to localStorage - too large, always fetch from API or use master syllabus
      }
      
      return {
        instructors,
        trainees,
        events,
        scores: fallbackScores || new Map(),
        pt051Assessments,
        courses,
        courseColors,
        archivedCourses,
        coursePriorities,
        coursePercentages,
        traineeLMPs,
      };
    }
  } else {
    // Load from localStorage or use empty arrays
    console.log('Loading data from localStorage (API disabled)');
    instructors = loadFromStorage(STORAGE_KEYS.INSTRUCTORS, []);
    trainees = loadFromStorage(STORAGE_KEYS.TRAINEES, []);
    events = loadFromStorage(STORAGE_KEYS.SCHEDULE, []);
    const localScores = loadFromStorage<Map<string, Score[]>>(STORAGE_KEYS.SCORES, new Map());

    // Auto-generate courseColors based on trainee courses
    if (trainees.length > 0 && Object.keys(courseColors).length === 0) {
      const uniqueCourses = [...new Set(trainees.map(t => t.course).filter(c => c))];
      const predefinedColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8B500', '#00CED1', '#FF69B4', '#32CD32',
        '#FF6347', '#40E0D0', '#9370DB', '#20B2AA'
      ];
      
      courseColors = {};
      uniqueCourses.forEach((course, index) => {
        courseColors[course] = predefinedColors[index % predefinedColors.length];
      });
      
      console.log('🎨 Auto-generated courseColors:', courseColors);
      try {
        saveToStorage(STORAGE_KEYS.COURSE_COLORS, courseColors);
      } catch (error) {
        console.warn('Failed to save courseColors to localStorage (continuing anyway):', error);
      }
    }

    // Auto-populate traineeLMPs with master syllabus for each trainee
    if (trainees.length > 0 && traineeLMPs.size === 0) {
      console.log('📚 Initializing traineeLMPs with master syllabus for', trainees.length, 'trainees');
      
      trainees.forEach(trainee => {
        traineeLMPs.set(trainee.fullName, INITIAL_SYLLABUS_DETAILS);
      });
      
      console.log('✅ traineeLMPs initialized with', traineeLMPs.size, 'entries');
      // Don't save traineeLMPs to localStorage - too large, always fetch from API or use master syllabus
    }
    
    return {
      instructors,
      trainees,
      events,
      scores: localScores,
      pt051Assessments,
      courses,
      courseColors,
      archivedCourses,
      coursePriorities,
      coursePercentages,
      traineeLMPs,
    };
  }

  // Auto-generate courseColors based on trainee courses
  if (trainees.length > 0 && Object.keys(courseColors).length === 0) {
    const uniqueCourses = [...new Set(trainees.map(t => t.course).filter(c => c))];
    const predefinedColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8B500', '#00CED1', '#FF69B4', '#32CD32',
      '#FF6347', '#40E0D0', '#9370DB', '#20B2AA'
    ];
    
    courseColors = {};
    uniqueCourses.forEach((course, index) => {
      courseColors[course] = predefinedColors[index % predefinedColors.length];
    });
    
    console.log('🎨 Auto-generated courseColors:', courseColors);
    try {
      saveToStorage(STORAGE_KEYS.COURSE_COLORS, courseColors);
    } catch (error) {
      console.warn('Failed to save courseColors to localStorage (continuing anyway):', error);
    }
  }

  // Note: The auto-generation of courseColors and traineeLMPs is now handled
  // in each return path separately to ensure they're properly initialized
  
  // This code should never be reached, but return empty data as safety fallback
  console.warn('⚠️ initializeData reached end without returning data, returning empty data');
  return {
    instructors: [],
    trainees: [],
    events: [],
    scores: new Map(),
    pt051Assessments,
    courses: [],
    courseColors: {},
    archivedCourses: {},
    coursePriorities: [],
    coursePercentages: new Map(),
    traineeLMPs: new Map(),
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