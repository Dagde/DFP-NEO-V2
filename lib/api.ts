import { Instructor, Trainee, Aircraft, ScheduleEvent } from '../types';

// API Base URL
const API_BASE = '/api';

// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PersonnelResponse {
  id: string;
  userId: string;
  role: string;
  firstName: string;
  lastName: string;
  rank?: string;
  callsignNumber?: number;
  callsignPrefix?: string;
  unit?: string;
  qualificationStatus?: string;
  isAvailable?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AircraftResponse {
  id: string;
  aircraftNumber: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to convert API personnel to Instructor/Trainee format
const convertPersonnelToInstructor = (p: PersonnelResponse): Instructor => ({
  id: p.id,
  name: `${p.rank} ${p.lastName}`,
  rank: p.rank || '',
  unit: p.unit || '',
  callsign: p.callsignNumber && p.callsignPrefix 
    ? `${p.callsignPrefix} ${String(p.callsignNumber).padStart(3, '0')}`
    : '',
  isAvailable: p.isAvailable ?? true,
});

const convertPersonnelToTrainee = (p: PersonnelResponse): Trainee => ({
  id: p.id,
  fullName: `${p.rank} ${p.lastName}`,
  rank: p.rank as TraineeRank,
  unit: p.unit || '',
  traineeCallsign: p.callsignNumber && p.callsignPrefix
    ? `${p.callsignPrefix} ${String(p.callsignNumber).padStart(3, '0')}`
    : '',
  isAvailable: p.isAvailable ?? true,
});

const convertAircraft = (a: AircraftResponse): Aircraft => ({
  id: a.id,
  aircraftNumber: a.aircraftNumber,
  type: a.type,
  status: a.status,
});

// Fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error(`API fetch error for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Personnel API
export async function fetchInstructors(): Promise<Instructor[]> {
  const result = await fetchAPI<PersonnelResponse[]>('/personnel?role=INSTRUCTOR');
  if (result.success && result.data) {
    return result.data.map(convertPersonnelToInstructor);
  }
  console.error('Failed to fetch instructors:', result.error);
  return [];
}

export async function fetchTrainees(): Promise<Trainee[]> {
  const result = await fetchAPI<PersonnelResponse[]>('/personnel?role=PILOT,TRAINEE');
  if (result.success && result.data) {
    return result.data.map(convertPersonnelToTrainee);
  }
  console.error('Failed to fetch trainees:', result.error);
  return [];
}

export async function fetchAllPersonnel(): Promise<PersonnelResponse[]> {
  const result = await fetchAPI<PersonnelResponse[]>('/personnel');
  if (result.success && result.data) {
    return result.data;
  }
  console.error('Failed to fetch personnel:', result.error);
  return [];
}

// Aircraft API
export async function fetchAircraft(): Promise<Aircraft[]> {
  const result = await fetchAPI<AircraftResponse[]>('/aircraft');
  if (result.success && result.data) {
    return result.data.map(convertAircraft);
  }
  console.error('Failed to fetch aircraft:', result.error);
  return [];
}

// Schedule API
export async function fetchSchedule(date?: string): Promise<ScheduleEvent[]> {
  const endpoint = date ? `/schedule?date=${date}` : '/schedule';
  const result = await fetchAPI<ScheduleEvent[]>(endpoint);
  if (result.success && result.data) {
    return result.data;
  }
  console.error('Failed to fetch schedule:', result.error);
  return [];
}

export async function saveSchedule(schedule: ScheduleEvent[]): Promise<boolean> {
  const result = await fetchAPI<ScheduleEvent[]>('/schedule', {
    method: 'POST',
    body: JSON.stringify(schedule),
  });
  if (result.success) {
    return true;
  }
  console.error('Failed to save schedule:', result.error);
  return false;
}

// Unavailability API
export interface UnavailabilityRecord {
  id: string;
  personnelId: string;
  startDate: string;
  endDate: string;
  reason: string;
  notes?: string;
}

export async function fetchUnavailability(personnelId?: string): Promise<UnavailabilityRecord[]> {
  const endpoint = personnelId 
    ? `/unavailability?personnelId=${personnelId}`
    : '/unavailability';
  const result = await fetchAPI<UnavailabilityRecord[]>(endpoint);
  if (result.success && result.data) {
    return result.data;
  }
  console.error('Failed to fetch unavailability:', result.error);
  return [];
}

export async function createUnavailability(record: Omit<UnavailabilityRecord, 'id'>): Promise<boolean> {
  const result = await fetchAPI<UnavailabilityRecord>('/unavailability', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  if (result.success) {
    return true;
  }
  console.error('Failed to create unavailability:', result.error);
  return false;
}

export async function updateUnavailability(
  id: string, 
  updates: Partial<UnavailabilityRecord>
): Promise<boolean> {
  const result = await fetchAPI<UnavailabilityRecord>(`/unavailability/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  if (result.success) {
    return true;
  }
  console.error('Failed to update unavailability:', result.error);
  return false;
}