// API Client for fetching data from backend
// Uses plain objects (NOT Maps) for React compatibility

// API base URL - can be configured via environment variable for cross-origin deployments
// Default: '/api' for same-origin (Next.js serves frontend at /flight-school-app/)
// Set VITE_API_BASE_URL for cross-origin (e.g., 'https://api.example.com/api')
const getApiBase = (): string => {
  // Check for environment variable (injected at build time)
  const envApiBase = (window as any).VITE_API_BASE_URL || (window as any).DFP_API_BASE;
  if (envApiBase) {
    console.log('🌐 API Base URL from environment:', envApiBase);
    return envApiBase;
  }
  
  // Check for current origin - if we're on the Railway backend, use relative
  const currentOrigin = window.location.origin;
  const railwayBackend = 'https://dfp-neo-v2-production.up.railway.app';
  
  if (currentOrigin === railwayBackend || currentOrigin.includes('railway.app')) {
    console.log('🌐 API Base URL: relative (same origin as backend)');
    return '/api';
  }
  
  // If accessing from different origin, use the Railway backend URL
  console.log('🌐 API Base URL: absolute (cross-origin to Railway backend)');
  return `${railwayBackend}/api`;
};

const API_BASE = getApiBase();

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
    return result.data.personnel;
  }
  return [];
}

// Fetch trainees from API - queries the Trainee table directly
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