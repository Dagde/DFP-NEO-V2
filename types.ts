



export type ExpiryRuleType = 'ROLLING_WINDOW' | 'LAST_EVENT_PLUS_PERIOD';
export type ExpiryCalculation = 'EARLIEST_CHILD' | 'LATEST_CHILD';
export type LogicOperator = 'AND' | 'OR';

export interface LogicNode {
  operator: LogicOperator;
  children: (string | LogicNode)[]; // Array of currency IDs or nested LogicNodes
}

export interface CurrencyRequirement {
  id: string;
  name: string;
  description: string;
  type: 'primitive';
  isVisible: boolean;
  validityDays: number;
  eventCodes: string[]; // syllabus codes that satisfy this
  requiredCount: number; // e.g., 3 for "3 approaches in 90 days"
  expiryRule: ExpiryRuleType;
}

export interface MasterCurrency {
  id: string;
  name: string;
  description: string;
  type: 'composite';
  isVisible: boolean;
  logicTree: LogicNode;
  expiryCalculation: ExpiryCalculation;
}

export type CurrencyDefinition = MasterCurrency | CurrencyRequirement;

export interface Course {
  name: string;
  color: string;
  startDate: string;
  gradDate: string;
  raafStart: number;
  navyStart: number;
  armyStart: number;
}

export type InstructorRank = 'WGCDR' | 'SQNLDR' | 'FLTLT' | 'FLGOFF' | 'PLTOFF' | 'Mr';
export type TraineeRank = 'OCDT' | 'MIDN' | 'PLTOFF' | 'FLGOFF' | 'SBLT' | '2LT' | 'FLTLT';

export type InstructorCategory = 'UnCat' | 'D' | 'C' | 'B' | 'A';
export type SeatConfig = 'Normal' | 'FWD/SHORT' | 'REAR/SHORT' | 'FWD/LONG';

export type UnavailabilityReason = 'TMUF' | 'TMUF - Ground Duties only' | 'Leave' | 'Appointment' | 'Other';

export interface UnavailabilityPeriod {
  id: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  reason: UnavailabilityReason;
  notes?: string;
}

export interface PersonCurrencyStatus {
  currencyName: string; // This will now map to the ID of a MasterCurrency or CurrencyRequirement
  lastEventDate: string; // For manual overrides or legacy data
  calculatedExpiry?: string;
  isCurrent?: boolean;
}

export interface LogbookExperience {
  day: {
    p1: number;
    p2: number;
    dual: number;
  };
  night: {
    p1: number;
    p2: number;
    dual: number;
  };
  total: number;
  captain: number;
  instructor: number;
  instrument: {
    sim: number;
    actual: number;
  };
  simulator: {
    p1: number;
    p2: number;
    dual: number;
    total: number;
  };
}

export interface Instructor {
  idNumber: number;
  name: string;
  rank: InstructorRank;
  role: 'QFI' | 'SIM IP';
  callsignNumber: number;
  service?: 'RAAF' | 'RAN' | 'ARA';
  category: InstructorCategory;
  isTestingOfficer: boolean;
  seatConfig: SeatConfig;
  isExecutive: boolean;
  isFlyingSupervisor: boolean;
  isIRE: boolean;
  isCommandingOfficer?: boolean;
  isCFI?: boolean;
  isDeputyFlightCommander?: boolean;
  isContractor?: boolean;
  isAdminStaff?: boolean;
  isQFI?: boolean;
  isOFI?: boolean;
  unavailability: UnavailabilityPeriod[];
  currencyStatus?: PersonCurrencyStatus[];
  location?: string;
  unit?: string;
  flight?: string;
  phoneNumber?: string;
  email?: string;
  permissions?: string[];
  priorExperience?: LogbookExperience;
}

export interface ScheduleEvent {
  id: string;
  date: string;
  type: 'flight' | 'ftd' | 'ground' | 'cpt' | 'deployment';
  instructor?: string;
  student?: string;
  pilot?: string;
  crew?: string; // Second pilot for SCT events (not PIC)
  group?: string;
  groupTraineeIds?: number[];
  flightNumber: string;
  duration: number;
  startTime: number;
  resourceId: string;
  color: string;
  flightType: 'Dual' | 'Solo';
  locationType: 'Local' | 'Land Away';
  origin: string;
  destination: string;
  area?: string;
  formationId?: string;
  formationType?: string;
  formationPosition?: number;
  callsign?: string;
  attendees?: string[];
  isUnavailabilityConflict?: boolean;
  authNotes?: string;
  authoSignedBy?: string;
  authoSignedAt?: string;
  captainSignedBy?: string;
  captainSignedAt?: string;
  isVerbalAuth?: boolean;
  preStart?: number;
  postEnd?: number;
  landTime?: number;
  isTimeFixed?: boolean;
  isDeploy?: boolean;
  
