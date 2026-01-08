import { useState, useEffect } from 'react';
import { Instructor, Trainee, ScheduleEvent, Score, Pt051Assessment, Course, SyllabusItemDetail } from '../types';
import { initializeData, saveSchedule as saveScheduleService } from '../lib/dataService';

interface AppDataWrapperProps {
  children: (data: {
    instructors: Instructor[];
    trainees: Trainee[];
    events: ScheduleEvent[];
    scores: Map<string, Score[]>;
    pt051Assessments: Map<string, Pt051Assessment>;
    courses: Course[];
    courseColors: { [key: string]: string };
    archivedCourses: { [key: string]: string };
    coursePriorities: string[];
    coursePercentages: Map<string, number>;
    traineeLMPs: Map<string, SyllabusItemDetail[]>;
    loading: boolean;
    error: string | null;
    setEvents: (events: ScheduleEvent[]) => void;
    setScores: (scores: Map<string, Score[]>) => void;
    setPt051Assessments: (assessments: Map<string, Pt051Assessment>) => void;
    setCourses: (courses: Course[]) => void;
    setCourseColors: (colors: { [key: string]: string }) => void;
    setArchivedCourses: (archived: { [key: string]: string }) => void;
    setCoursePriorities: (priorities: string[]) => void;
    setCoursePercentages: (percentages: Map<string, number>) => void;
    setTraineeLMPs: (lmps: Map<string, SyllabusItemDetail[]>) => void;
    saveSchedule: () => Promise<boolean>;
    refreshData: () => Promise<void>;
  }) => JSX.Element;
}

export default function AppDataWrapper({ children }: AppDataWrapperProps) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [scores, setScores] = useState<Map<string, Score[]>>(new Map());
  const [pt051Assessments, setPt051Assessments] = useState<Map<string, Pt051Assessment>>(new Map());
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseColors, setCourseColors] = useState<{ [key: string]: string }>({});
  const [archivedCourses, setArchivedCourses] = useState<{ [key: string]: string }>({});
  const [coursePriorities, setCoursePriorities] = useState<string[]>([]);
  const [coursePercentages, setCoursePercentages] = useState<Map<string, number>>(new Map());
  const [traineeLMPs, setTraineeLMPs] = useState<Map<string, SyllabusItemDetail[]>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await initializeData();
      setInstructors(data.instructors);
      setTrainees(data.trainees);
      setEvents(data.events);
      setScores(data.scores);
      setPt051Assessments(data.pt051Assessments);
      setCourses(data.courses);
      setCourseColors(data.courseColors);
      setArchivedCourses(data.archivedCourses);
      setCoursePriorities(data.coursePriorities);
      setCoursePercentages(data.coursePercentages);
      setTraineeLMPs(data.traineeLMPs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      console.error('Error initializing app data:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const saveSchedule = async () => {
    const success = await saveScheduleService(events);
    if (!success) {
      setError('Failed to save schedule to server');
    }
    return success;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading DFP-NEO...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <div className="bg-red-900 border border-red-500 rounded-lg p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Data</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children({
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
    loading,
    error: null,
    setEvents,
    setScores,
    setPt051Assessments,
    setCourses,
    setCourseColors,
    setArchivedCourses,
    setCoursePriorities,
    setCoursePercentages,
    setTraineeLMPs,
    saveSchedule,
    refreshData,
  });
}