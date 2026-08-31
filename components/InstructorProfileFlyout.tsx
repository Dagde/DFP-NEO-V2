import { useSystemFreeze } from '../hooks/useSystemFreeze';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { InstructorRank, Instructor, InstructorCategory, SeatConfig, UnavailabilityPeriod, UnavailabilityReason, Trainee, LogbookExperience, MasterCurrency, CurrencyRequirement, PersonCurrencyStatus, ScheduleEvent, SyllabusItemDetail, AirCombatTrainingAssignment, AirCombatTrainingReport, SctRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import AuditButton from './AuditButton';
import PermissionNotice from './PermissionNotice';
import { InsertEventModal, LmpEventEditModal, type InsertLmpEventRequest } from './TraineeLmpView';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';
import { verifyCurrentUserPassword } from '../utils/passwordVerification';
import CurrencyPanel from './CurrencyPanel';
import CurrencyAuditFlyout from './CurrencyAuditFlyout';
import MySctRequestsPanel from './MySctRequestsPanel';
import { showDarkAlert, showDarkConfirm, showDarkPrompt } from './DarkMessageModal';
import AccountAccessPanel from './AccountAccessPanel';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
  DEFAULT_PERSONNEL_DISPLAY_SETTINGS,
  getSimIpDisplayLabel,
  getRankOptionGroupsForGroup,
  normalisePersonnelDisplaySettings,
  type PersonnelDisplaySettings,
} from '../utils/personnelDisplaySettings';
import {
  getAssignedPlatformPermissionProfileSummary,
  getPlatformUserIdentityValuesForPerson,
  isFixedCrewLikeOperationalModel,
  normaliseOperationalModel,
  type PlatformConfig,
} from '../utils/platformConfigService';
import { normaliseAirCombatTrainingAssignments, normaliseAirCombatTrainingReports } from '../utils/airCombatTraining';
import { type InsertEventTypeConfig } from '../utils/insertEventTypes';
import { type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import {
  getCrewPositionDisplayLabel,
  getCrewPositionLabelMap,
  getCrewPositionOptions,
  type CrewPositionTerminology,
} from '../utils/crewPositionTerminology';
import {
  getQualificationsForOperationalModel,
  normaliseQualificationToken,
  normaliseAssignedQualificationIds,
  normaliseStaffQualificationCatalogue,
  qualificationMatches,
  type StaffQualificationCatalogue,
  type StaffQualificationDefinition,
} from '../utils/staffQualifications';
import { getStaffRoleDisplay } from '../utils/staffRoleColours';
import { DEFAULT_SCT_TERMINOLOGY, normaliseSctTerminology, type SctTerminology } from '../utils/sctTerminology';
import { describeDuplicateNamePerson, normalisePersonName, samePersonRecord } from '../utils/personIdentity';

type LegacyQualificationField = 'isCommandingOfficer' | 'isCFI' | 'isExecutive' | 'isFlyingSupervisor' | 'isTestingOfficer' | 'isIRE' | 'isQFI' | 'isOFI' | 'isDeputyFlightCommander' | 'isContractor' | 'isAdminStaff';

const LEGACY_QUALIFICATION_FIELD_BY_ID: Record<string, LegacyQualificationField> = {
  co: 'isCommandingOfficer',
  cfi: 'isCFI',
  executive: 'isExecutive',
  'flying-supervisor': 'isFlyingSupervisor',
  'testing-officer': 'isTestingOfficer',
  ire: 'isIRE',
  qfi: 'isQFI',
  ofi: 'isOFI',
  dfc: 'isDeputyFlightCommander',
  contractor: 'isContractor',
  'admin-staff': 'isAdminStaff',
};

const isContractorStaffRoleValue = (value?: string | null): boolean => (
  ['SIM IP', 'CONTRACTOR STAFF'].includes(String(value || '').trim().toUpperCase().replace(/[\s-]+/g, ' '))
);

const isLegacyInstructorRoleValue = (value?: string | null): boolean => {
  const token = String(value || '').trim().toUpperCase();
  return token === 'QFI' || token === 'INSTRUCTOR';
};

const getEditableStaffRole = (
  value: string | undefined,
  operationalModel: unknown,
  terminology?: CrewPositionTerminology,
): string => {
  if (!isLegacyInstructorRoleValue(value)) return String(value || '').trim();
  return getCrewPositionOptions(terminology, [], operationalModel)[0] || 'Pilot';
};

interface InstructorProfileFlyoutProps {
  instructor: Instructor;
  onClose: () => void;
  school: string;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  onUpdateInstructor: (data: Instructor) => void | Promise<void>;
  onNavigateToCurrency: (person: Instructor) => void;
  originRect: DOMRect | null;
  isClosing: boolean;
  isCreating?: boolean;
  locations: string[];
  units: string[];
  instructorsData?: Instructor[];
  traineesData: Trainee[];
  events?: ScheduleEvent[];
  scheduleHistoryEvents?: ScheduleEvent[];
  syllabusDetails?: SyllabusItemDetail[];
  insertEventTypes?: InsertEventTypeConfig[];
  aircraftConfigurations?: AircraftConfigurationDefinition[];
  onInsertAirCombatTrainingEvent?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    sequenceItems: SyllabusItemDetail[],
    request: InsertLmpEventRequest,
  ) => Promise<boolean> | boolean;
  onUpdateAirCombatTrainingEvent?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    originalItem: SyllabusItemDetail,
    updatedItem: SyllabusItemDetail,
  ) => Promise<boolean> | boolean;
  onGenerateAirCombatTrainingReport?: (
    staff: Instructor,
    assignment: AirCombatTrainingAssignment,
    item: SyllabusItemDetail,
  ) => Promise<void> | void;
  onAddTrainingReport?: (staff: Instructor) => void;
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: (instructor: Instructor) => void;
  sctRequests?: SctRequest[];
  onPatchSctRequest?: (id: string, updates: Partial<SctRequest>, type: 'flight' | 'ftd') => void | Promise<void>;
  onCancelSctRequest?: (id: string, type: 'flight' | 'ftd') => void | Promise<void>;
  onNavigateToTrainee?: (trainee: Trainee) => void;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  profileInitialTab?: 'currency' | 'trainingReports' | null;
  onProfileTabConsumed?: () => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserRole?: string;
  resourceDisplayNames?: ResourceDisplayNames;
  instructorLabel?: string;
  personnelDisplaySettings?: Partial<PersonnelDisplaySettings> | null;
  operationalModel?: string;
  platformConfig?: PlatformConfig | null;
  crewPositionTerminology?: CrewPositionTerminology;
  staffQualificationCatalogue?: StaffQualificationCatalogue;
  sctTerminology?: SctTerminology;
  trainingReportDisplayName?: string;
  trainingReportStatusFieldLabel?: string;
  canUsePlatformPermission?: (permissionId: string) => boolean;
}

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; type?: string }> = ({ label, value, onChange, readOnly, type = 'text' }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} readOnly={readOnly}
      className={`block w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
  </div>
);

const Dropdown: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }> = ({ label, value, onChange, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
    <select value={value} onChange={onChange}
      className="block w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500">
      {children}
    </select>
  </div>
);

const AIR_COMBAT_LINKED_EVENT_NOTE_REGEX = /^\[Linked Event:\s*([^\]]+)\]$/i;

const getAirCombatLinkedEventCode = (item?: Partial<SyllabusItemDetail> | null): string => {
  const notes = String(item?.notes || '');
  const linkedLine = notes
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => AIR_COMBAT_LINKED_EVENT_NOTE_REGEX.test(line));
  const match = linkedLine?.match(AIR_COMBAT_LINKED_EVENT_NOTE_REGEX);
  return match?.[1]?.trim() || '';
};

const getAirCombatDisplayNotes = (item?: Partial<SyllabusItemDetail> | null): string => {
  const visibleNotes = String(item?.notes || '')
    .split(/\r?\n/)
    .filter(line => !AIR_COMBAT_LINKED_EVENT_NOTE_REGEX.test(line.trim()))
    .join('\n')
    .trim();
  return visibleNotes || 'Nil';
};

const withAirCombatLinkedEventNote = (item: SyllabusItemDetail, linkedEventCode: string): SyllabusItemDetail => {
  const visibleNotes = String(item.notes || '')
    .split(/\r?\n/)
    .filter(line => !AIR_COMBAT_LINKED_EVENT_NOTE_REGEX.test(line.trim()))
    .join('\n')
    .trim();
  const normalizedLinkedEvent = linkedEventCode && linkedEventCode !== 'none' ? linkedEventCode : '';
  const notes = [visibleNotes, normalizedLinkedEvent ? `[Linked Event: ${normalizedLinkedEvent}]` : '']
    .filter(Boolean)
    .join('\n')
    .trim();
  return {
    ...item,
    notes: notes || undefined,
  };
};

const getLocalLogbookMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getProfileLogbookMonth = (person: any): string => {
  const archiveDate = String(person?._archiveDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(archiveDate)) return archiveDate.slice(0, 7);
  return getLocalLogbookMonth();
};

const ExperienceInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex flex-col items-center">
    <label className="text-xs text-gray-400 mb-1">{label}</label>
    <input type="number" min="0" step="0.1" value={value} onFocus={(e) => e.target.select()}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-16 bg-gray-700 border border-gray-600 rounded py-1 px-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
  </div>
);

const CircularGauge: React.FC<{ title: string; mainValue: number; subItems: { label: string; value: number }[]; borderColor?: string }> = ({ title, mainValue, subItems, borderColor }) => {
  const strokeColor = borderColor === 'border-purple-500/60' ? '#a855f7' : '#4b5563';
  return (
  <div className="flex flex-col items-center bg-[#1a2a3a] border border-gray-500/50 rounded-lg p-3 flex-1 shadow-md" style={{boxShadow:'0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)'}}>
    <span className="text-xs text-gray-300 font-semibold mb-2">{title}</span>
    <div className="relative flex items-center justify-center mb-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="32" cy="32" r="26" fill="none" stroke={strokeColor} strokeWidth="6"
          strokeDasharray={`${Math.min(mainValue / 100 * 163, 163)} 163`}
          strokeLinecap="round" transform="rotate(-90 32 32)" />
        <circle cx="32" cy="56" r="3" fill="#ef4444" />
      </svg>
      <span className="absolute text-white font-bold text-sm">{mainValue.toFixed(1)}</span>
    </div>
    <div className="w-full space-y-0.5">
      {subItems.map(item => (
        <div key={item.label} className="flex justify-between text-xs">
          <span className="text-gray-400">{item.label}</span>
          <span className="text-white font-mono">{item.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  </div>
  );
};

const InstrumentGauge: React.FC<{ sim: number; actual: number }> = ({ sim, actual }) => (
  <div className="flex flex-col items-center bg-[#1a2a3a] border border-gray-500/50 rounded-lg p-3 flex-1 shadow-md" style={{boxShadow:'0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)'}}>
    <span className="text-xs text-gray-300 font-semibold mb-2">Instrument</span>
    <div className="relative flex items-center justify-center mb-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="32" cy="56" r="3" fill="#ef4444" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-gray-400 text-[9px]">Sim</span>
        <span className="text-white font-bold text-xs">{sim.toFixed(1)}</span>
      </div>
    </div>
    <div className="w-full space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">Actual</span>
        <span className="text-white font-mono">{actual.toFixed(1)}</span>
      </div>
    </div>
  </div>
);

// Returns "dd Mmm" e.g. "12 Apr"
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${day} ${month}`;
};

const initialExperience: LogbookExperience = {
  day: { p1: 0, p2: 0, dual: 0 },
  night: { p1: 0, p2: 0, dual: 0 },
  total: 0, captain: 0, instructor: 0,
  instrument: { sim: 0, actual: 0 },
  simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
};