    // Deployment Period fields
    deploymentStartDate?: string;
    deploymentStartTime?: string;
    deploymentEndDate?: string;
    deploymentEndTime?: string;
    deploymentAircraftCount?: number;
      
      // Event Category field (for progressive display)
      eventCategory?: 'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di';
      
      // Additional fields for enhanced priority events display
      dateCreated?: string;
      notes?: string;
      isSctRequest?: boolean;
      sctRequestId?: string;
      sctRequestType?: 'flight' | 'ftd';
      isRemedialForceSchedule?: boolean;
      traineeId?: number;
      eventCode?: string;
      
      // Cancellation fields
      isCancelled?: boolean;
      cancellationCode?: string;
      cancellationManualEntry?: string; // For OTHER option
      cancelledBy?: string;
      cancelledAt?: string;
}

export interface EventSegment extends ScheduleEvent {
  segmentStartTime: number;
  segmentDuration: number;
  segmentType: 'start' | 'end' | 'middle' | 'full';
}

export interface SyllabusItemDetail {
  id: string;
  code: string;
  phase: string;
  module: string;
  dayNight: 'Day' | 'Night' | 'Day/Night'; // NEW: Day/Night classification
  eventDescription: string;
  prerequisites: string[];
  prerequisitesGround: string[];
  prerequisitesFlying: string[];
  eventDetailsCommon: string[];
  eventDetailsSortie: string[];
  totalEventHours: number;
  flightOrSimHours: number;
  duration: number;
  preFlightTime: number;
  postFlightTime: number;
  type: 'Flight' | 'FTD' | 'Ground School';
  sortieType?: 'Dual' | 'Solo';
     twrDiReqd?: 'YES' | 'NO'; // NEW: TWR DI Required field
     cctOnly?: 'YES' | 'NO'; // NEW: CCT Only field
     cctOnly?: 'YES' | 'NO'; // NEW: CCT Only field
  methodOfDelivery: string[];
  methodOfAssessment: string[];
  resourcesPhysical: string[];
  resourcesHuman: string[];
  isRemedial?: boolean;
  location: string;
  courses: string[]; // Added for Master LMP filtering
  lmpType?: 'Master LMP' | 'Staff CAT'; // Added for LMP type filtering
}

export interface Trainee {
  idNumber: number;
  fullName: string;
  name: string;
  rank: TraineeRank;
  course: string;
  seatConfig: SeatConfig;
  isPaused: boolean;
  unit: string;
  flight?: string;
  service?: 'RAAF' | 'RAN' | 'ARA';
  unavailability: UnavailabilityPeriod[];
  lastEventDate?: string;
  lastFlightDate?: string;
  currencyStatus?: PersonCurrencyStatus[];
  location?: string;
  phoneNumber?: string;
  email?: string;
  primaryInstructor?: string;
  secondaryInstructor?: string;
  lmpType?: string;
  
     traineeCallsign?: string;
  permissions?: string[];
  priorExperience?: LogbookExperience;
}

export interface Score {
  event: string;
  score: 0 | 1 | 2 | 3 | 4 | 5;
  date: string;
  instructor: string;
  notes: string;
  details: {
    criteria: string;
    score: number;
    comment: string;
  }[];
}

export type Pt051Grade = 'MIN' | 'DEMO' | 0 | 1 | 2 | 3 | 4 | 5;
export type Pt051OverallGrade = 'No Grade' | 0 | 1 | 2 | 3 | 4 | 5;

export interface Pt051Assessment {
  id: string;
  traineeFullName: string;
  eventId: string;
  flightNumber: string;
  date: string;
  instructorName: string;
  overallGrade: Pt051OverallGrade | null;
  overallResult: 'P' | 'F' | null;
  dcoResult?: 'DCO' | 'DPCO' | 'DNCO' | '';
  overallComments?: string;
  // Add timing fields to preserve time data
  startTime?: number; // in hours (e.g., 9.5 for 9:30)
  duration?: number;  // in hours
  endTime?: number;   // in hours
  scores: {
    element: string;
    grade: Pt051Grade | null;
    comment: string;
  }[];
  isCompleted?: boolean; // Track if PT-051 has been edited and saved
  // Ground School Assessment
  groundSchoolAssessment?: {
    isAssessment: boolean;
    result?: number; // percentage (0-100)
  };
}

