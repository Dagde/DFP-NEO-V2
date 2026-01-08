import { Instructor, Trainee, Aircraft, ScheduleEvent, TraineeRank, SeatConfig } from '../types';

// API Base URL
const API_BASE = '/api';

// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface InstructorResponse {
  id: string;
  userId?: string;
  name: string;
  rank?: string;
  role?: string;
  qualifications?: any;
  availability?: any;
  preferences?: any;
  isActive?: boolean;
  callsignNumber?: number;
  category?: string;
  email?: string;
  flight?: string;
  idNumber?: number;
  isAdminStaff?: boolean;
  isCFI?: boolean;
  isCommandingOfficer?: boolean;
  isContractor?: boolean;
  isDeputyFlightCommander?: boolean;
  isExecutive?: boolean;
  isFlyingSupervisor?: boolean;
  isIRE?: boolean;
  isOFI?: boolean;
  isQFI?: boolean;
  isTestingOfficer?: boolean;
  location?: string;
  permissions?: string[];
  phoneNumber?: string;
  priorExperience?: any;
  seatConfig?: string;
  service?: string;
  unavailability?: any[];
  unit?: string;
}

interface TraineeResponse {
  id: string;
  userId?: string;
  idNumber: number;
  name: string;
  fullName: string;
  rank?: string;
  service?: string;
  course?: string;
  lmpType?: string;
  traineeCallsign?: string;
  seatConfig?: string;
  isPaused?: boolean;
  unavailability?: any;
  unit?: string;
  flight?: string;
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
const convertPersonnelToInstructor = (p: InstructorResponse): Instructor => ({
  id: p.id,
  idNumber: p.idNumber || 0,
  name: p.name,
  rank: (p.rank as InstructorRank) || 'FLTLT',
  role: (p.role as 'QFI' | 'SIM IP') || 'QFI',
  callsignNumber: p.callsignNumber || 0,
  service: p.service as 'RAAF' | 'RAN' | 'ARA' || 'RAAF',
  category: (p.category as InstructorCategory) || 'UnCat',
  isTestingOfficer: p.isTestingOfficer || false,
  seatConfig: (p.seatConfig as SeatConfig) || 'Normal',
  isExecutive: p.isExecutive || false,
  isFlyingSupervisor: p.isFlyingSupervisor || false,
  isIRE: p.isIRE || false,
  isCommandingOfficer: p.isCommandingOfficer || false,
  isCFI: p.isCFI || false,
  isDeputyFlightCommander: p.isDeputyFlightCommander || false,
  isOFI: p.isOFI || false,
  isQFI: p.isQFI || false,
  isContractor: p.isContractor || false,
  isAdminStaff: p.isAdminStaff || false,
  unit: p.unit || '',
  isAvailable: true, // Default to available if no unavailability
});

const convertPersonnelToTrainee = (p: TraineeResponse): Trainee => ({
  id: p.id,
  idNumber: p.idNumber,
  fullName: p.fullName,
  name: p.name,
  rank: (p.rank as TraineeRank) || 'OCDT',
  service: p.service,
  course: p.course || '',
  lmpType: (p.lmpType as any) || 'BPC+IPC',
  traineeCallsign: p.traineeCallsign || '',
  seatConfig: (p.seatConfig as SeatConfig) || 'Normal',
  isPaused: p.isPaused || false,
  unit: p.unit || '',
  flight: p.flight || '',
  isAvailable: true, // Default to available if no unavailability
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
  const url = `${API_BASE}${endpoint}`;
  
  console.log(`🌐 API Request: ${url}`, {
    method: options?.method || 'GET',
    headers: options?.headers
  });
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ API Response: ${url}`, {
      status: response.status,
      dataKeys: Object.keys(data),
      dataType: typeof data
    });
    return { success: true, data };
  } catch (error) {
    console.error(`❌ API fetch error for ${endpoint}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Personnel API
export async function fetchInstructors(): Promise<Instructor[]> {
  console.log('🔍 Fetching instructors from /personnel?role=INSTRUCTOR');
  const result = await fetchAPI<{ personnel: InstructorResponse[] }>('/personnel?role=INSTRUCTOR');
  
  console.log('📥 Instructors API response:', {
    success: result.success,
    hasData: !!result.data,
    dataKeys: result.data ? Object.keys(result.data) : [],
    personnelCount: result.data?.personnel?.length || 0,
    error: result.error
  });
  
  if (result.success && result.data?.personnel) {
    const converted = result.data.personnel.map(convertPersonnelToInstructor);
    console.log('✅ Converted instructors:', {
      originalCount: result.data.personnel.length,
      convertedCount: converted.length,
      sample: converted.slice(0, 2)
    });
    return converted;
  }
  console.error('❌ Failed to fetch instructors:', result.error);
  return [];
}

export async function fetchTrainees(): Promise<Trainee[]> {
  console.log('🔍 Fetching trainees from /personnel?role=TRAINEE');
  const result = await fetchAPI<{ personnel: TraineeResponse[] }>('/personnel?role=TRAINEE');
  
  console.log('📥 Trainees API response:', {
    success: result.success,
    hasData: !!result.data,
    dataKeys: result.data ? Object.keys(result.data) : [],
    personnelCount: result.data?.personnel?.length || 0,
    error: result.error
  });
  
  if (result.success && result.data?.personnel) {
    const converted = result.data.personnel.map(convertPersonnelToTrainee);
    console.log('✅ Converted trainees:', {
      originalCount: result.data.personnel.length,
      convertedCount: converted.length,
      sample: converted.slice(0, 2)
    });
    return converted;
  }
  console.error('❌ Failed to fetch trainees:', result.error);
  return [];
}

export async function fetchAllPersonnel(): Promise<any[]> {
  const result = await fetchAPI<{ personnel: any[] }>('/personnel');
  if (result.success && result.data?.personnel) {
    return result.data.personnel;
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
  const result = await fetchAPI<{ schedules: ScheduleEvent[] }>(endpoint);
  if (result.success && result.data?.schedules) {
    return result.data.schedules;
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
// Scores API
export interface Score {
  id: string;
  traineeId: string;
  trainee?: string;
  event: string;
  score: number;
  date: string;
  instructor: string;
  notes?: string;
  details?: any;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchScores(traineeId?: string, traineeFullName?: string): Promise<Map<string, Score[]>> {
  let url = '/scores';  // Note: fetchAPI already adds /api/ prefix
  const params = new URLSearchParams();
  
  if (traineeId) {
    params.append('traineeId', traineeId);
  }
  if (traineeFullName) {
    params.append('traineeFullName', traineeFullName);
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  try {
    // API returns { scores: [[traineeName, [scoreObjects]]], count: number }
    const result = await fetchAPI<{ scores: [string, Score[]][], count: number }>(url);
    if (result.success && result.data && result.data.scores) {
      // Convert [[traineeName, [scoreObjects]]] to Map<string, Score[]>
      return new Map(result.data.scores);
    }
    console.error('Failed to fetch scores:', result.error);
    return new Map();
  } catch (error) {
    console.error('Error fetching scores:', error);
    return new Map();
  }
}
