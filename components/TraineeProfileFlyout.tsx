import { useSystemFreeze } from '../hooks/useSystemFreeze';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { jsPDF } from 'jspdf';
import { Trainee, TraineeRank, SeatConfig, UnavailabilityPeriod, ScheduleEvent, Score, SyllabusItemDetail, UnavailabilityReason, Instructor, LogbookExperience, MasterCurrency, CurrencyRequirement, PersonCurrencyStatus, Pt051Assessment, PhraseBank } from '../types';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import PauseConfirmationFlyout from './PauseConfirmationFlyout';
import ScheduleWarningFlyout from './ScheduleWarningFlyout';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';
import CurrencyPanel from './CurrencyPanel';
import CurrencyAuditFlyout from './CurrencyAuditFlyout';
import HateSheetView from './HateSheetView';
import TraineeLmpView from './TraineeLmpView';
import PT051View from './PT051View';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, type ResourceDisplayNames } from '../utils/resourceDisplayNames';
import {
  DEFAULT_PERSONNEL_DISPLAY_SETTINGS,
  getRankOptionsForGroup,
  type PersonnelDisplaySettings,
} from '../utils/personnelDisplaySettings';
import {
  DEFAULT_TRAINING_REPORT_TERMINOLOGY,
  DEFAULT_TRAINING_REPORT_TEMPLATE,
  getUnitTrainingReportPhraseBank,
  getUnitTrainingReportTemplate,
  type TrainingReportTerminology,
  type TrainingReportTemplate,
} from '../utils/trainingReportTerminology';
import type { InsertEventTypeConfig } from '../utils/insertEventTypes';
import type { InsertLmpEventRequest } from './TraineeLmpView';
import type { AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import {
  getVisiblePermissions,
  isTraineeSuspended,
  setTraineeSuspendedMarker,
} from '../utils/traineeStatus';
import { isExternalDataAllowed } from '../utils/externalDataControls';
import {
  filterMasterLmpCodesForAccess,
  type PlatformConfig,
} from '../utils/platformConfigService';
import { DEFAULT_PHRASE_BANK } from '../config/phraseBankConfig';

const COURSE_MASTER_LMPS = ['BPC+IPC', 'FIC', 'OFI', 'WSO', 'FIC(I)', 'PLT CONV', 'QFI CONV', 'PLT Refresh', 'Staff CAT'];
// ACADEMIC_LMP_COURSES is derived dynamically from syllabusDetails (DB only, no hardcoded fallback)

interface TraineeProfileFlyoutProps {
  trainee: Trainee;
  traineesData?: Trainee[];
  onClose: () => void;
  onUpdateTrainee: (data: Trainee) => void;
  events: ScheduleEvent[];
  school: 'ESL' | 'PEA';
  onNavigateToHateSheet: (trainee: Trainee) => void;
  onAddRemedialPackage: (trainee: Trainee) => void;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number; callsign?: string }>;
  courseColors: { [key: string]: string };
  scores: Map<string, Score[]>;
  syllabusDetails: SyllabusItemDetail[];
  onNavigateToSyllabus: (syllabusId: string) => void;
  onNavigateToCurrency: (person: Instructor | Trainee) => void;
  locations: string[];
  units: string[];
  individualLmp: SyllabusItemDetail[];
  onViewLogbook?: (person: Trainee) => void;
  isCreating?: boolean;
  activeCourses?: string[];
  onOpenInstructorProfile?: (instructorName: string) => void;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  currentUserId?: string;
  currentUserName?: string;
  pt051Assessments?: Map<string, Pt051Assessment>;
  pt051PerformanceLoading?: boolean;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  userProfile?: any;
  initialActiveTab?: 'unavailable' | 'currency' | 'review' | 'logbook' | 'hatesheet' | 'lmp' | 'pt051' | null;
  onSelectPt051ForEvent?: (assessment: Pt051Assessment) => void;
  onSavePt051Assessment?: (assessment: Pt051Assessment) => void;
  onDeletePt051Assessment?: (assessmentId: string, eventId: string, traineeFullName: string) => void;
  instructorsData?: Instructor[];
  registerDirtyCheck?: (isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => void;
  phraseBank?: PhraseBank;
  trainingReportTemplate?: Partial<TrainingReportTemplate> | null;
  canViewPt051?: boolean;
  canEditPt051?: boolean;
  canViewIndividualLmp?: boolean;
  canAddRemedialPackage?: boolean;
  onDeleteRemedialItem?: (trainee: Trainee, item: SyllabusItemDetail) => Promise<boolean> | boolean;
  onGeneratePt051ForItem?: (trainee: Trainee, item: SyllabusItemDetail) => void;
  onInsertCustomLmpEvent?: (trainee: Trainee, request: InsertLmpEventRequest) => Promise<boolean> | boolean;
  onUpdateLmpItem?: (trainee: Trainee, originalItem: SyllabusItemDetail, updatedItem: SyllabusItemDetail) => Promise<boolean> | boolean;
  insertEventTypes?: InsertEventTypeConfig[];
  aircraftConfigurations?: AircraftConfigurationDefinition[];
  onAccessDenied?: (actionLabel: string) => void;
  resourceDisplayNames?: ResourceDisplayNames;
  personnelDisplaySettings?: Partial<PersonnelDisplaySettings> | null;
  trainingReportTerminology?: Partial<TrainingReportTerminology> | null;
  platformConfig?: PlatformConfig | null;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <div className={`mt-1 text-white p-2 bg-gray-700/50 rounded-md min-h-[38px] flex items-center ${className}`}>
            {value}
        </div>
    </div>
);

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean }> = ({ label, value, onChange, readOnly }) => (
     <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <input
            type="text"
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm ${readOnly ? 'bg-gray-700/50 cursor-not-allowed' : ''}`}
        />
    </div>
);

const Dropdown: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; }> = ({ label, value, onChange, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <select
            value={value}
            onChange={onChange}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        >
            {children}
        </select>
    </div>
);

// Reused Experience Components
const ExperienceInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            min="0"
            step="0.1"
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
    </div>
);

const ExperienceDisplay: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex flex-col items-center">
        <label className="text-xs text-gray-500 mb-1">{label}</label>
        <div className="w-20 bg-gray-800/50 rounded-md py-1 px-2 text-white text-sm text-center font-mono border border-gray-700">
            {value.toFixed(1)}
        </div>
    </div>
);

const pushTrainingReportNotesDiag = (stage: string, payload: Record<string, any> = {}) => {
  try {
    const existing = JSON.parse(window.localStorage.getItem('neo_training_report_notes_diag') || '[]');
    const next = [
      ...(Array.isArray(existing) ? existing : []),
      {
        ts: new Date().toISOString(),
        stage,
        ...payload,
      },
    ].slice(-250);
    window.localStorage.setItem('neo_training_report_notes_diag', JSON.stringify(next));
  } catch {
    // Diagnostics must not affect profile rendering.
  }
};

const CircularGauge: React.FC<{ title: string; mainValue: number; subItems: { label: string; value: number }[] }> = ({ title, mainValue, subItems }) => (
  <div className="flex flex-col items-center bg-gray-800/60 rounded-lg p-2 min-w-[80px]">
    <div className="text-[10px] text-gray-400 font-semibold mb-1 text-center">{title}</div>
    <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-1">
      <span className="text-white font-bold text-sm">{mainValue.toFixed(1)}</span>
    </div>
    <div className="space-y-0.5 w-full">
      {subItems.map(item => (
        <div key={item.label} className="flex justify-between text-[9px]">
          <span className="text-gray-400">{item.label}</span>
          <span className="text-white font-medium">{item.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  </div>
);

const InstrumentGauge: React.FC<{ sim: number; actual: number }> = ({ sim, actual }) => (
  <div className="flex flex-col items-center bg-gray-800/60 rounded-lg p-2 min-w-[80px]">
    <div className="text-[10px] text-gray-400 font-semibold mb-1 text-center">Instrument</div>
    <div className="w-14 h-14 rounded-full border-4 border-purple-500/60 flex items-center justify-center mb-1">
      <span className="text-white font-bold text-sm">{(sim + actual).toFixed(1)}</span>
    </div>
    <div className="space-y-0.5 w-full">
      <div className="flex justify-between text-[9px]"><span className="text-gray-400">Sim</span><span className="text-white font-medium">{sim.toFixed(1)}</span></div>
      <div className="flex justify-between text-[9px]"><span className="text-gray-400">Actual</span><span className="text-white font-medium">{actual.toFixed(1)}</span></div>
    </div>
  </div>
);



const EventDetailCard: React.FC<{
  event: SyllabusItemDetail | null;
  title: string;
  onNavigate: (syllabusId: string) => void;
  onCloseFlyout: () => void;
  reason?: string;
}> = ({ event, title, onNavigate, onCloseFlyout, reason }) => {

  const handleNavigate = () => {
    if (event) {
      onNavigate(event.id);
      onCloseFlyout();
    }
  };

  return (
    <fieldset className="p-3 border border-gray-600 rounded-lg">
      <legend className="px-2 text-sm font-semibold text-gray-300">{title}</legend>
      {event ? (
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Event:</span>
            <button onClick={handleNavigate} className="font-semibold text-sky-400 hover:underline focus:outline-none">
              {event.id}
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white font-medium">{event.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white font-medium">{event.duration.toFixed(1)} hrs</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-center text-center italic text-gray-500 h-[80px]">
            <div>
                <p>No {title.toLowerCase()} found.</p>
                {reason && <p className="text-xs mt-1">{reason}</p>}
            </div>
        </div>
      )}
    </fieldset>
  );
};

// Returns "dd Mmm" e.g. "12 Apr"
const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00Z`);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
    return `${day} ${month}`;
};

