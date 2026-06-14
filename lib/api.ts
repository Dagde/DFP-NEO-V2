// API Client for fetching data from backend
// Uses plain objects (NOT Maps) for React compatibility

// API base URL - relative to the Next.js platform (same origin when served as iframe)
const API_BASE = '/api';

interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<FetchResult<T>> {
  try {
    const url = `${API_BASE}${endpoint}`;
    console.log('🌐 API Request:', url);
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ API Response:', url, data);
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ API Error:', endpoint, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Fetch instructors from API (fetches ALL personnel, filtering happens in mergeInstructorData)
export async function fetchInstructors(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel');
  if (result.success && result.data?.personnel) {
    // Extract qualifications.currencyStatus into top-level currencyStatus
    // so that in-memory instructor objects always have currencyStatus available
    // (the DB stores it nested inside the qualifications JSON field)
    return result.data.personnel.map((p: any) => {
      const preferences = p.preferences && typeof p.preferences === 'object' && !Array.isArray(p.preferences)
        ? p.preferences
        : {};
      return {
        ...p,
        callsign: p.callsign || preferences.callsign || '',
        secondaryCallsign: p.secondaryCallsign || preferences.secondaryCallsign || '',
        crew: p.crew || preferences.crew || '',
        currencyStatus: p.qualifications?.currencyStatus || p.currencyStatus || [],
      };
    });
  }
  return [];
}

// Fetch trainees from API
export async function fetchTrainees(): Promise<any[]> {
  const result = await fetchAPI<{ trainees: any[] }>('/trainees');
  if (result.success && result.data?.trainees) {
    return result.data.trainees;
  }
  return [];
}

// Fetch aircraft from API
export async function fetchAircraft(): Promise<any[]> {
  const result = await fetchAPI<{ aircraft: any[] }>('/aircraft');
  if (result.success && result.data?.aircraft) {
    return result.data.aircraft;
  }
  return [];
}

// Fetch scores from API - returns plain object keyed by trainee fullName
export async function fetchScores(): Promise<Record<string, any[]>> {
  const result = await fetchAPI<{ scores: [string, any[]][] }>('/scores');
  if (result.success && result.data?.scores) {
    // Convert array of entries to plain object.
    // Normalize asterisk event codes (e.g. 'BIF FTD1*' -> 'BIF FTD1') so they
    // match syllabus item codes in TraineeLmpView and computeNextEventsForTrainee.
    const scoresObj: Record<string, any[]> = {};
    result.data.scores.forEach(([fullName, scores]) => {
      const normalized = scores.map((s: any) => ({
        ...s,
        event: typeof s.event === 'string' ? s.event.replace('*', '') : s.event,
      }));
      // Apply BIF FTD dependency rules so BIF FTD1/BIF FTD3 always show as
      // complete when their trigger events are done, even without lmp-sync:
      // Rule 1: BIF FTD2 complete -> BIF FTD1 complete
      // Rule 2: BIF1 complete    -> BIF FTD3 complete
      const eventIds = normalized.map((s: any) => s.event as string);
      if (eventIds.includes('BIF FTD2') && !eventIds.includes('BIF FTD1')) {
        normalized.push({ event: 'BIF FTD1', score: 3, date: '', instructor: '', notes: '', details: [] });
      }
      if (eventIds.includes('BIF1') && !eventIds.includes('BIF FTD3')) {
        normalized.push({ event: 'BIF FTD3', score: 3, date: '', instructor: '', notes: '', details: [] });
      }
      scoresObj[fullName] = normalized;
    });
    return scoresObj;
  }
  return {};
}

// Bulk migrate personnel (mock staff) to database
export async function migratePersonnelToDatabase(personnelList: any[]): Promise<{
  success: boolean;
  inserted?: number;
  skipped?: number;
  errors?: { name: string; error: string }[];
  error?: string;
}> {
  const result = await fetchAPI<{ success: boolean; inserted: number; skipped: number; errors?: any[] }>(
    '/personnel/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ personnel: personnelList }),
    }
  );
  if (result.success && result.data) {
    return result.data;
  }
  return { success: false, error: result.error || 'Migration failed' };
}

// Fetch courses from API
export async function fetchCourses(): Promise<any[]> {
  const result = await fetchAPI<{ courses: any[] }>('/courses');
  if (result.success && result.data?.courses) {
    return result.data.courses;
  }
  return [];
}

// Save a course to the database
export async function saveCourse(course: any): Promise<{ success: boolean; error?: string }> {
  const result = await fetchAPI<{ success: boolean }>('/courses', {
    method: 'POST',
    body: JSON.stringify(course),
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}

// Delete a course from the database
export async function deleteCourse(name: string): Promise<{ success: boolean; error?: string }> {
  const result = await fetchAPI<{ success: boolean }>(`/courses/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}

// Fetch schedule from API
export async function fetchSchedule(startDate?: string, endDate?: string): Promise<any[]> {
  let endpoint = '/schedule';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) endpoint += `?${params.toString()}`;
  
  const result = await fetchAPI<{ schedules: any[] }>(endpoint);
  if (result.success && result.data?.schedules) {
    return result.data.schedules;
  }
  return [];
}
