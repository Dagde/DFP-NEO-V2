



export type ExpiryRuleType = 'ROLLING_WINDOW' | 'LAST_EVENT_PLUS_PERIOD';
export type ExpiryCalculation = 'EARLIEST_CHILD' | 'LATEST_CHILD';
export type LogicOperator = 'AND' | 'OR';

/**
 * How a currency is entered in the Post-Flight page (can be combined — more than one allowed):
 * - 'date'     → date picker (for LAST_EVENT_PLUS_PERIOD currencies — date auto-set to flight date when checkbox ticked)
 * - 'count'    → number input (for ROLLING_WINDOW currencies — "how many did you complete today?")
 * - 'checkbox' → simple checkbox — "completed this flight" — flight/FTD date is saved as the currency date
 */
export type PostFlightInputType = 'date' | 'count' | 'checkbox';

export type CrewRequirementMode = 'aircraft_default' | 'custom';

export interface CrewRequirementRole {
  crewPositionId?: string;
  role: string;
  count: number;
  eligibleRoles?: string[];
}

export interface CrewRequirement {
  mode: CrewRequirementMode;
  roles?: CrewRequirementRole[];
}

export type StandardMissionResourceType = 'Flight' | 'FTD' | 'CPT' | 'Ground';

export interface StandardMissionRoleRequirement {
  role: string;
  count: number;
}

export interface StandardMissionProfile {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
  unitCode: string;
  compositeUnitCode: string;
  compositeProfileId: string;
  aircraftTypeCode: string;
  missionName: string;
  shortTitle: string;
  description: string;
  resourceType: StandardMissionResourceType;
  departureLocationCode: string;
  arrivalLocationCode: string;
  durationMinutes: number;
  preFlightMinutes: number;
  postFlightMinutes: number;
  isFormation: boolean;
  formationAircraft: number;
  config: string;
  crewCompositionMode: 'STANDARD' | 'ALTERNATE' | 'CUSTOM';
  selectedCrewCompositionId: string;
  acceptableCrewCompositionIds: string[];
  roleRequirements: StandardMissionRoleRequirement[];
  defaultCallsignPrefix: string;
}

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
  // Post-flight integration
  showInPostFlight?: boolean;          // Whether this currency appears on the post-flight page
  showInPostFlightRecency?: boolean;   // Whether this currency appears in the post-flight recency checklist
  postFlightInputTypes?: PostFlightInputType[]; // Which input types to show (multiple allowed)
  crewRequirement?: CrewRequirement;
}

export interface MasterCurrency {
  id: string;
  name: string;
  description: string;
  type: 'composite';
  isVisible: boolean;
  logicTree: LogicNode;
  expiryCalculation: ExpiryCalculation;
  // Post-flight integration
  showInPostFlight?: boolean;          // Whether this currency appears on the post-flight page
  showInPostFlightRecency?: boolean;   // Whether this currency appears in the post-flight recency checklist
  postFlightInputTypes?: PostFlightInputType[]; // Which input types to show (multiple allowed)
  crewRequirement?: CrewRequirement;
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
  location?: string;
  unit?: string;
  lmpType?: string;         // determines which syllabus events populate the Individual LMP (NEO Build)
  academicLmpType?: string; // determines which Academics events populate the Academic LMP tab
  status?: string;
}

export type InstructorRank = 'WGCDR' | 'SQNLDR' | 'FLTLT' | 'FLGOFF' | 'PLTOFF' | 'Mr';
export type TraineeRank = 'OCDT' | 'MIDN' | 'PLTOFF' | 'FLGOFF' | 'SBLT' | '2LT' | 'FLTLT';

export type InstructorCategory = 'UnCat' | 'D' | 'C' | 'B' | 'A';
export type SeatConfig = 'Normal' | 'FWD/SHORT' | 'REAR/SHORT' | 'FWD/LONG';

export type UnavailabilityReason = 'TMUF' | 'TMUF - Ground Duties only' | 'Leave' | 'Appointment' | 'Deployed' | 'Other';

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
  isInactive?: boolean;
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
  id?: string;           // DB primary key (cuid) — present for database-sourced records
  idNumber: number;
  name: string;
  rank: InstructorRank;
  photoUrl?: string | null;  // Profile photo — base64 data URI or https URL; null/undefined = no photo
  role: string;
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
  callsign?: string;           // Primary callsign string (e.g. "ROLR042")
  secondaryCallsign?: string;  // Secondary callsign string (e.g. "VIPR007")
  crew?: string;               // Fixed crew grouping/name for Fixed Crew Model
  preferences?: PersonnelPreferences;
}