const LastEventCard: React.FC<{
  title: string;
  date: string | undefined;
  daysSince: number | null;
  eventCode?: string | null;
}> = ({ title, date, daysSince, eventCode }) => (
    <fieldset className="p-3 border border-gray-600 rounded-lg">
      <legend className="px-2 text-sm font-semibold text-gray-300">{title}</legend>
      {date && daysSince !== null ? (
        <div className="mt-2 space-y-2 text-sm">
          {eventCode && (
              <div className="flex justify-between items-center">
                  <span className="text-gray-400">Event:</span>
                  <span className="font-semibold text-white">{eventCode}</span>
              </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Date:</span>
            <span className="font-semibold text-white">{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Days Since:</span>
            <span className="text-white font-bold text-lg">{daysSince}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-center text-center italic text-gray-500 h-[78px]">
            <p>No event recorded.</p>
        </div>
      )}
    </fieldset>
);

const initialExperience: LogbookExperience = {
    day: { p1: 0, p2: 0, dual: 0 },
    night: { p1: 0, p2: 0, dual: 0 },
    total: 0,
    captain: 0,
    instructor: 0,
    instrument: { sim: 0, actual: 0 },
    simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
};

type TraineeReviewPoint = {
    code: string;
    date: string;
    grade: number;
    smoothed: number;
    status: 'fail' | 'marginal' | 'double-marginal' | 'pass';
    comments: string;
};

type TraineeReviewHourRow = {
    code: string;
    date: string;
    logbookHours: number;
    syllabusHours: number;
    ineffectiveHours: number;
    effectiveHours: number;
    cumulativeLogbook: number;
    cumulativeSyllabus: number;
    cumulativeEffective: number;
};

const reviewNumber = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const reviewEventCode = (value: unknown): string => String(value || '').trim().toUpperCase();

const reviewLmpRefs = (item: SyllabusItemDetail): string[] => [
    item.id,
    item.code,
    item.masterEventId,
].filter(Boolean).map(reviewEventCode);

const reviewIsCountableLmpEvent = (item: SyllabusItemDetail): boolean => {
    const code = reviewEventCode(item.code);
    if (!code || code.includes(' MB') || code.includes('MORNING_BREAK')) return false;
    return !item.isRemedial && ['Flight', 'FTD'].includes(item.type);
};

const reviewIsCourseProgressLmpEvent = (item: SyllabusItemDetail): boolean => {
    const lmpSource = String((item as any).lmpSource || 'master').toLowerCase();
    return Boolean(reviewEventCode(item.code)) && !item.isRemedial && item.type !== 'Academics' && lmpSource !== 'remedial' && lmpSource !== 'custom';
};

const reviewUniqueByEventCode = (items: SyllabusItemDetail[]): SyllabusItemDetail[] => {
    const seen = new Set<string>();
    return items.filter(item => {
        const code = reviewEventCode(item.code || item.masterEventId || item.id);
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
    });
};

const reviewItemBelongsToLmpType = (item: SyllabusItemDetail, lmpType: string): boolean => {
    const courses = Array.isArray(item.courses) ? item.courses.map(reviewEventCode) : [];
    const normalisedLmpType = reviewEventCode(lmpType || 'BPC+IPC');
    if (normalisedLmpType === 'BPC+IPC') return courses.length === 0 || courses.includes('BPC+IPC');
    return courses.includes(normalisedLmpType);
};

const reviewFormatHours = (value: number): string => reviewNumber(value).toFixed(1);

const TraineeProfileFlyout: React.FC<TraineeProfileFlyoutProps> = ({
  trainee,
  traineesData = [],
  onClose,
  onUpdateTrainee,
  events,
  school,
  onNavigateToHateSheet,
  onAddRemedialPackage,
  personnelData,
  courseColors,
  scores,
  syllabusDetails,
  onNavigateToSyllabus,
  onNavigateToCurrency,
  locations,
  units,
  individualLmp,
  onViewLogbook,
  isCreating = false,
  activeCourses = [],
  onOpenInstructorProfile,
  masterCurrencies = [],
  currencyRequirements = [],
  currentUserId,
  currentUserName,
  pt051Assessments,
  pt051PerformanceLoading = false,
  traineeLMPs,
  userProfile,
  initialActiveTab = null,
  onSelectPt051ForEvent,
  onSavePt051Assessment,
  onDeletePt051Assessment,
  instructorsData = [],
  registerDirtyCheck = () => {},
  phraseBank = DEFAULT_PHRASE_BANK,
  trainingReportTemplate = null,
  canViewPt051 = true,
  canEditPt051 = true,
  canViewIndividualLmp = true,
  canAddRemedialPackage = true,
  onDeleteRemedialItem,
  onGeneratePt051ForItem,
  onInsertCustomLmpEvent,
  onUpdateLmpItem,
  insertEventTypes,
  aircraftConfigurations = [],
  onAccessDenied,
  resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES,
  personnelDisplaySettings = DEFAULT_PERSONNEL_DISPLAY_SETTINGS,
  trainingReportTerminology = DEFAULT_TRAINING_REPORT_TERMINOLOGY,
  platformConfig = null,
}) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const { isFrozen } = useSystemFreeze();
    const [showAddUnavailability, setShowAddUnavailability] = useState(false);

    // Dynamic Academic LMP courses: extract unique course codes from Academics-type syllabus items (DB only)
    const allAcademicLmpCourses = useMemo(() => {
        const courseCodes = new Set<string>();
        syllabusDetails.forEach(s => {
            if (s.type === 'Academics' && s.courses) {
                s.courses.forEach(c => courseCodes.add(c));
            }
        });
        return Array.from(courseCodes).sort();
    }, [syllabusDetails]);

    // Shared 3D card style (matches Staff Profile)
    const card3d = "rounded-lg border border-gray-500/60 shadow-md";
    const card3dStyle = { background: 'linear-gradient(180deg, #243044 0%, #1e2d42 60%)', boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' };

    // Tab state — null means no tab open
    const [activeTab, setActiveTab] = useState<'unavailable' | 'currency' | 'review' | 'logbook' | 'hatesheet' | 'lmp' | 'pt051' | null>(initialActiveTab);
    const [inlinePt051Assessment, setInlinePt051Assessment] = useState<Pt051Assessment | null>(null);
    const [inlinePt051Event, setInlinePt051Event] = useState<ScheduleEvent | null>(null);
    // Edit controls exposed by CurrencyPanel (so we can render them in the tab header)
    const [currencyEditState, setCurrencyEditState] = useState<{
      isEditing: boolean; isSaving: boolean;
      onEdit: () => void; onSave: () => void; onCancel: () => void;
    } | null>(null);
    const [reviewScoreGraphExpanded, setReviewScoreGraphExpanded] = useState(false);
    const [reviewProgressExpanded, setReviewProgressExpanded] = useState(false);
    const [reviewHoursExpanded, setReviewHoursExpanded] = useState(false);
    const [reviewLogbookEntries, setReviewLogbookEntries] = useState<any[]>([]);
    const [reviewLogbookLoading, setReviewLogbookLoading] = useState(false);
    const [reviewLogbookError, setReviewLogbookError] = useState<string | null>(null);
    // Local currency status override — updated after successful save without triggering full onUpdateTrainee
    const [localCurrencyStatus, setLocalCurrencyStatus] = useState<PersonCurrencyStatus[] | undefined>(undefined);
    const localCurrencyStatusRef = useRef<PersonCurrencyStatus[] | undefined>(undefined);
    // Audit flyout visibility
    const [showCurrencyAudit, setShowCurrencyAudit] = useState(false);
    const btnClass = "w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed";
    const tabBtnClass = (tab: string) => `w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed${activeTab === tab || (tab === 'hatesheet' && activeTab === 'pt051') ? ' active' : ''}`;
    // Ref for scrollable content area - used to scroll to top when a tab opens
    const contentScrollRef = useRef<HTMLDivElement>(null);
    const currentIndividualLMP = traineeLMPs?.get(trainee.fullName) || individualLmp;
    const activeTrainingReportUnitCode = trainee.unit || '';
    const activeTrainingReportTemplate = trainingReportTemplate
      || getUnitTrainingReportTemplate(platformConfig, activeTrainingReportUnitCode)
      || DEFAULT_TRAINING_REPORT_TEMPLATE;
    const activeTrainingReportPhraseBank = getUnitTrainingReportPhraseBank(platformConfig, activeTrainingReportUnitCode, phraseBank);

    useEffect(() => {
        if (activeTab !== 'review') return;
        setReviewLogbookLoading(true);
        setReviewLogbookError(null);
        fetch(`/api/flight-log?personName=${encodeURIComponent(trainee.fullName)}`, { credentials: 'include' })
            .then(response => response.ok ? response.json() : Promise.reject(new Error('Failed to load logbook rows')))
            .then((json: any) => {
                const entries = Array.isArray(json?.entries) ? json.entries : [];
                entries.sort((a: any, b: any) => {
                    const dateA = String(a.eventDate || '');
                    const dateB = String(b.eventDate || '');
                    if (dateA !== dateB) return dateA.localeCompare(dateB);
                    return String(a.eventCode || '').localeCompare(String(b.eventCode || ''));
                });
                setReviewLogbookEntries(entries);
                setReviewLogbookLoading(false);
            })
            .catch(() => {
                setReviewLogbookEntries([]);
                setReviewLogbookError('Could not load post-flight logbook entries.');
                setReviewLogbookLoading(false);
            });
    }, [activeTab, trainee.fullName]);

    const reviewData = useMemo(() => {
        const traineeScores = [...(scores.get(trainee.fullName) || [])].sort((a, b) => {
            const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
            if (dateCompare !== 0) return dateCompare;
            return reviewEventCode(a.event).localeCompare(reviewEventCode(b.event));
        });
        const traineeAssessments = pt051Assessments
            ? Array.from(pt051Assessments.values())
                .filter((assessment: Pt051Assessment) => assessment.traineeFullName === trainee.fullName)
                .sort((a, b) => {
                    const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
                    if (dateCompare !== 0) return dateCompare;
                    return reviewEventCode(a.flightNumber).localeCompare(reviewEventCode(b.flightNumber));
                })
            : [];

        const getReviewLmpItemForRef = (value: unknown): SyllabusItemDetail | undefined => {
            const ref = reviewEventCode(value);
            if (!ref) return undefined;
            return currentIndividualLMP.find(item => reviewLmpRefs(item).includes(ref));
        };
        const isFlightOrSimulatorReviewPoint = (value: unknown): boolean => {
            const item = getReviewLmpItemForRef(value);
            return item ? item.type === 'Flight' || item.type === 'FTD' : false;
        };

        const assessmentPoints = traineeAssessments
            .map(assessment => {
                const grade = typeof assessment.overallGrade === 'number'
                    ? assessment.overallGrade
                    : assessment.overallResult === 'F'
                        ? 0
                        : null;
                if (grade === null || !Number.isFinite(Number(grade))) return null;
                return {
                    id: assessment.id || assessment.eventId || `${assessment.flightNumber}-${assessment.date}`,
                    code: assessment.flightNumber || assessment.eventId,
                    date: assessment.date || '',
                    grade: Number(grade),
                    dcoResult: assessment.dcoResult || '',
                    comments: String(assessment.overallComments || assessment.trainingReportNotes || '').trim(),
                };
            })
            .filter(Boolean)
            .filter((point: any) => isFlightOrSimulatorReviewPoint(point.code) || isFlightOrSimulatorReviewPoint(point.id)) as Array<{ id: string; code: string; date: string; grade: number; dcoResult: string; comments: string }>;

        const scoreOnlyPoints = traineeScores
            .filter(score => !assessmentPoints.some(point => reviewEventCode(point.code) === reviewEventCode(score.event) && point.date === score.date))
            .filter(score => isFlightOrSimulatorReviewPoint(score.event))
            .map(score => ({
                id: `${score.event}-${score.date}`,
                code: getReviewLmpItemForRef(score.event)?.code || score.event,
                date: score.date || '',
                grade: Number(score.score),
                dcoResult: '',
                comments: String(score.notes || '').trim(),
            }));

        const rawPoints = [...assessmentPoints, ...scoreOnlyPoints].sort((a, b) => {
            const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
            if (dateCompare !== 0) return dateCompare;
            return reviewEventCode(a.code).localeCompare(reviewEventCode(b.code));
        });

        const scorePoints: TraineeReviewPoint[] = rawPoints.map((point, index) => {
            const windowPoints = rawPoints.slice(Math.max(0, index - 2), index + 1);
            const smoothed = windowPoints.reduce((sum, item) => sum + reviewNumber(item.grade), 0) / Math.max(1, windowPoints.length);
            const previous = index > 0 ? rawPoints[index - 1] : null;
            const status: TraineeReviewPoint['status'] = point.grade === 0
                ? 'fail'
                : point.grade === 1 && previous?.grade === 1
                    ? 'double-marginal'
                    : point.grade === 1 || point.dcoResult === 'DPCO'
                        ? 'marginal'
                        : 'pass';
            return {
                code: point.code,
                date: point.date,
                grade: point.grade,
                smoothed,
                status,
                comments: point.comments,
            };
        });

        const currentCourse = String(trainee.course || '').trim().toUpperCase();
        const sameCourseTraineeNames = new Set(
            (traineesData.length > 0 ? traineesData : [trainee])
                .filter(candidate => String(candidate.course || '').trim().toUpperCase() === currentCourse)
                .map(candidate => candidate.fullName)
                .filter(Boolean)
        );
        if (trainee.fullName) sameCourseTraineeNames.add(trainee.fullName);

        const getCompletionRefsForTrainee = (name: string): Set<string> => {
            const refs = new Set<string>();
            (scores.get(name) || []).forEach(score => refs.add(reviewEventCode(score.event)));
            if (pt051Assessments) {
                Array.from(pt051Assessments.values())
                    .filter(assessment => assessment.traineeFullName === name)
                    .forEach(assessment => {
                        refs.add(reviewEventCode(assessment.eventId));
                        refs.add(reviewEventCode(assessment.flightNumber));
                    });
            }
            return refs;
        };
        const isMarkedCompleteInLmp = (item: SyllabusItemDetail): boolean => Boolean((item as any).completedAt);
        const activeLmpType = String((trainee as any).lmpType || 'BPC+IPC');
        const masterCourseProgressItems = reviewUniqueByEventCode(
            syllabusDetails
                .filter(reviewIsCourseProgressLmpEvent)
                .filter(item => reviewItemBelongsToLmpType(item, activeLmpType))
        );
        const ownCourseProgressFallback = reviewUniqueByEventCode(currentIndividualLMP.filter(reviewIsCourseProgressLmpEvent));
        const courseProgressItems = masterCourseProgressItems.length > 0 ? masterCourseProgressItems : ownCourseProgressFallback;
        const getProgressForTrainee = (name: string, lmpItems: SyllabusItemDetail[]) => {
            const countableItems = courseProgressItems;
            const refs = getCompletionRefsForTrainee(name);
            const completedLmpRefs = new Set(
                lmpItems
                    .filter(isMarkedCompleteInLmp)
                    .flatMap(reviewLmpRefs)
            );
            const hasIndividualLmpCompletion = completedLmpRefs.size > 0;
            const furthestCompletedIndex = countableItems.reduce((furthest, item, index) => {
                const completedByLmp = reviewLmpRefs(item).some(ref => completedLmpRefs.has(ref));
                const completedByRefs = !hasIndividualLmpCompletion && reviewLmpRefs(item).some(ref => refs.has(ref));
                return completedByLmp || completedByRefs ? Math.max(furthest, index) : furthest;
            }, -1);
            const completedThroughCount = furthestCompletedIndex >= 0 ? furthestCompletedIndex + 1 : 0;
            return {
                completedCount: completedThroughCount,
                totalCount: countableItems.length,
                percent: countableItems.length > 0 ? (completedThroughCount / countableItems.length) * 100 : 0,
                countableItems,
            };
        };

        const ownProgress = getProgressForTrainee(trainee.fullName, currentIndividualLMP);
        const completedCount = ownProgress.completedCount;
        const progressPercent = ownProgress.percent;
        const countableLmp = currentIndividualLMP.filter(reviewIsCountableLmpEvent);

        const peerProgressValues = Array.from(sameCourseTraineeNames)
            .map(name => {
                const peerLmp = traineeLMPs?.get(name) || (name === trainee.fullName ? currentIndividualLMP : []);
                if (!peerLmp || peerLmp.length === 0) return null;
                return getProgressForTrainee(name, peerLmp).percent;
            })
            .filter((value): value is number => value !== null && Number.isFinite(value));
        const averageProgress = peerProgressValues.length > 0
            ? peerProgressValues.reduce((sum, value) => sum + value, 0) / peerProgressValues.length
            : progressPercent;
        const mostProgress = peerProgressValues.length > 0 ? Math.max(...peerProgressValues) : progressPercent;
        const leastProgress = peerProgressValues.length > 0 ? Math.min(...peerProgressValues) : progressPercent;

        let cumulativeLogbook = 0;
        let cumulativeSyllabus = 0;
        let cumulativeEffective = 0;
        const lmpByCode = new Map(countableLmp.map(item => [reviewEventCode(item.code), item]));
        const logRows = reviewLogbookEntries
            .filter(entry => String(entry.personRole || '').toLowerCase().includes('trainee') || String(entry.personName || '').trim().toLowerCase() === trainee.fullName.toLowerCase())
            .map(entry => {
                const code = reviewEventCode(entry.eventCode || entry.duty || entry.scheduleEventId);
                const lmpItem = lmpByCode.get(code) || countableLmp.find(item => reviewLmpRefs(item).includes(code));
                const logbookHours = reviewNumber(entry.totalTime || entry.captainLogSnapshot?.total || entry.crewLogSnapshot?.total);
                const ineffectiveHours = reviewNumber(entry.ineffectiveTime);
                const syllabusHours = reviewNumber(lmpItem?.flightOrSimHours);
                const effectiveHours = Math.max(0, logbookHours - ineffectiveHours);
                cumulativeLogbook += logbookHours;
                cumulativeSyllabus += syllabusHours;
                cumulativeEffective += effectiveHours;
                return {
                    code: code || reviewEventCode(lmpItem?.code) || 'EVENT',
                    date: entry.eventDate || '',
                    logbookHours,
                    syllabusHours,
                    ineffectiveHours,
                    effectiveHours,
                    cumulativeLogbook,
                    cumulativeSyllabus,
                    cumulativeEffective,
                };
            });

        const summaryFailed = scorePoints.filter(point => point.status === 'fail');
        const summaryDoubleMarginal = scorePoints.filter(point => point.status === 'double-marginal');
        const summaryMarginal = scorePoints.filter(point => point.status === 'marginal');
        const currentScoreAverage = scorePoints.length > 0
            ? scorePoints.reduce((sum, point) => sum + point.grade, 0) / scorePoints.length
            : 0;
        const countableRefSet = new Set(countableLmp.flatMap(reviewLmpRefs));
        const courseAverageRankings = Array.from(scores.entries())
            .filter(([name]) => sameCourseTraineeNames.has(name))
            .map(([name, peerScores]) => {
                const peerFlightScores = peerScores
                    .filter(score => countableRefSet.has(reviewEventCode(score.event)))
                    .map(score => reviewNumber(score.score))
                    .filter(value => Number.isFinite(value));
                if (peerFlightScores.length === 0) return null;
                return {
                    name,
                    average: peerFlightScores.reduce((sum, value) => sum + value, 0) / peerFlightScores.length,
                    completed: peerFlightScores.length,
                };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
                if (b.average !== a.average) return b.average - a.average;
                if (b.completed !== a.completed) return b.completed - a.completed;
                return String(a.name).localeCompare(String(b.name));
            }) as Array<{ name: string; average: number; completed: number }>;
        const courseRankIndex = courseAverageRankings.findIndex(entry => entry.name === trainee.fullName);
        const courseAverageRank = courseRankIndex >= 0
            ? { rank: courseRankIndex + 1, total: courseAverageRankings.length }
            : { rank: 0, total: courseAverageRankings.length };

        return {
            scorePoints,
            progress: {
                completedCount,
                totalCount: ownProgress.totalCount,
                progressPercent,
                averageProgress,
                mostProgress,
                leastProgress,
            },
            currentScoreAverage,
            courseAverageRank,
            hourRows: logRows,
            hourTotals: {
                logbook: cumulativeLogbook,
                syllabus: cumulativeSyllabus,
                effective: cumulativeEffective,
            },
            summaryFailed,
            summaryDoubleMarginal,
            summaryMarginal,
        };
    }, [currentIndividualLMP, pt051Assessments, reviewLogbookEntries, scores, syllabusDetails, trainee.course, trainee.fullName, trainee.lmpType, traineeLMPs, traineesData]);

    const exportTraineeReviewPdf = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = 16;
        const addText = (text: string, x: number, yy: number, size = 9, style: 'normal' | 'bold' = 'normal') => {
            doc.setFont('helvetica', style);
            doc.setFontSize(size);
            doc.text(text, x, yy);
        };
        const addSection = (title: string) => {
            y += 7;
            doc.setFillColor(31, 45, 66);
            doc.rect(margin, y - 4.5, pageWidth - margin * 2, 7, 'F');
            doc.setTextColor(255, 255, 255);
            addText(title, margin + 2, y, 9, 'bold');
            doc.setTextColor(15, 23, 42);
            y += 6;
        };
        const ensureSpace = (height: number) => {
            if (y + height < 282) return;
            doc.addPage();
            y = 16;
        };
        const drawScoreGraph = () => {
            ensureSpace(58);
            const x = margin;
            const graphY = y + 4;
            const width = pageWidth - margin * 2;
            const height = 42;
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.line(x, graphY + height, x + width, graphY + height);
            [0, 1, 2, 3, 4, 5].forEach(grade => {
                const gy = graphY + height - (grade / 5) * height;
                doc.setDrawColor(226, 232, 240);
                doc.line(x, gy, x + width, gy);
                doc.setTextColor(100, 116, 139);
                addText(String(grade), x - 4, gy + 1, 6);
            });
            const points = reviewData.scorePoints;
            const barWidth = Math.min(5, Math.max(1.8, width / Math.max(1, points.length) - 1));
            points.forEach((point, index) => {
                const px = x + ((index + 0.5) / Math.max(1, points.length)) * width - barWidth / 2;
                const barHeight = (Math.max(0, Math.min(5, point.grade)) / 5) * height;
                if (point.status === 'fail' || point.status === 'double-marginal') doc.setFillColor(239, 68, 68);
                else if (point.status === 'marginal') doc.setFillColor(245, 158, 11);
                else doc.setFillColor(14, 165, 233);
                doc.rect(px, graphY + height - barHeight, barWidth, barHeight, 'F');
                if (index % Math.ceil(Math.max(1, points.length / 18)) === 0) {
                    doc.setTextColor(point.status === 'fail' || point.status === 'double-marginal' ? 185 : point.status === 'marginal' ? 180 : 71, point.status === 'marginal' ? 83 : 85, point.status === 'fail' || point.status === 'double-marginal' ? 83 : 105);
                    doc.setFontSize(5.5);
                    doc.text(point.code.slice(0, 8), px, graphY + height + 5, { angle: 45 });
                }
            });
            if (points.length > 1) {
                doc.setDrawColor(8, 145, 178);
                doc.setLineWidth(0.7);
                points.forEach((point, index) => {
                    if (index === 0) return;
                    const prev = points[index - 1];
                    const x1 = x + ((index - 0.5) / points.length) * width;
                    const y1 = graphY + height - (Math.max(0, Math.min(5, prev.smoothed)) / 5) * height;
                    const x2 = x + ((index + 0.5) / points.length) * width;
                    const y2 = graphY + height - (Math.max(0, Math.min(5, point.smoothed)) / 5) * height;
                    doc.line(x1, y1, x2, y2);
                });
            }
            y += 60;
        };
        const drawProgressGraph = () => {
            ensureSpace(42);
            const cx = margin + 22;
            const cy = y + 18;
            const radius = 16;
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.circle(cx, cy, radius, 'S');
            doc.setFillColor(34, 197, 94);
            const percent = Math.max(0, Math.min(100, reviewData.progress.progressPercent));
            const slices = Math.round(percent / 4);
            for (let i = 0; i < slices; i++) {
                const a1 = (-90 + i * 14.4) * Math.PI / 180;
                const a2 = (-90 + (i + 1) * 14.4) * Math.PI / 180;
                doc.triangle(cx, cy, cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius, cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius, 'F');
            }
            doc.setFillColor(255, 255, 255);
            doc.circle(cx, cy, 9, 'F');
            doc.setTextColor(15, 23, 42);
            addText(`${percent.toFixed(0)}%`, cx - 5, cy + 1, 7, 'bold');
            const drawBenchmark = (value: number, r: number, g: number, b: number) => {
                const angle = (-90 + (Math.max(0, Math.min(100, value)) / 100) * 360) * Math.PI / 180;
                const innerRadius = radius - 4;
                const outerRadius = radius + 3;
                doc.setDrawColor(r, g, b);
                doc.setLineWidth(0.55);
                doc.line(
                    cx + Math.cos(angle) * innerRadius,
                    cy + Math.sin(angle) * innerRadius,
                    cx + Math.cos(angle) * outerRadius,
                    cy + Math.sin(angle) * outerRadius
                );
            };
            drawBenchmark(reviewData.progress.averageProgress, 255, 170, 0);
            drawBenchmark(reviewData.progress.mostProgress, 0, 210, 255);
            drawBenchmark(reviewData.progress.leastProgress, 255, 64, 64);
            addText(`Events completed: ${reviewData.progress.completedCount}/${reviewData.progress.totalCount}`, margin + 50, y + 8, 8);
            addText(`Failed: ${reviewData.summaryFailed.length}   Double marginal: ${reviewData.summaryDoubleMarginal.length}   Marginal: ${reviewData.summaryMarginal.length}`, margin + 50, y + 14, 8);
            addText(`Current score average: ${reviewData.currentScoreAverage.toFixed(1)}`, margin + 50, y + 20, 8);
            addText(`Course rank by average score: ${reviewData.courseAverageRank.rank ? `${reviewData.courseAverageRank.rank}/${reviewData.courseAverageRank.total}` : '-'}`, margin + 50, y + 26, 8);
            addText(`Course avg: ${reviewData.progress.averageProgress.toFixed(0)}%   Front runner: ${reviewData.progress.mostProgress.toFixed(0)}%   Back marker: ${reviewData.progress.leastProgress.toFixed(0)}%`, margin + 50, y + 32, 8);
            y += 42;
        };

        doc.setFillColor(15, 24, 36);
        doc.rect(0, 0, pageWidth, 24, 'F');
        doc.setTextColor(255, 255, 255);
        addText('TRAINEE REVIEW SUMMARY', margin, 11, 14, 'bold');
        addText(`${trainee.rank || ''} ${trainee.name}  |  ${trainee.course || 'No course'}  |  ${trainee.unit || ''}`, margin, 18, 9);
        doc.setTextColor(15, 23, 42);
        y = 30;

        addSection('Scores by Event');
        drawScoreGraph();
        addSection('Course Progress');
        drawProgressGraph();
        addText(`Progress: ${reviewData.progress.completedCount}/${reviewData.progress.totalCount} events (${reviewData.progress.progressPercent.toFixed(0)}%)`, margin, y);
        addText(`Course avg: ${reviewData.progress.averageProgress.toFixed(0)}%   Front runner: ${reviewData.progress.mostProgress.toFixed(0)}%   Back marker: ${reviewData.progress.leastProgress.toFixed(0)}%`, margin, y + 5);
        y += 12;

        addSection('Performance Summary');
        const addSummaryLines = (label: string, items: TraineeReviewPoint[]) => {
            ensureSpace(8);
            addText(`${label}:`, margin, y, 8, 'bold');
            y += 4.5;
            if (items.length === 0) {
                addText('None', margin + 4, y, 7);
                y += 4.5;
                return;
            }
            items.forEach(item => {
                ensureSpace(8);
                const comment = item.comments || 'No overall comments recorded.';
                const lines = doc.splitTextToSize(`${item.code}: ${comment}`, pageWidth - margin * 2 - 4);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.text(lines, margin + 4, y);
                y += lines.length * 3.8 + 1;
            });
        };
        addSummaryLines('Failed events', reviewData.summaryFailed);
        addSummaryLines('Double marginal events', reviewData.summaryDoubleMarginal);
        addSummaryLines('Marginal events', reviewData.summaryMarginal);
        y += 2;

        addSection('Cumulative Hours');
        addText('Event', margin, y, 8, 'bold');
        addText('Date', margin + 32, y, 8, 'bold');
        addText('Log', margin + 58, y, 8, 'bold');
        addText('Syllabus', margin + 78, y, 8, 'bold');
        addText('Effective', margin + 105, y, 8, 'bold');
        y += 5;
        const rowsForPdf = reviewData.hourRows.length > 0 ? reviewData.hourRows : [];
        rowsForPdf.slice(0, 28).forEach(row => {
            ensureSpace(5);
            addText(row.code.slice(0, 14), margin, y, 7);
            addText(row.date || '-', margin + 32, y, 7);
            addText(reviewFormatHours(row.cumulativeLogbook), margin + 58, y, 7);
            addText(reviewFormatHours(row.cumulativeSyllabus), margin + 78, y, 7);
            addText(reviewFormatHours(row.cumulativeEffective), margin + 105, y, 7);
            y += 4.5;
        });
        if (rowsForPdf.length === 0) {
            addText('No post-flight logbook rows available.', margin, y, 8);
            y += 5;
        }
        y += 3;
        addText(`Totals: Logbook ${reviewFormatHours(reviewData.hourTotals.logbook)} | Syllabus ${reviewFormatHours(reviewData.hourTotals.syllabus)} | Effective ${reviewFormatHours(reviewData.hourTotals.effective)}`, margin, y, 8, 'bold');

        doc.save(`Trainee_Review_${trainee.name.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
    };

    const handleTabClick = (tab: typeof activeTab) => setActiveTab(prev => {
      const next = prev === tab ? null : tab;
      if (next !== null) {
        setTimeout(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      }
      return next;
    });
    const [showPauseConfirm, setShowPauseConfirm] = useState(false);
    const [showScheduleWarning, setShowScheduleWarning] = useState(false);

    // Editable state
    const [name, setName] = useState(trainee.name);
    const [idNumber, setIdNumber] = useState(trainee.idNumber);
    const [rank, setRank] = useState<TraineeRank>(trainee.rank);
    const traineeRankOptions = useMemo(() => {
      const configuredRanks = getRankOptionsForGroup(personnelDisplaySettings || undefined, 'trainee');
      const currentRank = String(rank || '').trim();
      const hasCurrentRank = Boolean(currentRank) && configuredRanks.some(option => option.toLowerCase() === currentRank.toLowerCase());
      return currentRank && !hasCurrentRank ? [...configuredRanks, currentRank] : configuredRanks;
    }, [personnelDisplaySettings, rank]);
    const [service, setService] = useState(trainee.service || '');
    const [course, setCourse] = useState(trainee.course || activeCourses[0] || '');
  const [lmpType, setLmpType] = useState(trainee.lmpType || 'BPC+IPC');
  const [academicLmpType, setAcademicLmpType] = useState((trainee as any).academicLmpType || '');
    const [seatConfig, setSeatConfig] = useState<SeatConfig>(trainee.seatConfig);
    const [isPaused, setIsPaused] = useState(trainee.isPaused);
    const [unavailability, setUnavailability] = useState<UnavailabilityPeriod[]>(trainee.unavailability || []);
    const [location, setLocation] = useState(trainee.location || locations[0] || '');
    const [unit, setUnit] = useState(trainee.unit || units[0] || '');
    const [flight, setFlight] = useState(trainee.flight || '');
    const [phoneNumber, setPhoneNumber] = useState(trainee.phoneNumber || '');
    const [email, setEmail] = useState(trainee.email || '');
    const [traineeCallsign, setTraineeCallsign] = useState(trainee.traineeCallsign || '');

    const assignableMasterLmps = useMemo(() => {
        const courseCodes = new Set<string>(COURSE_MASTER_LMPS.filter(lmp => lmp !== 'Staff CAT'));
        syllabusDetails.forEach(s => {
            if (s.type === 'Academics' || s.lmpType === 'Staff CAT') return;
            (s.courses || []).forEach(c => courseCodes.add(c));
        });
        const allowed = filterMasterLmpCodesForAccess(platformConfig, Array.from(courseCodes), {
            unitCode: unit || trainee.unit,
            operationalModel: 'flight_school',
        }, 'Assign');
        return allowed.sort();
    }, [platformConfig, syllabusDetails, trainee.unit, unit]);

    const academicLmpCourses = useMemo(() => {
        const allowed = filterMasterLmpCodesForAccess(platformConfig, allAcademicLmpCourses, {
            unitCode: unit || trainee.unit,
            operationalModel: 'flight_school',
        }, 'Assign');
        return allowed.sort();
    }, [allAcademicLmpCourses, platformConfig, trainee.unit, unit]);
    const [secondaryCallsign, setSecondaryCallsign] = useState(trainee.secondaryCallsign || '');
    const [crew, setCrew] = useState(trainee.crew || 'N/A');
    const [permissions, setPermissions] = useState<string[]>(trainee.permissions || []);
    const isSuspended = useMemo(() => isTraineeSuspended({ permissions }), [permissions]);
    const traineeStatusLabel = isSuspended ? 'Suspended' : (isPaused ? 'Paused' : 'Active');

    const [priorExperience, setPriorExperience] = useState<LogbookExperience>(trainee.priorExperience || initialExperience);
    const exp = priorExperience;

    const allPermissions = useMemo(() => ['Trainee', 'Staff', 'Ops', 'Course Supervisor', 'Admin', 'Super Admin'], []);
    const allRoles = useMemo(() => ['Course Leader', 'Section Leader', 'Squadron Leader', 'Flight Leader'], []);

    const callsignData = useMemo(() => personnelData.get(trainee.fullName), [personnelData, trainee.fullName]);

    const {
        lastFlight,
        lastEvent,
        daysSinceLastFlight,
        daysSinceLastEvent
    } = useMemo(() => {
        const traineeScores = scores.get(trainee.fullName) || [];
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const calculateDays = (dateStr: string | undefined): number | null => {
            if (!dateStr) return null;
            const eventDate = new Date(dateStr + 'T00:00:00Z');
            return Math.round((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        };

        if (traineeScores.length === 0) {
            return {
                lastFlight: null,
                lastEvent: null,
                daysSinceLastFlight: null,
                daysSinceLastEvent: null
            };
        }

        const sortedScores = [...traineeScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const lastEvt = sortedScores[0] || null;

        const lastFlt = sortedScores.find(score => {
            const syllabusItem = syllabusDetails.find(item => item.id === score.event);
            return syllabusItem?.type === 'Flight';
        }) || null;

        return {
            lastFlight: lastFlt,
            lastEvent: lastEvt,
            daysSinceLastFlight: calculateDays(lastFlt?.date),
            daysSinceLastEvent: calculateDays(lastEvt?.date)
        };
    }, [trainee.fullName, scores, syllabusDetails]);


    const { nextEvent, subsequentEvent, nextEventReason } = useMemo(() => {
        if (isCreating) return { nextEvent: null, subsequentEvent: null, nextEventReason: 'New Trainee' };

        const traineeScores = scores.get(trainee.fullName) || [];
        const completedEventIds = new Set(traineeScores.map(s => s.event));

        let nextEvt: SyllabusItemDetail | null = null;
        let subsequentEvt: SyllabusItemDetail | null = null;
        let reason = '';
        let nextEventIndex = -1;

        for (let i = 0; i < individualLmp.length; i++) {
            const item = individualLmp[i];
            if (completedEventIds.has(item.id) || item.code.includes(' MB')) {
                continue;
            }
            const prereqsMet = item.prerequisites.every(prereqId => completedEventIds.has(prereqId));
            if (prereqsMet) {
                nextEvt = item;
                nextEventIndex = i;
                break;
            }
        }

        if (nextEventIndex !== -1) {
            for (let i = nextEventIndex + 1; i < individualLmp.length; i++) {
                const item = individualLmp[i];
                if (!item.code.includes(' MB')) {
                    subsequentEvt = item;
                    break;
                }
            }
        }

        if (!nextEvt) {
            const allStandardEvents = individualLmp.filter(item => !item.isRemedial && !item.code.includes(' MB'));
            if (allStandardEvents.every(item => completedEventIds.has(item.id))) {
                reason = 'Syllabus complete.';
            } else {
                reason = 'Prerequisites incomplete.';
            }
        }

        return { nextEvent: nextEvt, subsequentEvent: subsequentEvt, nextEventReason: reason };
    }, [trainee.fullName, scores, individualLmp, isCreating]);


    const resetState = () => {
        setName(trainee.name);
        setIdNumber(trainee.idNumber);
        setRank(trainee.rank);
        setService(trainee.service || '');
        setCourse(trainee.course || activeCourses[0] || '');
        setLmpType(trainee.lmpType || 'BPC+IPC');
        setAcademicLmpType((trainee as any).academicLmpType || '');
        setSeatConfig(trainee.seatConfig);
        setIsPaused(trainee.isPaused);
        setUnavailability(trainee.unavailability || []);
        setLocation(trainee.location || locations[0] || '');
        setUnit(trainee.unit || units[0] || '');
        setFlight(trainee.flight || '');
        setPhoneNumber(trainee.phoneNumber || '');
        setEmail(trainee.email || '');
        setPermissions(trainee.permissions || []);
        setPriorExperience(trainee.priorExperience || initialExperience);
    };

    useEffect(() => {
        resetState();
        setIsEditing(isCreating);
    }, [trainee, isCreating]);

    useEffect(() => {
        if (initialActiveTab) {
            setActiveTab(initialActiveTab);
            setTimeout(() => { contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
        }
    }, [initialActiveTab, trainee.fullName]);

    // Use ref to prevent double-logging in React StrictMode
    const hasLoggedViewRef = useRef(false);
    useEffect(() => {
        if (!isCreating && !hasLoggedViewRef.current) {
            hasLoggedViewRef.current = true;
            logAudit({
                action: 'View',
                description: `Viewed trainee profile for ${trainee.rank} ${trainee.name}`,
                changes: `Course: ${trainee.course}, Unit: ${trainee.unit}`,
                page: 'Trainee Roster'
            });
        }
    }, []);


    const traineeHasEventsToday = useMemo(() => {
        return events.some(e => e.student === trainee.fullName || e.pilot === trainee.fullName);
    }, [events, trainee.fullName]);

    const handlePauseToggle = () => {
        if (!isPaused && traineeHasEventsToday) {
            setShowScheduleWarning(true);
        } else {
            setShowPauseConfirm(true);
        }
    };

    const confirmPause = () => {
        const nextIsPaused = !isPaused;
        const nextPermissions = getVisiblePermissions(permissions);
        const updatedTrainee: Trainee = {
            ...trainee,
            isPaused: nextIsPaused,
            permissions: nextPermissions,
        };
        onUpdateTrainee(updatedTrainee);
        setIsPaused(updatedTrainee.isPaused);
        setPermissions(nextPermissions);
        setShowPauseConfirm(false);
    };

    const handleSuspendToggle = () => {
        const nextIsSuspended = !isSuspended;
        const nextPermissions = setTraineeSuspendedMarker(permissions, nextIsSuspended);
        const updatedTrainee: Trainee = {
            ...trainee,
            isPaused: nextIsSuspended ? true : false,
            permissions: nextPermissions,
        };
        onUpdateTrainee(updatedTrainee);
        setIsPaused(updatedTrainee.isPaused);
        setPermissions(nextPermissions);
    };

    // Debounced field change handlers
    const handleNameChange = (newName: string) => {
        const oldName = name;
        setName(newName);
        if (oldName && newName !== oldName) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-name`,
                'Edit',
                `Updated trainee name`,
                `Name: ${oldName} → ${newName}`,
                'Trainee Roster'
            );
        }
    };

    const handleRankChange = (newRank: TraineeRank) => {
        const oldRank = rank;
        setRank(newRank);
        if (oldRank !== newRank) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-rank`,
                'Edit',
                `Updated trainee rank`,
                `Rank: ${oldRank} → ${newRank}`,
                'Trainee Roster'
            );
        }
    };

    const handleCourseChange = (newCourse: string) => {
        const oldCourse = course;
        setCourse(newCourse);
        if (oldCourse !== newCourse) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-course`,
                'Edit',
                `Updated trainee course`,
                `Course: ${oldCourse} → ${newCourse}`,
                'Trainee Roster'
            );
        }
    };

    const handleLmpTypeChange = (newLmpType: string) => {
        const oldLmpType = lmpType;
        setLmpType(newLmpType);
        if (oldLmpType !== newLmpType) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-lmptype`,
                'Edit',
                `Updated trainee LMP type`,
                `LMP: ${oldLmpType} → ${newLmpType}`,
                'Trainee Roster'
            );
        }
    };

    const handleUnitChange = (newUnit: string) => {
        const oldUnit = unit;
        setUnit(newUnit);
        if (oldUnit !== newUnit) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-unit`,
                'Edit',
                `Updated trainee unit`,
                `Unit: ${oldUnit} → ${newUnit}`,
                'Trainee Roster'
            );
        }
    };

    const handleLocationChange = (newLocation: string) => {
        const oldLocation = location;
        setLocation(newLocation);
        if (oldLocation !== newLocation) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-location`,
                'Edit',
                `Updated trainee location`,
                `Location: ${oldLocation} → ${newLocation}`,
                'Trainee Roster'
            );
        }
    };

    const handleSave = async () => {
        if (!name || !course) {
            alert("Name and Course are required.");
            return;
        }
        const fullName = `${name} – ${course}`;
        const updatedTrainee: Trainee = {
            ...trainee,
            idNumber,
            name,
            fullName,
            course,
            lmpType,
            academicLmpType,
            rank,
            seatConfig,
            isPaused: isSuspended ? true : isPaused,
            unavailability,
            location,
            unit,
            flight,
            phoneNumber,
            email,
            service,
            traineeCallsign,
            secondaryCallsign,
            crew,
            permissions,
            priorExperience
        };

        // Flush any pending debounced logs before saving
        flushPendingAudits();

        // Log the save action
        if (isCreating) {
            logAudit({
                action: 'Add',
                description: `Added new trainee ${rank} ${name}`,
                changes: `Course: ${course}, Unit: ${unit}, Location: ${location}`,
                page: 'Trainee Roster'
            });
        } else {
            // Detect changes for edit
            const changes: string[] = [];
            if (trainee.name !== name) changes.push(`Name: ${trainee.name} → ${name}`);
            if (trainee.rank !== rank) changes.push(`Rank: ${trainee.rank} → ${rank}`);
            if (trainee.course !== course) changes.push(`Course: ${trainee.course} → ${course}`);
            if (trainee.lmpType !== lmpType) changes.push(`LMP: ${trainee.lmpType || 'BPC+IPC'} → ${lmpType}`);
            if (trainee.unit !== unit) changes.push(`Unit: ${trainee.unit} → ${unit}`);
            if (trainee.location !== location) changes.push(`Location: ${trainee.location} → ${location}`);
            if (trainee.seatConfig !== seatConfig) changes.push(`Seat Config: ${trainee.seatConfig} → ${seatConfig}`);
            if (trainee.isPaused !== isPaused) changes.push(`Paused: ${trainee.isPaused} → ${isPaused}`);

            if (changes.length > 0) {
                logAudit({
                    action: 'Edit',
                    description: `Updated trainee ${rank} ${name}`,
                    changes: changes.join(', '),
                    page: 'Trainee Roster'
                });
            }
        }

        onUpdateTrainee(updatedTrainee);

        // Persist Logbook Data to Storage
        try {
            const cleanName = name.replace(/,\s/g, '_');
            const fileName = `Logbook_${cleanName}_${idNumber}.json`;
            const fileContent = JSON.stringify(priorExperience, null, 2);
            const file = new File([fileContent], fileName, { type: "application/json" });
            // 'trainee_logbook' is the ID for the Trainee Data -> Logbook folder
            await addFile(file, 'trainee_logbook', fileName);
        } catch (error) {
            console.error("Failed to save logbook data to storage:", error);
        }

        setIsEditing(false);
        if (isCreating) {
            onClose();
        }
    };

    const handleCancel = () => {
        if (isCreating) {
            onClose();
        } else {
            resetState();
            setIsEditing(false);
        }
    };

    const handlePermissionChange = (permission: string, isChecked: boolean) => {
        setPermissions(prev =>
            isChecked ? [...prev, permission] : prev.filter(p => p !== permission)
        );
    };

    const handleHateSheetClick = () => {
        if (!canViewPt051) {
            onAccessDenied?.('PT-051 performance history');
            return;
        }
        if (pt051Assessments !== undefined) {
            // Render inline as a tab (keeps flyout/sidebar open)
            setActiveTab(prev => prev === 'hatesheet' ? null : 'hatesheet');
            setTimeout(() => { contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
        } else {
            onNavigateToHateSheet(trainee);
            onClose();
        }
    };

    const buildPt051EventFromAssessment = (assessment: Pt051Assessment): ScheduleEvent => {
        const lmpItem = currentIndividualLMP?.find(item => {
            const assessmentRefs = new Set([
                assessment.eventId,
                assessment.flightNumber,
            ].filter(Boolean).map(value => String(value).trim().toUpperCase()));
            const itemRefs = [
                item.id,
                item.code,
                item.masterEventId,
                `lmp-${(trainee as any).id || trainee.idNumber}-${item.code}`,
            ].filter(Boolean).map(value => String(value).trim().toUpperCase());
            return itemRefs.some(ref => assessmentRefs.has(ref));
        });
        const forwardedPreFlightNotes = Object.values(((lmpItem as any)?.trainingReportForwardedNotes || {}) as Record<string, any>)
            .map((entry: any) => String(entry?.notes || '').trim())
            .filter(Boolean)
            .join('\n\n');
        pushTrainingReportNotesDiag('profile:build-pt051-event', {
            traineeFullName: trainee.fullName,
            assessmentId: assessment.id,
            eventId: assessment.eventId,
            flightNumber: assessment.flightNumber,
            lmpCount: currentIndividualLMP?.length || 0,
            matchedItemId: lmpItem?.id || null,
            matchedItemCode: lmpItem?.code || null,
            matchedItemType: lmpItem?.type || null,
            forwardedKeys: Object.keys(((lmpItem as any)?.trainingReportForwardedNotes || {}) as Record<string, any>),
            forwardedPreFlightNotesLength: forwardedPreFlightNotes.length,
            forwardedPreFlightNotesPreview: forwardedPreFlightNotes.slice(0, 160),
        });
        const scheduledEvent = events.find(e => e.id === assessment.eventId)
            || events.find(e =>
                e.flightNumber === assessment.flightNumber &&
                (!assessment.date || !e.date || e.date === assessment.date) &&
                (e.student === trainee.fullName || e.pilot === trainee.fullName || String(e.crew || '').includes(trainee.fullName))
            );
        if (scheduledEvent) {
            return {
                ...scheduledEvent,
                preFlightNotes: forwardedPreFlightNotes || (scheduledEvent as any).preFlightNotes,
                trainingReportForwardedNotes: (lmpItem as any)?.trainingReportForwardedNotes || (scheduledEvent as any).trainingReportForwardedNotes,
            } as ScheduleEvent;
        }

        const flightNum = assessment.flightNumber || '';
        const eventType: ScheduleEvent['type'] = flightNum.includes('CPT') || flightNum.includes('Cpt')
            ? 'cpt'
            : flightNum.includes('MB') || flightNum.includes('GS') || flightNum.includes('Ground') || flightNum.includes('GROUND')
                ? 'ground'
                : 'flight';

        return {
            id: assessment.eventId || `pt051-${trainee.idNumber}-${flightNum}-${assessment.date || 'undated'}`,
            flightNumber: flightNum,
            date: assessment.date,
            startTime: assessment.startTime ?? 8,
            duration: assessment.duration ?? 1,
            instructor: assessment.instructorName || '',
            student: trainee.fullName,
            syllabus: flightNum,
            aircraft: '',
            type: eventType,
            status: 'Scheduled',
            notes: lmpItem?.notes || '',
            preFlightNotes: forwardedPreFlightNotes,
            trainingReportForwardedNotes: (lmpItem as any)?.trainingReportForwardedNotes,
            crew: []
        } as ScheduleEvent;
    };

    const openInlinePt051 = (assessment: Pt051Assessment) => {
        if (!canViewPt051) {
            onAccessDenied?.('PT-051 record');
            return;
        }
        setInlinePt051Assessment(assessment);
        setInlinePt051Event(buildPt051EventFromAssessment(assessment));
        setActiveTab('pt051');
        setTimeout(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    const persistInlinePt051Assessment = async (assessment: Pt051Assessment, isAutoSave?: boolean) => {
        if (!canEditPt051) {
            if (!isAutoSave) onAccessDenied?.('save PT-051 assessment');
            return;
        }
        const eventId = assessment.eventId || inlinePt051Event?.id || `pt051-${trainee.idNumber}-${assessment.flightNumber}-${assessment.date || 'undated'}`;
        const normalizedAssessment: Pt051Assessment = {
            ...assessment,
            id: assessment.id || `pt051-${eventId}-${trainee.fullName}`,
            eventId,
            traineeFullName: trainee.fullName,
        };
        onSavePt051Assessment?.(normalizedAssessment);
        setInlinePt051Assessment(normalizedAssessment);

        const traineeId = (trainee as any).id;
        if (!traineeId) {
            if (!isAutoSave) {
                alert(`Training Report could not be saved: trainee database record not found for ${trainee.fullName}.`);
            }
            return;
        }

        const response = await fetch('/api/trainee-performance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...normalizedAssessment,
                traineeId,
                course: trainee.course || null,
                createdBy: currentUserId || null,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            if (!isAutoSave) alert(`Training Report could not be saved to the database.\n\n${errorText || `HTTP ${response.status}`}`);
            throw new Error(errorText || `Failed to save Training Report (${response.status})`);
        }
    };

    const deleteInlinePt051Assessment = async (assessmentId: string) => {
        if (!canEditPt051) {
            onAccessDenied?.('delete PT-051 assessment');
            return;
        }
        const eventId = inlinePt051Assessment?.eventId || inlinePt051Event?.id || assessmentId;
        const response = await fetch(`/api/trainee-performance/${encodeURIComponent(eventId)}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            alert(`Training Report could not be deleted from the database.\n\n${errorText || `HTTP ${response.status}`}`);
            throw new Error(errorText || `Failed to delete Training Report (${response.status})`);
        }
        onDeletePt051Assessment?.(assessmentId, eventId, trainee.fullName);
        setInlinePt051Assessment(null);
        setInlinePt051Event(null);
        setActiveTab('hatesheet');
    };

    const handleIndividualLMPClick = () => {
        if (!canViewIndividualLmp) {
            onAccessDenied?.('Individual LMP');
            return;
        }
        if (traineeLMPs === undefined) {
            onAccessDenied?.('Individual LMP');
            return;
        }

        setActiveTab(prev => prev === 'lmp' ? null : 'lmp');
        setTimeout(() => { contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, 50);
    };

    const handleExperienceChange = (
        section: keyof LogbookExperience,
        field: string | null,
        value: number
    ) => {
        setPriorExperience(prev => {
            if (field) {
                return {
                    ...prev,
                    [section]: {
                        ...(prev[section] as any),
                        [field]: value
                    }
                };
            } else {
                return {
                    ...prev,
                    [section]: value
                };
            }
        });
    };

    const handleAddTodayOnlyUnavailability = () => {
        const today = new Date();
        const formatForInput = (date: Date) => date.toISOString().split('T')[0];
        const todayStr = formatForInput(today);
        const newPeriod: UnavailabilityPeriod = {
            id: uuidv4(),
            startDate: todayStr,
            endDate: todayStr,
            allDay: false,
            startTime: '0001',
            endTime: '2359',
            reason: 'Other',
            notes: 'Today Only',
        };
        if (isCreating) {
            setUnavailability(prev => [...prev, newPeriod]);
            setShowAddUnavailability(false);
        } else {
            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `Today Only - ${todayStr}`,
                page: 'Trainee Roster'
            });
            const updatedUnavailability = [...unavailability, newPeriod];
            setUnavailability(updatedUnavailability);
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
            setShowAddUnavailability(false);
        }
    };

    const handleSaveCustomUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
        console.log('handleSaveCustomUnavailability called', { periodData, isCreating, traineeName: trainee.name });

        const newPeriod = {
            ...periodData,
            id: uuidv4(),
            startTime: periodData.allDay ? undefined : periodData.startTime,
            endTime: periodData.allDay ? undefined : periodData.endTime,
        };

        console.log('Created new period', newPeriod);

        if (isCreating) {
            console.log('Adding to creating trainee unavailability');
            setUnavailability(prev => [...prev, newPeriod]);
        } else {
            console.log('Updating existing trainee unavailability');
            const dateRange = periodData.startDate === periodData.endDate
                ? periodData.startDate
                : `${periodData.startDate} to ${periodData.endDate}`;
            const timeRange = periodData.allDay ? 'All Day' : `${periodData.startTime} to ${periodData.endTime}`;

            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `${dateRange} @ ${timeRange} - ${periodData.reason}`,
                page: 'Trainee Roster'
            });
            const updatedUnavailability = [...unavailability, newPeriod];
            console.log('Calling onUpdateTrainee with updated unavailability', updatedUnavailability);
            setUnavailability(updatedUnavailability);
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
        }
    };

    const handleRemoveUnavailabilityFromFlyout = (idToRemove: string) => {
        if (isCreating) {
            setUnavailability(prev => prev.filter(p => p.id !== idToRemove));
        } else {
            const periodToRemove = unavailability.find(p => p.id === idToRemove);
            if (periodToRemove) {
                const dateRange = periodToRemove.startDate === periodToRemove.endDate
                    ? periodToRemove.startDate
                    : `${periodToRemove.startDate} to ${periodToRemove.endDate}`;

                logAudit({
                    action: 'Delete',
                    description: `Removed unavailability for ${trainee.rank} ${trainee.name}`,
                    changes: `${dateRange} - ${periodToRemove.reason}`,
                    page: 'Trainee Roster'
                });
            }
            const updatedUnavailability = unavailability.filter(p => p.id !== idToRemove);
            setUnavailability(updatedUnavailability);
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
        }
    };

    const handleRemoveUnavailability = (idToRemove: string) => {
        console.log('🗑️ [TRAINEE] DELETE START - idToRemove:', idToRemove);
        console.log('🗑️ [TRAINEE] Current unavailability state:', unavailability);
        console.log('🗑️ [TRAINEE] isCreating:', isCreating);

        const periodToRemove = unavailability?.find(p => p.id === idToRemove);
        console.log('🗑️ [TRAINEE] Period to remove:', periodToRemove);

        if (periodToRemove) {
            const dateRange = periodToRemove.startDate === periodToRemove.endDate
                ? periodToRemove.startDate
                : `${periodToRemove.startDate} to ${periodToRemove.endDate}`;

            console.log('🗑️ [TRAINEE] Logging audit for:', { trainee, dateRange, reason: periodToRemove.reason });

            logAudit({
                action: 'Delete',
                description: `Removed unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `${dateRange} - ${periodToRemove.reason}`,
                page: 'Trainee Profile'
            });
        }

        const updatedUnavailability = unavailability.filter(p => p.id !== idToRemove);
        console.log('🗑️ [TRAINEE] Updated unavailability after filter:', updatedUnavailability);
        console.log('🗑️ [TRAINEE] Calling setUnavailability with filtered list');

        setUnavailability(prev => prev.filter(p => p.id !== idToRemove));

        console.log('🗑️ [TRAINEE] Calling onUpdateTrainee with trainee object');
        console.log('🗑️ [TRAINEE] Trainee object to update:', {
            id: (trainee as any).id,
            idNumber: trainee.idNumber,
            name: trainee.name,
            unavailability: updatedUnavailability
        });

        onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });

        console.log('🗑️ [TRAINEE] DELETE COMPLETE');
    };

    const formatMilitaryTime = (timeString: string | undefined): string => {
        if (!timeString) return '';
        return timeString.replace(':', '');
    };

    const buttonClasses = "w-full px-4 py-2 rounded-md transition-colors text-sm font-semibold shadow-md text-center";

    const permissionsWindow = (
        <div className="grid grid-cols-2 gap-3">
            <fieldset className="p-3 border border-gray-600 rounded-lg">
                <legend className="px-2 text-sm font-semibold text-gray-300">Permissions</legend>
                <div className="mt-1 min-h-[10rem] p-2">
                    {isEditing ? (
                        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                            {allPermissions.map(perm => (
                                <label key={perm} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={permissions.includes(perm)}
                                        onChange={e => handlePermissionChange(perm, e.target.checked)}
                                        className="h-4 w-4 accent-sky-500 bg-gray-600 rounded"
                                    />
                                    <span className="text-white text-[11px]">{perm}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <ul className="space-y-2 text-white list-disc list-inside">
                            {getVisiblePermissions(trainee.permissions).length > 0 ? (
                                getVisiblePermissions(trainee.permissions).map(perm => <li key={perm}>{perm}</li>)
                            ) : (
                                <li className="list-none italic text-gray-500">No permissions assigned.</li>
                            )}
                        </ul>
                    )}
                </div>
            </fieldset>
            <fieldset className="p-3 border border-gray-600 rounded-lg">
                <legend className="px-2 text-sm font-semibold text-gray-300">Roles</legend>
                <div className="mt-1 min-h-[10rem] p-2">
                    {isEditing ? (
                        <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                            {allRoles.map(role => (
                                <label key={role} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={false}
                                        className="h-4 w-4 accent-sky-500 bg-gray-600 rounded"
                                    />
                                    <span className="text-white text-[11px]">{role}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <ul className="space-y-2 text-white list-disc list-inside">
                            <li className="list-none italic text-gray-500">No roles assigned.</li>
                        </ul>
                    )}
                </div>
            </fieldset>
        </div>
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={onClose}>
              <div className="bg-[#141e2e] rounded-lg shadow-2xl w-[calc(100vw-2rem)] md:w-[calc(100vw-12rem)] xl:w-[min(calc(100vw-18rem),88rem)] max-w-[88rem] max-h-[94vh] flex flex-col border border-gray-600 overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="px-5 py-3 border-b border-gray-600 flex justify-between items-center bg-[#0f1824] flex-shrink-0">
                  <h2 className="text-lg font-bold text-white">{isCreating ? 'New Trainee' : 'Trainee Profile'}</h2>
                  <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold leading-none">✕</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                  {/* MAIN CONTENT — scrollable */}
                  <div
                    ref={contentScrollRef}
                    className={`flex-1 min-h-0 p-4 relative ${
                      activeTab === 'lmp' || activeTab === 'pt051'
                        ? 'overflow-hidden flex flex-col'
                        : 'overflow-y-auto space-y-3'
                    }`}
                  >
                    {/* Transparent freeze overlay — blocks all interaction with content */}
                    {isFrozen && (
                      <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                    )}

                    {/* ── TAB PANELS (shown inline above profile when a tab is active) ── */}
                    {activeTab === 'currency' && (
                      <div className={card3d + " p-3"} style={card3dStyle}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-white">Currency &mdash; {trainee.name}</h4>
                          <div className="flex items-center gap-[1px]">
                            {currencyEditState && !currencyEditState.isEditing && (
                              <button
                                onClick={currencyEditState.onEdit}
                                className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                title="Edit currency dates"
                              >
                                Edit
                              </button>
                            )}
                            {currencyEditState && currencyEditState.isEditing && (
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
                          key={`currency-panel-${trainee.idNumber}`}
                          personId={(trainee as any).id}
                          idNumber={trainee.idNumber}
                          personType="trainee"
                          personName={trainee.name}
                          masterCurrencies={masterCurrencies}
                          currencyRequirements={currencyRequirements}
                          initialCurrencyStatus={localCurrencyStatusRef.current ?? localCurrencyStatus ?? trainee.currencyStatus}
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
                        personId={String((trainee as any).id || trainee.idNumber)}
                        personName={trainee.name}
                        onClose={() => setShowCurrencyAudit(false)}
                      />
                    )}

                    {activeTab === 'review' && (() => {
                      const chartWidth = 900;
                      const chartHeight = reviewScoreGraphExpanded ? 300 : 190;
                      const chartPadding = { left: 34, right: 18, top: 16, bottom: 38 };
                      const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
                      const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                      const points = reviewData.scorePoints;
                      const maxGrade = Math.max(5, ...points.map(point => point.grade));
                      const xForPoint = (index: number) => chartPadding.left + ((index + 0.5) / Math.max(1, points.length)) * chartInnerWidth;
                      const yForGrade = (grade: number) => chartPadding.top + chartInnerHeight - (Math.max(0, grade) / maxGrade) * chartInnerHeight;
                      const smoothPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xForPoint(index)} ${yForGrade(point.smoothed)}`).join(' ');
                      const progressAngle = (value: number) => -90 + (Math.max(0, Math.min(100, value)) / 100) * 360;
                      const lineForProgress = (value: number, colour: string, label: string) => {
                        const angle = progressAngle(value) * Math.PI / 180;
                        const x1 = 70 + Math.cos(angle) * 43;
                        const y1 = 70 + Math.sin(angle) * 43;
                        const x2 = 70 + Math.cos(angle) * 62;
                        const y2 = 70 + Math.sin(angle) * 62;
                        return (
                          <g key={label}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colour} strokeWidth="1.8" strokeOpacity="0.82" strokeLinecap="round" />
                            <title>{`${label}: ${value.toFixed(0)}%`}</title>
                          </g>
                        );
                      };
                      const progressDash = `${Math.max(0, Math.min(100, reviewData.progress.progressPercent))} ${100 - Math.max(0, Math.min(100, reviewData.progress.progressPercent))}`;
                      const displayHourRows = reviewHoursExpanded ? reviewData.hourRows : reviewData.hourRows.slice(-1);
                      const summaryBlock = (title: string, items: TraineeReviewPoint[], colourClass: string) => (
                        <div className="rounded border border-gray-600/70 bg-gray-900/35 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-300">{title}</span>
                            <span className={`rounded px-2 py-0.5 text-xs font-bold ${colourClass}`}>{items.length}</span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {items.length > 0 ? items.map((item, index) => (
                              <div key={`${title}-${item.code}-${index}`} className="rounded bg-gray-800/80 px-2 py-1.5">
                                <div className="font-mono text-[10px] font-bold text-gray-100">{item.code}</div>
                                <div className="mt-0.5 text-[11px] leading-snug text-gray-300">{item.comments || 'No overall comments recorded.'}</div>
                              </div>
                            )) : (
                              <span className="text-xs italic text-gray-500">None</span>
                            )}
                          </div>
                        </div>
                      );

                      return (
                        <div className={card3d + " p-4"} style={card3dStyle}>
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-white">Trainee Review — {trainee.name}</h4>
                              <p className="text-[11px] text-gray-400">Performance, course progress, cumulative hours and review flags.</p>
                            </div>
                            <div className="flex items-center gap-[1px]">
                              <button onClick={exportTraineeReviewPdf} className="w-[74px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md">
                                Export PDF
                              </button>
                              <button onClick={() => setActiveTab(null)} className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md">
                                Close
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded border border-gray-600/70 bg-gray-950/30 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <div>
                                  <h5 className="text-xs font-bold uppercase tracking-wide text-sky-100">Scores by Event</h5>
                                  <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-400">
                                    <span><span className="inline-block h-2 w-2 rounded-sm bg-red-500 mr-1" />Fail</span>
                                    <span><span className="inline-block h-2 w-2 rounded-sm bg-amber-500 mr-1" />Marginal</span>
                                    <span><span className="inline-block h-0.5 w-4 bg-cyan-300 mr-1 align-middle" />Smoothed avg</span>
                                  </div>
                                </div>
                                <button onClick={() => setReviewScoreGraphExpanded(prev => !prev)} className="w-[72px] h-[34px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md">
                                  {reviewScoreGraphExpanded ? 'Collapse' : 'Expand'}
                                </button>
                              </div>
                              {points.length > 0 ? (
                                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={`${reviewScoreGraphExpanded ? 'h-[480px]' : 'h-[220px]'} w-full overflow-visible`}>
                                  {[0, 1, 2, 3, 4, 5].map(grade => (
                                    <g key={grade}>
                                      <line x1={chartPadding.left} y1={yForGrade(grade)} x2={chartWidth - chartPadding.right} y2={yForGrade(grade)} stroke="rgba(148,163,184,0.16)" />
                                      <text x="8" y={yForGrade(grade) + 3} fill="#94a3b8" fontSize="9">{grade}</text>
                                    </g>
                                  ))}
                                  {points.map((point, index) => {
                                    const barWidth = Math.max(8, Math.min(22, chartInnerWidth / Math.max(1, points.length) - 6));
                                    const x = xForPoint(index) - barWidth / 2;
                                    const y = yForGrade(point.grade);
                                    const fill = point.status === 'fail' || point.status === 'double-marginal'
                                      ? '#ef4444'
                                      : point.status === 'marginal'
                                        ? '#f59e0b'
                                        : '#38bdf8';
                                    return (
                                      <g key={`${point.code}-${index}`}>
                                        <rect x={x} y={y} width={barWidth} height={chartPadding.top + chartInnerHeight - y} rx="2" fill={fill} opacity="0.88" />
                                        <text
                                          x={xForPoint(index)}
                                          y={chartHeight - 20}
                                          fill={point.status === 'fail' || point.status === 'double-marginal' ? '#f87171' : point.status === 'marginal' ? '#fb923c' : '#cbd5e1'}
                                          fontSize="8"
                                          fontWeight={point.status === 'pass' ? 500 : 800}
                                          textAnchor="middle"
                                          transform={`rotate(-45 ${xForPoint(index)} ${chartHeight - 20})`}
                                        >
                                          {point.code}
                                        </text>
                                        <title>{`${point.code}: ${point.grade} (${point.status})`}</title>
                                      </g>
                                    );
                                  })}
                                  {smoothPath && <path d={smoothPath} fill="none" stroke="#67e8f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
                                </svg>
                              ) : (
                                <div className="flex h-[220px] items-center justify-center text-xs italic text-gray-500">No scored events available.</div>
                              )}
                            </div>

                            <div className={`grid grid-cols-1 gap-4 ${reviewProgressExpanded ? '' : 'xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]'}`}>
                            <div className={`rounded border border-gray-600/70 bg-gray-950/30 p-3 ${reviewProgressExpanded ? 'min-h-[460px]' : ''}`}>
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold uppercase tracking-wide text-sky-100">Course Progress</h5>
                                <button onClick={() => setReviewProgressExpanded(prev => !prev)} className="w-[72px] h-[34px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md">
                                  {reviewProgressExpanded ? 'Collapse' : 'Expand'}
                                </button>
                              </div>
                              <div className={`mt-3 flex ${reviewProgressExpanded ? 'flex-col items-center justify-center' : 'flex-col items-center'}`}>
                                <svg viewBox="0 0 140 140" className={reviewProgressExpanded ? 'h-80 w-80' : 'h-36 w-36'}>
                                  <circle cx="70" cy="70" r="52" fill="rgba(15,23,42,0.9)" stroke="rgba(148,163,184,0.25)" strokeWidth="14" />
                                  <circle cx="70" cy="70" r="52" fill="none" stroke="#22c55e" strokeWidth="14" strokeDasharray={progressDash} pathLength="100" transform="rotate(-90 70 70)" strokeLinecap="round" />
                                  {lineForProgress(reviewData.progress.averageProgress, '#ffb000', 'Course average')}
                                  {lineForProgress(reviewData.progress.mostProgress, '#00d9ff', 'Front runner')}
                                  {lineForProgress(reviewData.progress.leastProgress, '#ff4040', 'Back marker')}
                                  <text x="70" y="68" fill="#f8fafc" fontSize="18" fontWeight="800" textAnchor="middle">{reviewData.progress.progressPercent.toFixed(0)}%</text>
                                  <text x="70" y="84" fill="#94a3b8" fontSize="9" textAnchor="middle">{reviewData.progress.completedCount}/{reviewData.progress.totalCount}</text>
                                </svg>
                                <div className={`${reviewProgressExpanded ? 'mt-4 w-72 text-[11px]' : 'mt-2 text-[10px]'} space-y-1 text-gray-300`}>
                                  <div className="flex justify-between"><span style={{ color: '#ffb000' }}>Course average</span><span>{reviewData.progress.averageProgress.toFixed(0)}%</span></div>
                                  <div className="flex justify-between"><span style={{ color: '#00d9ff' }}>Front runner</span><span>{reviewData.progress.mostProgress.toFixed(0)}%</span></div>
                                  <div className="flex justify-between"><span style={{ color: '#ff4040' }}>Back marker</span><span>{reviewData.progress.leastProgress.toFixed(0)}%</span></div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded border border-gray-600/70 bg-gray-950/30 p-3">
                              <h5 className="text-xs font-bold uppercase tracking-wide text-sky-100">Review Metrics</h5>
                              <div className="mt-3 overflow-x-auto">
                                <table className="min-w-full text-left text-[11px]">
                                  <tbody className="divide-y divide-gray-800/80">
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Events completed</td>
                                      <td className="py-1.5 text-right font-semibold text-white">{reviewData.progress.completedCount}</td>
                                    </tr>
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Failed events</td>
                                      <td className="py-1.5 text-right font-semibold text-red-200">{reviewData.summaryFailed.length}</td>
                                    </tr>
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Double marginal events</td>
                                      <td className="py-1.5 text-right font-semibold text-red-200">{reviewData.summaryDoubleMarginal.length}</td>
                                    </tr>
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Marginal events</td>
                                      <td className="py-1.5 text-right font-semibold text-amber-200">{reviewData.summaryMarginal.length}</td>
                                    </tr>
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Current score average</td>
                                      <td className="py-1.5 text-right font-semibold text-sky-100">{reviewData.currentScoreAverage.toFixed(1)}</td>
                                    </tr>
                                    <tr>
                                      <td className="py-1.5 pr-4 text-gray-400">Course rank by average score</td>
                                      <td className="py-1.5 text-right font-semibold text-sky-100">
                                        {reviewData.courseAverageRank.rank ? `${reviewData.courseAverageRank.rank}/${reviewData.courseAverageRank.total}` : '-'}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded border border-gray-600/70 bg-gray-950/30 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div>
                                <h5 className="text-xs font-bold uppercase tracking-wide text-sky-100">Cumulative Hours</h5>
                                <p className="text-[10px] text-gray-500">Effective hours = logbook hours minus ineffective post-flight time.</p>
                              </div>
                              <button onClick={() => setReviewHoursExpanded(prev => !prev)} className="w-[72px] h-[34px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md">
                                {reviewHoursExpanded ? 'Collapse' : 'Expand'}
                              </button>
                            </div>
                            {reviewLogbookLoading ? (
                              <div className="py-5 text-center text-xs italic text-gray-500">Loading post-flight logbook entries...</div>
                            ) : reviewLogbookError ? (
                              <div className="py-5 text-center text-xs italic text-amber-300">{reviewLogbookError}</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-[11px]">
                                  <thead className="text-gray-400">
                                    <tr className="border-b border-gray-700">
                                      <th className="py-1 pr-3">Event</th>
                                      <th className="py-1 pr-3">Date</th>
                                      <th className="py-1 pr-3 text-right">Logbook</th>
                                      <th className="py-1 pr-3 text-right">Syllabus</th>
                                      <th className="py-1 pr-3 text-right">Ineff</th>
                                      <th className="py-1 pr-3 text-right">Effective</th>
                                      <th className="py-1 pr-3 text-right">Cum Log</th>
                                      <th className="py-1 pr-3 text-right">Cum Syl</th>
                                      <th className="py-1 text-right">Cum Eff</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {displayHourRows.length > 0 ? displayHourRows.map((row, index) => (
                                      <tr key={`${row.code}-${row.date}-${index}`} className="border-b border-gray-800/80 text-gray-200">
                                        <td className="py-1 pr-3 font-mono">{row.code}</td>
                                        <td className="py-1 pr-3 text-gray-400">{row.date || '-'}</td>
                                        <td className="py-1 pr-3 text-right">{reviewFormatHours(row.logbookHours)}</td>
                                        <td className="py-1 pr-3 text-right">{reviewFormatHours(row.syllabusHours)}</td>
                                        <td className="py-1 pr-3 text-right text-amber-200">{reviewFormatHours(row.ineffectiveHours)}</td>
                                        <td className="py-1 pr-3 text-right">{reviewFormatHours(row.effectiveHours)}</td>
                                        <td className="py-1 pr-3 text-right font-semibold">{reviewFormatHours(row.cumulativeLogbook)}</td>
                                        <td className="py-1 pr-3 text-right font-semibold">{reviewFormatHours(row.cumulativeSyllabus)}</td>
                                        <td className="py-1 text-right font-semibold">{reviewFormatHours(row.cumulativeEffective)}</td>
                                      </tr>
                                    )) : (
                                      <tr><td colSpan={9} className="py-5 text-center italic text-gray-500">No post-flight logbook rows available.</td></tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="text-sky-100">
                                      <td className="pt-2 font-bold" colSpan={2}>Totals</td>
                                      <td className="pt-2 pr-3 text-right font-bold">{reviewFormatHours(reviewData.hourTotals.logbook)}</td>
                                      <td className="pt-2 pr-3 text-right font-bold">{reviewFormatHours(reviewData.hourTotals.syllabus)}</td>
                                      <td />
                                      <td />
                                      <td />
                                      <td />
                                      <td className="pt-2 text-right font-bold">{reviewFormatHours(reviewData.hourTotals.effective)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 space-y-3">
                            {summaryBlock('Failed Events', reviewData.summaryFailed, 'bg-red-500/20 text-red-200')}
                            {summaryBlock('Double Marginal Events', reviewData.summaryDoubleMarginal, 'bg-red-500/20 text-red-200')}
                            {summaryBlock('Marginal Events', reviewData.summaryMarginal, 'bg-amber-500/20 text-amber-200')}
                          </div>
                        </div>
                      );
                    })()}

                    {activeTab === 'unavailable' && (
                      <div className={card3d + " p-4"} style={card3dStyle}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-white">Unavailability — {trainee.name}</h4>
                          <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                        </div>
                        <div className="space-y-2">
                          {(unavailability || []).length > 0 ? (unavailability || []).map(p => {
                            let periodDisplay = '';
                            if (p.allDay) {
                              const sd = formatDate(p.startDate);
                              const ed = formatDate(p.endDate);
                              periodDisplay = p.startDate !== p.endDate ? `${sd} – ${ed} @ All Day` : `${sd} @ All Day`;
                            } else {
                              const sd = `${formatMilitaryTime(p.startTime)} ${formatDate(p.startDate)}`;
                              const ed = `${formatMilitaryTime(p.endTime)} ${formatDate(p.endDate)}`;
                              periodDisplay = p.startDate !== p.endDate ? `${sd} to ${ed}` : `${sd} - ${ed}`;
                            }
                            return (
                              <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                                <span className="text-white font-medium">{p.reason}</span>
                                <span className="text-gray-300 font-mono">{periodDisplay}</span>
                                <button onClick={() => handleRemoveUnavailability(p.id)} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
                              </div>
                            );
                          }) : <p className="text-gray-500 text-xs italic text-center py-4">No unavailability periods scheduled.</p>}
                        </div>
                        <button onClick={() => { setShowAddUnavailability(true); setActiveTab(null); }} className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded">+ Add Unavailability</button>
                      </div>
                    )}

                    {activeTab === 'logbook' && (
                      <div className={card3d + " p-4"} style={card3dStyle}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-white">Logbook — {trainee.name}</h4>
                          <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                        </div>
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
                        <div className="flex justify-end gap-2 pt-4">
                          <button onClick={handleSave} className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded">Save Logbook</button>
                          <button onClick={() => setActiveTab(null)} className="px-4 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded">Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* ── PT-051 PERFORMANCE HISTORY TAB (inline) ── */}
                    {activeTab === 'hatesheet' && (() => {
                      const traineeAssessments = pt051Assessments
                        ? Array.from(pt051Assessments.values()).filter((a: Pt051Assessment) => a.traineeFullName === trainee.fullName)
                        : [];
                      return (
                        <div className={card3d + " p-0 overflow-hidden"} style={card3dStyle}>
                          <HateSheetView
                            trainee={trainee}
                            lmpScores={scores.get(trainee.fullName) || []}
                            assessments={traineeAssessments}
                            pt051Events={traineeAssessments}
                            traineeLmp={currentIndividualLMP || []}
                            userProfile={userProfile || {}}
                            refreshEvents={() => {}}
                            onSelectLmpScore={() => {}}
                            onSelectPt051={(assessment: Pt051Assessment) => {
                              openInlinePt051(assessment);
                              if (onSelectPt051ForEvent) {
                                logAudit('Performance History', 'View', `Opened embedded Training Report for ${assessment.traineeFullName} - Event: ${assessment.flightNumber} (${assessment.date})`);
                              }
                            }}
                            onBackToRoster={() => setActiveTab(null)}
                            onInsertPt051={() => {}}
                            canEditPt051={canEditPt051}
                            isLoading={pt051PerformanceLoading}
                            trainingReportTerminology={trainingReportTerminology}
                          />
                        </div>
                      );
                    })()}

                    {/* ── TRAINING REPORT DETAIL TAB (inline within trainee profile) ── */}
                    {activeTab === 'pt051' && inlinePt051Assessment && inlinePt051Event && (() => {
                      const assessmentKey = `pt051-${inlinePt051Assessment.eventId}-${trainee.fullName}`;
                      const currentAssessment = pt051Assessments?.get(assessmentKey)
                        || Array.from(pt051Assessments?.values() || []).find((assessment: Pt051Assessment) =>
                          assessment.traineeFullName === trainee.fullName &&
                          (
                            assessment.eventId === inlinePt051Assessment.eventId ||
                            (
                              assessment.flightNumber === inlinePt051Assessment.flightNumber &&
                              (!inlinePt051Assessment.date || !assessment.date || assessment.date === inlinePt051Assessment.date)
                            )
                          )
                        )
                        || inlinePt051Assessment;
                      return (
                        <div className={card3d + " p-0 overflow-hidden h-full min-h-0 flex flex-col"} style={card3dStyle}>
                          <PT051View
                            key={`embedded-${inlinePt051Event.id}-${trainee.fullName}-${currentAssessment?.overallGrade ?? 'none'}`}
                            trainee={trainee}
                            event={inlinePt051Event}
                            initialAssessment={currentAssessment}
                            instructorLabel="QFI"
                            trainingReportTerminology={trainingReportTerminology}
                            trainingReportTemplate={activeTrainingReportTemplate}
                            trainingReportUnitCode={activeTrainingReportUnitCode}
                            trainingReportContextUnitCode={activeTrainingReportUnitCode}
                            onBack={() => setActiveTab('hatesheet')}
                            onEventUpdate={setInlinePt051Event}
                            onDeleteAssessment={deleteInlinePt051Assessment}
                            onSave={persistInlinePt051Assessment}
                            instructors={instructorsData}
                            pt051Assessments={pt051Assessments || new Map()}
                            events={events}
                            lmpScores={scores.get(trainee.fullName) || []}
                            syllabusDetails={syllabusDetails}
                            registerDirtyCheck={registerDirtyCheck}
                            phraseBank={activeTrainingReportPhraseBank}
                            currentUserPin={currentUserId || '1111'}
                            canEditPt051={canEditPt051}
                            embeddedInProfile
                          />
                        </div>
                      );
                    })()}

                    {/* ── INDIVIDUAL LMP TAB (inline) ── */}
                    {activeTab === 'lmp' && (() => {
                      const traineeScores = scores.get(trainee.fullName) || [];
                      return (
                        <div className={card3d + " p-0 overflow-hidden h-full min-h-0 flex flex-col"} style={card3dStyle}>
                          <TraineeLmpView
                            trainee={trainee}
                            traineeLmp={currentIndividualLMP || []}
                            scores={traineeScores}
                            onBack={() => setActiveTab(null)}
                            onDeleteRemedialItem={onDeleteRemedialItem}
                            onGeneratePt051ForItem={onGeneratePt051ForItem}
                            onInsertCustomEvent={onInsertCustomLmpEvent}
                            onUpdateLmpItem={onUpdateLmpItem}
                            insertEventTypes={insertEventTypes}
                            aircraftConfigurations={aircraftConfigurations}
                          />
                        </div>
                      );
                    })()}

                    {/* ── SECTION 1: MAIN PROFILE CARD ── */}
                    <div className={card3d + ` p-3 ${activeTab === 'lmp' || activeTab === 'pt051' ? 'hidden' : ''}`} style={card3dStyle}>
                      {isEditing ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-gray-700/70 pb-2">
                            <div>
                              <h4 className="text-sm font-semibold text-white">Profile Details</h4>
                              <p className="text-[11px] text-gray-400">Course, identity, contact and access settings.</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isSuspended ? 'bg-red-600 text-white' : isPaused ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                              {traineeStatusLabel}
                            </span>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-300 mb-2">Training</div>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                              <div className="lg:col-span-2">
                                <InputField label="Name (Surname, Firstname)" value={name} onChange={e => handleNameChange(e.target.value)} />
                              </div>
                              <InputField label="ID Number" value={idNumber} onChange={e => setIdNumber(parseInt(e.target.value) || 0)} />
                              <Dropdown label="Rank" value={rank} onChange={e => setRank(e.target.value as TraineeRank)}>
                                {traineeRankOptions.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </Dropdown>
                              <Dropdown label="Service" value={service} onChange={e => setService(e.target.value)}>
                                <option value="RAAF">RAAF</option><option value="RAN">RAN</option><option value="ARA">ARA</option>
                              </Dropdown>
                              <Dropdown label="Course" value={course} onChange={e => handleCourseChange(e.target.value)}>
                                {(activeCourses || []).length > 0 ? (activeCourses || []).map(c => <option key={c} value={c}>{c}</option>) : <option disabled>No courses</option>}
                              </Dropdown>
                              <Dropdown label="LMP" value={lmpType} onChange={e => handleLmpTypeChange(e.target.value)}>
                                {assignableMasterLmps.map(lmp => <option key={lmp} value={lmp}>{lmp}</option>)}
                              </Dropdown>
                              <Dropdown label="Academic LMP" value={academicLmpType} onChange={e => setAcademicLmpType(e.target.value)}>
                                <option value="">None</option>
                                {academicLmpCourses.map(lmp => <option key={lmp} value={lmp}>{lmp}</option>)}
                              </Dropdown>
                              <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}>
                                <option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option>
                              </Dropdown>
                            </div>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-300 mb-2">Organisation & Contact</div>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                              <Dropdown label="Unit" value={unit} onChange={e => setUnit(e.target.value)}>
                                {(units || []).map(u => <option key={u} value={u}>{u}</option>)}
                              </Dropdown>
                              <Dropdown label="Location" value={location} onChange={e => setLocation(e.target.value)}>
                                {(locations || []).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                              </Dropdown>
                              <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                              <InputField label="Callsign" value={traineeCallsign} onChange={e => setTraineeCallsign(e.target.value)} />
                              <InputField label="Secondary Callsign" value={secondaryCallsign} onChange={e => setSecondaryCallsign(e.target.value)} />
                              <InputField label="Crew" value={crew} onChange={e => setCrew(e.target.value)} />
                              <div className="lg:col-span-2">
                                <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                              </div>
                              <div className="lg:col-span-3">
                                <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-300 mb-2">Permissions</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-2">
                              {allPermissions.map(perm => (
                                <label key={perm} className="flex items-center space-x-2 cursor-pointer text-xs text-white">
                                  <input type="checkbox" checked={permissions.includes(perm)} onChange={e => handlePermissionChange(perm, e.target.checked)} className="h-3 w-3 accent-sky-500" />
                                  <span>{perm}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* VIEW MODE: avatar + data grid + permissions panel */
                        <div className="flex gap-4">
                          {/* Profile photo */}
                          <div className="flex-shrink-0">
                            <div className="w-20 h-24 bg-gray-600 rounded border border-gray-500 flex items-center justify-center overflow-hidden">
                              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                              </svg>
                            </div>
                          </div>

                          {/* Name + data grid */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="text-xl font-bold text-white">{trainee.name}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${isTraineeSuspended(trainee) ? 'bg-red-600 text-white' : trainee.isPaused ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                                {isTraineeSuspended(trainee) ? 'Suspended' : trainee.isPaused ? 'Paused' : 'Active'}
                              </span>
                            </div>
                            <div className="grid grid-cols-6 gap-x-4 gap-y-2 text-xs">
                              {/* Row 1 */}
                              <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{trainee.idNumber}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Course</span><span
                                data-course-color="true"
                                className={`font-semibold px-1 rounded text-white text-[10px] ${(courseColors[trainee.course] || '').startsWith('#') ? '' : (courseColors[trainee.course] || 'bg-gray-500')}`}
                                style={(courseColors[trainee.course] || '').startsWith('#') ? { backgroundColor: courseColors[trainee.course] } : {}}
                              >{trainee.course}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">LMP</span><span className="text-sky-300 font-medium">{trainee.lmpType || 'BPC+IPC'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Academic LMP</span><span className="text-purple-300 font-medium">{(trainee as any).academicLmpType || <span className="text-gray-500 italic">None</span>}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{trainee.traineeCallsign || `${callsignData?.callsignPrefix || ''}${callsignData?.callsignNumber || ''}`}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-white font-medium">{trainee.secondaryCallsign || '-'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{trainee.seatConfig}</span></div>
                              {/* Row 2 */}
                              <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{trainee.rank}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{trainee.service || 'RAAF'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{trainee.unit}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Crew</span><span className="text-white font-medium">{trainee.crew || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{trainee.location}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{trainee.flight || 'N/A'}</span></div>
                              {/* Row 3 */}
                              <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                              <div><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                              <div></div>
                              <div></div>
                              <div></div>
                              <div></div>
                            </div>
                          </div>

                          {/* Permissions and Roles panels */}
                          <div className="w-40 flex-shrink-0 space-y-2">
                            <div className="bg-gray-700/30 rounded p-2">
                              <div className="text-[10px] text-gray-400 mb-1 font-semibold">Permissions</div>
                              <div className="flex flex-wrap gap-1">
                                {getVisiblePermissions(trainee.permissions).length > 0 ? getVisiblePermissions(trainee.permissions).map((p: string) => (
                                  <span key={p} className="px-1.5 py-0.5 bg-sky-800 text-sky-200 rounded text-[9px]">{p}</span>
                                )) : <span className="text-gray-500 text-[10px]">None</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>


                      {/* ─── SECTION 2: ASSIGNED INSTRUCTORS (always visible, not editing) ─── */}
                      {activeTab !== 'lmp' && activeTab !== 'pt051' && !isEditing && !isCreating && (
                        <div className={card3d + " p-3"} style={card3dStyle}>
                          <h4 className="text-xs font-semibold text-gray-300 mb-3">Assigned Instructors</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Primary Instructors */}
                            <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                              <div className="text-[9px] text-sky-400 font-semibold mb-1.5">Primary</div>
                              {(() => {
                                const primaries = Array.isArray(trainee.primaryInstructor)
                                  ? trainee.primaryInstructor
                                  : trainee.primaryInstructor ? [trainee.primaryInstructor] : [];
                                return primaries.length > 0 ? (
                                  <div className="flex flex-col gap-1.5">
                                    {primaries.map((name, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                          {name.toLowerCase().includes('burns') && isExternalDataAllowed('externalMediaEnabled') ? (
                                            <img src="https://dfp-neo.com/burns-profile.png" alt={name} className="w-full h-full object-cover object-top" />
                                          ) : (
                                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                                          )}
                                        </div>
                                        {onOpenInstructorProfile ? (
                                          <button
                                            onClick={() => { onOpenInstructorProfile(name); onClose(); }}
                                            className="text-sky-300 hover:text-sky-100 hover:underline text-[10px] font-medium leading-tight text-left"
                                          >{name}</button>
                                        ) : (
                                          <span className="text-white text-[10px] font-medium leading-tight">{name}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                                    </div>
                                    <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                                  </div>
                                );
                              })()}
                            </div>
                            {/* Secondary Instructors */}
                            <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                              <div className="text-[9px] text-amber-400 font-semibold mb-1.5">Secondary</div>
                              {(() => {
                                const secondaries = Array.isArray(trainee.secondaryInstructor)
                                  ? trainee.secondaryInstructor
                                  : trainee.secondaryInstructor ? [trainee.secondaryInstructor] : [];
                                return secondaries.length > 0 ? (
                                  <div className="flex flex-col gap-1.5">
                                    {secondaries.map((name, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                          {name.toLowerCase().includes('burns') && isExternalDataAllowed('externalMediaEnabled') ? (
                                            <img src="https://dfp-neo.com/burns-profile.png" alt={name} className="w-full h-full object-cover object-top" />
                                          ) : (
                                            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                                          )}
                                        </div>
                                        {onOpenInstructorProfile ? (
                                          <button
                                            onClick={() => { onOpenInstructorProfile(name); onClose(); }}
                                            className="text-amber-300 hover:text-amber-100 hover:underline text-[10px] font-medium leading-tight text-left"
                                          >{name}</button>
                                        ) : (
                                          <span className="text-white text-[10px] font-medium leading-tight">{name}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                                    </div>
                                    <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ─── SECTION 3: LOGBOOK VIEW (always visible, not editing) ─── */}
                      {activeTab !== 'lmp' && activeTab !== 'pt051' && !isEditing && (
                        <div className={card3d + " p-3"} style={card3dStyle}>
                          <h4 className="text-xs font-semibold text-gray-300 mb-3">Logbook – Prior Experience ({resourceDisplayNames.aircraft} only)</h4>
                          <div className="flex gap-2">
                            {/* Day Flying */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">Day Flying</div>
                              <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{(exp.day.p1 + exp.day.p2 + exp.day.dual).toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P1</span><span className="text-white font-medium">{exp.day.p1.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P2</span><span className="text-white font-medium">{exp.day.p2.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Dual</span><span className="text-white font-medium">{exp.day.dual.toFixed(1)}</span></div>
                              </div>
                            </div>
                            {/* Night Flying */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">Night Flying</div>
                              <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{(exp.night.p1 + exp.night.p2 + exp.night.dual).toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P1</span><span className="text-white font-medium">{exp.night.p1.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P2</span><span className="text-white font-medium">{exp.night.p2.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Dual</span><span className="text-white font-medium">{exp.night.dual.toFixed(1)}</span></div>
                              </div>
                            </div>
                            {/* Totals */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">Totals</div>
                              <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{exp.total.toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">TOTAL</span><span className="text-white font-medium">{exp.total.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Captain</span><span className="text-white font-medium">{exp.captain.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Instructor</span><span className="text-white font-medium">{exp.instructor.toFixed(1)}</span></div>
                              </div>
                            </div>
                            {/* Inst Sim */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">Inst Sim</div>
                              <div className="w-14 h-14 rounded-full border-4 border-purple-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{exp.instrument.sim.toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Sim</span><span className="text-white font-medium">{exp.instrument.sim.toFixed(1)}</span></div>
                              </div>
                            </div>
                            {/* Inst Actual */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">Inst Actual</div>
                              <div className="w-14 h-14 rounded-full border-4 border-purple-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{exp.instrument.actual.toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Actual</span><span className="text-white font-medium">{exp.instrument.actual.toFixed(1)}</span></div>
                              </div>
                            </div>
                            {/* Simulator */}
                            <div className="flex-1 rounded-lg border border-gray-600/70 bg-gray-800/50 p-2 flex flex-col items-center">
                              <div className="text-[11px] font-semibold text-gray-200 mb-2">{resourceDisplayNames.ftd}</div>
                              <div className="w-14 h-14 rounded-full border-4 border-sky-500/60 flex items-center justify-center mb-2">
                                <span className="text-white font-bold text-sm">{exp.simulator.total.toFixed(1)}</span>
                              </div>
                              <div className="w-full space-y-0.5">
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P1</span><span className="text-white font-medium">{exp.simulator.p1.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">P2</span><span className="text-white font-medium">{exp.simulator.p2.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Dual</span><span className="text-white font-medium">{exp.simulator.dual.toFixed(1)}</span></div>
                                <div className="flex justify-between text-[10px]"><span className="text-gray-400">Total</span><span className="text-white font-medium">{exp.simulator.total.toFixed(1)}</span></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* RIGHT SIDEBAR — buttons */}
                    <div className="w-[95px] flex-shrink-0 border-l border-gray-700 bg-[#0f1824] px-[10px] py-3 flex flex-col gap-px">
                      {!isEditing && (
                        <>
                          <button onClick={() => handleTabClick('unavailable')} className={tabBtnClass('unavailable')}>Unavail&shy;able</button>
                          <button onClick={() => handleTabClick('currency')} className={tabBtnClass('currency')}>Currency</button>
                          {canViewPt051 && (
                            <button
                              onClick={handleHateSheetClick}
                              className={tabBtnClass('hatesheet')}
                              title="Training Report"
                            >
                              <span className="leading-tight">Training<br />Report</span>
                            </button>
                          )}
                          {canViewIndividualLmp && <button onClick={handleIndividualLMPClick} className={tabBtnClass('lmp')}>View Individual LMP</button>}
                          {canAddRemedialPackage && <button onClick={() => onAddRemedialPackage(trainee)} className={btnClass}>Add Remedial Package</button>}
                          <button onClick={() => handleTabClick('review')} className={tabBtnClass('review')}>
                            <span className="leading-tight">Trainee<br />Review</span>
                          </button>
                          <button onClick={() => handleTabClick('logbook')} className={tabBtnClass('logbook')}>Logbook</button>
                          <button onClick={() => setIsEditing(true)} disabled={isFrozen} className={btnClass}>Edit</button>
                          <button onClick={onClose} className={btnClass}>Close</button>
                        </>
                      )}
                      {isEditing && (
                        <>
                          <button onClick={handlePauseToggle} disabled={isFrozen} className={btnClass} style={{ color: isPaused ? '#16a34a' : '#dc2626' }}>{isPaused ? 'UNPAUSE' : 'PAUSE'}</button>
                          <button onClick={handleSuspendToggle} disabled={isFrozen} className={btnClass} style={{ color: isSuspended ? '#16a34a' : '#dc2626' }}>{isSuspended ? 'UNSUSPEND' : 'SUSPEND'}</button>
                          <button onClick={handleSave} className={btnClass}>Save</button>
                          <button onClick={handleCancel} className={btnClass}>Cancel</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            {showAddUnavailability && (<AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnlyUnavailability} onSave={handleSaveCustomUnavailability} unavailabilityPeriods={unavailability} onRemove={handleRemoveUnavailabilityFromFlyout} />)}
            {showScheduleWarning && <ScheduleWarningFlyout traineeName={trainee.name} onAcknowledge={() => {setShowScheduleWarning(false); setShowPauseConfirm(true); }} />}
            {showPauseConfirm && <PauseConfirmationFlyout isPaused={isPaused} onConfirm={confirmPause} onCancel={() => setShowPauseConfirm(false)} />}
        </>
    );

};

export default TraineeProfileFlyout;