// Shared 3D card style
const card3d = "rounded-lg border border-gray-500/60 shadow-md";
const card3dStyle = { background: 'linear-gradient(180deg, #243044 0%, #1e2d42 60%)', boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' };
type StaffRole = Instructor['role'];
type StaffProfileTab = 'unavailable' | 'currency' | 'logbook' | 'sct' | 'trainingReports' | 'trainingProgress';
type AirCombatAssignment = AirCombatTrainingAssignment;

const normaliseTrainingCode = (value?: string | null): string =>
  String(value || '').replace(/\s+/g, '').trim().toUpperCase();

const formatDecimalTime = (time?: number | null): string => {
  const value = Number(time);
  if (!Number.isFinite(value)) return '----';
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
};

const getEventDateValue = (event: ScheduleEvent): number => {
  const rawDate = event.date || (event as any).eventDate || '';
  const timestamp = rawDate ? new Date(`${rawDate}T00:00:00`).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getEventPeople = (event: ScheduleEvent): string[] => {
  const rawPeople = [
    event.instructor,
    event.student,
    event.pilot,
    event.crew,
    event.fixedCrewPic,
    ...(Array.isArray(event.attendees) ? event.attendees : []),
  ];
  return rawPeople
    .flatMap(person => String(person || '').split(/[,;/]/))
    .map(person => person.trim())
    .filter(Boolean);
};

const eventIncludesStaff = (event: ScheduleEvent, staffName: string): boolean => {
  const target = staffName.trim().toLowerCase();
  return Boolean(target) && getEventPeople(event).some(person => person.toLowerCase() === target);
};

const getStaffEventRole = (event: ScheduleEvent, staffName: string): string => {
  const target = staffName.trim().toLowerCase();
  if (String(event.pilot || '').trim().toLowerCase() === target) return 'Pilot';
  if (String(event.crew || '').split(/[,;/]/).some(person => person.trim().toLowerCase() === target)) return 'Crew';
  if (String(event.fixedCrewPic || '').trim().toLowerCase() === target) return 'PIC';
  if (String(event.instructor || '').trim().toLowerCase() === target) return 'Instructor';
  if (Array.isArray(event.attendees) && event.attendees.some(person => String(person || '').trim().toLowerCase() === target)) return 'Attendee';
  return 'Staff';
};

const getLogbookEntryRoleLabel = (personRole?: string): string => {
  if (personRole === 'instructor' || personRole === 'fixed_crew_pic') return 'Captain';
  if (personRole === 'fixed_crew_p2') return 'P2';
  return 'Crew';
};

export const InstructorProfileFlyout: React.FC<InstructorProfileFlyoutProps> = ({
  instructor, onClose, school, personnelData, onUpdateInstructor,
  onNavigateToCurrency, originRect, isClosing, isCreating = false,
  locations, units, instructorsData = [], traineesData, events = [], scheduleHistoryEvents = [], syllabusDetails = [],
  insertEventTypes = [], aircraftConfigurations = [],
  onInsertAirCombatTrainingEvent, onUpdateAirCombatTrainingEvent, onGenerateAirCombatTrainingReport, onAddTrainingReport,
  onViewLogbook, onRequestSct, sctRequests = [], onPatchSctRequest, onCancelSctRequest, onNavigateToTrainee,
  masterCurrencies = [], currencyRequirements = [],
  profileInitialTab, onProfileTabConsumed,
  currentUserId, currentUserName, currentUserRole = '',
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  instructorLabel = 'Instructor',
  personnelDisplaySettings = DEFAULT_PERSONNEL_DISPLAY_SETTINGS,
  operationalModel = 'flight_school',
  platformConfig = null,
  crewPositionTerminology,
  staffQualificationCatalogue,
  sctTerminology = DEFAULT_SCT_TERMINOLOGY,
  trainingReportDisplayName = 'Training Report',
  trainingReportStatusFieldLabel = 'Mission Status',
  canUsePlatformPermission,
}) => {
  const continuationTerminology = useMemo(() => normaliseSctTerminology(sctTerminology), [sctTerminology]);
  const continuationShortLabel = continuationTerminology.shortLabel;
  const continuationLongLabel = continuationTerminology.longLabel;
  const [isEditing, setIsEditing] = useState(isCreating);
    const { isFrozen } = useSystemFreeze();
  const [showAddUnavailability, setShowAddUnavailability] = useState(false);
  const canManageAccountAccess = ['ADMIN', 'SUPER_ADMIN'].includes(String(currentUserRole || '').trim().toUpperCase());

  const [idNumber, setIdNumber] = useState(instructor.idNumber);
  const [name, setName] = useState(instructor.name);
  const [rank, setRank] = useState<InstructorRank>(instructor.rank);
  const staffRankOptionGroups = useMemo(() => {
    const configuredGroups = getRankOptionGroupsForGroup(personnelDisplaySettings || undefined, 'staff');
    const configuredRanks = configuredGroups.flatMap(group => group.options);
    const currentRank = String(rank || '').trim();
    const hasCurrentRank = Boolean(currentRank) && configuredRanks.some(option => option.toLowerCase() === currentRank.toLowerCase());
    return currentRank && !hasCurrentRank
      ? [...configuredGroups, { label: 'Current value', options: [currentRank] }]
      : configuredGroups;
  }, [personnelDisplaySettings, rank]);
  const [role, setRole] = useState<StaffRole>(() => getEditableStaffRole(instructor.role, operationalModel, crewPositionTerminology));
  const simIpDisplayLabel = useMemo(
    () => getSimIpDisplayLabel(personnelDisplaySettings),
    [personnelDisplaySettings],
  );
  const configuredServiceOptions = useMemo(() => {
    const normalised = normalisePersonnelDisplaySettings(personnelDisplaySettings);
    const options = normalised.staffRankEquivalency.services
      .map(serviceOption => String(serviceOption.name || '').trim())
      .filter(Boolean);
    const currentService = String(instructor.service || '').trim();
    return currentService && !options.some(option => option.toLowerCase() === currentService.toLowerCase())
      ? [...options, currentService]
      : options;
  }, [instructor.service, personnelDisplaySettings]);
  const staffRoleOptions = useMemo(() => {
    const legacyOptions = [
      { value: 'CONTRACTOR STAFF', label: simIpDisplayLabel },
    ];
    const crewLabelMap = getCrewPositionLabelMap(crewPositionTerminology);
    const crewOptions = getCrewPositionOptions(
      crewPositionTerminology,
      role && !isLegacyInstructorRoleValue(String(role)) ? [String(role)] : [],
      operationalModel,
    ).map((value) => ({
      value,
      label: getCrewPositionDisplayLabel(value, crewPositionTerminology, crewLabelMap[value] || value),
    }));
    const options = [...legacyOptions, ...crewOptions];
    const byValue = new Map<string, { value: string; label: string }>();
    options.forEach((option) => {
      const key = option.value.trim().toUpperCase();
      if (!key || byValue.has(key)) return;
      byValue.set(key, option);
    });
    return Array.from(byValue.values());
  }, [crewPositionTerminology, instructorLabel, operationalModel, role, simIpDisplayLabel]);
  const normalisedQualificationCatalogue = useMemo(
    () => normaliseStaffQualificationCatalogue(staffQualificationCatalogue),
    [staffQualificationCatalogue],
  );
  const contractorQualificationId = useMemo(() => (
    normalisedQualificationCatalogue.qualifications.find(qualification => (
      normaliseQualificationToken(qualification.id) === 'contractor'
      || normaliseQualificationToken(qualification.code) === 'contractor'
      || normaliseQualificationToken(qualification.name) === 'contractor'
    ))?.id || 'contractor'
  ), [normalisedQualificationCatalogue]);
  const qfiQualificationIds = useMemo(() => (
    normalisedQualificationCatalogue.qualifications
      .filter(qualification => (
        normaliseQualificationToken(qualification.id) === 'qfi'
        || normaliseQualificationToken(qualification.code) === 'qfi'
        || normaliseQualificationToken(qualification.name) === 'qfi'
      ))
      .map(qualification => qualification.id)
  ), [normalisedQualificationCatalogue]);
  const ofiQualificationLabel = useMemo(() => {
    const match = normalisedQualificationCatalogue.qualifications.find(qualification => (
      normaliseQualificationToken(qualification.id) === 'ofi'
      || normaliseQualificationToken(qualification.code) === 'ofi'
      || normaliseQualificationToken(qualification.name) === 'ofi'
    ));
    return String(match?.code || match?.name || 'OFI').trim() || 'OFI';
  }, [normalisedQualificationCatalogue]);
  const normaliseContractorStaffQualifications = useCallback((ids: string[]): string[] => {
    const filtered = ids.filter(id => !qfiQualificationIds.includes(id));
    return Array.from(new Set([...filtered, contractorQualificationId]));
  }, [contractorQualificationId, qfiQualificationIds]);
  const activeQualificationOptions = useMemo(() => (
    getQualificationsForOperationalModel(normalisedQualificationCatalogue, operationalModel)
      .filter(qualification => {
        if (!isContractorStaffRoleValue(String(role))) return true;
        return !qfiQualificationIds.includes(qualification.id);
      })
      .sort((left, right) => (left.code || left.name).localeCompare(right.code || right.name, undefined, { sensitivity: 'base' }))
  ), [normalisedQualificationCatalogue, operationalModel, qfiQualificationIds, role]);
  const getAssignedQualificationIds = useCallback((source: Instructor): string[] => {
    let assigned = normaliseAssignedQualificationIds(source.preferences?.qualifications || [], normalisedQualificationCatalogue);
    normalisedQualificationCatalogue.qualifications.forEach((qualification) => {
      const legacyField = LEGACY_QUALIFICATION_FIELD_BY_ID[qualification.id];
      if (legacyField && source[legacyField] === true && !assigned.includes(qualification.id)) {
        assigned.push(qualification.id);
      }
    });
    if (isContractorStaffRoleValue(source.role)) {
      assigned = normaliseContractorStaffQualifications(assigned);
    }
    if (isLegacyInstructorRoleValue(source.role) && qfiQualificationIds.length > 0) {
      assigned = Array.from(new Set([...assigned, ...qfiQualificationIds]));
    }
    return assigned;
  }, [normalisedQualificationCatalogue, normaliseContractorStaffQualifications, qfiQualificationIds]);
  const [callsignNumber, setCallsignNumber] = useState(instructor.callsignNumber);
  const [service, setService] = useState<string>(instructor.service || '');
  const [category, setCategory] = useState<InstructorCategory>(instructor.category);
  const [seatConfig, setSeatConfig] = useState<SeatConfig>(instructor.seatConfig);
  const [unavailabilityPeriods, setUnavailabilityPeriods] = useState<UnavailabilityPeriod[]>(instructor.unavailability || []);
  const [location, setLocation] = useState(instructor.location || '');
  const [unit, setUnit] = useState(instructor.unit || '');
  const [flight, setFlight] = useState(instructor.flight || '');
  const [secondaryCallsign, setSecondaryCallsign] = useState(instructor.secondaryCallsign || '');
  const [crew, setCrew] = useState(instructor.crew || '');
  const [phoneNumber, setPhoneNumber] = useState(instructor.phoneNumber || '');
  const [email, setEmail] = useState(instructor.email || '');
  const [permissions, setPermissions] = useState<string[]>(instructor.permissions || []);
  const [permissionNoticeRect, setPermissionNoticeRect] = useState<DOMRect | null>(null);
  const [assignedQualifications, setAssignedQualifications] = useState<string[]>(() => getAssignedQualificationIds(instructor));
  const [priorExperience, setPriorExperience] = useState<LogbookExperience>(instructor.priorExperience || initialExperience);

  const [isTestingOfficer, setIsTestingOfficer] = useState(instructor.isTestingOfficer);
  const [isExecutive, setIsExecutive] = useState(instructor.isExecutive);
  const [isFlyingSupervisor, setIsFlyingSupervisor] = useState(instructor.isFlyingSupervisor);
  const [isIRE, setIsIRE] = useState(instructor.isIRE);
  const [isCommandingOfficer, setIsCommandingOfficer] = useState(instructor.isCommandingOfficer || false);
  const [isCFI, setIsCFI] = useState(instructor.isCFI || false);
  const [isDeputyFlightCommander, setIsDeputyFlightCommander] = useState(instructor.isDeputyFlightCommander || false);
  const [isContractor, setIsContractor] = useState(instructor.isContractor || false);
  const [isAdminStaff, setIsAdminStaff] = useState(instructor.isAdminStaff || false);
  const [isQFI, setIsQFI] = useState(Boolean(instructor.isQFI || isLegacyInstructorRoleValue(instructor.role)));
  const [isOFI, setIsOFI] = useState(instructor.isOFI || false);

  // ── Profile photo state ──────────────────────────────────────────────────────
  // photoUrl            = committed photo URL from DB (shown in view mode)
  // pendingPhotoDataUrl = photo selected in edit mode, not yet saved to DB
  // pendingPhotoRemoved = user clicked Remove in edit mode (applied on Save, reverted on Cancel)
  const [photoUrl, setPhotoUrl] = useState<string | null>(instructor.photoUrl || null);
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);
  const [pendingPhotoRemoved, setPendingPhotoRemoved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  const profilePhotoInitials = (value: string) => {
    const cleaned = String(value || '')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map(part => part.trim())
      .filter(Boolean);
    const first = cleaned[0]?.[0] || '';
    const last = cleaned.length > 1 ? cleaned[cleaned.length - 1]?.[0] || '' : '';
    return `${first}${last}`.toUpperCase() || 'ID';
  };

  const savePhotoImmediately = async (dataUrl: string) => {
    const dbId = (instructor as any).id;
    if (!dbId) {
      setPhotoError('Click Edit before adding a photo to this new staff profile.');
      return;
    }

    setPhotoUploading(true);
    try {
      const response = await fetch(`/api/personnel/${dbId}/photo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: dataUrl }),
      });
      if (!response.ok) throw new Error('Photo upload failed.');
      const result = await response.json();
      const savedPhotoUrl = result.photoUrl || dataUrl;
      setPhotoUrl(savedPhotoUrl);
      setPendingPhotoDataUrl(null);
      setPendingPhotoRemoved(false);
      setPhotoLoadFailed(false);
      onUpdateInstructor({ ...instructor, photoUrl: savedPhotoUrl });
    } catch {
      setPhotoError('Photo upload failed. Please try again.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoFile = async (file: File | undefined | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file (JPG, PNG, GIF, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image is too large. Please use an image under 2 MB.');
      return;
    }

    setPhotoError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (isEditing) {
        setPendingPhotoDataUrl(dataUrl);
        setPendingPhotoRemoved(false);
        setPhotoLoadFailed(false);
      } else {
        await savePhotoImmediately(dataUrl);
      }
    } catch (err: any) {
      setPhotoError(`Could not read image: ${err.message}`);
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handlePhotoFile(e.target.files?.[0]);
  };

  const handlePhotoDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await handlePhotoFile(e.dataTransfer.files?.[0]);
  };

  // Edit mode only: mark photo for removal on Save
  const handlePhotoRemoveInEdit = () => {
    setPendingPhotoDataUrl(null);
    setPendingPhotoRemoved(true);
    setPhotoError(null);
    setPhotoLoadFailed(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  // ────────────────────────────────────────────────────────────────────────────

  const { primaryTrainees, secondaryTrainees } = useMemo(() => {
    if (!traineesData) return { primaryTrainees: [], secondaryTrainees: [] };
    const primary = traineesData.filter(t => {
      const p = t.primaryInstructor;
      return Array.isArray(p) ? p.includes(instructor.name) : p === instructor.name;
    }).sort((a, b) => a.name.localeCompare(b.name));
    const secondary = traineesData.filter(t => {
      const s = t.secondaryInstructor;
      return Array.isArray(s) ? s.includes(instructor.name) : s === instructor.name;
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { primaryTrainees: primary, secondaryTrainees: secondary };
  }, [traineesData, instructor.name]);
  const activeOperationalModel = normaliseOperationalModel(operationalModel);
  const isAirCombatModel = activeOperationalModel === 'air_combat';
  const isStaffTrainingReportModel = isAirCombatModel || isFixedCrewLikeOperationalModel(activeOperationalModel);
  const assignedTraining = useMemo(
    () => normaliseAirCombatTrainingAssignments(instructor.preferences),
    [instructor.preferences],
  );
  const assignedAirCombatTraining = useMemo(() => ([
    ...assignedTraining.courses.map(item => ({ ...item, displayKind: 'Course', tone: 'sky' })),
    ...assignedTraining.trainingPackages.map(item => ({ ...item, displayKind: 'Training Package', tone: 'emerald' })),
  ]), [assignedTraining]);
  const airCombatStaffHistoryEvents = useMemo(() => {
    const deduped = new Map<string, ScheduleEvent>();
    [...scheduleHistoryEvents, ...events]
      .filter(event => eventIncludesStaff(event, instructor.name))
      .forEach(event => {
        const key = event.id || `${event.date || ''}-${event.flightNumber || ''}-${event.startTime}-${event.resourceId || ''}`;
        deduped.set(key, event);
      });
    return Array.from(deduped.values()).sort((left, right) => (
      getEventDateValue(right) - getEventDateValue(left) ||
      Number(right.startTime || 0) - Number(left.startTime || 0)
    ));
  }, [events, instructor.name, scheduleHistoryEvents]);
  const getTrainingSyllabusItems = useCallback((assignment: AirCombatAssignment): SyllabusItemDetail[] => {
    const assignmentCode = normaliseTrainingCode(assignment.code);
    return syllabusDetails
      .filter(item => item.isActive !== false)
      .filter(item => (assignment.kind === 'training_package' ? item.lmpType === 'Staff CAT' : item.lmpType !== 'Staff CAT'))
      .filter(item => (
        (item.courses || []).some(course => normaliseTrainingCode(course) === assignmentCode) ||
        normaliseTrainingCode(item.code) === assignmentCode
      ))
      .sort((left, right) => (
        Number((left as any).sortOrder ?? Number.MAX_SAFE_INTEGER) - Number((right as any).sortOrder ?? Number.MAX_SAFE_INTEGER) ||
        String(left.orderKey || '').localeCompare(String(right.orderKey || '')) ||
        normaliseTrainingCode(left.code).localeCompare(normaliseTrainingCode(right.code))
      ));
  }, [syllabusDetails]);
  const airCombatTrainingSummaries = useMemo(() => assignedAirCombatTraining.map(assignment => {
    const sequenceItems = getTrainingSyllabusItems(assignment);
    const sequenceCodeSet = new Set(sequenceItems.map(item => normaliseTrainingCode(item.code)));
    const completedEvents = airCombatStaffHistoryEvents.filter(event => sequenceCodeSet.has(normaliseTrainingCode(event.flightNumber)));
    const completedReportCodes = normaliseAirCombatTrainingReports(instructor.preferences)
      .filter(report => report.trainingKey === assignment.trainingKey || report.trainingCode === assignment.code)
      .filter(report => report.dcoResult === 'DCO' || report.dcoResult === 'DPCO')
      .map(report => normaliseTrainingCode(report.eventCode))
      .filter(code => sequenceCodeSet.has(code));
    const completedCodes = new Set([
      ...completedEvents.map(event => normaliseTrainingCode(event.flightNumber)),
      ...completedReportCodes,
    ]);
    const nextItem = sequenceItems.find(item => !completedCodes.has(normaliseTrainingCode(item.code))) || null;
    const completedCount = completedCodes.size;
    const totalCount = sequenceItems.length;
    return {
      assignment,
      sequenceItems,
      completedEvents,
      completedCodes,
      completedCount,
      totalCount,
      nextItem,
      progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      lastEvent: completedEvents[0] || null,
    };
  }), [airCombatStaffHistoryEvents, assignedAirCombatTraining, getTrainingSyllabusItems, instructor.preferences]);
  const [selectedAirCombatTrainingKey, setSelectedAirCombatTrainingKey] = useState<string | null>(null);
  const [selectedAirCombatTrainingItemId, setSelectedAirCombatTrainingItemId] = useState<string | null>(null);
  const [showAirCombatInsertEventModal, setShowAirCombatInsertEventModal] = useState(false);
  const [showAirCombatGenerateReportModal, setShowAirCombatGenerateReportModal] = useState(false);
  const [airCombatReportItemId, setAirCombatReportItemId] = useState<string>('');
  const [airCombatItemBeingEdited, setAirCombatItemBeingEdited] = useState<SyllabusItemDetail | null>(null);
  useEffect(() => {
    if (airCombatTrainingSummaries.length === 0) {
      if (selectedAirCombatTrainingKey) setSelectedAirCombatTrainingKey(null);
      return;
    }
    if (!selectedAirCombatTrainingKey || !airCombatTrainingSummaries.some(summary => summary.assignment.trainingKey === selectedAirCombatTrainingKey)) {
      setSelectedAirCombatTrainingKey(airCombatTrainingSummaries[0].assignment.trainingKey);
    }
  }, [airCombatTrainingSummaries, selectedAirCombatTrainingKey]);
  const selectedAirCombatTraining = airCombatTrainingSummaries.find(summary => summary.assignment.trainingKey === selectedAirCombatTrainingKey) || airCombatTrainingSummaries[0] || null;
  useEffect(() => {
    if (!selectedAirCombatTraining) {
      if (selectedAirCombatTrainingItemId) setSelectedAirCombatTrainingItemId(null);
      return;
    }
    const selectedStillExists = selectedAirCombatTraining.sequenceItems.some(item => (
      (item.id || item.code) === selectedAirCombatTrainingItemId ||
      item.code === selectedAirCombatTrainingItemId
    ));
    if (!selectedAirCombatTrainingItemId || !selectedStillExists) {
      const defaultItem = selectedAirCombatTraining.nextItem || selectedAirCombatTraining.sequenceItems[0] || null;
      setSelectedAirCombatTrainingItemId(defaultItem ? (defaultItem.id || defaultItem.code) : null);
    }
  }, [selectedAirCombatTraining, selectedAirCombatTrainingItemId]);
  const selectedAirCombatTrainingItem = selectedAirCombatTraining?.sequenceItems.find(item => (
    (item.id || item.code) === selectedAirCombatTrainingItemId ||
    item.code === selectedAirCombatTrainingItemId
  )) || selectedAirCombatTraining?.nextItem || selectedAirCombatTraining?.sequenceItems[0] || null;
  const isSelectedAirCombatTrainingPackage = selectedAirCombatTraining?.assignment.kind === 'training_package';
  const handleAirCombatLinkedEventChange = useCallback(async (item: SyllabusItemDetail, linkedEventCode: string) => {
    if (!selectedAirCombatTraining || !onUpdateAirCombatTrainingEvent) return;
    const updatedItem = withAirCombatLinkedEventNote(item, linkedEventCode);
    const updated = await onUpdateAirCombatTrainingEvent(
      instructor,
      selectedAirCombatTraining.assignment,
      item,
      updatedItem,
    );
    if (updated !== false) {
      setSelectedAirCombatTrainingItemId(updatedItem.id || updatedItem.code);
    }
  }, [instructor, onUpdateAirCombatTrainingEvent, selectedAirCombatTraining]);
  const airCombatTrainingReportRows = useMemo(() => (
    airCombatTrainingSummaries.flatMap(summary => (
      summary.completedEvents.map(event => ({
        event,
        summary,
        item: summary.sequenceItems.find(item => normaliseTrainingCode(item.code) === normaliseTrainingCode(event.flightNumber)) || null,
      }))
    )).sort((left, right) => (
      getEventDateValue(right.event) - getEventDateValue(left.event) ||
      Number(right.event.startTime || 0) - Number(left.event.startTime || 0)
    ))
  ), [airCombatTrainingSummaries]);
  const airCombatStoredTrainingReports = useMemo(() => (
    normaliseAirCombatTrainingReports(instructor.preferences)
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
  ), [instructor.preferences]);
  const handleDeleteTrainingReport = useCallback(async (report: AirCombatTrainingReport) => {
    const password = await showDarkPrompt({
      title: 'Delete Training Report',
      message: `Enter your password to delete ${report.reportName || 'this training report'} for ${report.eventCode || 'this event'}.`,
      inputLabel: 'Password',
      inputType: 'password',
      inputPlaceholder: 'Enter password',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'warning',
    });
    if (!password) return;

    try {
      const isValid = await verifyCurrentUserPassword(password);
      if (!isValid) {
        await showDarkAlert('The password was not accepted. The training report was not deleted.', 'Password Required', 'warning');
        return;
      }
    } catch {
      await showDarkAlert('The app could not verify your password. The training report was not deleted.', 'Password Check Failed', 'error');
      return;
    }

    const preferences = { ...(instructor.preferences || {}) };
    const existingReports = normaliseAirCombatTrainingReports(preferences);
    const updatedReports = existingReports.filter(existing => existing.id !== report.id);
    const updatedInstructor: Instructor = {
      ...instructor,
      preferences: {
        ...preferences,
        airCombat: {
          ...(preferences.airCombat || {}),
          trainingReports: updatedReports,
        },
      },
    };

    onUpdateInstructor(updatedInstructor);
    logAudit(
      'Air Combat Training Reports',
      'Delete',
      `Deleted ${report.reportName || 'training report'} for ${instructor.name} - Event: ${report.eventCode || 'Unknown'}`
    );
  }, [instructor, onUpdateInstructor]);
  const totalAirCombatSequenceEvents = airCombatTrainingSummaries.reduce((total, summary) => total + summary.totalCount, 0);
  const totalAirCombatCompletedEvents = airCombatTrainingSummaries.reduce((total, summary) => total + summary.completedCount, 0);
  const airCombatPanelButtonClass = "w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] leading-tight font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed";
  const openAirCombatTrainingReportPicker = useCallback(() => {
    if (!selectedAirCombatTraining || selectedAirCombatTraining.sequenceItems.length === 0) return;
    const defaultItem = selectedAirCombatTrainingItem || selectedAirCombatTraining.nextItem || selectedAirCombatTraining.sequenceItems[0];
    setAirCombatReportItemId(defaultItem?.id || defaultItem?.code || '');
    setShowAirCombatGenerateReportModal(true);
  }, [selectedAirCombatTraining, selectedAirCombatTrainingItem]);

  const callsignData = useMemo(() => personnelData.get(instructor.name), [personnelData, instructor.name]);
  const displayCallsign = useMemo(() => {
    if (callsignData?.callsign) return callsignData.callsign;
    if (instructor.callsign) return instructor.callsign;
    if (callsignData && (callsignData.callsignNumber || instructor.callsignNumber)) {
      return `${callsignData.callsignPrefix || ''}${callsignData.callsignNumber || instructor.callsignNumber || ''}`;
    }
    return '';
  }, [callsignData, instructor.callsign, instructor.callsignNumber]);

  const resetState = () => {
    setIdNumber(instructor.idNumber); setName(instructor.name); setRank(instructor.rank);
    setRole(getEditableStaffRole(instructor.role, operationalModel, crewPositionTerminology)); setCallsignNumber(instructor.callsignNumber); setService(instructor.service);
    setCategory(instructor.category); setSeatConfig(instructor.seatConfig);
    setUnavailabilityPeriods(instructor.unavailability || []); setLocation(instructor.location || '');
    setUnit(instructor.unit || ''); setFlight(instructor.flight || '');
    setSecondaryCallsign(instructor.secondaryCallsign || '');
    setCrew(instructor.crew || '');
    setPhoneNumber(instructor.phoneNumber || ''); setEmail(instructor.email || '');
    setPermissions(instructor.permissions || []); setPriorExperience(instructor.priorExperience || initialExperience);
    setAssignedQualifications(getAssignedQualificationIds(instructor));
    setIsTestingOfficer(instructor.isTestingOfficer); setIsExecutive(instructor.isExecutive);
    setIsFlyingSupervisor(instructor.isFlyingSupervisor); setIsIRE(instructor.isIRE);
    setIsCommandingOfficer(instructor.isCommandingOfficer || false); setIsCFI(instructor.isCFI || false);
    setIsDeputyFlightCommander(instructor.isDeputyFlightCommander || false);
    setIsContractor(instructor.isContractor || false); setIsAdminStaff(instructor.isAdminStaff || false);
    setIsQFI(Boolean(instructor.isQFI || isLegacyInstructorRoleValue(instructor.role))); setIsOFI(instructor.isOFI || false);
    setPhotoUrl(instructor.photoUrl || null);
    setPendingPhotoDataUrl(null);
    setPendingPhotoRemoved(false);
    setPhotoError(null);
    setPhotoLoadFailed(false);
  };

  useEffect(() => { resetState(); setIsEditing(isCreating); }, [instructor, isCreating]);

  // Use ref to prevent double-logging in React StrictMode
  const hasLoggedViewRef = useRef(false);
  useEffect(() => {
    if (!isCreating && !hasLoggedViewRef.current) {
      hasLoggedViewRef.current = true;
      logAudit({ action: 'View', description: `Viewed staff profile for ${instructor.rank} ${instructor.name}`, changes: `Role: ${instructor.role}, Unit: ${instructor.unit}`, page: 'Staff' });
    }
  }, []);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => { if (isCreating) onClose(); else { resetState(); setIsEditing(false); } };
  const handleQualificationChange = (qualificationId: string, isChecked: boolean) => {
    setAssignedQualifications(prev => (
      isChecked
        ? Array.from(new Set([...prev, qualificationId]))
        : prev.filter(id => id !== qualificationId)
    ));
    const legacyField = LEGACY_QUALIFICATION_FIELD_BY_ID[qualificationId];
    if (legacyField === 'isCommandingOfficer') setIsCommandingOfficer(isChecked);
    if (legacyField === 'isCFI') setIsCFI(isChecked);
    if (legacyField === 'isExecutive') setIsExecutive(isChecked);
    if (legacyField === 'isFlyingSupervisor') setIsFlyingSupervisor(isChecked);
    if (legacyField === 'isTestingOfficer') setIsTestingOfficer(isChecked);
    if (legacyField === 'isIRE') setIsIRE(isChecked);
    if (legacyField === 'isQFI') setIsQFI(isChecked);
    if (legacyField === 'isOFI') setIsOFI(isChecked);
    if (legacyField === 'isDeputyFlightCommander') setIsDeputyFlightCommander(isChecked);
    if (legacyField === 'isContractor') setIsContractor(isChecked);
    if (legacyField === 'isAdminStaff') setIsAdminStaff(isChecked);
  };
  const handleRoleChange = (nextRole: StaffRole) => {
    setRole(nextRole);
    if (isContractorStaffRoleValue(String(nextRole))) {
      setAssignedQualifications(prev => normaliseContractorStaffQualifications(prev));
      setIsQFI(false);
      setIsContractor(true);
      setCategory('UnCat');
    }
  };
  const handleExperienceChange = (section: keyof LogbookExperience, field: string | null, value: number) => {
    setPriorExperience(prev => field ? { ...prev, [section]: { ...(prev[section] as any), [field]: value } } : { ...prev, [section]: value });
  };

  const handleSave = async () => {
    if (!name) { await showDarkAlert('Name is required.', 'Missing Staff Name', 'warning'); return; }
    if (!Number.isInteger(Number(idNumber)) || Number(idNumber) <= 0) {
      await showDarkAlert('Personnel ID is required before this staff record can be saved.', 'Missing Personnel ID', 'warning');
      return;
    }
    const proposedRecord = { ...instructor, idNumber, name, rank, role, unit };
    const duplicateNameMatches = [...instructorsData, ...traineesData]
      .filter(person => (person as any).isActive !== false)
      .filter(person => normalisePersonName(person.name || person.fullName) === normalisePersonName(name))
      .filter(person => !samePersonRecord(person, proposedRecord));
    if (duplicateNameMatches.length > 0) {
      const confirmed = await showDarkConfirm(
        `Another active person already has the name "${name}".\n\n${duplicateNameMatches.map(describeDuplicateNamePerson).join('\n')}\n\nConfirm the Personnel ID, unit and role are correct before saving this separate person.`,
        'Duplicate Name Check',
        'warning'
      );
      if (!confirmed) return;
    }
    const savedRole = role;
    const savedAsContractorStaff = isContractorStaffRoleValue(String(savedRole));
    const savedQualifications = savedAsContractorStaff
      ? normaliseContractorStaffQualifications(assignedQualifications)
      : assignedQualifications;
    const savedCategory = savedAsContractorStaff ? 'UnCat' : category;
    const savedHasQfiQualification = qfiQualificationIds.some(id => savedQualifications.includes(id));
    const savedIsQFI = savedAsContractorStaff ? false : savedHasQfiQualification;
    const savedIsContractor = savedAsContractorStaff ? true : isContractor;

    // ── Handle pending photo changes ──────────────────────────────────────────
    let finalPhotoUrl = photoUrl;
    const dbId = (instructor as any).id;
    if (dbId) {
      if (pendingPhotoDataUrl) {
        // Upload new photo to DB
        setPhotoUploading(true);
        try {
          const response = await fetch(`/api/personnel/${dbId}/photo`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoUrl: pendingPhotoDataUrl }),
          });
          if (response.ok) {
            const result = await response.json();
            finalPhotoUrl = result.photoUrl;
            setPhotoUrl(finalPhotoUrl);
            setPhotoLoadFailed(false);
          } else {
            setPhotoError('Photo upload failed — other changes were saved.');
          }
        } catch {
          setPhotoError('Photo upload failed — other changes were saved.');
        } finally {
          setPhotoUploading(false);
          setPendingPhotoDataUrl(null);
        }
      } else if (pendingPhotoRemoved && photoUrl) {
        // Remove photo from DB
        setPhotoUploading(true);
        try {
          const response = await fetch(`/api/personnel/${dbId}/photo`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (response.ok) {
            finalPhotoUrl = null;
            setPhotoUrl(null);
            setPhotoLoadFailed(false);
          } else {
            setPhotoError('Photo removal failed — other changes were saved.');
          }
        } catch {
          setPhotoError('Photo removal failed — other changes were saved.');
        } finally {
          setPhotoUploading(false);
          setPendingPhotoRemoved(false);
        }
      }
    } else if (pendingPhotoDataUrl || pendingPhotoRemoved) {
      setPhotoError('Cannot save photo: personnel record has no database ID.');
      setPendingPhotoDataUrl(null);
      setPendingPhotoRemoved(false);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const updatedInstructor: Instructor = {
      ...instructor,
      idNumber,
      name,
      rank,
      role: savedRole,
      callsignNumber,
      callsign: displayCallsign,
      secondaryCallsign,
      service: service || undefined,
      category: savedCategory,
      seatConfig,
      crew,
      preferences: {
        ...(instructor.preferences || {}),
        callsign: displayCallsign || null,
        secondaryCallsign: secondaryCallsign || null,
        crew: crew || null,
        qualifications: savedQualifications,
      },
      unavailability: unavailabilityPeriods, location, unit, flight, phoneNumber, email, permissions,
      priorExperience, isTestingOfficer, isExecutive, isFlyingSupervisor, isIRE,
      isCommandingOfficer, isCFI, isDeputyFlightCommander, isContractor: savedIsContractor, isAdminStaff, isQFI: savedIsQFI, isOFI,
      photoUrl: finalPhotoUrl,
    };
    flushPendingAudits();

    if (isCreating) {
      logAudit({ action: 'Add', description: `Added new staff ${rank} ${name}`, changes: `Role: ${savedRole}, Unit: ${unit}, Location: ${location}`, page: 'Staff' });
    } else {
      // Track what changed for edit audit log
      const changes: string[] = [];
      if (instructor.name !== name) changes.push(`Name: ${instructor.name} → ${name}`);
      if (instructor.rank !== rank) changes.push(`Rank: ${instructor.rank} → ${rank}`);
      if (instructor.role !== savedRole) changes.push(`Role: ${instructor.role} → ${savedRole}`);
      if (instructor.unit !== unit) changes.push(`Unit: ${instructor.unit || '(none)'} → ${unit || '(none)'}`);
      if (instructor.flight !== flight) changes.push(`Flight: ${instructor.flight || '(none)'} → ${flight || '(none)'}`);
      if ((instructor.secondaryCallsign || '') !== secondaryCallsign) changes.push(`Secondary Callsign: ${instructor.secondaryCallsign || '(none)'} → ${secondaryCallsign || '(none)'}`);
      if ((instructor.crew || '') !== crew) changes.push(`Crew: ${instructor.crew || '(none)'} → ${crew || '(none)'}`);
      const previousQualifications = getAssignedQualificationIds(instructor);
      if (JSON.stringify(previousQualifications) !== JSON.stringify(savedQualifications)) {
        const labelsFor = (ids: string[]) => ids.map(id => {
          const match = normalisedQualificationCatalogue.qualifications.find(definition => qualificationMatches(id, definition));
          return match?.code || match?.name || id;
        }).join(', ') || '(none)';
        changes.push(`Qualifications: ${labelsFor(previousQualifications)} → ${labelsFor(savedQualifications)}`);
      }
      if (instructor.location !== location) changes.push(`Location: ${instructor.location || '(none)'} → ${location || '(none)'}`);
      if (instructor.phoneNumber !== phoneNumber) changes.push(`Phone: ${instructor.phoneNumber || '(none)'} → ${phoneNumber || '(none)'}`);
      if (instructor.email !== email) changes.push(`Email: ${instructor.email || '(none)'} → ${email || '(none)'}`);
      if (instructor.category !== savedCategory) changes.push(`Category: ${instructor.category} → ${savedCategory}`);
      if (instructor.seatConfig !== seatConfig) changes.push(`Seat Config: ${instructor.seatConfig} → ${seatConfig}`);
      if (instructor.service !== service) changes.push(`Service: ${instructor.service || '(none)'} → ${service || '(none)'}`);
      if (instructor.isTestingOfficer !== isTestingOfficer) changes.push(`Testing Officer: ${instructor.isTestingOfficer} → ${isTestingOfficer}`);
      if (instructor.isExecutive !== isExecutive) changes.push(`Executive: ${instructor.isExecutive} → ${isExecutive}`);
      if (instructor.isFlyingSupervisor !== isFlyingSupervisor) changes.push(`Flying Supervisor: ${instructor.isFlyingSupervisor} → ${isFlyingSupervisor}`);
      if (instructor.isIRE !== isIRE) changes.push(`IRE: ${instructor.isIRE} → ${isIRE}`);
      if (instructor.isCommandingOfficer !== isCommandingOfficer) changes.push(`CO: ${instructor.isCommandingOfficer} → ${isCommandingOfficer}`);
      if (instructor.isCFI !== isCFI) changes.push(`CFI: ${instructor.isCFI} → ${isCFI}`);
      if (instructor.isDeputyFlightCommander !== isDeputyFlightCommander) changes.push(`Deputy FC: ${instructor.isDeputyFlightCommander} → ${isDeputyFlightCommander}`);
      if (instructor.isContractor !== savedIsContractor) changes.push(`Contractor: ${instructor.isContractor} → ${savedIsContractor}`);
      if (instructor.isAdminStaff !== isAdminStaff) changes.push(`Admin Staff: ${instructor.isAdminStaff} → ${isAdminStaff}`);
      if (instructor.isQFI !== savedIsQFI) changes.push(`${instructorLabel}: ${instructor.isQFI} → ${savedIsQFI}`);
      if (instructor.isOFI !== isOFI) changes.push(`${ofiQualificationLabel}: ${instructor.isOFI} → ${isOFI}`);

      const changesStr = changes.length > 0 ? changes.join(', ') : 'No field changes';
      logAudit({ action: 'Edit', description: `Edited staff profile for ${rank} ${name}`, changes: changesStr, page: 'Staff' });
    }

    try {
      await Promise.resolve(onUpdateInstructor(updatedInstructor));
    } catch (error) {
      console.error('Failed to save staff profile:', error);
      const reason = error instanceof Error ? error.message : String(error || '').trim();
      await showDarkAlert(
        reason || 'The staff record could not be saved because the app did not receive a specific failure reason from the server.',
        'Save Failed',
        'error'
      );
      return;
    }
    setIsEditing(false);
    if (isCreating) onClose();
  };

  const handleAddTodayOnly = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newPeriod: UnavailabilityPeriod = { id: uuidv4(), startDate: todayStr, endDate: todayStr, allDay: false, startTime: '0001', endTime: '2359', reason: 'Other', notes: 'Today Only' };
    logAudit({ action: 'Add', description: `Added unavailability for ${instructor.rank} ${instructor.name}`, changes: `Today Only - ${todayStr}`, page: 'Staff' });
    const updated = [...unavailabilityPeriods, newPeriod];
    setUnavailabilityPeriods(updated);
    onUpdateInstructor({ ...instructor, unavailability: updated });
    setShowAddUnavailability(false);
  };

  const handleSaveUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
    const newPeriod = { ...periodData, id: uuidv4(), startTime: periodData.allDay ? undefined : periodData.startTime, endTime: periodData.allDay ? undefined : periodData.endTime };
    const updated = [...unavailabilityPeriods, newPeriod];
    setUnavailabilityPeriods(updated);
    onUpdateInstructor({ ...instructor, unavailability: updated });
  };

  const handleRemoveUnavailability = (idToRemove: string) => {
    const updated = unavailabilityPeriods.filter(p => p.id !== idToRemove);
    setUnavailabilityPeriods(updated);
    onUpdateInstructor({ ...instructor, unavailability: updated });
  };

  const formatMilitaryTime = (t: string | undefined) => t ? t.replace(':', '') : '';

  // Tab state — null means no tab open (profile only)
  const [activeTab, setActiveTab] = useState<StaffProfileTab | null>(null);

  // Logbook flight entries (fetched from DB when tab opens)
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [logbookLoading, setLogbookLoading] = useState(false);
  const [logbookError, setLogbookError] = useState<string | null>(null);
  // Month navigator: null = show all, 'YYYY-MM' for specific month
  const [logbookMonth, setLogbookMonth] = useState<string>(() => getProfileLogbookMonth(instructor));
  const isArchiveProfile = (instructor as any)._dataSource === 'archive';
  const archivedLogbookEntries = useMemo(() => (
    Array.isArray((instructor as any).archivedLogbookEntries)
      ? [...(instructor as any).archivedLogbookEntries]
      : []
  ), [instructor]);

  useEffect(() => {
    if (activeTab !== 'logbook') return;
    setLogbookLoading(true);
    setLogbookError(null);
    setLogbookMonth(getProfileLogbookMonth(instructor)); // Reset to the active profile month each time tab opens
    if (isArchiveProfile) {
      setLogbookEntries(archivedLogbookEntries);
      setLogbookLoading(false);
      return;
    }
    // Use the full instructor.name as stored in personName field of FlightLogEntry
    const fullName = instructor.name;
    fetch(`/api/flight-log?personName=${encodeURIComponent(fullName)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then((json: any) => {
        const entries: any[] = (json.entries || []).sort((a: any, b: any) =>
          (a.eventDate || '') < (b.eventDate || '') ? -1 : (a.eventDate || '') > (b.eventDate || '') ? 1 : 0
        );
        setLogbookEntries(entries);
        setLogbookLoading(false);
      })
      .catch(() => {
        setLogbookError('Could not load logbook data.');
        setLogbookLoading(false);
      });
  }, [activeTab, archivedLogbookEntries, instructor.name, isArchiveProfile]);

  // Edit controls exposed by CurrencyPanel (so we can render them in the tab header)
  const [currencyEditState, setCurrencyEditState] = useState<{
    isEditing: boolean; isSaving: boolean;
    onEdit: () => void; onSave: () => void; onCancel: () => void;
  } | null>(null);

  // Local currency status override — updated after successful save without triggering full onUpdateInstructor
  // Uses a ref to ensure the value persists across renders and instructor prop changes
  const [localCurrencyStatus, setLocalCurrencyStatus] = useState<PersonCurrencyStatus[] | undefined>(undefined);
  const localCurrencyStatusRef = useRef<PersonCurrencyStatus[] | undefined>(undefined);
  const isArchiveCurrencyProfile = isArchiveProfile;
  // Audit flyout visibility
  const [showCurrencyAudit, setShowCurrencyAudit] = useState(false);

  // Open to a specific tab if requested (e.g. from "My Currency" in MyDashboard)
  useEffect(() => {
    if (profileInitialTab) {
      setActiveTab(profileInitialTab);
      onProfileTabConsumed?.();
    }
  }, [profileInitialTab]);
  const btnClass = "w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed";
  const tabBtnClass = (tab: string, allowed = true) => `w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed${activeTab === tab ? ' active' : ''}${allowed ? '' : ' cursor-not-allowed'}`;
  // Ref for the scrollable content area - used to scroll to top when a tab opens
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const canUsePermission = canUsePlatformPermission || (() => true);
  const normaliseIdentityValue = (value?: string | number | null): string => (
    String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9@.]/g, '')
  );
  const isOwnStaffProfile = useMemo(() => {
    const userKeys = [currentUserId, currentUserName].map(normaliseIdentityValue).filter(Boolean);
    if (userKeys.length === 0) return false;
    const staffKeys = [
      (instructor as any).id,
      (instructor as any).userId,
      (instructor as any).personnelId,
      instructor.idNumber,
      instructor.email,
      instructor.name,
    ].map(normaliseIdentityValue).filter(Boolean);
    return userKeys.some(key => staffKeys.includes(key));
  }, [currentUserId, currentUserName, instructor]);
  const canUseStaffProfileAction = (permissionId: string): boolean => (
    isOwnStaffProfile || canUsePermission(permissionId)
  );
  const staffProfileTabPermissions: Partial<Record<NonNullable<StaffProfileTab>, string>> = {
    unavailable: 'staff.profile.unavailable.use',
    currency: 'staff.profile.currency.use',
    logbook: 'staff.profile.logbook.use',
    sct: 'staff.profile.sctRequest.use',
    trainingReports: 'staff.profile.trainingReport.use',
    trainingProgress: 'staff.profile.trainingProgress.use',
  };
  const canOpenStaffProfileTab = (tab: NonNullable<StaffProfileTab>): boolean => (
    canUseStaffProfileAction(staffProfileTabPermissions[tab] || 'staff.profile.view')
  );
  const showPermissionNoticeForElement = (element: HTMLElement) => {
    setPermissionNoticeRect(element.getBoundingClientRect());
  };

  // Toggle: clicking active tab closes it; clicking another opens it
  const handleTabClick = (tab: typeof activeTab, anchor?: HTMLElement) => {
    if (tab && !canOpenStaffProfileTab(tab)) {
      if (anchor) showPermissionNoticeForElement(anchor);
      return;
    }
    setActiveTab(prev => {
      const next = prev === tab ? null : tab;
      // Scroll to top so the tab panel is visible
      if (next !== null) {
        setTimeout(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      }
      return next;
    });
  };
  const exp = priorExperience;

  const assignedQualificationLabels = assignedQualifications
    .map(id => activeQualificationOptions.find(qualification => qualificationMatches(id, qualification)))
    .filter((qualification): qualification is StaffQualificationDefinition => Boolean(qualification))
    .map(qualification => qualification.code || qualification.name);
  const profileRoleDisplay = getStaffRoleDisplay(
    instructor.role,
    crewPositionTerminology,
    instructorLabel,
    simIpDisplayLabel,
  );
  const assignedPermissionProfileSummary = useMemo(() => {
    const linkedPlatformUserIdentifiers = getPlatformUserIdentityValuesForPerson(platformConfig, instructor as any, 'staff');
    return getAssignedPlatformPermissionProfileSummary(platformConfig, [
      ...linkedPlatformUserIdentifiers,
      (instructor as any).id,
      (instructor as any).userId,
      (instructor as any).personnelId,
      instructor.idNumber,
      instructor.email,
    ]);
  }, [instructor, platformConfig]);
  const assignedPermissionProfileLabels = assignedPermissionProfileSummary.labels;
  const hasPermissionProfileExceptions = assignedPermissionProfileSummary.hasPermissionOverrides;

  // Trainee avatar icon
  const TraineeIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[90] flex items-start justify-center overflow-hidden px-4 pb-4 pt-[7.25rem]" onClick={onClose}>
        <div className="bg-[#141e2e] rounded-lg shadow-2xl w-full md:w-[calc(100vw-12rem)] xl:w-[min(calc(100vw-18rem),88rem)] max-w-[88rem] max-h-[calc(100vh-8.25rem)] flex flex-col border border-gray-600 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-600 flex justify-between items-center bg-[#0f1824] flex-shrink-0">
            <h2 className="text-lg font-bold text-white">{isCreating ? 'New Staff' : 'Staff Profile'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold leading-none">✕</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* MAIN CONTENT — always full, scrollable */}
            <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
              {/* Transparent freeze overlay — blocks all interaction with content */}
              {isFrozen && (
                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
              )}

              {/* ── TAB PANEL (shown inline above profile when a tab is active) ── */}
              {activeTab === 'currency' && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-white">Currency &mdash; {instructor.name}</h4>
                    <div className="flex items-center gap-[1px]">
                      {!isArchiveCurrencyProfile && currencyEditState && !currencyEditState.isEditing && (
                        <button
                          onClick={currencyEditState.onEdit}
                          className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                          title="Edit currency dates"
                        >
                          Edit
                        </button>
                      )}
                      {!isArchiveCurrencyProfile && currencyEditState && currencyEditState.isEditing && (
                        <>
                          <button
                            onClick={currencyEditState.onCancel}
                            disabled={currencyEditState.isSaving}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                            title="Cancel editing"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={currencyEditState.onSave}
                            disabled={currencyEditState.isSaving}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:opacity-50"
                            title="Save currency dates"
                          >
                            {currencyEditState.isSaving ? 'Saving\u2026' : 'Save'}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setActiveTab(null)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="Close currency panel"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => setShowCurrencyAudit(true)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="View currency audit log"
                      >
                        Audit
                      </button>
                    </div>
                  </div>
                  <CurrencyPanel
                    key={`currency-panel-${instructor.idNumber}-${(instructor as any)._dataSource || 'live'}`}
                    personId={(instructor as any).id}
                    idNumber={instructor.idNumber}
                    personType="instructor"
                    personName={instructor.name}
                    masterCurrencies={masterCurrencies}
                    currencyRequirements={currencyRequirements}
                    initialCurrencyStatus={isArchiveCurrencyProfile ? instructor.currencyStatus : localCurrencyStatusRef.current ?? localCurrencyStatus ?? instructor.currencyStatus}
                    useLiveCurrency={!isArchiveCurrencyProfile}
                    readOnly={isArchiveCurrencyProfile}
                    onCurrencyStatusChange={(newStatus: PersonCurrencyStatus[]) => {
                      localCurrencyStatusRef.current = newStatus;
                      setLocalCurrencyStatus(newStatus);
                    }}
                    onEditStateChange={setCurrencyEditState}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                  />
                </div>
              )}

              {showCurrencyAudit && (
                <CurrencyAuditFlyout
                  personId={String((instructor as any).id || instructor.idNumber)}
                  personName={instructor.name}
                  onClose={() => setShowCurrencyAudit(false)}
                />
              )}

              {activeTab === 'logbook' && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    {/* Left: title + month navigator */}
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Logbook — {instructor.name}</h4>
                       {(() => {
                         const ML: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'};
                         // Helper: increment or decrement a YYYY-MM string by one month (infinite in both directions)
                         const shiftMonth = (ym: string, delta: 1 | -1): string => {
                           const [y, m] = ym.split('-').map(Number);
                           let nm = m + delta; let ny = y;
                           if (nm > 12) { nm = 1; ny++; }
                           if (nm < 1)  { nm = 12; ny--; }
                           return `${ny}-${String(nm).padStart(2,'0')}`;
                         };
                         // Default to current month when "All" and user clicks an arrow
                                                const label = `${ML[logbookMonth.slice(5,7)]||''} ${logbookMonth.slice(2,4)}`;
                         return (
                           <div className="flex items-center gap-0.5">
                             <button onClick={() => setLogbookMonth(shiftMonth(logbookMonth, -1))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-sm leading-none">‹</button>
                             <span className="min-w-[50px] text-center text-[10px] font-mono text-sky-300 bg-gray-800/60 border border-gray-600 rounded px-1 py-0.5">{label}</span>
                             <button onClick={() => setLogbookMonth(shiftMonth(logbookMonth, 1))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-sm leading-none">›</button>
                           </div>
                         );
                       })()}
                    </div>
                    {/* Right: print + entry count + close */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const ML2: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'};
                          const printLabel = `${ML2[logbookMonth.slice(5,7)]||''} ${logbookMonth.slice(2,4)}`;
                          const filtered = logbookEntries.filter((e: any) => (e.eventDate || '').slice(0,7) === logbookMonth);
                          const rows = filtered.map((entry: any) => {
                            const snap: any = entry.captainLogSnapshot || entry.crewLogSnapshot || {};
                            const yr = snap.year || (entry.eventDate ? new Date(entry.eventDate).getFullYear().toString() : '');
                            const dt = snap.date || (entry.eventDate ? new Date(entry.eventDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '');
                            const role = getLogbookEntryRoleLabel(entry.personRole);
                            return `<tr><td>${role}</td><td>${entry.eventCode||''}</td><td>${yr}</td><td>${dt}</td><td>${snap.type||entry.eventType||''}</td><td>${snap.tail||entry.aircraftNumber||''}</td><td>${snap.captain||''}</td><td>${snap.crew||''}</td><td style="min-width:120px">${snap.duty||entry.duty||''}</td><td>${snap.dayP1||''}</td><td>${snap.dayP2||''}</td><td>${snap.dayDual||''}</td><td>${snap.nightP1||''}</td><td>${snap.nightP2||''}</td><td>${snap.nightDual||''}</td><td>${snap.total||entry.totalTime||''}</td><td>${snap.captTime||entry.captainTime||''}</td><td>${snap.instTime||entry.instructorTime||''}</td><td>${snap.simIf||''}</td><td>${snap.simActual||entry.ifActualTime||''}</td><td>${snap.app2D||''}</td><td>${snap.app3D||''}</td><td>${snap.simP1||''}</td><td>${snap.simP2||''}</td><td>${snap.simDual||''}</td><td>${snap.simTotal||''}</td></tr>`;
                          }).join('');
                          const w = window.open('','_blank','width=1400,height=800');
                          if (!w) return;
                          w.document.write(`<!DOCTYPE html><html><head><title>Logbook - ${instructor.name} - ${printLabel}</title><style>body{font-family:monospace;font-size:8px;margin:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:2px 3px;text-align:center;white-space:nowrap}th{background:#ddd;font-weight:bold}tr:nth-child(even){background:#f5f5f5}h2{font-size:11px;margin-bottom:6px}@page{size:landscape;margin:6mm}</style></head><body><h2>Logbook — ${instructor.name} — ${printLabel}</h2><table><thead><tr><th>Role</th><th>Event</th><th>Year</th><th>Date</th><th>Type</th><th>Tail</th><th>Captain</th><th>Co-Pilot/Crew</th><th>Duty</th><th>Day P1</th><th>Day P2</th><th>Day Dual</th><th>Nt P1</th><th>Nt P2</th><th>Nt Dual</th><th>Total</th><th>Capt</th><th>Inst</th><th>SimIF</th><th>ActIF</th><th>2D</th><th>3D</th><th>Sim P1</th><th>Sim P2</th><th>Sim Dual</th><th>Sim Tot</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
                          w.document.close(); w.focus(); w.print();
                        }}
                        className="text-[10px] text-gray-400 hover:text-white border border-gray-600/50 hover:border-gray-400 rounded px-2 py-0.5 bg-transparent"
                      >Print</button>
                      <span className="text-[10px] text-gray-400">{logbookEntries.length} entr{logbookEntries.length === 1 ? 'y' : 'ies'}</span>
                      <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">× Close</button>
                    </div>
                  </div>
                  {logbookLoading && <div className="text-gray-400 text-xs py-4 text-center animate-pulse">Loading logbook…</div>}
                  {logbookError && <div className="text-red-400 text-xs py-4 text-center">{logbookError}</div>}
                  {!logbookLoading && !logbookError && (() => {
                    // Filter entries by selected month
                    const filteredEntries = logbookEntries.filter((e: any) => (e.eventDate || '').slice(0, 7) === logbookMonth);
                    const rows: any[] = filteredEntries.map((entry: any) => {
                      const snap: any = entry.captainLogSnapshot || entry.crewLogSnapshot || {};
                      const role = getLogbookEntryRoleLabel(entry.personRole);
                      const yr = snap.year || (entry.eventDate ? new Date(entry.eventDate).getFullYear().toString() : '');
                      const dt = snap.date || (entry.eventDate ? new Date(entry.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '');
                      // Fallback to raw entry fields when snapshot values are missing
                      const total = snap.total || (entry.totalTime != null ? String(entry.totalTime) : '');
                      const captTime = snap.captTime || (entry.captainTime != null ? String(entry.captainTime) : '');
                      const instTime = snap.instTime || (entry.instructorTime != null ? String(entry.instructorTime) : '');
                      const nightP1raw = snap.nightP1 || (entry.nightTime != null ? String(entry.nightTime) : '');
                      const simActual = snap.simActual || (entry.ifActualTime != null ? String(entry.ifActualTime) : '');
                      const simIf = snap.simIf || (entry.ifSimTime != null ? String(entry.ifSimTime) : '');
                      const typeVal = snap.type || entry.eventType || '';
                      const tailVal = snap.tail || entry.aircraftNumber || '';
                      const dutyVal = snap.duty || entry.duty || '';
                      return { ...snap, year: yr, date: dt, total, captTime, instTime, nightP1: nightP1raw, simActual, simIf, type: typeVal, tail: tailVal, duty: dutyVal, _role: role, _eventCode: entry.eventCode || '' };
                    });
                    const displayRows = rows.length > 0 ? rows : [{}];
                    const C = ({ v, w, bg = 'bg-gray-800' }: { v?: string; w: string; bg?: string }) => (
                      <div className={`flex items-center justify-center ${w} flex-shrink-0 border-r border-gray-700 last:border-r-0 ${bg} h-6`}>
                        <span className="text-white text-[10px] font-mono truncate px-0.5">{v || ''}</span>
                      </div>
                    );
                    const H = ({ l, w, sub = '' }: { l: string; w: string; sub?: string }) => (
                      <div className={`flex flex-col items-center justify-end ${w} flex-shrink-0 border-r border-gray-600 last:border-r-0 bg-gray-900/60 py-0.5`}>
                        <span className="text-[8px] font-bold text-gray-400 uppercase leading-tight text-center">{l}</span>
                        {sub && <span className="text-[7px] text-gray-500 leading-tight">{sub}</span>}
                      </div>
                    );
                    return (
                      <>
                        <div className="overflow-x-auto rounded border border-gray-600">
                          <div className="inline-flex flex-col bg-gray-900 min-w-max">
                            <div className="flex flex-nowrap border-b border-gray-600 sticky top-0 z-10 bg-gray-900">
                              <div className="w-14 flex-shrink-0 border-r border-gray-600 bg-gray-900/60" />
                              <H l="Year" w="w-10" /><H l="Date" w="w-14" /><H l="Type" w="w-10" /><H l="Tail" w="w-14" />
                              <H l="Captain" w="w-20" /><H l="Co-Pilot" sub="Crew" w="w-20" /><H l="Duty" w="w-40" />
                              <div className="flex flex-col border-r border-gray-600">
                                <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Day</div>
                                <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /></div>
                              </div>
                              <div className="flex flex-col border-r border-gray-600">
                                <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Night</div>
                                <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /></div>
                              </div>
                              <H l="TOTAL" w="w-10" /><H l="Capt" w="w-10" /><H l="Inst" w="w-10" />
                              <H l="SimIF" w="w-8" /><H l="ActIF" w="w-8" /><H l="2D" w="w-8" /><H l="3D" w="w-8" />
                              <div className="flex flex-col">
                                <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Sim</div>
                                <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /><H l="Tot" w="w-8" /></div>
                              </div>
                            </div>
                            {displayRows.map((row: any, idx: number) => (
                              <div key={idx} className={`flex flex-nowrap border-t border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/10'} hover:bg-sky-900/20`}>
                                <div className="flex flex-col items-start justify-center w-14 flex-shrink-0 border-r border-gray-600 px-1">
                                  <span className="text-[8px] font-bold text-sky-400 truncate w-full">{row._role || ''}</span>
                                  <span className="text-[7px] text-gray-500 truncate w-full">{row._eventCode || ''}</span>
                                </div>
                                <C v={row.year} w="w-10" /><C v={row.date} w="w-14" /><C v={row.type} w="w-10" /><C v={row.tail} w="w-14" />
                                <C v={row.captain} w="w-20" /><C v={row.crew} w="w-20" /><C v={row.duty} w="w-40" />
                                <div className="flex border-r border-gray-600">
                                  <C v={row.dayP1 ?? ''} w="w-8" /><C v={row.dayP2 ?? ''} w="w-8" /><C v={row.dayDual ?? ''} w="w-8" />
                                </div>
                                <div className="flex border-r border-gray-600">
                                  <C v={row.nightP1 ?? ''} w="w-8" /><C v={row.nightP2 ?? ''} w="w-8" /><C v={row.nightDual ?? ''} w="w-8" />
                                </div>
                                <C v={row.total ?? ''} w="w-10" bg="bg-gray-700/30" />
                                <C v={row.captTime ?? ''} w="w-10" /><C v={row.instTime ?? ''} w="w-10" />
                                <C v={row.simIf ?? ''} w="w-8" /><C v={row.simActual ?? ''} w="w-8" />
                                <C v={String(row.app2D ?? '')} w="w-8" /><C v={String(row.app3D ?? '')} w="w-8" />
                                <div className="flex">
                                  <C v={row.simP1 ?? ''} w="w-8" bg="bg-gray-800/50" />
                                  <C v={row.simP2 ?? ''} w="w-8" bg="bg-gray-800/50" />
                                  <C v={row.simDual ?? ''} w="w-8" bg="bg-gray-800/50" />
                                  <C v={row.simTotal ?? ''} w="w-8" bg="bg-gray-800/50" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="h-[50px]" aria-hidden="true" />
                      </>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'unavailable' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white">Unavailability — {instructor.name}</h4>
                    <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>
                  <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                    {unavailabilityPeriods.length > 0 ? unavailabilityPeriods.map(p => {
                      let periodDisplay = '';
                      if (p.allDay) {
                        const startDisplay = formatDate(p.startDate);
                        const endDisplay = formatDate(p.endDate);
                        periodDisplay = p.startDate !== p.endDate ? `${startDisplay} – ${endDisplay} @ All Day` : `${startDisplay} @ All Day`;
                      } else {
                        const startDisplay = `${formatMilitaryTime(p.startTime)} ${formatDate(p.startDate)}`;
                        const endDisplay   = `${formatMilitaryTime(p.endTime)} ${formatDate(p.endDate)}`;
                        periodDisplay = p.startDate !== p.endDate ? `${startDisplay} to ${endDisplay}` : `${startDisplay} - ${endDisplay}`;
                      }
                      return (
                        <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                          <span className="text-white font-medium">{p.reason}</span>
                          <span className="text-gray-300 font-mono">{periodDisplay}</span>
                          <button onClick={() => handleRemoveUnavailability(p.id)} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
                        </div>
                      );
                    }) : <p className="text-gray-500 text-xs italic text-center py-2">No unavailability periods scheduled.</p>}
                  </div>
                  <button onClick={() => setShowAddUnavailability(true)} className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded">+ Add Unavailability</button>
                </div>
              )}

              {activeTab === 'sct' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white">Request {continuationShortLabel} — {instructor.name}</h4>
                    <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>
                  <p className="text-gray-400 text-xs italic mb-4">Submit a {continuationLongLabel} request for this staff member.</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRequestSct(instructor);
                    }}
                    className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded"
                  >Submit {continuationShortLabel} Request</button>
                  {onPatchSctRequest && onCancelSctRequest && (
                    <MySctRequestsPanel
                      requests={sctRequests}
                      currentUserId={currentUserId}
                      profileName={instructor.name}
                      continuationShortLabel={continuationShortLabel}
                      continuationLongLabel={continuationLongLabel}
                      onPatchRequest={onPatchSctRequest}
                      onCancelRequest={onCancelSctRequest}
                    />
                  )}
                </div>
              )}

              {activeTab === 'trainingReports' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Training Reports - {instructor.name}</h4>
                      <p className="mt-0.5 text-xs text-gray-400">Training reports saved against this staff member and unit.</p>
                    </div>
                    <div className="flex items-center gap-px">
                      <button type="button" onClick={() => onAddTrainingReport?.(instructor)} className={airCombatPanelButtonClass}>Add<br />Training<br />Report</button>
                      <AuditButton pageName="Air Combat Training Reports" />
                      <button onClick={() => setActiveTab(null)} className={airCombatPanelButtonClass}>Close</button>
                    </div>
                  </div>
                  {isStaffTrainingReportModel ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Assigned Training</div>
                          <div className="mt-1 text-lg font-bold text-white">{airCombatTrainingSummaries.length}</div>
                        </div>
                        <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Report Records</div>
                          <div className="mt-1 text-lg font-bold text-emerald-300">{airCombatStoredTrainingReports.length}</div>
                        </div>
                        <div className="rounded border border-gray-700 bg-gray-950/70 p-3">
                          <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Sequence Progress</div>
                          <div className="mt-1 text-lg font-bold text-sky-300">{totalAirCombatCompletedEvents}/{totalAirCombatSequenceEvents}</div>
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
                        <table className="min-w-full divide-y divide-gray-700">
                          <thead className="bg-gray-700/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">Date</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">Event</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">Training</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">Report</th>
                              <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gray-300">{trainingReportStatusFieldLabel}</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">{instructorLabel}</th>
                              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-300">Unit</th>
                              <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-gray-300">Delete</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700 bg-gray-800">
                            {airCombatStoredTrainingReports.length > 0 ? airCombatStoredTrainingReports.map((report) => {
                              const isComplete = report.status === 'Complete';
                              return (
                                <tr key={report.id} className="hover:bg-gray-700/50">
                                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">{report.date || '-'}</td>
                                  <td className="whitespace-nowrap px-4 py-2">
                                    <div className="text-xs font-bold text-sky-300">{report.eventCode}</div>
                                    <div className="max-w-[180px] truncate text-[10px] text-gray-500">{report.eventDescription || '-'}</div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="max-w-[180px] truncate text-xs font-semibold text-white">{report.trainingCode || '-'}</div>
                                    <div className="max-w-[180px] truncate text-[10px] text-gray-400">{report.trainingTitle || '-'}</div>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2">
                                    <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                                      {report.reportName || trainingReportDisplayName}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-center">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isComplete ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                      {report.overallResult || report.status || 'Draft'}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-300">{report.instructorName || '-'}</td>
                                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-400">{report.locationCode || instructor.location || '-'} / {report.unitCode || instructor.unit || '-'}</td>
                                  <td className="whitespace-nowrap px-4 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTrainingReport(report)}
                                      className="h-7 min-w-[54px] rounded-md btn-aluminium-brushed px-2 text-[10px] font-semibold text-red-700"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                                  No training reports saved for this staff member.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border border-gray-700 bg-gray-900/50 p-3 text-xs text-gray-400">
                      Staff training reports are not configured for this operational model.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'trainingProgress' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Training Progress - {instructor.name}</h4>
                      <p className="mt-0.5 text-xs text-gray-400">Progress follows the Air Combat sequence used by the NEO priority scheduler.</p>
                    </div>
                    <div className="flex items-center gap-px">
                      <button
                        type="button"
                        onClick={() => setShowAirCombatInsertEventModal(true)}
                        disabled={!selectedAirCombatTraining || selectedAirCombatTraining.sequenceItems.length === 0 || insertEventTypes.length === 0 || !onInsertAirCombatTrainingEvent}
                        className={airCombatPanelButtonClass}
                      >
                        Insert<br />Event
                      </button>
                      <button
                        type="button"
                        onClick={() => selectedAirCombatTrainingItem && setAirCombatItemBeingEdited(selectedAirCombatTrainingItem)}
                        disabled={!selectedAirCombatTrainingItem || !onUpdateAirCombatTrainingEvent}
                        className={airCombatPanelButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={openAirCombatTrainingReportPicker}
                        disabled={!selectedAirCombatTraining || selectedAirCombatTraining.sequenceItems.length === 0 || !onGenerateAirCombatTrainingReport}
                        className={airCombatPanelButtonClass}
                      >
                        Generate<br />Report
                      </button>
                      <AuditButton pageName="Air Combat Training Progress" />
                      <button onClick={() => setActiveTab(null)} className={airCombatPanelButtonClass}>Close</button>
                    </div>
                  </div>
                  {isAirCombatModel ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-gray-600 bg-gray-950/55 p-3 shadow-inner">
                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-700 pb-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Assigned Air Combat Training</div>
                            <div className="text-[11px] text-gray-500">Courses and packages assigned to this staff member.</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-gray-600 bg-gray-900 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-300">
                            {airCombatTrainingSummaries.length} assigned
                          </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                        {airCombatTrainingSummaries.length > 0 ? airCombatTrainingSummaries.map(summary => {
                          const isSelected = selectedAirCombatTraining?.assignment.trainingKey === summary.assignment.trainingKey;
                          const isPackage = summary.assignment.kind === 'training_package';
                          const accentClass = isPackage ? 'from-emerald-400 via-emerald-500 to-teal-500' : 'from-sky-300 via-sky-500 to-cyan-500';
                          const assignmentCardClass = isPackage
                            ? (isSelected ? 'border-emerald-300 bg-gray-900/90 shadow-lg shadow-emerald-950/25 ring-1 ring-emerald-300/70' : 'border-emerald-500/55 bg-gray-900/85 hover:border-emerald-400/80 hover:bg-gray-800')
                            : (isSelected ? 'border-sky-300 bg-gray-900/90 shadow-lg shadow-sky-950/30 ring-1 ring-sky-300/70' : 'border-sky-500/55 bg-gray-900/85 hover:border-sky-400/80 hover:bg-gray-800');
                          const typePillClass = isPackage ? 'border-emerald-400/45 bg-gray-950/60 text-emerald-200' : 'border-sky-300/45 bg-gray-950/60 text-sky-100';
                          return (
                            <button
                              key={summary.assignment.trainingKey}
                              type="button"
                              onClick={() => setSelectedAirCombatTrainingKey(summary.assignment.trainingKey)}
                              className={`relative min-h-[156px] w-full overflow-hidden rounded-md border p-4 text-left transition ${assignmentCardClass}`}
                            >
                              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accentClass}`} />
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Training Assignment</div>
                                  <div className="mt-1 truncate text-xl font-extrabold leading-tight text-white">{summary.assignment.code}</div>
                                  <div className="mt-0.5 truncate text-xs font-medium text-gray-300">{summary.assignment.title}</div>
                                </div>
                                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${typePillClass}`}>
                                  {isPackage ? 'Package' : 'Course'}
                                </span>
                              </div>
                              <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-700/90">
                                <div className="h-full rounded-full bg-gray-300" style={{ width: `${summary.progressPercent}%` }} />
                              </div>
                              <div className="mt-2 flex justify-between text-[11px] font-semibold text-gray-300">
                                <span>{summary.completedCount}/{summary.totalCount} complete</span>
                                <span className="text-white">{summary.progressPercent}%</span>
                              </div>
                              <div className="mt-3 rounded border border-gray-700 bg-gray-950/45 px-2.5 py-2 text-[11px] text-gray-400">
                                Next event: <span className="font-bold text-gray-100">{summary.nextItem?.code || 'Complete'}</span>
                              </div>
                            </button>
                          );
                        }) : (
                          <div className="rounded border border-gray-700 bg-gray-900/50 p-3 text-xs text-gray-500">
                            No Air Combat training assigned.
                          </div>
                        )}
                        </div>
                      </div>
                      <div className="min-h-[260px] rounded-lg border border-gray-700 bg-gray-950/35">
                        {selectedAirCombatTraining ? (
                          <div className="min-h-[260px]">
                            <div className="grid gap-3 border-b border-gray-700 bg-gray-950/30 p-3 lg:grid-cols-[minmax(220px,1fr)_140px_140px_minmax(240px,0.9fr)]">
                              <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Selected Sequence</div>
                                <div className="mt-1 truncate text-lg font-extrabold text-white">{selectedAirCombatTraining.assignment.code}</div>
                                <div className="truncate text-xs text-gray-400">{selectedAirCombatTraining.assignment.title}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 lg:contents">
                                <div className="rounded border border-gray-700 bg-gray-900/70 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-gray-500">Complete</div>
                                  <div className="text-base font-bold text-emerald-300">{selectedAirCombatTraining.completedCount}</div>
                                </div>
                                <div className="rounded border border-gray-700 bg-gray-900/70 p-2">
                                  <div className="text-[9px] uppercase tracking-wide text-gray-500">Remaining</div>
                                  <div className="text-base font-bold text-amber-300">{Math.max(0, selectedAirCombatTraining.totalCount - selectedAirCombatTraining.completedCount)}</div>
                                </div>
                              </div>
                              <div className={`rounded border bg-gray-900/70 p-3 ${isSelectedAirCombatTrainingPackage ? 'border-emerald-500/35' : 'border-sky-500/35'}`}>
                                <div className={`text-[9px] font-bold uppercase tracking-wide ${isSelectedAirCombatTrainingPackage ? 'text-emerald-300' : 'text-sky-300'}`}>Next Event</div>
                                <div className="mt-1 text-sm font-bold text-white">{selectedAirCombatTraining.nextItem?.code || 'Sequence complete'}</div>
                                {selectedAirCombatTraining.nextItem && (
                                  <div className="mt-1 text-[10px] text-gray-300">{selectedAirCombatTraining.nextItem.eventDescription || selectedAirCombatTraining.nextItem.module}</div>
                                )}
                              </div>
                              {selectedAirCombatTraining.sequenceItems.length === 0 && (
                                <div className="mt-4 rounded border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                                  No active syllabus events match this assignment code.
                                </div>
                              )}
                            </div>
                            <div className="max-h-[420px] overflow-y-auto p-3">
                              <div className="space-y-3">
                                {selectedAirCombatTraining.sequenceItems.map((item, index) => {
                                  const isCompleted = selectedAirCombatTraining.completedCodes.has(normaliseTrainingCode(item.code));
                                  const isNext = selectedAirCombatTraining.nextItem?.code === item.code;
                                  const isSelected = selectedAirCombatTrainingItem && ((item.id || item.code) === (selectedAirCombatTrainingItem.id || selectedAirCombatTrainingItem.code));
                                  const configLabel = Array.isArray(item.acceptableAircraftConfigs) && item.acceptableAircraftConfigs.length > 0 ? item.acceptableAircraftConfigs.join(', ') : 'ANY';
                                  const physicalResources = Array.isArray(item.resourcesPhysical) && item.resourcesPhysical.length > 0 ? item.resourcesPhysical.join(', ') : 'Nil';
                                  const humanResources = Array.isArray(item.resourcesHuman) && item.resourcesHuman.length > 0 ? item.resourcesHuman.join(', ') : 'Nil';
                                  const prerequisites = Array.from(new Set([...(item.prerequisitesGround || []), ...(item.prerequisitesFlying || []), ...(item.prerequisites || [])])).filter(Boolean).join(', ') || 'Nil';
                                  const linkedEventCode = getAirCombatLinkedEventCode(item);
                                  const linkedEventOptions = selectedAirCombatTraining.sequenceItems.filter(option => (
                                    (option.id || option.code) !== (item.id || item.code) &&
                                    option.code !== item.code
                                  ));
                                  const hasSavedLinkedEventOption = linkedEventOptions.some(option => (option.code || option.id) === linkedEventCode);
                                  const displayNotes = getAirCombatDisplayNotes(item);
                                  const rowToneClass = isSelectedAirCombatTrainingPackage
                                    ? (isSelected ? 'border-emerald-300 bg-gray-950/35 ring-1 ring-emerald-300/80' : 'border-emerald-500/45 bg-gray-950/25 hover:border-emerald-400/75')
                                    : (isSelected ? 'border-sky-300 bg-gray-950/35 ring-1 ring-sky-300/80' : 'border-sky-500/40 bg-gray-950/25 hover:border-sky-400/70');
                                  const eventTileToneClass = isSelectedAirCombatTrainingPackage
                                    ? (isSelected ? 'border-emerald-200 bg-gray-700/85' : isNext ? 'border-emerald-300 bg-gray-700/80' : 'border-emerald-500/45 bg-gray-700/70 hover:border-emerald-400/75 hover:bg-gray-700/85')
                                    : (isSelected ? 'border-sky-200 bg-gray-700/85' : isNext ? 'border-sky-300 bg-gray-700/80' : 'border-sky-500/40 bg-gray-700/70 hover:border-sky-400/70 hover:bg-gray-700/85');
                                  const detailTileToneClass = isSelectedAirCombatTrainingPackage
                                    ? (isSelected ? 'border-emerald-300/80 bg-gray-900/85' : 'border-emerald-500/45 bg-gray-900/75 hover:border-emerald-400/75')
                                    : (isSelected ? 'border-sky-300/80 bg-gray-900/85' : 'border-sky-500/40 bg-gray-900/75 hover:border-sky-400/70');
                                  const nextPillClass = isSelectedAirCombatTrainingPackage ? 'border border-emerald-400/45 bg-gray-950/60 text-emerald-100' : 'border border-sky-400/45 bg-gray-950/60 text-sky-100';
                                  return (
                                    <div
                                      key={item.id || `${item.code}-${index}`}
                                      className={`grid gap-3 rounded-md border p-2 transition lg:grid-cols-[210px_1fr] ${rowToneClass}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAirCombatTrainingItemId(item.id || item.code)}
                                        className={`flex min-h-[132px] flex-col rounded-md border px-3 py-2.5 text-left shadow-sm transition ${eventTileToneClass}`}
                                        title={`${item.code} - ${item.eventDescription || item.module || ''}`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">{item.phase || 'Phase'}</div>
                                            <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.type || 'Event'}</div>
                                          </div>
                                          {isCompleted && (
                                            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                                              Done
                                            </span>
                                          )}
                                          {isNext && !isCompleted && (
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${nextPillClass}`}>
                                              Next
                                            </span>
                                          )}
                                        </div>
                                        <div className="my-3 min-w-0 text-center">
                                          <div className="truncate text-2xl font-extrabold leading-none text-white">{item.code}</div>
                                          <div className="mt-1 truncate text-[10px] font-medium text-gray-400">{item.eventDescription || item.module || selectedAirCombatTraining.assignment.code}</div>
                                        </div>
                                        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 text-[10px] font-bold uppercase text-gray-300">
                                          <span className="truncate rounded bg-gray-950/45 px-1.5 py-1 text-gray-400">{item.module || selectedAirCombatTraining.assignment.code}</span>
                                          <span className="rounded bg-gray-950/45 px-1.5 py-1">{item.dayNight || 'Day'}</span>
                                          <span className="rounded bg-gray-950/45 px-1.5 py-1">{item.duration || 0}h</span>
                                        </div>
                                      </button>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedAirCombatTrainingItemId(item.id || item.code)}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setSelectedAirCombatTrainingItemId(item.id || item.code);
                                          }
                                        }}
                                        className={`min-h-[132px] rounded-md border p-3 text-left shadow-sm transition hover:bg-gray-900 ${detailTileToneClass}`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="truncate text-sm font-bold text-white">{item.eventDescription || item.code}</div>
                                            <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.phase || selectedAirCombatTraining.assignment.code} / {item.module || selectedAirCombatTraining.assignment.title}</div>
                                          </div>
                                          <span className="shrink-0 rounded-full bg-gray-950/60 px-2 py-1 text-[10px] font-bold uppercase text-gray-300">{item.type || 'Event'}</span>
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                          <div className="rounded border border-gray-800 bg-gray-950/45 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Timing</div>
                                            <div className="mt-0.5 text-[11px] font-semibold text-gray-200">{item.dayNight || 'Day'} / {item.duration || 0}h</div>
                                          </div>
                                          <div className="rounded border border-gray-800 bg-gray-950/45 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">CONFIG</div>
                                            <div className="mt-0.5 truncate text-[11px] font-semibold text-gray-200">{configLabel}</div>
                                          </div>
                                          <div className="rounded border border-gray-800 bg-gray-950/45 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Physical</div>
                                            <div className="mt-0.5 truncate text-[11px] font-semibold text-gray-200">{physicalResources}</div>
                                          </div>
                                          <div className="rounded border border-gray-800 bg-gray-950/45 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Human</div>
                                            <div className="mt-0.5 truncate text-[11px] font-semibold text-gray-200">{humanResources}</div>
                                          </div>
                                          <div className="rounded border border-gray-800 bg-gray-950/45 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Linked Events</div>
                                            <select
                                              className="mt-0.5 w-full rounded border border-gray-700 bg-gray-950 px-1.5 py-1 text-[11px] font-semibold text-gray-200 focus:border-sky-400 focus:outline-none"
                                              value={linkedEventCode || 'none'}
                                              onClick={(event) => event.stopPropagation()}
                                              onKeyDown={(event) => event.stopPropagation()}
                                              onChange={async (event) => {
                                                event.stopPropagation();
                                                await handleAirCombatLinkedEventChange(item, event.target.value);
                                              }}
                                              disabled={!onUpdateAirCombatTrainingEvent}
                                            >
                                              <option value="none">none</option>
                                              {linkedEventCode && !hasSavedLinkedEventOption && (
                                                <option value={linkedEventCode}>{linkedEventCode}</option>
                                              )}
                                              {linkedEventOptions.map(option => (
                                                <option key={option.id || option.code} value={option.code || option.id}>
                                                  {option.code || option.id} - {option.eventDescription || option.module || 'Event'}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                        <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_1.3fr]">
                                          <div className="rounded border border-gray-800 bg-gray-950/35 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Prerequisites</div>
                                            <div className="mt-0.5 max-h-[2.6em] overflow-hidden text-[11px] leading-snug text-gray-300">{prerequisites}</div>
                                          </div>
                                          <div className="rounded border border-gray-800 bg-gray-950/35 px-2 py-1.5">
                                            <div className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Notes</div>
                                            <div className="mt-0.5 max-h-[2.6em] overflow-hidden whitespace-pre-line text-[11px] leading-snug text-gray-300">{displayNotes}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
                            Select assigned training to view progress.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded border border-gray-700 bg-gray-900/50 p-3 text-xs text-gray-400">
                      Staff training progress is not configured for this operational model.
                    </div>
                  )}
                </div>
              )}

              {/* ── SECTION 1: MAIN INFO CARD (always visible) ── */}
              <div className={card3d + " p-4"} style={card3dStyle}>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Edit mode photo upload */}
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {/* Photo frame — clickable in edit mode */}
                        <div
                          className="relative w-20 h-24 bg-gray-700 rounded border border-gray-500 flex items-center justify-center overflow-hidden cursor-pointer group"
                          onClick={() => photoInputRef.current?.click()}
                          onDragOver={e => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                          }}
                          onDrop={handlePhotoDrop}
                          title="Click to change profile photo"
                        >
                          {(() => {
                            const displayUrl = pendingPhotoRemoved ? null : (pendingPhotoDataUrl || (photoLoadFailed ? null : photoUrl));
                            return displayUrl ? (
                              <>
                                <img
                                  src={displayUrl}
                                  alt={name}
                                  className="w-full h-full object-cover object-top"
                                  onError={() => setPhotoLoadFailed(true)}
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span className="text-[9px] text-white font-medium">Change</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                                  <span className="text-lg font-bold text-gray-300 leading-none select-none">
                                    {profilePhotoInitials(name)}
                                  </span>
                                  <span className="text-[7px] text-gray-300 leading-tight break-words">
                                    Click to add picture<br />or drag and drop
                                  </span>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span className="text-[9px] text-white font-medium">Upload</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        {/* Status / error */}
                        {photoUploading && (
                          <div className="mt-1 w-20 text-[8px] text-sky-400 text-center">Saving…</div>
                        )}
                        {photoError && (
                          <div className="mt-1 w-20 text-[8px] text-red-400 leading-tight break-words">{photoError}</div>
                        )}
                        {/* Pending indicator */}
                        {pendingPhotoDataUrl && !photoUploading && (
                          <div className="mt-1 w-20 text-[8px] text-amber-400 text-center leading-tight">Pending save</div>
                        )}
                        {/* Remove button — shown when there is a photo to remove */}
                        {(pendingPhotoDataUrl || (photoUrl && !pendingPhotoRemoved)) && !photoUploading && (
                          <button
                            onClick={handlePhotoRemoveInEdit}
                            className="mt-1 w-20 text-[8px] text-gray-500 hover:text-red-400 text-center transition-colors"
                            title="Remove profile photo"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">
                        <p className="text-gray-400 font-medium mb-0.5">Profile Photo</p>
                        <p>Click the photo frame to upload.</p>
                        <p>Changes are saved when you click <span className="text-white">Save</span>.</p>
                        <p className="mt-0.5">Max 2 MB &mdash; JPG, PNG, GIF, WebP.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InputField label="Name (Surname, Firstname)" value={name} onChange={e => setName(e.target.value)} />
                      <InputField label="Personnel ID" value={idNumber || ''} onChange={e => setIdNumber(parseInt(e.target.value) || 0)} />
                      <Dropdown label="Rank" value={rank} onChange={e => setRank(e.target.value as InstructorRank)}>
                        {staffRankOptionGroups.map(group => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map(option => (
                              <option key={`${group.label}-${option}`} value={option}>{option}</option>
                            ))}
                          </optgroup>
                        ))}
                      </Dropdown>
                      <Dropdown label="Role" value={role} onChange={e => handleRoleChange(e.target.value as StaffRole)}>
                        {staffRoleOptions.map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <InputField label="Callsign" value={displayCallsign || 'Auto assigned'} onChange={() => {}} readOnly />
                      <InputField label="Secondary Callsign" value={secondaryCallsign} onChange={e => setSecondaryCallsign(e.target.value)} />
                      <InputField label="Crew" value={crew} onChange={e => setCrew(e.target.value)} />
                      <Dropdown label="Service" value={service || ''} onChange={e => setService(e.target.value)}>
                        <option value="">Select...</option>
                        {configuredServiceOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </Dropdown>
                      {isContractorStaffRoleValue(String(role)) ? (
                        <InputField label="Category" value={simIpDisplayLabel} onChange={() => {}} readOnly />
                      ) : (
                        <Dropdown label="Category" value={category} onChange={e => setCategory(e.target.value as InstructorCategory)}>
                          <option value="UnCat">UnCat</option><option value="D">D</option><option value="C">C</option><option value="B">B</option><option value="A">A</option>
                        </Dropdown>
                      )}
                      <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}>
                        <option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option>
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Dropdown label="Unit" value={unit} onChange={e => setUnit(e.target.value)}>
                        <option value="">Select...</option>
                        {(units || []).map(u => <option key={u} value={u}>{u}</option>)}
                      </Dropdown>
                      <Dropdown label="Location" value={location} onChange={e => setLocation(e.target.value)}>
                        {(locations || []).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </Dropdown>
                      <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                      <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <AccountAccessPanel
                      personType="staff"
                      personId={(instructor as any).id || instructor.idNumber}
                      idNumber={idNumber}
                      name={name || instructor.name}
                      email={email}
                      canManage={canManageAccountAccess}
                      activationDisabledReason="Save this profile before sending account activation."
                    />
                    {/* Qualification checkboxes */}
                    <div className="bg-gray-700/30 rounded p-3">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Qualifications</label>
                      {activeQualificationOptions.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {activeQualificationOptions.map(qualification => (
                            <label key={qualification.id} className="flex items-center space-x-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={assignedQualifications.some(id => qualificationMatches(id, qualification))}
                                onChange={e => handleQualificationChange(qualification.id, e.target.checked)}
                                className="h-3 w-3 accent-emerald-500"
                              />
                              <span className="text-white text-xs truncate" title={qualification.name}>
                                {qualification.code || qualification.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">No qualifications configured for this operational model.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE: avatar + data grid + qualifications panel */
                  <div className="flex gap-4">
                    {/* Profile photo */}
                    <div className="flex-shrink-0">
                      <div
                        className="relative w-20 h-24 bg-gray-700 rounded border border-gray-500 flex items-center justify-center overflow-hidden cursor-pointer group"
                        onClick={() => photoInputRef.current?.click()}
                        onDragOver={e => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                        }}
                        onDrop={handlePhotoDrop}
                        title="Click to add profile photo"
                      >
                        {photoUrl && !photoLoadFailed ? (
                          <>
                            <img
                              src={photoUrl}
                              alt={instructor.name}
                              className="w-full h-full object-cover object-top"
                              onError={() => setPhotoLoadFailed(true)}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-[9px] text-white font-medium">Change</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
                            <span className="text-lg font-bold text-gray-300 leading-none select-none">
                              {profilePhotoInitials(instructor.name)}
                            </span>
                            <span className="text-[7px] text-gray-300 leading-tight break-words">
                              Click to add picture<br />or drag and drop
                            </span>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-[9px] text-white font-medium">Upload</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {photoUploading && (
                        <div className="mt-1 w-20 text-[8px] text-sky-400 text-center">Saving…</div>
                      )}
                      {photoError && (
                        <div className="mt-1 w-20 text-[8px] text-red-400 leading-tight break-words">{photoError}</div>
                      )}
                    </div>

                    {/* Name + data grid */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-xl font-bold text-white">{instructor.name}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">Active</span>
                      </div>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-2 text-xs">
                        {/* Row 1 */}
                        <div><span className="text-gray-400 block text-[10px]">Personnel ID</span><span className="text-white font-medium">{instructor.idNumber || '-'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Role</span><span className="text-sky-300 font-medium">{profileRoleDisplay.label}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Category</span><span className="text-white font-medium">{isContractorStaffRoleValue(instructor.role) ? simIpDisplayLabel : instructor.category}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{displayCallsign || '[None]'}</span></div>
                        {/* Row 2 */}
                        <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">{instructor.secondaryCallsign || '[None]'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{instructor.crew || '[None]'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{instructor.rank}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{instructor.service || '[None]'}</span></div>
                        {/* Row 3 */}
                        <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{instructor.unit}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{instructor.seatConfig}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{instructor.location}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{instructor.flight || 'N/A'}</span></div>
                        {/* Row 4 */}
                        <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 flex gap-2">
                      <div className={card3d + " w-36 p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                        <div className="text-[10px] text-gray-400 font-semibold mb-2">Qualifications</div>
                        <div className="space-y-1">
                          {assignedQualificationLabels.length > 0
                            ? assignedQualificationLabels.map(label => (
                                <div key={label} className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-100 text-[10px] font-semibold break-words">
                                  {label}
                                </div>
                              ))
                            : <div className="text-gray-500 text-[10px] italic">None</div>
                          }
                        </div>
                      </div>
                      <div className={card3d + " w-36 p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                        <div className="text-[10px] text-gray-400 font-semibold mb-2">Permissions</div>
                        <div className="space-y-1">
                          {assignedPermissionProfileLabels.length > 0
                            ? assignedPermissionProfileLabels.map(label => (
                                <div key={label} className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-cyan-100 text-[10px] font-semibold break-words">
                                  {label}{hasPermissionProfileExceptions ? ' *' : ''}
                                </div>
                              ))
                            : <div className="text-gray-500 text-[10px] italic">None</div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isEditing && !isCreating && (
                <AccountAccessPanel
                  personType="staff"
                  personId={(instructor as any).id || instructor.idNumber}
                  idNumber={instructor.idNumber}
                  name={instructor.name}
                  email={instructor.email}
                  canManage={canManageAccountAccess}
                />
              )}

              {/* ── SECTION 2: ASSIGNED TRAINING / TRAINEES (always visible, not editing) ── */}
              {!isEditing && !isCreating && isAirCombatModel && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <h4 className="text-xs font-semibold text-gray-300 mb-3">Assigned Training</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { title: 'Courses', items: assignedTraining.courses },
                      { title: 'Training Packages', items: assignedTraining.trainingPackages },
                    ].map(group => (
                      <div key={group.title} className={card3d + " p-3"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                        <div className="text-[9px] text-sky-400 font-semibold mb-2">{group.title}</div>
                        {group.items.length > 0 ? (
                          <div className="space-y-1">
                            {group.items.map(item => (
                              <div key={item.trainingKey} className="rounded border border-gray-700 bg-gray-900/60 px-2 py-1">
                                <div className="text-[10px] font-semibold text-white">{item.code}</div>
                                <div className="text-[9px] text-gray-400 truncate">{item.title}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-[10px] italic">Nil</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!isEditing && !isCreating && !isAirCombatModel && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <h4 className="text-xs font-semibold text-gray-300 mb-3">Assigned Trainees</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Primary Trainee 1 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-sky-400 font-semibold mb-1.5">Primary</div>
                      {primaryTrainees[0] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(primaryTrainees[0])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {primaryTrainees[0].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Primary Trainee 2 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-sky-400 font-semibold mb-1.5">Primary</div>
                      {primaryTrainees[1] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(primaryTrainees[1])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {primaryTrainees[1].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Secondary Trainee 1 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-amber-400 font-semibold mb-1.5">Secondary</div>
                      {secondaryTrainees[0] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(secondaryTrainees[0])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {secondaryTrainees[0].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Secondary Trainee 2 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-amber-400 font-semibold mb-1.5">Secondary</div>
                      {secondaryTrainees[1] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(secondaryTrainees[1])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {secondaryTrainees[1].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION 3: LOGBOOK VIEW (always visible, not editing) ── */}
              {!isEditing && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <h4 className="text-xs font-semibold text-gray-300 mb-3">Logbook – Prior Experience ({resourceDisplayNames.aircraft} only)</h4>
                  <div className="flex gap-2">
                    <CircularGauge title="Day Flying" mainValue={exp.day.p1 + exp.day.p2 + exp.day.dual}
                      subItems={[{ label: 'P1', value: exp.day.p1 }, { label: 'P2', value: exp.day.p2 }, { label: 'Dual', value: exp.day.dual }]} />
                    <CircularGauge title="Night Flying" mainValue={exp.night.p1 + exp.night.p2 + exp.night.dual}
                      subItems={[{ label: 'P1', value: exp.night.p1 }, { label: 'P2', value: exp.night.p2 }, { label: 'Dual', value: exp.night.dual }]} />
                    <CircularGauge title="Totals" mainValue={exp.total}
                      subItems={[{ label: 'TOTAL', value: exp.total }, { label: 'Captain', value: exp.captain }, { label: 'Instructor', value: exp.instructor }]} />
                    <CircularGauge title="Inst Sim" mainValue={exp.instrument.sim} borderColor="border-purple-500/60"
                      subItems={[{ label: 'Sim', value: exp.instrument.sim }]} />
                    <CircularGauge title="Inst Actual" mainValue={exp.instrument.actual} borderColor="border-purple-500/60"
                      subItems={[{ label: 'Actual', value: exp.instrument.actual }]} />
                    {(() => {
                      const ftdTotal = logbookEntries
                        .filter((e: any) => e.isFtdLog === true)
                        .reduce((sum: number, e: any) => {
                          const snap: any = e.captainLogSnapshot || e.crewLogSnapshot || {};
                          const val = snap.simTotal != null ? parseFloat(snap.simTotal) : (e.totalTime != null ? Number(e.totalTime) : 0);
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0);
                      const simMainValue = exp.simulator.total + ftdTotal;
                      const simSubItems: { label: string; value: number }[] = [
                        { label: 'Prior P1', value: exp.simulator.p1 },
                        { label: 'Prior P2', value: exp.simulator.p2 },
                        { label: 'Prior Dual', value: exp.simulator.dual },
                        { label: 'Prior Total', value: exp.simulator.total },
                        ...(ftdTotal > 0 ? [{ label: resourceDisplayNames.ftd, value: ftdTotal }] : []),
                      ];
                      return <CircularGauge title={resourceDisplayNames.ftd} mainValue={simMainValue} subItems={simSubItems} />;
                    })()}
                  </div>
                </div>
              )}

              {/* ── SECTION 3: LOGBOOK EDIT (always visible, editing) ── */}
              {isEditing && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <h4 className="text-xs font-semibold text-sky-400 mb-3">Logbook – Prior Experience ({resourceDisplayNames.aircraft} only)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">Day Flying</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="P1" value={exp.day.p1} onChange={v => handleExperienceChange('day', 'p1', v)} />
                        <ExperienceInput label="P2" value={exp.day.p2} onChange={v => handleExperienceChange('day', 'p2', v)} />
                        <ExperienceInput label="Dual" value={exp.day.dual} onChange={v => handleExperienceChange('day', 'dual', v)} />
                      </div>
                    </div>
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">Night Flying</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="P1" value={exp.night.p1} onChange={v => handleExperienceChange('night', 'p1', v)} />
                        <ExperienceInput label="P2" value={exp.night.p2} onChange={v => handleExperienceChange('night', 'p2', v)} />
                        <ExperienceInput label="Dual" value={exp.night.dual} onChange={v => handleExperienceChange('night', 'dual', v)} />
                      </div>
                    </div>
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">Totals</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="TOTAL" value={exp.total} onChange={v => handleExperienceChange('total', null, v)} />
                        <ExperienceInput label="Captain" value={exp.captain} onChange={v => handleExperienceChange('captain', null, v)} />
                        <ExperienceInput label="Instructor" value={exp.instructor} onChange={v => handleExperienceChange('instructor', null, v)} />
                      </div>
                    </div>
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">Instrument</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="Sim" value={exp.instrument.sim} onChange={v => handleExperienceChange('instrument', 'sim', v)} />
                        <ExperienceInput label="Actual" value={exp.instrument.actual} onChange={v => handleExperienceChange('instrument', 'actual', v)} />
                      </div>
                    </div>
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">{resourceDisplayNames.ftd}</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="P1" value={exp.simulator.p1} onChange={v => handleExperienceChange('simulator', 'p1', v)} />
                        <ExperienceInput label="P2" value={exp.simulator.p2} onChange={v => handleExperienceChange('simulator', 'p2', v)} />
                        <ExperienceInput label="Dual" value={exp.simulator.dual} onChange={v => handleExperienceChange('simulator', 'dual', v)} />
                        <ExperienceInput label="Total" value={exp.simulator.total} onChange={v => handleExperienceChange('simulator', 'total', v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION 4: UNAVAILABILITY SUMMARY (always visible) ── */}
              <div className={card3d + " p-3"} style={card3dStyle}>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Unavailability</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unavailabilityPeriods.length > 0 ? unavailabilityPeriods.map(p => {
                    let periodDisplay = '';
                    if (p.allDay) {
                      const startDisplay = formatDate(p.startDate);
                      const endDisplay = formatDate(p.endDate);
                      periodDisplay = p.startDate !== p.endDate ? `${startDisplay} – ${endDisplay} @ All Day` : `${startDisplay} @ All Day`;
                    } else {
                      const startDisplay = `${formatMilitaryTime(p.startTime)} ${formatDate(p.startDate)}`;
                      const endDisplay   = `${formatMilitaryTime(p.endTime)} ${formatDate(p.endDate)}`;
                      periodDisplay = p.startDate !== p.endDate ? `${startDisplay} to ${endDisplay}` : `${startDisplay} - ${endDisplay}`;
                    }
                    return (
                      <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                        <span className="text-white font-medium">{p.reason}</span>
                        <span className="text-gray-300 font-mono">{periodDisplay}</span>
                      </div>
                    );
                  }) : <p className="text-sm text-gray-500 text-center italic py-2">No unavailability periods scheduled.</p>}
                </div>
              </div>

            </div>

            {/* RIGHT BUTTON PANEL */}
            <div className="w-[95px] flex-shrink-0 border-l border-gray-600 bg-[#0f1824] pt-2 pb-2 px-[10px] flex flex-col space-y-[1px]">
              {!isEditing && !isCreating && (<>
                <button onClick={(event) => handleTabClick('unavailable', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('unavailable')} className={tabBtnClass('unavailable', canOpenStaffProfileTab('unavailable'))}>Unavailable</button>
                <button onClick={(event) => handleTabClick('currency', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('currency')} className={tabBtnClass('currency', canOpenStaffProfileTab('currency'))}>Currency</button>
                <button onClick={(event) => handleTabClick('logbook', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('logbook')} className={tabBtnClass('logbook', canOpenStaffProfileTab('logbook'))}>Logbook</button>
                <button onClick={(event) => handleTabClick('sct', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('sct')} className={tabBtnClass('sct', canOpenStaffProfileTab('sct'))}>Request {continuationShortLabel}</button>
                <button onClick={(event) => handleTabClick('trainingReports', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('trainingReports')} className={tabBtnClass('trainingReports', canOpenStaffProfileTab('trainingReports'))}>Training Reports</button>
                <button onClick={(event) => handleTabClick('trainingProgress', event.currentTarget)} aria-disabled={!canOpenStaffProfileTab('trainingProgress')} className={tabBtnClass('trainingProgress', canOpenStaffProfileTab('trainingProgress'))}>Training Progress</button>
                <button onClick={(event) => {
                  if (!canUseStaffProfileAction('staff.profile.edit')) {
                    showPermissionNoticeForElement(event.currentTarget);
                    return;
                  }
                  setActiveTab(null);
                  handleEdit();
                }} disabled={isFrozen} aria-disabled={!canUseStaffProfileAction('staff.profile.edit')} className={`${btnClass} ${canUseStaffProfileAction('staff.profile.edit') ? '' : 'cursor-not-allowed'}`}>Edit</button>
                <button onClick={onClose} className={btnClass}>Close</button>
              </>)}
              {isEditing && (<>
                <button onClick={handleSave} className={btnClass}>Save</button>
                <button onClick={handleCancel} className={btnClass}>Cancel</button>
              </>)}
            </div>
          </div>
        </div>
      </div>
      {showAirCombatInsertEventModal && selectedAirCombatTraining && (
        <InsertEventModal
          traineeLmp={selectedAirCombatTraining.sequenceItems}
          insertEventTypes={insertEventTypes}
          selectedAnchorItem={selectedAirCombatTrainingItem}
          description="Create an Air Combat course/package event with the scheduling fields NEO Build needs."
          onCancel={() => setShowAirCombatInsertEventModal(false)}
          onSave={async (request) => {
            const inserted = await onInsertAirCombatTrainingEvent?.(
              instructor,
              selectedAirCombatTraining.assignment,
              selectedAirCombatTraining.sequenceItems,
              request,
            );
            if (inserted !== false) setShowAirCombatInsertEventModal(false);
          }}
        />
      )}
      {airCombatItemBeingEdited && selectedAirCombatTraining && (
        <LmpEventEditModal
          item={airCombatItemBeingEdited}
          aircraftConfigurations={aircraftConfigurations}
          description="Update the Air Combat training event details used by Training Progress and NEO Build."
          onCancel={() => setAirCombatItemBeingEdited(null)}
          onSave={async (updatedItem) => {
            const updated = await onUpdateAirCombatTrainingEvent?.(
              instructor,
              selectedAirCombatTraining.assignment,
              airCombatItemBeingEdited,
              updatedItem,
            );
            if (updated !== false) {
              setSelectedAirCombatTrainingItemId(updatedItem.id || updatedItem.code);
              setAirCombatItemBeingEdited(null);
            }
          }}
        />
      )}
      {showAirCombatGenerateReportModal && selectedAirCombatTraining && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-600 bg-gray-900 p-5 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-white">Create Training Report</h3>
              <p className="mt-1 text-sm text-gray-400">
                Select the Air Combat event to open a new {trainingReportDisplayName} training report for {instructor.name}.
              </p>
            </div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">Event</label>
            <select
              value={airCombatReportItemId}
              onChange={(event) => setAirCombatReportItemId(event.target.value)}
              className="mb-5 block w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              {selectedAirCombatTraining.sequenceItems.map(item => {
                const itemKey = item.id || item.code;
                return (
                  <option key={itemKey} value={itemKey}>
                    {item.code} - {item.eventDescription || item.module || selectedAirCombatTraining.assignment.title}
                  </option>
                );
              })}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAirCombatGenerateReportModal(false)}
                className="h-10 min-w-[92px] rounded-md btn-aluminium-brushed text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const selectedItem = selectedAirCombatTraining.sequenceItems.find(item => (
                    (item.id || item.code) === airCombatReportItemId ||
                    item.code === airCombatReportItemId
                  )) || selectedAirCombatTraining.nextItem || selectedAirCombatTraining.sequenceItems[0];
                  if (!selectedItem) return;
                  await onGenerateAirCombatTrainingReport?.(
                    instructor,
                    selectedAirCombatTraining.assignment,
                    selectedItem,
                  );
                  setShowAirCombatGenerateReportModal(false);
                }}
                disabled={!airCombatReportItemId || !onGenerateAirCombatTrainingReport}
                className="h-10 min-w-[120px] rounded-md btn-aluminium-brushed text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Report
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddUnavailability && !isCreating && (
        <AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnly} onSave={handleSaveUnavailability} unavailabilityPeriods={unavailabilityPeriods} onRemove={handleRemoveUnavailability} />
      )}
      <PermissionNotice
        anchorRect={permissionNoticeRect}
        onClose={() => setPermissionNoticeRect(null)}
      />
    </>
  );
};
