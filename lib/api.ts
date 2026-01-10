// API Client for fetching data from backend
// Uses plain objects (NOT Maps) for React compatibility

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

// Fetch instructors from API
export async function fetchInstructors(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel?role=INSTRUCTOR');
  if (result.success && result.data?.personnel) {
    return result.data.personnel;
  }
  return [];
}

// Fetch trainees from API
export async function fetchTrainees(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel?role=TRAINEE');
  if (result.success && result.data?.personnel) {
    return result.data.personnel;
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
    // Convert array of entries to plain object
    const scoresObj: Record<string, any[]> = {};
    result.data.scores.forEach(([fullName, scores]) => {
      scoresObj[fullName] = scores;
    });
    return scoresObj;
  }
  return {};
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