export interface AirCombatTrainingAssignment {
  assignmentId: string;
  kind: 'course' | 'training_package';
  trainingKey: string;
  lmpType: 'Master LMP' | 'Staff CAT';
  code: string;
  title: string;
  locationCode: string;
  unitCode: string;
  operationalModel: 'air_combat';
  assignedAt: string;
  assignedBy?: string;
}

export interface AirCombatTrainingAssignments {
  courses: AirCombatTrainingAssignment[];
  trainingPackages: AirCombatTrainingAssignment[];
}

export interface AirCombatTrainingReport {
  id: string;
  reportName: string;
  staffIdNumber: number;
  staffName: string;
  locationCode?: string;
  unitCode?: string;
  trainingKey?: string;
  trainingKind?: 'course' | 'training_package';
  trainingCode?: string;
  trainingTitle?: string;
  eventId?: string;
  eventCode: string;
  eventDescription?: string;
  eventType?: string;
  date: string;
  startTime?: number;
  duration?: number;
  resourceId?: string;
  callsign?: string;
  instructorName?: string;
  dashboardAssigneeName?: string;
  overallGrade?: string;
  overallResult?: '' | 'P' | 'F';
  dcoResult?: '' | 'DCO' | 'DPCO' | 'DNCO';
  dpcoFollowUp?: {
    action: 'extra-event' | 'extra-hours-next-event' | 'continue-no-additions' | '';
    extraEventHours?: number;
    extraHours?: number;
  };
  dncoFollowUp?: {
    requestExtraFlight?: boolean;
  };
  passNotesToNextEvent?: boolean;
  assessedElementScores?: Array<{
    element: string;
    grade?: string;
    comment?: string;
  }>;
  groundSchoolAssessment?: {
    isAssessment: boolean;
    result?: string;
  };
  notes?: string;
  status?: 'Draft' | 'Complete';
  dashboardAcknowledgedAt?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface PersonnelPreferences {
  callsign?: string | null;
  secondaryCallsign?: string | null;
  qualifications?: string[];
  airCombat?: {
    trainingAssignments?: AirCombatTrainingAssignments;
    trainingReports?: AirCombatTrainingReport[];
  };
  [key: string]: any;
}

export interface StaffCallsignInfo {
  callsign: string;
  callsignPrefix: string;
  callsignNumber: number;
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
  formationSize?: number;
  crewSelectionOrder?: string[];
  callsign?: string;
  aircraftNumber?: string;
  attendees?: string[];
  isUnavailabilityConflict?: boolean;
  authNotes?: string;
  authoSignedBy?: string;
  authoSignedAt?: string;
  authoSignedOnBehalfBy?: string;
  captainSignedBy?: string;
  captainSignedAt?: string;
  captainSignedOnBehalfBy?: string;
  isVerbalAuth?: boolean;
  dualAuthSignedBy?: string;
  dualAuthSignedAt?: string;
  dualAuthSignedAnnotation?: string;
  preStart?: number;
  postEnd?: number;
  bookingOffsetsAreDuration?: boolean;
  landTime?: number;
  isTimeFixed?: boolean;
  isDeploy?: boolean;
  
    // Deployment Period fields
    deploymentStartDate?: string;
    deploymentStartTime?: string;
    deploymentEndDate?: string;
    deploymentEndTime?: string;
    deploymentAircraftCount?: number;
    deploymentSeriesId?: string;
    deploymentSource?: 'build-planner' | 'neo-assist' | 'flight-details' | string;
      
      // Event Category field (for progressive display)
      eventCategory?: 'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di' | 'currency';
      isTaskingRequest?: boolean;
      taskingRequestId?: string;
      taskingUnitCode?: string;
      taskingUnitCodes?: string[];
      taskingAircraftIndex?: number;
      taskingAircraftCount?: number;
      isMandatoryTasking?: boolean;
      taskingName?: string;
      taskingDisplayLabel?: string;
      unit?: string;
      unitCode?: string;
      fixedCrewUnit?: string;
      fixedCrewUnitCode?: string;
      
      // Additional fields for enhanced priority events display
      dateCreated?: string;
      notes?: string;
      preFlightNotes?: string;
      trainingReportForwardedNotes?: Record<string, { notes?: string; [key: string]: any }>;
      trainingReportNextEventExtensions?: Record<string, number>;
  currency?: string;
  currencyDraftId?: string;
  aircraftCount?: number;
  priority?: 'High' | 'Medium' | 'Low';
      soloOrDual?: 'Solo' | 'Dual';
      isSctRequest?: boolean;
  isAcademic?: boolean;   // Academic (theory) events — never modified or deleted by NEO Build
      academicTiles?: { lessonCode: string; label: string; startTime: number; duration: number; color: string; isStandard?: boolean }[]; // Inset lesson tiles for academic day tile
      sctRequestId?: string;
      sctRequestType?: 'flight' | 'ftd';
      isRemedialForceSchedule?: boolean;
      traineeId?: number;
      eventCode?: string;
      aircraftConfigId?: string;
      acceptableAircraftConfigs?: string[];
      crewRequirement?: CrewRequirement;
      fixedCrewGroup?: string;
      fixedCrewPic?: string;
      fixedCrewRandomCrew?: boolean;
      fixedCrewManifestStatus?: 'pending' | 'complete' | 'partial' | 'swapped' | 'invalid';
      fixedCrewManifestNotes?: string;
      
