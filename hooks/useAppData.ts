import { useState, useEffect } from 'react';
import { Instructor, Trainee, ScheduleEvent, Score, Pt051Assessment, Course, SyllabusItemDetail } from '../types';
import { fetchInstructors, fetchTrainees, fetchAircraft, fetchSchedule } from '../lib/api';

interface UseAppDataResult {
  instructors: Instructor[];
  trainees: Trainee[];
  events: ScheduleEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAppData(): UseAppDataResult {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch instructors and trainees in parallel
      const [instructorsResult, traineesResult, scheduleResult] = await Promise.all([
        fetchInstructors(),
        fetchTrainees(),
        fetchSchedule(),
      ]);

      setInstructors(instructorsResult);
      setTrainees(traineesResult);
      setEvents(scheduleResult);

      if (instructorsResult.length === 0) {
        console.warn('No instructors fetched from API');
      }
      if (traineesResult.length === 0) {
        console.warn('No trainees fetched from API');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error fetching app data:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    instructors,
    trainees,
    events,
    loading,
    error,
    refetch: fetchData,
  };
}

interface UsePersistentDataResult<T> {
  data: T;
  setData: (data: T) => void;
  loading: boolean;
  error: string | null;
}

export function usePersistentData<T>(
  key: string,
  initialValue: T,
  shouldLoadFromAPI: boolean = true
): UsePersistentDataResult<T> {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(shouldLoadFromAPI);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage first (for fallback/speed)
  useEffect(() => {
    if (!shouldLoadFromAPI) {
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch (err) {
      console.error(`Error loading ${key} from localStorage:`, err);
    } finally {
      setLoading(false);
    }
  }, [key, shouldLoadFromAPI]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.error(`Error saving ${key} to localStorage:`, err);
    }
  }, [key, data]);

  return { data, setData, loading, error };
}