export interface Conflict {
  conflictingEvent: ScheduleEvent;
  newEvent: ScheduleEvent;
  conflictedPerson: 'instructor' | 'trainee';
  personName: string;
}

export interface PersonnelConflict {
  event1: ScheduleEvent;
  event2: ScheduleEvent;
}

export interface NeoProblemTile {
  event: ScheduleEvent;
  errors: string[];
}

export interface NeoInstructorOption {
  name: string;
  rank: InstructorRank;
  dutyHours: number;
  flightsToday: number;
  ftdsToday: number;
  cptsToday: number;
  groundToday: number;
}

export interface NeoInstructorRemedy {
  type: 'instructor';
  instructor: NeoInstructorOption;
}

export interface NeoTimeShiftRemedy {
  type: 'timeshift';
  newStartTime: number;
  instructor: NeoInstructorOption;
}

export interface NeoTraineeOption {
  name: string;
  rank: TraineeRank;
  course: string;
  daysSinceLastFlight: number;
  flightsToday: number;
  ftdsToday: number;
  cptsToday: number;
  groundToday: number;
}

export interface NeoTraineeRemedy {
  type: 'trainee';
  trainee: NeoTraineeOption;
}

export type NeoRemedy = NeoInstructorRemedy | NeoTimeShiftRemedy | NeoTraineeRemedy;

export interface PhraseBank {
  [dimension: string]: {
    [grade: number]: string[];
  };
}

export interface EventLimits {
  exec: {
    maxFlightFtd: number;
    maxDutySup: number;
    maxTotal: number;
  };
  instructor: {
    maxFlightFtd: number;
    maxDutySup: number; // For Flying Supervisor role
    maxTotal: number;
  };
  trainee: {
    maxFlightFtd: number;
    maxTotal: number;
  };
  simIp: {
    maxFtd: number;
    maxTotal: number;
  };
}

export interface SctRequest {
    id: string;
    name: string;
    event: string;
    flightType: 'Solo' | 'Dual';
    currency: string;
    currencyExpire: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
    dateRequested?: string;
    requestedTime?: string; // Format: "HH:MM" (e.g., "15:00")
}

export type PermissionRole = 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor';

export interface PagePermissions {
    pageName: string;
    allowedRoles: PermissionRole[];
}

export interface PermissionsConfig {
    pages: PagePermissions[];
}

export interface RemedialRequest {
    traineeId: number;
    eventCode: string;
    forceSchedule?: boolean;
}

// Oracle Feature Types
export interface OracleAnalysisResult {
    instructors: OracleInstructorAnalysis[];
    trainees: OracleTraineeAnalysis[];
}

export interface OracleInstructorAnalysis {
    instructor: Instructor;
    availableWindows: { start: number; end: number }[];
}

export interface OracleTraineeAnalysis {
    trainee: Trainee;
    availableWindows: { start: number; end: number }[];
    nextSyllabusEvent: SyllabusItemDetail | null;
    isEligible: boolean;
}
   // Formation Callsign Types
   export interface FormationCallsign {
       name: string;           // Full name (e.g., "Avon")
       code: string;           // Short code (e.g., "AVON")
       unit: string;           // Unit name (e.g., "1FTS")
       location: string;       // Location name (e.g., "East Sale")
       locationCode: string;   // Location code (e.g., "ESL")
   }

// AC History Types
export type CancellationCodeCategory = 'Aircraft' | 'Crew' | 'Program' | 'Weather';
export type CancellationCodeAppliesTo = 'Flight' | 'FTD' | 'Both';

export interface CancellationCode {
  code: string;
  category: CancellationCodeCategory;
  description: string;
  appliesTo: CancellationCodeAppliesTo;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface CancellationRecord {
  eventId: string;
  cancellationCode: string;
  cancelledBy: string;
  cancelledAt: string;
  manualCodeEntry?: string; // For OTHER option
  eventDate: string;
  eventType: 'flight' | 'ftd';
  resourceType: string; // Aircraft, FTD, etc.
}

export interface CancellationAnalytics {
  code: string;
  category: CancellationCodeCategory;
  description: string;
  totalCount: number;
  percentage: number;
  trend: number; // Positive = increase, negative = decrease
  previousCount: number;
}

export type TimePeriod = 'week' | 'month' | '6months' | 'year' | '2years' | '5years' | 'lastFY' | 'lastCY';