      // Cancellation fields
      isCancelled?: boolean;
      cancellationCode?: string;
  cancellationManualEntry?: string; // For OTHER option
  cancelledBy?: string;
  cancelledAt?: string;
  dayNight?: 'Day' | 'Night' | 'Day/Night';
  forcedInstructorConflict?: boolean;
  forcedInstructorConflictDetails?: string[];
}

export type FlyingWindowExclusionRestriction = 'departures' | 'arrivals' | 'both';

export interface FlyingWindowExclusionPeriod {
  id: string;
  startTime: number;
  endTime: number;
  restriction: FlyingWindowExclusionRestriction;
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
  type: 'Flight' | 'FTD' | 'Ground School' | 'Academics';
  sortieType?: 'Dual' | 'Solo';
     twrDiReqd?: 'YES' | 'NO'; // NEW: TWR DI Required field
     cctOnly?: 'YES' | 'NO'; // NEW: CCT Only field
     cctOnly?: 'YES' | 'NO'; // NEW: CCT Only field
  methodOfDelivery: string[];
  methodOfAssessment: string[];
  resourcesPhysical: string[];
  resourceNumber?: number;
  acceptableAircraftConfigs?: string[];
  assessedElements?: string[];
  assessmentRequired?: boolean;
  notes?: string;
  resourcesHuman: string[];
  crewRequirement?: CrewRequirement;
  isRemedial?: boolean;
  completedAt?: string | null;
  masterEventId?: string;
  lmpSource?: 'master' | 'remedial' | 'custom';
  orderKey?: string;
  sortOrder?: number;
  anchorAfterMasterEventId?: string;
  anchorBeforeMasterEventId?: string;
  anchorPolicy?: 'between' | 'after' | 'before' | 'fixed';
  userLockedPosition?: boolean;
  placementNeedsReview?: boolean;
  location: string;
  unit?: string;
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
  primaryInstructor?: string | string[];
  secondaryInstructor?: string | string[];
  lmpType?: string;
  academicLmpType?: string; // Academic LMP tab assignment
  
  traineeCallsign?: string;
  secondaryCallsign?: string;
  crew?: string;
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

export type Pt051NumericGrade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Pt051Grade = 'MIN' | 'DEMO' | Pt051NumericGrade;
export type Pt051OverallGrade = 'No Grade' | Pt051NumericGrade;

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
  dpcoFollowUp?: {
    action: 'extra-event' | 'extra-hours-next-event' | 'continue-no-additions' | '';
    extraEventHours?: number;
    extraHours?: number;
  };
  dncoFollowUp?: {
    requestExtraFlight?: boolean;
  };
  passNotesToNextEvent?: boolean;
  trainingReportNotes?: string;
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
    maxFlights?: number;
    maxSimulators?: number;
    maxFlightSim?: number;
    maxDutySup: number; // Maximum Duty Sup session length in hours
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
    eventCode?: string;
    flightType: 'Solo' | 'Dual';
    currency: string;
    currencyExpire: string;
    priority: 'High' | 'Medium' | 'Low';
    notes?: string;
    dateRequested?: string;
    requestedTime?: string; // Format: "HH:MM" (e.g., "15:00")
    submitted?: boolean;
    includeInBuild?: boolean; // For MEDIUM/LOW priority - user can manually include in build
    aircraftConfigId?: string;
    crewMember?: string;
    crewGroup?: string;
    crewGroupKey?: string;
    crewUnitCode?: string;
    crewDisplayLabel?: string;
    crewIndividual?: string;
    crewRequirement?: CrewRequirement;
    aircraftCount?: number;
    formationCrew?: {
      crewGroup?: string;
      crewGroupKey?: string;
      crewUnitCode?: string;
      crewDisplayLabel?: string;
      crewIndividual?: string;
    }[];
    callsignBase?: string;
    callsignNumber?: number;
    callsign?: string;
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
    aircraftConfigId?: string;
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
  eventName?: string; // Flight number or event name
  personnelAffected?: string; // Names of personnel affected
  notes?: string; // Additional notes
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
