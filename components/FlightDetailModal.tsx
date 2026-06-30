import { showDarkAlert, showDarkConfirm } from './DarkMessageModal';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import AuditButton from './AuditButton';
import CrewRequirementEditor from './CrewRequirementEditor';
import { logAudit } from '../utils/auditLogger';
import { useSystemFreeze } from '../hooks/useSystemFreeze';
import { ScheduleEvent, SyllabusItemDetail, Trainee, Instructor, OracleTraineeAnalysis, SctRequest, FormationCallsign, CancellationCode } from '../types';
import { v4 as uuidv4 } from 'uuid';
import CancelEventFlyout from './CancelEventFlyout';
import PinEntryFlyout from './PinEntryFlyout';
import MassBriefCompleteFlyout, { MassBriefConfirmationFlyout } from './MassBriefCompleteFlyout';
import { VisualAdjustModal } from './VisualAdjustModal';
import { DEFAULT_RESOURCE_DISPLAY_NAMES, ResourceDisplayNames } from '../utils/resourceDisplayNames';
import { comparePeopleByConfiguredRank, type PersonnelDisplaySettings } from '../utils/personnelDisplaySettings';
import {
    DEFAULT_AIRCRAFT_NUMBER_SETTINGS,
    formatAircraftNumber,
    parseAircraftNumber,
    type AircraftNumberSettings,
} from '../utils/aircraftNumberFormat';
import { BASE_AIRCRAFT_CONFIG, type AircraftConfigurationDefinition } from '../utils/aircraftConfigurationSettings';
import { getAircraftSeatEligibleRoles, type AircraftCrewComposition } from '../utils/aircraftCrewComposition';
import {
    crewPositionValuesMatch,
    findCrewPositionEntry,
    getCrewPositionDisplayLabel,
    normaliseFixedCrewStaffRole,
    type CrewPositionTerminology,
} from '../utils/crewPositionTerminology';
import { isFixedCrewLikeOperationalModel } from '../utils/platformConfigService';
import {
    getQualificationsForOperationalModel,
    normaliseAssignedQualificationIds,
    normaliseQualificationToken,
    type StaffQualificationCatalogue,
} from '../utils/staffQualifications';
import {
    buildUnitEventCallsign,
    formatUnitCallsignNumber,
    getDefaultUnitCallsign,
    getUnitCallsignEntries,
    type UnitCallsignSettings,
} from '../utils/unitCallsigns';

// ── Trainee Scores Modal (Grade Progression Chart) ───────────────────────────

const parseJ = (raw: any, fallback: any) => {
  if (!raw) return fallback;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return fallback; } }
  return raw;
};

const parseProgressionFull = (raw: any): { grades: number[]; labels: string[] } => {
  const arr = parseJ(raw, []);
  if (!Array.isArray(arr)) return { grades: [], labels: [] };
  const filtered = arr
    .map((item: any, i: number) => {
      const grade = typeof item === 'number' ? item
        : (item && typeof item === 'object') ? (item.grade ?? item.score ?? item.avgGrade ?? 0) : 0;
      const label = (item && typeof item === 'object' && item.event) ? String(item.event) : `#${i + 1}`;
      return { grade, label };
    })
    .filter(x => x.grade > 0);
  return {
    grades: filtered.map(x => x.grade),
    labels: filtered.map(x => x.label),
  };
};

const safeN = (n: number | undefined | null): number => {
  if (n === undefined || n === null || isNaN(Number(n))) return 0;
  return Number(n);
};

const safe = (n: number | undefined | null, d = 2): string => {
  if (n === undefined || n === null || isNaN(Number(n))) return '\u2014';
  return Number(n).toFixed(d);
};

const formatFixedCrewDisplayGroup = (crew?: string | null): string => {
  const cleaned = String(crew || '').replace(/^CREW\s*/i, '').trim();
  if (!cleaned) return '';
  const parts = cleaned.split('::');
  if (parts.length < 2) return `CREW ${cleaned}`;
  const unit = parts[0].trim();
  const crewLabel = parts.slice(1).join('::').trim();
  return unit && crewLabel ? `CREW ${crewLabel}/${unit}` : `CREW ${cleaned}`;
};

const normaliseFixedCrewUnitCode = (value?: string | null): string => String(value || '').trim().toUpperCase();

const splitFixedCrewGroupKey = (value?: string | null): { unit: string; crew: string; key: string } => {
  const cleaned = String(value || '').replace(/^CREW\s*/i, '').trim();
  if (!cleaned) return { unit: '', crew: '', key: '' };
  const parts = cleaned.split('::');
  if (parts.length > 1) {
    const unit = normaliseFixedCrewUnitCode(parts[0]);
    const crew = parts.slice(1).join('::').replace(/^CREW\s*/i, '').trim().toUpperCase();
    return { unit, crew, key: unit && crew ? `${unit}::${crew}` : cleaned.toUpperCase() };
  }
  const displayMatch = cleaned.match(/^(.+?)\/([A-Z0-9_-]+)$/i);
  if (displayMatch) {
    const crew = displayMatch[1].replace(/^CREW\s*/i, '').trim().toUpperCase();
    const unit = normaliseFixedCrewUnitCode(displayMatch[2]);
    return { unit, crew, key: unit && crew ? `${unit}::${crew}` : cleaned.toUpperCase() };
  }
  const crew = cleaned.toUpperCase();
  return { unit: '', crew, key: crew };
};

const gradeColor = (v: number): string => {
  if (v >= 4.5) return 'text-emerald-400';
  if (v >= 3.5) return 'text-green-400';
  if (v >= 3.0) return 'text-yellow-400';
  if (v >= 2.5) return 'text-orange-400';
  return 'text-red-400';
};

const trendIcon = (dir: string): string => {
  if (dir === 'improving') return '\u2191';
  if (dir === 'worsening') return '\u2193';
  return '\u2192';
};

const trendColor = (dir: string): string => {
  if (dir === 'improving') return 'text-emerald-400';
  if (dir === 'worsening') return 'text-red-400';
  return 'text-gray-400';
};

interface TraineeGradeSparkLineProps {
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  color?: string;
  interactive?: boolean;
}

const TraineeGradeSparkLine: React.FC<TraineeGradeSparkLineProps> = ({
  data, labels, width = 100, height = 32, color = '#60a5fa', interactive = false
}) => {
  const [tooltip, setTooltip] = React.useState<{ i: number; pageX: number; pageY: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (!data || data.length < 2) return <span className="text-gray-600 text-xs">\u2014</span>;

  const YMIN = 0, YMAX = 5;
  const PAD_TOP = 8, PAD_BOT = 8;
  const usableH = height - PAD_TOP - PAD_BOT;

  const getX = (i: number) => (data.length === 1 ? width / 2 : (i / (data.length - 1)) * width);
  const getY = (v: number) => PAD_TOP + usableH * (1 - Math.max(0, Math.min(1, (v - YMIN) / (YMAX - YMIN))));

  const pts = data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
  const hoveredVal = tooltip !== null ? data[tooltip.i] : null;
  const gc = (v: number) => v >= 4.5 ? '#34d399' : v >= 3.5 ? '#4ade80' : v >= 3.0 ? '#facc15' : v >= 2.5 ? '#fb923c' : '#f87171';
  const gridLines = interactive ? [0, 1, 2, 3, 4, 5] : [];

  return (
    <div className="relative" style={{ display: 'inline-block', overflow: 'visible' }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-visible"
        style={{ cursor: interactive ? 'crosshair' : 'default', display: 'block' }}
      >
        {gridLines.map(v => {
          const y = getY(v);
          return (
            <line key={v} x1={0} y1={y} x2={width} y2={y}
              stroke="#374151" strokeWidth="0.5" strokeDasharray="3,3" />
          );
        })}
        <polyline points={pts} fill="none" stroke={color} strokeWidth={interactive ? 2 : 1.5} strokeLinejoin="round" />
        {interactive && (
          <polygon
            points={`0,${getY(data[0])} ${pts} ${getX(data.length - 1)},${height} 0,${height}`}
            fill={color} fillOpacity={0.07}
          />
        )}
        {data.map((v, i) => {
          const x = getX(i);
          const y = getY(v);
          const isHov = tooltip?.i === i;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={interactive ? (isHov ? 6 : 4) : 2} fill={color}
                stroke={isHov ? '#fff' : 'none'} strokeWidth={1.5} />
              {interactive && (
                <circle
                  cx={x} cy={y} r={14} fill="transparent"
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({ i, pageX: rect.left + x * (rect.width / width), pageY: rect.top + y * (rect.height / height) });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              )}
            </g>
          );
        })}
      </svg>
      {tooltip !== null && hoveredVal !== null && (
        <div
          className="fixed z-[9999] pointer-events-none px-2 py-1 rounded bg-gray-900 border border-gray-600 text-xs shadow-xl"
          style={{ left: tooltip.pageX + 12, top: tooltip.pageY - 32 }}
        >
          <span className="text-gray-400">{labels?.[tooltip.i] ?? `#${tooltip.i + 1}`}: </span>
          <span className="font-bold" style={{ color: gc(hoveredVal) }}>{hoveredVal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
};

interface TraineeScoresModalProps {
  trainee: { fullName: string; course?: string };
  onClose: () => void;
}

const TraineeScoresModal: React.FC<TraineeScoresModalProps> = ({ trainee, onClose }) => {
  const [loading, setLoading] = React.useState(true);
  const [tieData, setTieData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Strip course suffix from fullName (format: "Evans, Linda – ADF302" -> "Evans, Linda")
  const traineeNameOnly = trainee.fullName.split(/\s*[\u2013\u2014-]\s*/)[0].trim();

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let found: any = null;

        // Strategy 1: Use course-based endpoint (same as Build Intelligence) if course is known
        if (trainee.course) {
          try {
            const courseRes = await fetch(`/api/tie/trainees/${encodeURIComponent(trainee.course)}`);
            if (courseRes.ok) {
              const courseRows = await courseRes.json();
              if (Array.isArray(courseRows)) {
                // Match by traineeFullName - stored as "Edwards, Luna – ADF302"
                found = courseRows.find((r: any) => {
                  const namePart = (r.traineeFullName || '').split(/\s*[\u2013\u2014-]\s*/)[0].trim();
                  return namePart.toLowerCase() === traineeNameOnly.toLowerCase();
                }) || null;
              }
            }
          } catch (e) { /* fall through to strategy 2 */ }
        }

        // Strategy 2: Use single trainee endpoint with LIKE matching
        if (!found) {
          const encodedName = encodeURIComponent(traineeNameOnly);
          const res = await fetch(`/api/tie/trainee/${encodedName}`);
          if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows.length > 0) {
              found = rows[0];
            }
          }
        }

        // Parse gradeProgression if it's a string (JSONB might come back as string)
        if (found && typeof found.gradeProgression === 'string') {
          try { found.gradeProgression = JSON.parse(found.gradeProgression); } catch (e) {}
        }

        setTieData(found);
      } catch (e: any) {
        setError(e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [traineeNameOnly, trainee.course]);

  const progression = tieData ? parseProgressionFull(tieData.gradeProgression) : { grades: [], labels: [] };
  const { grades, labels } = progression;
  const trend = tieData?.overallTrend || 'stable';
  const color = trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#60a5fa';
  const avgVal = grades.length > 0 ? grades.reduce((s: number, v: number) => s + v, 0) / grades.length : 0;
  const minVal = grades.length > 0 ? Math.min(...grades) : 0;
  const maxVal = grades.length > 0 ? Math.max(...grades) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-600 rounded-xl p-6 shadow-2xl w-full mx-4"
        style={{ maxWidth: '860px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold text-lg">{traineeNameOnly} &mdash; Grade Progression</h3>
            {tieData && (
              <p className="text-gray-400 text-sm mt-0.5">
                {grades.length} assessments &middot; Course: {tieData.courseName || 'N/A'} &middot; hover over a point to see details
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none ml-4 flex-shrink-0">&times;</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="text-gray-400 text-sm">Loading grade progression data...</div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-16">
            <div className="text-red-400 text-sm">Error loading data: {error}</div>
          </div>
        )}

        {!loading && !error && !tieData && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-gray-400 text-sm">No TIE analytics data found for {traineeNameOnly}</div>
            <div className="text-gray-600 text-xs">Run Build Intelligence analytics to generate grade progression data</div>
          </div>
        )}

        {!loading && tieData && grades.length < 2 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-gray-400 text-sm">Insufficient grade data to display progression chart</div>
            <div className="text-gray-600 text-xs">At least 2 assessments are required</div>
          </div>
        )}

        {!loading && tieData && grades.length >= 2 && (
          <>
            <div className="bg-gray-800 rounded-xl p-5">
              <div className="flex gap-3">
                <div className="flex flex-col justify-between text-xs text-gray-500 py-1 flex-shrink-0 text-right" style={{ width: 28, height: 220 }}>
                  <span>5</span><span>4</span><span>3</span><span>2</span><span>1</span><span>0</span>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <TraineeGradeSparkLine
                    data={grades}
                    labels={labels}
                    width={Math.max(760, grades.length * 48)}
                    height={220}
                    color={color}
                    interactive={true}
                  />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2 ml-9 px-1">
                <span>Assessment 1</span>
                <span>Assessment {grades.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mt-4">
              {([
                { label: 'Minimum', value: minVal },
                { label: 'Average', value: avgVal },
                { label: 'Maximum', value: maxVal },
              ] as Array<{label: string; value: number}>).map((s) => (
                <div key={s.label} className="bg-gray-800 rounded-lg px-4 py-3 text-center border border-gray-700">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{s.label}</p>
                  <p className={`text-xl font-bold font-mono ${gradeColor(s.value)}`}>{s.value.toFixed(2)}</p>
                </div>
              ))}
              <div className="bg-gray-800 rounded-lg px-4 py-3 text-center border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Trend</p>
                <p className={`text-base font-bold ${trendColor(trend)}`}>{trendIcon(trend)} {trend || 'stable'}</p>
              </div>
            </div>

            {tieData.narrativeSummary && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Analytics Summary</p>
                <p className="text-gray-300 text-sm">{tieData.narrativeSummary}</p>
              </div>
            )}
          </>
        )}

        <p className="text-gray-600 text-xs mt-3 text-center">Click outside or &times; to close</p>
      </div>
    </div>
  );
};

interface EventDetailModalProps {
  event: ScheduleEvent;
  onClose: () => void;
  onSave: (events: ScheduleEvent[]) => void;
  onDeleteRequest: () => void;
  isEditingDefault?: boolean;
  instructors: string[];
  trainees: string[];
  syllabus: string[];
  syllabusDetails: SyllabusItemDetail[];
  highlightedField?: 'startTime' | 'instructor' | 'student' | null;
  onScoresCreated?: (scores: any[]) => void; // New callback for creating scores
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
  instructorsData: Instructor[];
  courseColors: { [key: string]: string };
  onNavigateToHateSheet: (trainee: Trainee) => void;
  onNavigateToSyllabus: (flightNumber: string) => void;
  onOpenPt051: (trainee: Trainee) => void;
  onOpenTrainingReport?: (staff: Instructor, event: ScheduleEvent) => void;
  onOpenAuth: (event: ScheduleEvent) => void;
  onOpenPostFlight: (event: ScheduleEvent) => void;
  isConflict: boolean;
  onNeoClick: (event: ScheduleEvent) => void;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  oracleContextForModal?: {
      availableInstructors: string[];
      availableTraineesAnalysis: OracleTraineeAnalysis[];
  } | null;
  sctRequests?: SctRequest[];
  sctEvents?: string[];
     eventsForDate?: ScheduleEvent[];
  // New props for deployment functionality
  publishedSchedules?: Record<string, ScheduleEvent[]>;
  nextDayBuildEvents?: ScheduleEvent[];
  activeView?: string;
  isAddingTile?: boolean;
    formationCallsigns?: FormationCallsign[];
    currentLocation?: string;
    onVisualAdjustStart?: (event: ScheduleEvent) => void;
    onVisualAdjustEnd?: (event: ScheduleEvent) => void;
    onSavePT051Assessment?: (assessment: any) => void;
    cancellationCodes?: CancellationCode[];
    onCancelEvent?: (eventId: string, cancellationCode: string, manualCodeEntry?: string) => void;
    onRestoreEvent?: (eventId: string) => void;
    onSendAlert?: (eventId: string, recipients: string[], description: string) => Promise<boolean> | boolean;
    canSendAlert?: boolean;
    alertData?: any | null;
    baselineEvent?: any | null;
  onClearAlert?: (eventId: string) => void;
    onEditFixedCrewTile?: () => void;
    resourceDisplayNames?: ResourceDisplayNames;
    aircraftNumberSettings?: AircraftNumberSettings;
    aircraftConfigurationDefinitions?: AircraftConfigurationDefinition[];
    aircraftCrewComposition?: AircraftCrewComposition;
    crewPositionTerminology?: CrewPositionTerminology;
    operationalModel?: string;
    activeUnitCode?: string;
    staffQualificationCatalogue?: StaffQualificationCatalogue;
    unitCallsignSettings?: UnitCallsignSettings;
    personnelDisplaySettings?: PersonnelDisplaySettings;
    isReadOnly?: boolean;
}

interface CrewMember {
    flightType: 'Dual' | 'Solo';
    instructor: string;
    student: string;
    pilot: string;
    group: string;
    groupTraineeIds: number[]; // Added to track selected IDs
}

const getEventTypeFromSyllabus = (syllabusId: string, syllabusDetails: SyllabusItemDetail[]): 'flight' | 'ftd' | 'ground' => {
    const detail = syllabusDetails.find(d => d.id === syllabusId);
    if (!detail) { // Fallback for items not in syllabus like 'SCT FORM' or if data is missing
        if (syllabusId.includes('FTD')) return 'ftd';
        if (syllabusId.includes('CPT') || syllabusId.includes('MB') || syllabusId.includes('TUT') || syllabusId.includes('QUIZ')) return 'ground';
        return 'flight';
    }
    if (detail.type === 'FTD') return 'ftd';
    if (detail.type === 'Ground School') return 'ground';
    return 'flight';
};


const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatUnavailabilityDate = (dateValue?: string | null): string => {
    if (!dateValue) return '-';
    const parsedDate = new Date(`${dateValue}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    return parsedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
    });
};

const formatUnavailabilityClock = (rawTime?: string | number | null, fallbackTime?: number): string => {
    if (typeof rawTime === 'number') return formatTime(rawTime);
    if (typeof rawTime === 'string' && rawTime.trim()) {
        if (rawTime.includes(':')) return rawTime;
        const cleaned = rawTime.replace(/\D/g, '').padStart(4, '0').slice(-4);
        return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
    }
    if (typeof fallbackTime === 'number') return formatTime(fallbackTime);
    return '-';
};

const getAllDayUnavailabilityEndDate = (dateValue?: string | null): string | undefined => {
    if (!dateValue) return undefined;
    const parsedDate = new Date(`${dateValue}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime())) return dateValue;
    parsedDate.setUTCDate(parsedDate.getUTCDate() - 1);
    return parsedDate.toISOString().slice(0, 10);
};

const normalizeStartTimeValue = (time: number | string | undefined): string => {
    if (typeof time === 'number') return formatTime(time);
    if (!time) return '00:00';
    if (time.includes(':')) return time;
    const cleaned = time.replace(/\D/g, '').padStart(4, '0').slice(-4);
    return `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
};

const convertTimeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours + (minutes / 60);
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose, onSave, onDeleteRequest, isEditingDefault = false, instructors, trainees, syllabus, syllabusDetails, highlightedField, school, traineesData, instructorsData, courseColors, onNavigateToHateSheet, onNavigateToSyllabus, onOpenPt051, onOpenTrainingReport, onOpenAuth, onOpenPostFlight, isConflict, onNeoClick, traineeLMPs, oracleContextForModal, sctRequests = [], sctEvents = [], eventsForDate = [], onScoresCreated, publishedSchedules = {}, nextDayBuildEvents = [], activeView = '', isAddingTile = false, formationCallsigns = [], currentLocation = '', onVisualAdjustStart, onVisualAdjustEnd, onSavePT051Assessment, cancellationCodes = [], onCancelEvent, onRestoreEvent, onSendAlert, canSendAlert = false, alertData = null, baselineEvent = null, onClearAlert, onEditFixedCrewTile, resourceDisplayNames = DEFAULT_RESOURCE_DISPLAY_NAMES, aircraftNumberSettings = DEFAULT_AIRCRAFT_NUMBER_SETTINGS, aircraftConfigurationDefinitions = [], aircraftCrewComposition, crewPositionTerminology, operationalModel, activeUnitCode = '', staffQualificationCatalogue, unitCallsignSettings, personnelDisplaySettings, isReadOnly = false }) => {
    
    console.log('EventDetailModal opened - isAddingTile:', isAddingTile);
    console.log('Event data:', {
        eventCategory: event.eventCategory,
        flightType: event.flightType,
        instructor: event.instructor,
        student: event.student,
        pilot: event.pilot,
        isSct: event.isSct
    });

    const { isFrozen, allowedActions: freezeAllowedActions } = useSystemFreeze();
    const [isEditing, setIsEditing] = useState(isReadOnly ? false : isEditingDefault);
    const [localHighlight, setLocalHighlight] = useState(highlightedField);
    const [showDeleteChoice, setShowDeleteChoice] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showRemovePin, setShowRemovePin] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showMassBriefComplete, setShowMassBriefComplete] = useState(false);
    const [showMassBriefConfirmation, setShowMassBriefConfirmation] = useState(false);
    const [completedTrainees, setCompletedTrainees] = useState<Trainee[]>([]);

    // Event Category State (New)
    const [eventCategory, setEventCategory] = useState<'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di'>(event.eventCategory || 'lmp_event');

    const [flightNumber, setFlightNumber] = useState(event.flightNumber);
    const [duration, setDuration] = useState<number | ''>(event.duration);
    const [eventType, setEventType] = useState(event.type);
    const [startTime, setStartTime] = useState(normalizeStartTimeValue(event.startTime));
    const [area, setArea] = useState(event.area || 'A');
    const initialAircraftNumber = parseAircraftNumber(event.aircraftNumber || '001', aircraftNumberSettings);
    const [aircraftNumber, setAircraftNumber] = useState(initialAircraftNumber.number || '001');
    const [aircraftNumberPrefix, setAircraftNumberPrefix] = useState(initialAircraftNumber.prefix || aircraftNumberSettings.defaultPrefix);
    const [aircraftConfigId, setAircraftConfigId] = useState(event.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id);
    const [crewRequirement, setCrewRequirement] = useState(event.crewRequirement || { mode: 'aircraft_default' as const });
    const [aircraftCount, setAircraftCount] = useState(1);
    const aircraftConfigOptions = useMemo(() => {
        const definitions = aircraftConfigurationDefinitions.length > 0
            ? aircraftConfigurationDefinitions
            : [BASE_AIRCRAFT_CONFIG];
        return definitions.some(definition => definition.id === BASE_AIRCRAFT_CONFIG.id)
            ? definitions
            : [BASE_AIRCRAFT_CONFIG, ...definitions];
    }, [aircraftConfigurationDefinitions]);
    const [isVisualAdjustMode, setIsVisualAdjustMode] = useState(false);
    const [visualAdjustStartTime, setVisualAdjustStartTime] = useState(event.startTime);
    const [visualAdjustEndTime, setVisualAdjustEndTime] = useState(event.startTime + event.duration);
    
    // Sync visual adjust times when event changes (from parent drag updates)
    useEffect(() => {
        if (isVisualAdjustMode) {
            setVisualAdjustStartTime(event.startTime);
            setVisualAdjustEndTime(event.startTime + event.duration);
        }
    }, [event.startTime, event.duration, isVisualAdjustMode]);

    useEffect(() => {
        if (!aircraftNumberSettings.prefixes.includes(aircraftNumberPrefix)) {
            setAircraftNumberPrefix(aircraftNumberSettings.defaultPrefix);
        }
    }, [aircraftNumberPrefix, aircraftNumberSettings]);
    const [crew, setCrew] = useState<CrewMember[]>([{
        flightType: event.flightType,
        instructor: event.instructor || '',
        student: event.student || '',
        pilot: event.pilot || '',
        group: event.group || '',
        groupTraineeIds: event.groupTraineeIds || [],
    }]);
    
    console.log('Initial crew state:', crew);

    // Helper function to get Dual/Solo status from Individual LMP
    // Helper function to get Dual/Solo status from Individual LMP
    const getDualSoloFromIndividualLMP = (flightNumber: string, traineeName: string): 'Dual' | 'Solo' => {
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Called with flightNumber: ${flightNumber}, traineeName: ${traineeName}`);
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] traineeLMPs available: ${!!traineeLMPs}, traineeLMPs size: ${traineeLMPs?.size || 0}`);
        
        if (!traineeLMPs || !traineeName) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - missing traineeLMPs or traineeName`);
            return 'Dual'; // Default to Dual if no data available
        }

        const individualLMP = traineeLMPs.get(traineeName);
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] individualLMP found for ${traineeName}:`, !!individualLMP, individualLMP ? individualLMP.length : 0, 'items');
        
        if (!individualLMP) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - no Individual LMP found for ${traineeName}`);
            return 'Dual'; // Default to Dual if no Individual LMP found
        }

        const syllabusItem = individualLMP.find(item => 
            item.id === flightNumber || item.code === flightNumber
        );
        
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Searching for flightNumber: ${flightNumber}, found item:`, !!syllabusItem);
        if (syllabusItem) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Found syllabus item:`, {
                id: syllabusItem.id,
                code: syllabusItem.code,
                sortieType: syllabusItem.sortieType
            });
        }

        if (syllabusItem && syllabusItem.sortieType) {
            console.log(`ud83cudfaf [Dual/Solo] Found ${syllabusItem.sortieType} for ${traineeName} - ${flightNumber}`);
            return syllabusItem.sortieType;
        }

        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - no sortieType found for ${flightNumber}`);
        return 'Dual'; // Default to Dual if not specified
    };

    // Apply Solo logic (trainee as PIC, clear crew) when flightType changes to Solo
    const applySoloLogic = () => {
        // Check the first crew member's flightType
        if (crew[0]?.flightType === 'Solo') {
            // For Solo events, set trainee as PIC
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            if (traineeName) {
                // Update the first crew member: set trainee as pilot and clear instructor
                setCrew(prevCrew => {
                    const newCrew = [...prevCrew];
                    if (newCrew.length > 0) {
                        newCrew[0] = { 
                            ...newCrew[0], 
                            pilot: traineeName, 
                            instructor: '' // Clear instructor for solo flights
                        };
                    }
                    return newCrew;
                });
                console.log(`✈️ [Solo Logic] Applied: ${traineeName} as PIC, flightType set to Solo`);
            }
        }
    };

    const [locationType, setLocationType] = useState(event.locationType || 'Local');
    const [origin, setOrigin] = useState(event.origin || school);
    const [destination, setDestination] = useState(event.destination || school);
    const [formationType, setFormationType] = useState(event.formationType || '');
    const [callsign, setCallsign] = useState(event.callsign || '');
    const [unitCallsignBase, setUnitCallsignBase] = useState('');
    const [unitCallsignNumber, setUnitCallsignNumber] = useState(0);
    const [notes, setNotes] = useState(event.notes || '');
    const [fixedCrewGroup, setFixedCrewGroup] = useState(event.fixedCrewGroup || '');
    const [fixedCrewPic, setFixedCrewPic] = useState(event.fixedCrewPic || '');
    const [fixedCrewManifestStatus, setFixedCrewManifestStatus] = useState<ScheduleEvent['fixedCrewManifestStatus']>(event.fixedCrewManifestStatus || 'pending');
    const [fixedCrewManifestNotes, setFixedCrewManifestNotes] = useState(event.fixedCrewManifestNotes || '');
    const [isDeploy, setIsDeploy] = useState(event.isDeploy || false);
    
    // Deployment Selection State
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string>('');
    
    // Deployment Period State (Explicit)
    const [deploymentStartDate, setDeploymentStartDate] = useState(event.deploymentStartDate || event.date);
    const [deploymentStartTime, setDeploymentStartTime] = useState(event.deploymentStartTime || '');
    const [deploymentEndDate, setDeploymentEndDate] = useState(event.deploymentEndDate || event.date);
    const [deploymentEndTime, setDeploymentEndTime] = useState(event.deploymentEndTime || '');
    const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(event.deploymentAircraftCount || 1);
    
    // Group Selection State
    const [activeGroupInput, setActiveGroupInput] = useState<number | null>(null);
    const groupInputRef = useRef<HTMLDivElement>(null);
    
    // Oracle state
    const [syllabusSelectionError, setSyllabusSelectionError] = useState(false);
    const [showTraineeScoresModal, setShowTraineeScoresModal] = useState(false);
    const [showAlertPanel, setShowAlertPanel] = useState(false);
    const [alertRecipients, setAlertRecipients] = useState<string[]>([]);
    const [alertSent, setAlertSent] = useState(false);
    const [alertDescription, setAlertDescription] = useState('');
    const [alertUserNote, setAlertUserNote] = useState('');
    const [activeCrewConflictName, setActiveCrewConflictName] = useState<string | null>(null);
    const isOracleContext = !!oracleContextForModal;
    const instructorList = oracleContextForModal?.availableInstructors || instructors;
    const isFixedCrewModel = isFixedCrewLikeOperationalModel(operationalModel);
    const normalisedEventType = String(eventType || '').trim().toLowerCase();
    const isFixedCrewCrewedEvent = isFixedCrewModel && (normalisedEventType === 'flight' || normalisedEventType === 'ftd');
    const activeUnitNormalised = String(activeUnitCode || '').trim().toUpperCase();
    const activeUnitMemberCodes = useMemo(() => activeUnitNormalised
        .split('+')
        .map(unit => normaliseFixedCrewUnitCode(unit))
        .filter(Boolean), [activeUnitNormalised]);
    const staffMatchesActiveFixedCrewUnit = (staff: Instructor, crewKey?: string | null): boolean => {
        const staffUnit = normaliseFixedCrewUnitCode(staff.unit);
        const crewUnit = splitFixedCrewGroupKey(crewKey).unit;
        if (crewUnit) return staffUnit === crewUnit;
        if (activeUnitMemberCodes.length === 0) return true;
        return activeUnitMemberCodes.includes(staffUnit);
    };
    const fixedCrewAircraftRoleOptions = useMemo(() => {
        const roles = new Set<string>();
        (aircraftCrewComposition?.seats || []).forEach(seat => {
            getAircraftSeatEligibleRoles(seat).forEach(role => {
                const trimmed = String(role || '').trim();
                if (trimmed) roles.add(trimmed);
            });
        });
        return Array.from(roles);
    }, [aircraftCrewComposition]);
    const resolveFixedCrewAircraftRole = (role?: string | null): string => {
        const rawRole = String(role || '').trim();
        if (!rawRole) return '';
        return fixedCrewAircraftRoleOptions.find(option => crewPositionValuesMatch(option, rawRole, crewPositionTerminology)) || '';
    };
    const resolveFixedCrewStaffAircraftRole = (staff?: Partial<Instructor> | null): string => {
        const rawRole = String(staff?.role || '').trim();
        const normalisedRole = normaliseFixedCrewStaffRole(rawRole, staff?.unit || activeUnitCode);
        return resolveFixedCrewAircraftRole(normalisedRole) || resolveFixedCrewAircraftRole(rawRole);
    };
    const getFixedCrewStaffRoleLabel = (staff?: Partial<Instructor> | null): string => {
        const aircraftRole = resolveFixedCrewStaffAircraftRole(staff);
        const rawRole = normaliseFixedCrewStaffRole(staff?.role, staff?.unit || activeUnitCode);
        if (!aircraftRole) return rawRole.toUpperCase() === 'AWO' ? 'AWO' : 'Unconfigured role';
        return getCrewPositionDisplayLabel(aircraftRole, crewPositionTerminology, aircraftRole);
    };
    const normaliseFixedCrewStaffRoleKey = (staff?: Partial<Instructor> | null): string => {
        const aircraftRole = resolveFixedCrewStaffAircraftRole(staff);
        const rawRole = normaliseFixedCrewStaffRole(staff?.role, staff?.unit || activeUnitCode);
        const entry = findCrewPositionEntry(aircraftRole || rawRole, crewPositionTerminology);
        return String(entry?.genericName || aircraftRole || rawRole || '').trim().toUpperCase();
    };
    const fixedCrewStaffRolesMatch = (left?: Partial<Instructor> | null, right?: Partial<Instructor> | null): boolean => {
        const leftAircraftRole = resolveFixedCrewStaffAircraftRole(left);
        const rightAircraftRole = resolveFixedCrewStaffAircraftRole(right);
        if (leftAircraftRole && rightAircraftRole) return leftAircraftRole === rightAircraftRole;
        const leftKey = normaliseFixedCrewStaffRoleKey(left);
        const rightKey = normaliseFixedCrewStaffRoleKey(right);
        if (leftKey && rightKey && leftKey === rightKey) return true;
        const leftLabel = getFixedCrewStaffRoleLabel(left).trim().toUpperCase();
        const rightLabel = getFixedCrewStaffRoleLabel(right).trim().toUpperCase();
        return Boolean(leftLabel && rightLabel && leftLabel !== 'UNCONFIGURED ROLE' && leftLabel === rightLabel);
    };
    const fixedCrewGroups = useMemo(() => Array.from(new Set(instructorsData
        .filter(staff => staffMatchesActiveFixedCrewUnit(staff))
        .map(staff => {
            const staffCrew = String(staff.crew || '').trim();
            const staffUnit = normaliseFixedCrewUnitCode(staff.unit);
            return staffCrew && activeUnitMemberCodes.length > 1 && staffUnit ? `${staffUnit}::${staffCrew}` : staffCrew;
        })
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [activeUnitMemberCodes, instructorsData]);
    const fixedCrewMembers = useMemo(() => fixedCrewGroup
        ? instructorsData
            .filter(staff => staffMatchesActiveFixedCrewUnit(staff, fixedCrewGroup))
            .filter(staff => String(staff.crew || '').trim().toUpperCase() === splitFixedCrewGroupKey(fixedCrewGroup).crew)
            .filter(staff => !staff.isAdminStaff)
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }))
        : [], [activeUnitMemberCodes, fixedCrewGroup, instructorsData]);
    const fixedCrewPicQualification = useMemo(() => getQualificationsForOperationalModel(staffQualificationCatalogue, 'fixed_crew')
        .find(qualification => (
            normaliseQualificationToken(qualification.id) === 'pic'
            || normaliseQualificationToken(qualification.code) === 'pic'
            || normaliseQualificationToken(qualification.name) === 'pic'
        )), [staffQualificationCatalogue]);
    const fixedCrewPicCandidates = useMemo(() => fixedCrewPicQualification
        ? fixedCrewMembers.filter(staff => normaliseAssignedQualificationIds(staff.preferences?.qualifications || [], staffQualificationCatalogue, false).includes(fixedCrewPicQualification.id))
        : [], [fixedCrewMembers, fixedCrewPicQualification, staffQualificationCatalogue]);
    const getEventSyllabusDetail = (targetEvent: Partial<ScheduleEvent>): SyllabusItemDetail | undefined => (
        syllabusDetails.find(item => item.id === targetEvent.flightNumber || item.code === targetEvent.flightNumber)
    );
    const getEventBookingWindow = (targetEvent: Partial<ScheduleEvent>): { start: number; end: number; preFlight: number; postFlight: number } => {
        const detail = getEventSyllabusDetail(targetEvent);
        const preFlight = Number((targetEvent as any).preFlightTime ?? detail?.preFlightTime ?? 0) || 0;
        const postFlight = Number((targetEvent as any).postFlightTime ?? detail?.postFlightTime ?? 0) || 0;
        const startTimeValue = Number(targetEvent.startTime ?? 0) || 0;
        const durationValue = Number(targetEvent.duration ?? detail?.duration ?? 0) || 0;
        return {
            start: startTimeValue - preFlight,
            end: startTimeValue + durationValue + postFlight,
            preFlight,
            postFlight,
        };
    };
    const normaliseTimeFieldToHour = (value?: string | number | null, fallback = 0): number => {
        if (value === undefined || value === null || value === '') return fallback;
        if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
        const text = String(value).trim();
        if (!text) return fallback;
        if (text.includes(':')) {
            const [hours, minutes = '0'] = text.split(':');
            const hourNumber = Number(hours);
            const minuteNumber = Number(minutes);
            return Number.isFinite(hourNumber) && Number.isFinite(minuteNumber)
                ? hourNumber + (minuteNumber / 60)
                : fallback;
        }
        const rawNumber = Number(text);
        if (!Number.isFinite(rawNumber)) return fallback;
        if (rawNumber > 24) {
            const hours = Math.floor(rawNumber / 100);
            const minutes = rawNumber % 100;
            return hours + (minutes / 60);
        }
        return rawNumber;
    };
    const getPersonnelForConflictCheck = (targetEvent: Partial<ScheduleEvent>): string[] => Array.from(new Set([
        targetEvent.instructor,
        targetEvent.student,
        targetEvent.pilot,
        targetEvent.group,
        ...((targetEvent.attendees || []) as string[]),
    ].map(value => String(value || '').trim()).filter(Boolean)));
    const rosteredFixedCrewMembers = useMemo(() => {
        if (!isFixedCrewCrewedEvent) return [] as Instructor[];
        const eventCrewKey = fixedCrewGroup || event.fixedCrewGroup || '';
        const eventRosterNames = new Set(String(event.fixedCrewPic || event.pilot || event.instructor || '')
            ? [String(event.fixedCrewPic || event.pilot || event.instructor || '').trim()]
            : []);
        (event.attendees || []).forEach(name => {
            const cleaned = String(name || '').trim();
            if (cleaned) eventRosterNames.add(cleaned);
        });
        const crewParts = splitFixedCrewGroupKey(eventCrewKey);
        const rosterFromAttendees = Array.from(eventRosterNames)
            .map(name => {
                const candidates = instructorsData.filter(staff => staff.name === name);
                return candidates.find(staff => (
                    staffMatchesActiveFixedCrewUnit(staff, eventCrewKey)
                    && (!crewParts.crew || String(staff.crew || '').trim().toUpperCase() === crewParts.crew)
                ))
                    || candidates.find(staff => staffMatchesActiveFixedCrewUnit(staff, eventCrewKey))
                    || candidates[0];
            })
            .filter(Boolean) as Instructor[];
        if (rosterFromAttendees.length > 0) {
            return rosterFromAttendees.sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'));
        }
        if (!eventCrewKey) return [] as Instructor[];
        return instructorsData
            .filter(staff => staffMatchesActiveFixedCrewUnit(staff, eventCrewKey))
            .filter(staff => String(staff.crew || '').trim().toUpperCase() === crewParts.crew)
            .filter(staff => !staff.isAdminStaff)
            .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'));
    }, [event, fixedCrewGroup, instructorsData, isFixedCrewCrewedEvent, activeUnitMemberCodes, personnelDisplaySettings]);
    const staffHasAvailabilityConflict = (staff: Instructor, bookingWindow: { start: number; end: number }, eventDate?: string): boolean => {
        if (!eventDate) return false;
        return (staff.unavailability || []).some(period => {
            const periodStartDate = String(period.startDate || '');
            const periodEndDate = String(period.endDate || period.startDate || '');
            if (eventDate < periodStartDate || eventDate > periodEndDate) return false;
            if (period.allDay) return true;
            const unavailableStart = periodStartDate === eventDate
                ? normaliseTimeFieldToHour(period.startTime, 0)
                : 0;
            const unavailableEnd = periodEndDate === eventDate
                ? normaliseTimeFieldToHour(period.endTime, 24)
                : 24;
            return unavailableStart < bookingWindow.end && bookingWindow.start < unavailableEnd;
        });
    };
    const staffHasEventConflict = (staff: Instructor, bookingWindow: { start: number; end: number }): boolean => (
        (eventsForDate || [])
            .filter(otherEvent => otherEvent.id !== event.id)
            .filter(otherEvent => getPersonnelForConflictCheck(otherEvent).includes(staff.name))
            .some(otherEvent => {
                const otherWindow = getEventBookingWindow(otherEvent);
                return otherWindow.start < bookingWindow.end && bookingWindow.start < otherWindow.end;
            })
    );
    const getAvailableFixedCrewRoleAlternatives = (
        staff: Instructor,
        bookingWindow: { start: number; end: number },
        eventDate?: string,
    ): Instructor[] => {
        const eventCrewKey = fixedCrewGroup || event.fixedCrewGroup || '';
        const crewUnit = splitFixedCrewGroupKey(eventCrewKey).unit || normaliseFixedCrewUnitCode(staff.unit);
        const role = String(staff.role || '').trim();
        if (!crewUnit || !role) return [];
        const assignedToCurrentEvent = new Set([
            ...getPersonnelForConflictCheck(event),
            ...rosteredFixedCrewMembers.map(member => member.name),
        ].map(name => String(name || '').trim()).filter(Boolean));
        return instructorsData
            .filter(candidate => candidate.name !== staff.name)
            .filter(candidate => !assignedToCurrentEvent.has(candidate.name))
            .filter(candidate => !candidate.isAdminStaff)
            .filter(candidate => normaliseFixedCrewUnitCode(candidate.unit) === crewUnit)
            .filter(candidate => fixedCrewStaffRolesMatch(candidate, staff))
            .filter(candidate => !staffHasAvailabilityConflict(candidate, bookingWindow, eventDate))
            .filter(candidate => !staffHasEventConflict(candidate, bookingWindow))
            .sort((a, b) => comparePeopleByConfiguredRank(a, b, personnelDisplaySettings, 'staff'));
    };
    const getFixedCrewSubstituteRejectReasons = (
        staff: Instructor,
        bookingWindow: { start: number; end: number },
        eventDate?: string,
    ): Array<{ candidate: Instructor; reasons: string[] }> => {
        const eventCrewKey = fixedCrewGroup || event.fixedCrewGroup || '';
        const crewUnit = splitFixedCrewGroupKey(eventCrewKey).unit || normaliseFixedCrewUnitCode(staff.unit);
        if (!crewUnit) return [];
        const assignedToCurrentEvent = new Set([
            ...getPersonnelForConflictCheck(event),
            ...rosteredFixedCrewMembers.map(member => member.name),
        ].map(name => String(name || '').trim()).filter(Boolean));

        return instructorsData
            .filter(candidate => candidate.name !== staff.name)
            .filter(candidate => !candidate.isAdminStaff)
            .map(candidate => {
                const reasons: string[] = [];
                if (normaliseFixedCrewUnitCode(candidate.unit) !== crewUnit) reasons.push('different unit');
                if (!fixedCrewStaffRolesMatch(candidate, staff)) reasons.push(`role is ${getFixedCrewStaffRoleLabel(candidate) || 'unconfigured'}`);
                if (assignedToCurrentEvent.has(candidate.name)) reasons.push('already assigned to this event');
                if (staffHasAvailabilityConflict(candidate, bookingWindow, eventDate)) reasons.push('unavailable during this event window');
                if (staffHasEventConflict(candidate, bookingWindow)) reasons.push('already assigned to another event in this event window');
                return { candidate, reasons };
            })
            .filter(entry => normaliseFixedCrewUnitCode(entry.candidate.unit) === crewUnit)
            .filter(entry => fixedCrewStaffRolesMatch(entry.candidate, staff) || getFixedCrewStaffRoleLabel(entry.candidate) === getFixedCrewStaffRoleLabel(staff))
            .filter(entry => entry.reasons.length > 0)
            .sort((a, b) => comparePeopleByConfiguredRank(a.candidate, b.candidate, personnelDisplaySettings, 'staff'))
            .slice(0, 8);
    };
    const fixedCrewRosterStatus = useMemo(() => {
        const bookingWindow = getEventBookingWindow(event);
        const eventDate = event.date;
        return rosteredFixedCrewMembers.map(staff => {
            const unavailabilityConflicts = (staff.unavailability || [])
                .filter(period => {
                    if (!eventDate) return false;
                    const periodStartDate = String(period.startDate || '');
                    const periodEndDate = String(period.endDate || period.startDate || '');
                    if (eventDate < periodStartDate || eventDate > periodEndDate) return false;
                    if (period.allDay) return true;
                    const unavailableStart = periodStartDate === eventDate
                        ? normaliseTimeFieldToHour(period.startTime, 0)
                        : 0;
                    const unavailableEnd = periodEndDate === eventDate
                        ? normaliseTimeFieldToHour(period.endTime, 24)
                        : 24;
                    return unavailableStart < bookingWindow.end && bookingWindow.start < unavailableEnd;
                })
                .map(period => ({
                    type: 'unavailability' as const,
                    label: period.allDay
                        ? `${[staff.rank, staff.name].filter(Boolean).join(' ')} is unavailable all day${period.reason ? ` because ${period.reason}` : ''}.`
                        : `${[staff.rank, staff.name].filter(Boolean).join(' ')} is unavailable from ${formatTime(normaliseTimeFieldToHour(period.startTime, 0))} to ${formatTime(normaliseTimeFieldToHour(period.endTime, 24))}${period.reason ? ` because ${period.reason}` : ''}.`,
                }));
            const eventConflicts = (eventsForDate || [])
                .filter(otherEvent => otherEvent.id !== event.id)
                .filter(otherEvent => getPersonnelForConflictCheck(otherEvent).includes(staff.name))
                .filter(otherEvent => {
                    const otherWindow = getEventBookingWindow(otherEvent);
                    return otherWindow.start < bookingWindow.end && bookingWindow.start < otherWindow.end;
                })
                .map(otherEvent => ({
                    type: 'event' as const,
                    label: `${[staff.rank, staff.name].filter(Boolean).join(' ')} is already assigned to ${otherEvent.flightNumber || 'another event'} from ${formatTime(otherEvent.startTime)} to ${formatTime((otherEvent.startTime || 0) + (otherEvent.duration || 0))}.`,
                }));
            const conflicts = [...unavailabilityConflicts, ...eventConflicts];
            return {
                staff,
                conflicts,
                isClear: conflicts.length === 0,
                alternatives: getAvailableFixedCrewRoleAlternatives(staff, bookingWindow, eventDate),
                alternativeRejects: getFixedCrewSubstituteRejectReasons(staff, bookingWindow, eventDate),
            };
        });
    }, [event, eventsForDate, rosteredFixedCrewMembers, syllabusDetails]);
    const fixedCrewRosterByRole = useMemo(() => {
        const picName = String(fixedCrewPic || event.fixedCrewPic || event.pilot || '').trim();
        const roleRank = (role?: string) => String(role || '').trim().toLowerCase() === 'pilot' ? 0 : 1;
        return fixedCrewRosterStatus
            .slice()
            .sort((a, b) => {
                const aPic = a.staff.name === picName ? 0 : 1;
                const bPic = b.staff.name === picName ? 0 : 1;
                if (aPic !== bPic) return aPic - bPic;
                const roleDiff = roleRank(getFixedCrewStaffRoleLabel(a.staff)) - roleRank(getFixedCrewStaffRoleLabel(b.staff));
                if (roleDiff !== 0) return roleDiff;
                return comparePeopleByConfiguredRank(a.staff, b.staff, personnelDisplaySettings, 'staff');
            })
            .reduce<Array<{ role: string; members: typeof fixedCrewRosterStatus }>>((groups, status) => {
                const role = getFixedCrewStaffRoleLabel(status.staff);
                const existing = groups.find(group => group.role === role);
                if (existing) existing.members.push(status);
                else groups.push({ role, members: [status] });
                return groups;
            }, [])
            .sort((a, b) => {
                const aRank = String(a.role || '').trim().toLowerCase() === 'pilot' ? 0 : 1;
                const bRank = String(b.role || '').trim().toLowerCase() === 'pilot' ? 0 : 1;
                if (aRank !== bRank) return aRank - bRank;
                const seniorityComparison = comparePeopleByConfiguredRank(a.members[0]?.staff, b.members[0]?.staff, personnelDisplaySettings, 'staff');
                if (seniorityComparison !== 0) return seniorityComparison;
                return a.role.localeCompare(b.role);
            });
    }, [event.fixedCrewPic, event.pilot, fixedCrewPic, fixedCrewRosterStatus, personnelDisplaySettings]);
    const activeCrewConflict = useMemo(() => (
        fixedCrewRosterStatus.find(status => status.staff.name === activeCrewConflictName && !status.isClear) || null
    ), [activeCrewConflictName, fixedCrewRosterStatus]);
    const handleFixedCrewSubstituteSelect = async (unavailableStaff: Instructor, substitute: Instructor) => {
        if (isReadOnly) {
            await showDarkAlert('Past DFPs are locked. Crew substitutions cannot be amended.', 'Past DFP Locked', 'warning');
            return;
        }
        const _freezeRaw = localStorage.getItem('systemFreezeState');
        if (_freezeRaw) {
            const _freeze = JSON.parse(_freezeRaw);
            if (_freeze.isFrozen) {
                await showDarkAlert('System is currently frozen. No modifications are allowed during a system freeze.', 'System Frozen', 'error');
                return;
            }
        }
        const bookingWindow = getEventBookingWindow(event);
        const unavailableUnit = normaliseFixedCrewUnitCode(unavailableStaff.unit);
        const substituteUnit = normaliseFixedCrewUnitCode(substitute.unit);
        const reasons: string[] = [];
        if (!substituteUnit || substituteUnit !== unavailableUnit) {
            reasons.push(`${[substitute.rank, substitute.name].filter(Boolean).join(' ')} is not from the same unit as ${unavailableStaff.name}.`);
        }
        if (!fixedCrewStaffRolesMatch(substitute, unavailableStaff)) {
            reasons.push(`${[substitute.rank, substitute.name].filter(Boolean).join(' ')} is not assigned to the same role as ${unavailableStaff.name}.`);
        }
        if (staffHasAvailabilityConflict(substitute, bookingWindow, event.date)) {
            reasons.push(`${[substitute.rank, substitute.name].filter(Boolean).join(' ')} is unavailable during the event booking window, including pre-flight and post-flight.`);
        }
        if (staffHasEventConflict(substitute, bookingWindow)) {
            reasons.push(`${[substitute.rank, substitute.name].filter(Boolean).join(' ')} is already assigned to another event during the event booking window, including pre-flight and post-flight.`);
        }
        if (getPersonnelForConflictCheck(event).includes(substitute.name)) {
            reasons.push(`${[substitute.rank, substitute.name].filter(Boolean).join(' ')} is already assigned to this event.`);
        }
        if (reasons.length > 0) {
            await showDarkAlert(`${reasons.join('\n')}\n\nPlease select another substitute.`, 'Substitution Not Available', 'warning');
            return;
        }

        const originalPic = String(event.fixedCrewPic || event.pilot || event.instructor || '').trim();
        const substituteDisplayName = substitute.name;
        const updatedAttendees = Array.from(new Set([
            ...(event.attendees || []),
            ...rosteredFixedCrewMembers.map(staff => staff.name),
        ].map(name => String(name || '').trim()).filter(Boolean)))
            .map(name => name === unavailableStaff.name ? substituteDisplayName : name);
        const nextPic = originalPic === unavailableStaff.name ? substituteDisplayName : originalPic;
        const existingNotes = String(event.fixedCrewManifestNotes || fixedCrewManifestNotes || '').trim();
        const swapNote = `${formatTime(event.startTime)}: ${[unavailableStaff.rank, unavailableStaff.name].filter(Boolean).join(' ')} replaced by ${[substitute.rank, substitute.name].filter(Boolean).join(' ')}.`;
        const updatedEvent: ScheduleEvent = {
            ...event,
            attendees: updatedAttendees,
            fixedCrewPic: nextPic || event.fixedCrewPic,
            pilot: nextPic || event.pilot,
            instructor: nextPic || event.instructor,
            fixedCrewManifestStatus: 'swapped',
            fixedCrewManifestNotes: existingNotes ? `${existingNotes}\n${swapNote}` : swapNote,
        };
        setFixedCrewPic(nextPic);
        setFixedCrewManifestStatus('swapped');
        setFixedCrewManifestNotes(updatedEvent.fixedCrewManifestNotes || '');
        setActiveCrewConflictName(null);
        onSave([updatedEvent]);
    };
    const renderFixedCrewRosterStatus = () => {
        if (!isFixedCrewCrewedEvent) return null;
        const bookingWindow = getEventBookingWindow(event);
        return (
            <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="rounded bg-emerald-500/15 px-2 py-1 text-sm font-bold text-emerald-200">
                        {formatFixedCrewDisplayGroup(fixedCrewGroup || event.fixedCrewGroup || '') || 'Crew not assigned'}
                    </strong>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Availability window {formatTime(Math.max(0, bookingWindow.start))}-{formatTime(Math.min(24, bookingWindow.end))}
                    </span>
                </div>
                {fixedCrewRosterByRole.length > 0 ? (
                    <div className={`grid gap-3 ${activeCrewConflict ? 'grid-cols-[minmax(0,1fr)_12rem]' : 'grid-cols-1'}`}>
                        <div className="space-y-2">
                            {fixedCrewRosterByRole.map(group => (
                                <div key={group.role}>
                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{group.role}</div>
                                    <div className="space-y-1">
                                        {group.members.map(({ staff, isClear }) => {
                                            const isPic = staff.name === String(fixedCrewPic || event.fixedCrewPic || event.pilot || '').trim();
                                            const isSelected = activeCrewConflictName === staff.name && !isClear;
                                            return (
                                                <div key={staff.id || staff.name} className="flex items-baseline gap-2 text-left">
                                                    <button
                                                        type="button"
                                                        disabled={isClear}
                                                        onClick={() => setActiveCrewConflictName(isSelected ? null : staff.name)}
                                                        className={`min-w-0 truncate text-xs font-semibold ${isClear ? 'cursor-default text-emerald-300' : isSelected ? 'cursor-pointer text-red-200 underline decoration-red-200/70 underline-offset-2' : 'cursor-pointer text-red-300 underline decoration-red-300/40 underline-offset-2'}`}
                                                    >
                                                        {[staff.rank, staff.name].filter(Boolean).join(' ')}
                                                    </button>
                                                    <span className="shrink-0 text-[11px] text-gray-400">{getFixedCrewStaffRoleLabel(staff)}{isPic ? ' / PIC' : ''}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {activeCrewConflict && (
                            <div className="rounded-lg border border-red-400/40 bg-gray-950/80 p-3 text-left">
                                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-red-300">Unavailability</div>
                                <div className="text-sm font-semibold text-red-100">
                                    {[activeCrewConflict.staff.rank, activeCrewConflict.staff.name].filter(Boolean).join(' ')}
                                </div>
                                <div className="mt-2 space-y-1">
                                    {activeCrewConflict.conflicts.map((conflict, index) => (
                                        <p key={`${activeCrewConflict.staff.name}-conflict-detail-${index}`} className="text-xs leading-snug text-red-100">
                                            {conflict.label}
                                        </p>
                                    ))}
                                </div>
                                <div className="mt-3 border-t border-gray-800 pt-2">
                                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                                        Available same-unit {getFixedCrewStaffRoleLabel(activeCrewConflict.staff)}
                                    </div>
                                    {activeCrewConflict.alternatives.length > 0 ? (
                                        <div className="space-y-0.5">
                                            {activeCrewConflict.alternatives.slice(0, 10).map(candidate => (
                                                <button
                                                    key={candidate.id || candidate.name}
                                                    type="button"
                                                    onClick={() => handleFixedCrewSubstituteSelect(activeCrewConflict.staff, candidate)}
                                                    className="block w-full truncate rounded px-1 py-0.5 text-left text-xs text-emerald-100 hover:bg-emerald-500/15 hover:text-emerald-50"
                                                    title={[candidate.rank, candidate.name].filter(Boolean).join(' ')}
                                                >
                                                    {[candidate.rank, candidate.name].filter(Boolean).join(' ')}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="text-xs text-gray-400">No same-unit crew with this role are available for the full event window.</div>
                                            {activeCrewConflict.alternativeRejects?.length > 0 && (
                                                <div className="space-y-1 border-t border-gray-800 pt-2">
                                                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Checked same-unit {getFixedCrewStaffRoleLabel(activeCrewConflict.staff)}</div>
                                                    {activeCrewConflict.alternativeRejects.map(({ candidate, reasons }) => (
                                                        <div key={candidate.id || candidate.name} className="text-[11px] leading-tight text-gray-300">
                                                            <span className="font-semibold text-gray-200">{[candidate.rank, candidate.name].filter(Boolean).join(' ')}</span>
                                                            <span className="text-gray-500"> - {reasons.join('; ')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 italic">No crew roster is assigned to this event.</div>
                )}
            </div>
        );
    };
    const formatFixedCrewAssignmentStatus = (status?: ScheduleEvent['fixedCrewManifestStatus']): string => {
        switch (status) {
            case 'complete':
                return 'Complete';
            case 'partial':
                return 'Partial';
            case 'swapped':
                return 'Swapped';
            case 'invalid':
                return 'Invalid';
            case 'pending':
            default:
                return 'Pending';
        }
    };
    const traineeList = oracleContextForModal ? oracleContextForModal.availableTraineesAnalysis.map(t => t.trainee.fullName) : trainees;
    const [dynamicSyllabusOptions, setDynamicSyllabusOptions] = useState<string[]>(isOracleContext ? [] : syllabus);

    const selectedTraineeNameForLmp = crew[0]?.student || crew[0]?.pilot || event.student || event.pilot || '';
    const selectedIndividualLmp = useMemo(() => {
        if (!traineeLMPs || !selectedTraineeNameForLmp) return null;
        return traineeLMPs.get(selectedTraineeNameForLmp) || null;
    }, [selectedTraineeNameForLmp, traineeLMPs]);

    const getSyllabusItemForOption = (option: string): SyllabusItemDetail | undefined => (
        selectedIndividualLmp?.find(item => item.id === option || item.code === option)
        || syllabusDetails.find(item => item.id === option || item.code === option)
    );

    const formatSyllabusOptionLabel = (option: string): string => {
        if (option === 'SCT FORM') return option;
        const item = getSyllabusItemForOption(option);
        if (!item) return option;
        const code = item.code || item.id || option;
        return item.eventDescription ? `${code} - ${item.eventDescription}` : code;
    };

    // Filtered syllabus options based on event category
    const filteredSyllabusOptions = useMemo(() => {
        let options: string[] = [];
        
        if (eventCategory === 'sct') {
            options = sctEvents;
        } else if (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency') {
            const lmpSource = selectedIndividualLmp?.length
                ? selectedIndividualLmp
                : syllabusDetails.filter(item => item.lmpType === 'Master LMP' || !item.lmpType);
            options = lmpSource.map(item => item.id || item.code).filter(Boolean);
        } else if (eventCategory === 'staff_cat') {
            // Filter for Staff CAT LMP events only
            options = syllabusDetails
                .filter(item => item.lmpType === 'Staff CAT')
                .map(item => item.id);
        } else if (eventCategory === 'twr_di') {
            // TWR DI can use any syllabus items (no filtering)
            options = syllabusDetails.map(item => item.id);
        } else {
            options = dynamicSyllabusOptions;
        }
        
        // Always ensure SCT FORM is available when adding a tile
        if (isAddingTile && !options.includes('SCT FORM')) {
            options = [...options, 'SCT FORM'];
        }

        if (flightNumber && !options.includes(flightNumber)) {
            options = [flightNumber, ...options];
        }
        
        
        
        return options;
    }, [eventCategory, sctEvents, syllabusDetails, dynamicSyllabusOptions, isAddingTile, selectedIndividualLmp, flightNumber]);

    const fixedCrewEventOptions = useMemo(() => {
        if (!isFixedCrewModel) return [] as SyllabusItemDetail[];
        return syllabusDetails
            .filter(item => {
                const itemType = String(item.type || '').trim().toLowerCase();
                return itemType === 'flight' || itemType === 'ftd' || itemType === 'sim' || itemType === 'simulator';
            })
            .sort((a, b) => {
                const groupA = String((a as any).module || a.phase || (Array.isArray(a.courses) ? a.courses[0] : '') || '').toUpperCase();
                const groupB = String((b as any).module || b.phase || (Array.isArray(b.courses) ? b.courses[0] : '') || '').toUpperCase();
                if (groupA !== groupB) return groupA.localeCompare(groupB, undefined, { numeric: true });
                return String(a.code || a.id || '').localeCompare(String(b.code || b.id || ''), undefined, { numeric: true });
            });
    }, [isFixedCrewModel, syllabusDetails]);

    const fixedCrewGroupedEventOptions = useMemo(() => {
        const grouped = new Map<string, SyllabusItemDetail[]>();
        fixedCrewEventOptions.forEach(item => {
            const itemType = String(item.lmpType || '').trim().toLowerCase() === 'staff cat' ? 'Package' : 'Course';
            const itemGroup = String((item as any).module || item.phase || (Array.isArray(item.courses) ? item.courses[0] : '') || 'Unassigned').trim();
            const label = `${itemType}: ${itemGroup}`;
            grouped.set(label, [...(grouped.get(label) || []), item]);
        });
        return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    }, [fixedCrewEventOptions]);

    // Get staff-only instructors (exclude trainees) grouped by unit
    const staffInstructorsByUnit = useMemo(() => {
        const traineeNames = new Set(traineesData.map(t => t.fullName));
        
        // Filter out trainees to get staff only
        const staffOnly = instructorList.filter(name => !traineeNames.has(name));
        
        // Get instructor details to access unit and rank
        const staffWithDetails = staffOnly.map(name => {
            const instructor = instructorsData.find(i => i.name === name);
            return {
                name,
                unit: instructor?.unit || 'Unknown',
                rank: instructor?.rank || 'FLGOFF',
                instructor
            };
        });
        
        // Group by unit
        const grouped = staffWithDetails.reduce((acc, instructor) => {
            if (!acc[instructor.unit]) {
                acc[instructor.unit] = [];
            }
            acc[instructor.unit].push(instructor);
            return acc;
        }, {} as Record<string, typeof staffWithDetails>);
        
        Object.keys(grouped).forEach(unit => {
            grouped[unit].sort((a, b) =>
                comparePeopleByConfiguredRank(a.instructor || a, b.instructor || b, personnelDisplaySettings, 'staff')
            );
        });

        // Sort units by the senior displayed member in each group, then unit name.
        const sortedUnits = Object.keys(grouped).sort((a, b) => {
            const firstA = grouped[a][0];
            const firstB = grouped[b][0];
            if (firstA && firstB) {
                const rankComparison = comparePeopleByConfiguredRank(
                    firstA.instructor || firstA,
                    firstB.instructor || firstB,
                    personnelDisplaySettings,
                    'staff'
                );
                if (rankComparison !== 0) return rankComparison;
            }
            return a.localeCompare(b);
        });
        
        return { grouped, sortedUnits };
    }, [instructorList, traineesData, instructorsData, personnelDisplaySettings]);

    // Group trainees by course for dropdown
    const traineesByCourse = useMemo(() => {
        // Get trainee details with course information
        const traineesWithCourse = traineeList.map(name => {
            const trainee = traineesData.find(t => t.name === name || t.fullName === name);
            return {
                name,
                course: trainee?.course || 'Unknown'
            };
        });
        
        // Group by course
        const grouped = traineesWithCourse.reduce((acc, trainee) => {
            if (!acc[trainee.course]) {
                acc[trainee.course] = [];
            }
            acc[trainee.course].push(trainee);
            return acc;
        }, {} as Record<string, typeof traineesWithCourse>);
        
        // Sort courses alphabetically
        const sortedCourses = Object.keys(grouped).sort();
        
        return { grouped, sortedCourses };
    }, [traineeList, traineesData]);

    // Calculate event statistics for each person
    interface PersonStats {
        name: string;
        rank: string;
        flightCount: number;
        ftdCount: number;
        cptCount: number;
        groundCount: number;
        startTime: string; // HHMM format
    }

    const personStats = useMemo(() => {
        const stats: Record<string, PersonStats> = {};
        
        // Initialize stats for all instructors and trainees
        [...instructorList, ...traineeList].forEach(name => {
            const instructor = instructorsData.find(i => i.name === name);
            const trainee = traineesData.find(t => t.name === name || t.fullName === name);
            
            stats[name] = {
                name,
                rank: instructor?.rank || trainee?.rank || '',
                flightCount: 0,
                ftdCount: 0,
                cptCount: 0,
                groundCount: 0,
                startTime: ''
            };
        });
        
        // Calculate statistics from events
        eventsForDate.forEach(evt => {
            // Skip STBY and deployment events
            if (evt.resourceId?.startsWith('STBY') || evt.resourceId?.startsWith('BNF-STBY') || evt.type === 'deployment') {
                return;
            }
            
            const people = new Set<string>();
            
            // Add instructor
            if (evt.instructor) people.add(evt.instructor);
            
            // Add student/trainee
            if (evt.student) people.add(evt.student);
            
            // Add group trainees
            if (evt.groupTraineeIds && evt.groupTraineeIds.length > 0) {
                evt.groupTraineeIds.forEach(id => {
                    const trainee = traineesData.find(t => t.idNumber === id);
                    if (trainee) people.add(trainee.name);
                });
            }
            
            // Update counts for each person involved
            people.forEach(person => {
                if (stats[person]) {
                    // Count by event type
                    if (evt.type === 'flight') stats[person].flightCount++;
                    else if (evt.type === 'ftd') stats[person].ftdCount++;
                    else if (evt.type === 'cpt') stats[person].cptCount++;
                    else if (evt.type === 'ground') stats[person].groundCount++;
                    
                    // Calculate start time (event start - pre-flight time)
                    const syllabusItem = syllabusDetails.find(s => s.id === evt.flightNumber);
                    const preFlightHours = syllabusItem?.preFlightTime || 0;
                    const eventStartTime = evt.startTime - preFlightHours;
                    
                    // Update earliest start time
                    if (!stats[person].startTime || eventStartTime < parseFloat(stats[person].startTime.replace(':', '.'))) {
                        const hours = Math.floor(eventStartTime);
                        const minutes = Math.round((eventStartTime % 1) * 60);
                        stats[person].startTime = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
                    }
                }
            });
        });
        
        return stats;
    }, [eventsForDate, instructorList, traineeList, instructorsData, traineesData, syllabusDetails]);

// Helper to render staff instructor dropdown with unit grouping and statistics
    const renderStaffInstructorDropdown = (value: string, onChange: (value: string) => void, label: string = 'Instructor', disabled: boolean = false, includePax: boolean = false) => {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-400">{label}</label>
                <select 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed appearance-none cursor-pointer z-10 "
                >
                    <option value="" disabled>Select {label.toLowerCase()}</option>
                    {staffInstructorsByUnit.sortedUnits.map(unit => (
                        <optgroup key={unit} label={`─── ${unit} ───`}>
                            {staffInstructorsByUnit.grouped[unit].map(instructor => {
                                const stats = personStats[instructor.name] || { rank: '' };
                                   const displayText = `${stats.rank} ${instructor.name}`;
                                return (
                                    <option key={instructor.name} value={instructor.name}>
                                        {displayText}
                                    </option>
                                );
                            })}
                        </optgroup>
                    ))}
                    {includePax && (
                        <optgroup label="─── Other ───">
                            <option value="PAX">PAX</option>
                        </optgroup>
                    )}
                </select>
            </div>
        );
    };
// Helper to render trainee dropdown with course grouping and statistics
    const renderTraineeDropdown = (value: string, onChange: (value: string) => void, disabled: boolean = false, highlight: boolean = false) => {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-400">Trainee</label>
                <select 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200 disabled:bg-gray-700/50 disabled:cursor-not-allowed ${highlight ? 'ring-2 ring-red-500' : ''}`}
                    
                >
                    <option value="" disabled>Select a trainee</option>
                    {traineesByCourse.sortedCourses.map(course => (
                        <optgroup key={course} label={`─── ${course} ───`}>
                            {traineesByCourse.grouped[course].map(trainee => {
                                   // Get trainee details to access just the name without course
                                   const traineeData = traineesData.find(t => t.name === trainee.name || t.fullName === trainee.name);
                                   const stats = personStats[trainee.name] || { rank: '' };
                                   const displayText = `${stats.rank} ${traineeData?.name || trainee.name}`;
                                return (
                                    <option key={trainee.name} value={trainee.name}>
                                        {displayText}
                                    </option>
                                );
                            })}
                        </optgroup>
                    ))}
                </select>
            </div>
        );
    };    const formatDecimalHourToString = (decimalHour: number): string => {
        const hours = Math.floor(decimalHour);
        const minutes = Math.round((decimalHour % 1) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    // Auto-set Dual/Solo from Individual LMP when adding new events
    useEffect(() => {
        if (isAddingTile && flightNumber && crew[0]) {
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            if (traineeName && traineeLMPs) {
                const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                // Only update if the flightType is different to avoid infinite loop
                if (crew[0].flightType !== individualLMPFlightType) {
                    setCrew(prevCrew => {
                        const newCrew = [...prevCrew];
                        if (newCrew.length > 0) {
                            newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                        }
                        return newCrew;
                    });
                    console.log(`🎯 [Auto Dual/Solo] Set to ${individualLMPFlightType} from Individual LMP for ${traineeName}`);
                }
            }
        }
    }, [isAddingTile, flightNumber, traineeLMPs]);

    // Auto-set Dual/Solo from Individual LMP when creating new events (not just tiles)
    useEffect(() => {
        if (crew[0]?.flightType === 'Solo') {
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            // Only apply if pilot is not already set correctly
            if (traineeName && crew[0].pilot !== traineeName) {
                applySoloLogic();
            }
        }
    }, [crew[0]?.flightType, crew[0]?.student, crew[0]?.pilot]);

    // Effect to set default values based on event category
    useEffect(() => {
        if (eventCategory === 'sct') {
            // SCT defaults to Solo
            setCrew(prev => prev.map(c => ({ ...c, flightType: 'Solo' })));
            // Set default duration to 1.2
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency') {
            // Set default duration to 1.2 for LMP events
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'staff_cat') {
            // Set default duration to 1.2 for Staff CAT
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'twr_di') {
            // TWR DI defaults to Solo
            setCrew(prev => prev.map(c => ({ ...c, flightType: 'Solo' })));
            // Set default duration to 1.2 for TWR DI
            if (!duration) setDuration(1.2);
            // Set default start time to 0800 only for new events
            if (isAddingTile || !event.startTime || event.startTime === 0) {
                setStartTime('08:00');
            }
        }
    }, [eventCategory]);

    // Effect to pull Type (Dual/Solo) from syllabus when flight number changes
    // IMPORTANT: SCT is explicitly excluded because SCT events default to Solo and should not be overridden by syllabus
    useEffect(() => {
        if (flightNumber && (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency' || eventCategory === 'staff_cat' || eventCategory === 'twr_di') && eventCategory !== 'sct') {
            const syllabusItem = getSyllabusItemForOption(flightNumber);
            if (syllabusItem && syllabusItem.flightType) {
                setCrew(prev => prev.map(c => ({ ...c, flightType: syllabusItem.flightType as 'Dual' | 'Solo' })));
            }
        }
    }, [flightNumber, eventCategory, syllabusDetails, selectedIndividualLmp]);

    // Effect to set Dual/Solo from Individual LMP when flight number changes (before pilot selection)
    useEffect(() => {
        if (isAddingTile || (isEditingDefault && (!event.id || event.id.startsWith('2d1b6a22')))) {
            // This is a new event or tile (check for generated IDs that start with our prefix)
            console.log(`\ud83d\udcdd [Flight Number Change] isAddingTile: ${isAddingTile}, isEditingDefault: ${isEditingDefault}, event.id: ${event.id}, flightNumber: ${flightNumber}`);
            
            if (flightNumber && crew[0] && traineeLMPs) {
                const traineeName = crew[0]?.student || crew[0]?.pilot;
                
                if (traineeName) {
                    // If pilot is selected, use their Individual LMP
                    console.log(`\ud83d\udcdd [Flight Number Change] Using selected trainee: ${traineeName}`);
                    const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                    
                    if (crew[0].flightType !== individualLMPFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Auto Dual/Solo] Set to ${individualLMPFlightType} from Individual LMP for selected trainee ${traineeName}`);
                    }
                } else {
                    // No pilot selected yet - find first trainee with this LMP and use their Individual LMP as default
                    console.log(`\ud83d\udcdd [Flight Number Change] No pilot selected - searching for default from any trainee with LMP ${flightNumber}`);
                    
                    let defaultFlightType: 'Dual' | 'Solo' = 'Dual'; // Default to Dual if nothing found
                    let foundTrainee = '';
                    
                    // Search through all trainees to find someone who has this LMP in their Individual LMP
                    for (const [traineeName, individualLMP] of traineeLMPs.entries()) {
                        const syllabusItem = individualLMP.find(item => 
                            item.id === flightNumber || item.code === flightNumber
                        );
                        
                        if (syllabusItem && syllabusItem.sortieType) {
                            defaultFlightType = syllabusItem.sortieType;
                            foundTrainee = traineeName;
                            console.log(`\ud83d\udcdd [Flight Number Change] Found default ${defaultFlightType} from ${foundTrainee}'s Individual LMP`);
                            break; // Use the first one found
                        }
                    }
                    
                    if (crew[0].flightType !== defaultFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: defaultFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Auto Dual/Solo] Set to ${defaultFlightType} as default from ${foundTrainee || 'system'} for LMP ${flightNumber}`);
                    }
                }
            }
        }
    }, [flightNumber, traineeLMPs, isAddingTile, isEditingDefault, event.id]);

    // Effect to update Dual/Solo from Individual LMP when trainee changes (after initial flight number selection)
    useEffect(() => {
        if (isAddingTile || (isEditingDefault && (!event.id || event.id.startsWith('2d1b6a22')))) {
            if (flightNumber && crew[0] && traineeLMPs) {
                const traineeName = crew[0]?.student || crew[0]?.pilot;
                
                if (traineeName) {
                    // Update when specific trainee is selected (may override the default)
                    const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                    
                    if (crew[0].flightType !== individualLMPFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Trainee Change] Updated to ${individualLMPFlightType} from Individual LMP for selected trainee ${traineeName}`);
                    }
                }
            }
        }
    }, [crew[0]?.student, crew[0]?.pilot, flightNumber, traineeLMPs, isAddingTile, isEditingDefault, event.id]);

    // Filter formation callsigns by current location
    const filteredCallsigns = useMemo(() => {
        if (formationCallsigns && formationCallsigns.length > 0 && currentLocation) {
            const filtered = formationCallsigns.filter(cs => cs.location === currentLocation);
            return filtered.length > 0 ? filtered : null;
        }
        return null;
    }, [formationCallsigns, currentLocation]);

    // Backwards compatible formationTypes (just codes)
    const formationTypes = useMemo(() => {
        if (filteredCallsigns) {
            return filteredCallsigns.map(cs => cs.code);
        }
        return school === 'ESL' ? ['MERL', 'VANG'] : ['COBR', 'HAWK'];
    }, [filteredCallsigns, school]);
    const unitCallsignEntries = useMemo(
        () => getUnitCallsignEntries(unitCallsignSettings, activeUnitCode || school),
        [activeUnitCode, school, unitCallsignSettings],
    );
    const defaultUnitCallsign = useMemo(
        () => getDefaultUnitCallsign(unitCallsignSettings, activeUnitCode || school),
        [activeUnitCode, school, unitCallsignSettings],
    );
    const callsignNumberOptions = useMemo(
        () => Array.from({ length: 101 }, (_, value) => ({ value, label: formatUnitCallsignNumber(value) })),
        [],
    );
    const selectedPicForCallsign = fixedCrewPic || crew[0]?.pilot || crew[0]?.instructor || event.pilot || event.instructor || '';
    const selectedPicHasIndividualCallsign = useMemo(() => {
        const instructor = instructorsData.find(staff => staff.name === selectedPicForCallsign);
        if (instructor && String(instructor.callsign || '').trim()) return true;
        const trainee = traineesData.find(traineeRecord => (traineeRecord.fullName || traineeRecord.name) === selectedPicForCallsign);
        return Boolean(trainee && String(trainee.traineeCallsign || '').trim());
    }, [instructorsData, selectedPicForCallsign, traineesData]);
    const areas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    const courses = useMemo(() => Object.keys(courseColors).sort(), [courseColors]);
    
    // Group trainees data by course for the flyout
    const coursesStruct = useMemo(() => {
        return courses.map(courseName => ({
            name: courseName,
            trainees: traineesData.filter(t => t.course === courseName).sort((a,b) => a.name.localeCompare(b.name))
        }));
    }, [courses, traineesData]);

    const isUnavailabilityDetailsEvent = event.type === 'unavailability' || event.eventType === 'UNAVAILABILITY' || event.flightNumber === 'UNAVAIL';

    const unavailabilityDetails = useMemo(() => {
        const unavailabilityEvent = event as ScheduleEvent & {
            unavailabilityStartDate?: string;
            unavailabilityEndDate?: string;
            unavailabilityStartTime?: string;
            unavailabilityEndTime?: string;
            reason?: string;
            notes?: string;
            resourceName?: string;
            allDay?: boolean;
        };
        const personName = event.instructor || event.student || event.pilot || unavailabilityEvent.resourceName || '';
        const staffRecord = instructorsData.find((staff: any) => staff.name === personName || staff.fullName === personName);
        const traineeRecord = traineesData.find((trainee: any) => trainee.fullName === personName || trainee.name === personName);
        const rawEndDate = unavailabilityEvent.unavailabilityEndDate || event.date;
        const displayEndDate = unavailabilityEvent.allDay ? getAllDayUnavailabilityEndDate(rawEndDate) : rawEndDate;
        const role = staffRecord
            ? ((staffRecord as any).role || (staffRecord as any).instructorCategory || (staffRecord as any).category || '-')
            : ((traineeRecord as any)?.role || (traineeRecord as any)?.category || (traineeRecord as any)?.course || 'Trainee');

        return {
            rank: (staffRecord as any)?.rank || (traineeRecord as any)?.rank || '-',
            name: personName || '-',
            role,
            startDate: formatUnavailabilityDate(unavailabilityEvent.unavailabilityStartDate || event.date),
            startTime: formatUnavailabilityClock(unavailabilityEvent.unavailabilityStartTime, event.startTime),
            endDate: formatUnavailabilityDate(displayEndDate || event.date),
            endTime: formatUnavailabilityClock(unavailabilityEvent.unavailabilityEndTime, event.startTime + event.duration),
            reason: unavailabilityEvent.reason || unavailabilityEvent.notes || 'Unavailability',
        };
    }, [event, instructorsData, traineesData]);

    const modalTitle = useMemo(() => {
        if (isUnavailabilityDetailsEvent) return 'Unavailability Details';
        if (eventType === 'flight') return 'Flight Details';
        if (eventType === 'ftd') return `${resourceDisplayNames.ftd} Session Details`;
        return 'Ground Event Details';
    }, [eventType, isUnavailabilityDetailsEvent, resourceDisplayNames.ftd]);

    useEffect(() => {
        setFlightNumber(event.flightNumber);
        
        // Initialize duration as empty if creating a new event (and no pre-filled flight number), otherwise use event's duration
        if (isEditingDefault && !event.flightNumber) {
            setDuration('');
        } else {
            setDuration(event.duration);
        }

        setEventType(event.type);
        setStartTime(normalizeStartTimeValue(event.startTime));
        setArea(event.area || 'A');
        const parsedAircraftNumber = parseAircraftNumber(event.aircraftNumber || '001', aircraftNumberSettings);
        setAircraftNumber(parsedAircraftNumber.number || '001');
        setAircraftNumberPrefix(parsedAircraftNumber.prefix || aircraftNumberSettings.defaultPrefix);
        setAircraftConfigId(event.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id);
        setCrewRequirement(event.crewRequirement || { mode: 'aircraft_default' });
        setAircraftCount(1);
        setCrew([{ 
            flightType: event.flightType, 
            instructor: event.instructor || '', 
            student: event.student || '', 
            pilot: event.pilot || '',
            group: event.group || '',
            groupTraineeIds: event.groupTraineeIds || []
        }]);
        setIsEditing(isReadOnly ? false : isEditingDefault);
        setLocalHighlight(highlightedField);
        setLocationType(event.locationType || 'Local');
        setOrigin(event.origin || school);
        setDestination(event.destination || school);
        setFormationType(event.formationType || formationTypes[0]);
        setCallsign(event.callsign || '');
        setUnitCallsignBase(defaultUnitCallsign);
        setUnitCallsignNumber(0);
        setNotes(event.notes || '');
        setFixedCrewGroup(event.fixedCrewGroup || '');
        setFixedCrewPic(event.fixedCrewPic || '');
        setFixedCrewManifestStatus(event.fixedCrewManifestStatus || 'pending');
        setFixedCrewManifestNotes(event.fixedCrewManifestNotes || '');
        setIsDeploy(event.isDeploy || false);
        
        setDeploymentStartDate(event.deploymentStartDate || event.date);
        setDeploymentStartTime(event.deploymentStartTime || '');
        // Default end date/time logic handled in effect below or initialized here if event exists
        setDeploymentEndDate(event.deploymentEndDate || event.date); 
        setDeploymentEndTime(event.deploymentEndTime || '');

    }, [event, isEditingDefault, highlightedField, school, isReadOnly, defaultUnitCallsign, formationTypes]);

    useEffect(() => {
        if (selectedPicHasIndividualCallsign || unitCallsignEntries.length === 0 || !defaultUnitCallsign) return;
        const base = unitCallsignBase || defaultUnitCallsign;
        setCallsign(buildUnitEventCallsign(base, unitCallsignNumber));
    }, [defaultUnitCallsign, selectedPicHasIndividualCallsign, unitCallsignBase, unitCallsignEntries.length, unitCallsignNumber]);
    
    useEffect(() => {
        if (locationType === 'Local') {
            setOrigin(school);
            setDestination(school);
        }
    }, [locationType, school]);

    useEffect(() => {
        const isFormation = flightNumber === 'SCT FORM';
        const newSize = isFormation ? aircraftCount : 1;
        if (crew.length !== newSize) {
             const newCrew = Array.from({ length: newSize }, (_, i) => {
                // For SCT FORM with SCT category, default to Solo
                const defaultFlightType = (isFormation && eventCategory === 'sct') ? 'Solo' : 'Dual';
                return crew[i] || { flightType: defaultFlightType as 'Dual' | 'Solo', instructor: '', student: '', pilot: '', group: '', groupTraineeIds: [] };
            });
            setCrew(newCrew);
        }
    }, [aircraftCount, flightNumber, crew, eventCategory]);

    useEffect(() => {
      setEventType(getEventTypeFromSyllabus(flightNumber, syllabusDetails));
    }, [flightNumber, syllabusDetails]);

    // Helper function to get current deployments
    const getCurrentDeployments = (): ScheduleEvent[] => {
        const deployments: ScheduleEvent[] = [];
        const targetDate = event.date;

        const parseClock = (clock?: string): number | null => {
            if (!clock) return null;
            const match = clock.match(/^(\d{1,2}):?(\d{2})$/);
            if (!match) return null;
            return Number(match[1]) + Number(match[2]) / 60;
        };

        const dateTimeMs = (dateStr: string, hours: number): number =>
            new Date(`${dateStr}T00:00:00Z`).getTime() + hours * 60 * 60 * 1000;

        const deploymentOverlapsTargetDate = (deployment: ScheduleEvent): boolean => {
            if (!targetDate || deployment.isCancelled) return false;

            const dayStart = new Date(`${targetDate}T00:00:00Z`).getTime();
            const dayEnd = dayStart + 24 * 60 * 60 * 1000;
            const deploymentStartDate = deployment.deploymentStartDate || deployment.date;
            const deploymentStartTime = parseClock(deployment.deploymentStartTime) ?? deployment.startTime ?? 0;
            const deploymentStart = dateTimeMs(deploymentStartDate, deploymentStartTime);

            let deploymentEnd: number;
            if (deployment.deploymentEndDate && deployment.deploymentEndTime) {
                deploymentEnd = dateTimeMs(
                    deployment.deploymentEndDate,
                    parseClock(deployment.deploymentEndTime) ?? ((deployment.startTime || 0) + (deployment.duration || 0))
                );
            } else {
                deploymentEnd = deploymentStart + (deployment.duration || 0) * 60 * 60 * 1000;
            }

            return deploymentStart < dayEnd && deploymentEnd > dayStart;
        };
        
        // Get deployments from published schedules for Program Schedule view
        if (['Program Schedule', 'DailyFlyingProgram', 'InstructorSchedule', 'TraineeSchedule'].includes(activeView)) {
            const relevantSchedules = targetDate
                ? Object.values(publishedSchedules)
                : [];
            relevantSchedules.forEach(scheduleEvents => {
                const todayDeployments = scheduleEvents.filter(e =>
                    e.type === 'deployment' &&
                    deploymentOverlapsTargetDate(e)
                );
                deployments.push(...todayDeployments);
            });
        } 
        // Get deployments from next day build for Next Day Build view
        else if (['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView)) {
            const buildDeployments = nextDayBuildEvents.filter(e =>
                e.type === 'deployment' &&
                !e.isCancelled &&
                deploymentOverlapsTargetDate({ ...e, date: e.date || targetDate } as ScheduleEvent)
            );
            deployments.push(...buildDeployments);
        }
        
        // Filter deployments to show only those that could accommodate this event type
        const compatibleDeployments = deployments.filter(deployment => {
            if (eventType === 'flight') {
                return deployment.resourceId?.startsWith('PC-21') || deployment.resourceId?.startsWith('Deployed');
            } else if (eventType === 'ftd') {
                return deployment.resourceId?.startsWith('FTD');
            } else if (eventType === 'cpt') {
                return deployment.resourceId?.startsWith('CPT');
            }
            return false;
        });
        
        return Array.from(new Map(compatibleDeployments.map(deployment => [deployment.id, deployment])).values());
    };

    // Helper function to format deployment title
    const formatDeploymentTitle = (deployment: ScheduleEvent): string => {
        const formatTime = (time: number): string => {
            const hours = Math.floor(time);
            const minutes = Math.round((time - hours) * 60);
            return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
        };
        
        // Get start date and format it
        const startDate = deployment.date || '';
        const endDate = deployment.deploymentEndDate || startDate;
        
        // Format dates as DDMMMYY (e.g., 12May25)
        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const year = date.getFullYear().toString().slice(-2);
            return `${day}${month}${year}`;
        };
        
        const startTime = formatTime(deployment.startTime || 0);
        const endTime = formatTime((deployment.startTime || 0) + (deployment.duration || 0));
        
        return `${startTime}${formatDate(startDate)}–${endTime}${formatDate(endDate)}`;
    };

    
    
    


    // Oracle Logic for SCT and Trainee next event
    useEffect(() => {
        const selectedTrainee = crew[0]?.student;
        const selectedInstructor = crew[0]?.instructor;

        // Trainee selection always takes priority
        if (selectedTrainee) {
            if (isOracleContext && oracleContextForModal?.availableTraineesAnalysis) {
                const analysis = oracleContextForModal.availableTraineesAnalysis.find(t => t.trainee.fullName === selectedTrainee);
                if (analysis && analysis.nextSyllabusEvent) {
                    const nextEventId = analysis.nextSyllabusEvent.id;
                    setDynamicSyllabusOptions([nextEventId]);
                    setFlightNumber(nextEventId);
                    setDuration(analysis.nextSyllabusEvent.duration);
                    return;
                }
            }
            // Fallback for non-oracle or if analysis fails. Just show all syllabus items.
            setDynamicSyllabusOptions(syllabus);
            return;
        }

        // No trainee selected, check for instructor (only in Oracle context)
        if (isOracleContext && selectedInstructor) {
            const instructorScts = sctRequests.filter(req => req.name === selectedInstructor);
            if (instructorScts.length > 0) {
                const sctOptions = instructorScts.map(req => req.event);
                setDynamicSyllabusOptions(sctOptions);
                setFlightNumber(sctOptions[0]); // Auto-select the first one
                const detail = syllabusDetails.find(d => d.id === sctOptions[0]);
                if (detail) {
                    setDuration(detail.duration);
                }
            } else {
                // Instructor selected, but no SCT requests. So, no options.
                setDynamicSyllabusOptions([]);
                setFlightNumber('');
            }
            return;
        }
        
        // Fallback for all other cases (e.g., non-oracle, or oracle with no selections)
        setDynamicSyllabusOptions(isOracleContext ? [] : syllabus);
        if (!event.flightNumber && isOracleContext) {
            setFlightNumber('');
        }

    }, [crew, isOracleContext, oracleContextForModal, sctRequests, syllabus, syllabusDetails, event.flightNumber]);

    // Close group flyout when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (groupInputRef.current && !groupInputRef.current.contains(e.target as Node)) {
                setActiveGroupInput(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside as any);
        return () => document.removeEventListener("mousedown", handleClickOutside as any);
    }, []);
    
    const personnel = useMemo(() => [...instructors, ...trainees].sort(), [instructors, trainees]);
    
    const handleCrewChange = (index: number, field: keyof CrewMember, value: any) => {
        const newCrew = [...crew];
        const memberToUpdate = { ...newCrew[index] };

        if (field === 'flightType') {
            const flightTypeValue = value as 'Dual' | 'Solo';
            memberToUpdate.flightType = flightTypeValue;

            if (flightTypeValue === 'Solo') {
                memberToUpdate.instructor = '';
                memberToUpdate.student = '';
                memberToUpdate.group = '';
                memberToUpdate.groupTraineeIds = [];
            } else {
                memberToUpdate.pilot = '';
            }
        } else {
            // @ts-ignore - dynamic assignment
            memberToUpdate[field] = value;
        }

        newCrew[index] = memberToUpdate;
        setCrew(newCrew);
        setLocalHighlight(null);
    };
    
    const handleToggleTrainee = (index: number, traineeId: number) => {
        const member = crew[index];
        const currentIds = new Set(member.groupTraineeIds || []);
        
        if (currentIds.has(traineeId)) {
            currentIds.delete(traineeId);
        } else {
            currentIds.add(traineeId);
        }
        
        const newIds = Array.from(currentIds);
        
        // Update display string based on count
        const displayString = newIds.length > 0 
            ? `${newIds.length} Trainees Selected` 
            : '';

        const newCrew = [...crew];
        newCrew[index] = { ...member, groupTraineeIds: newIds, group: displayString };
        setCrew(newCrew);
    };

    const handleToggleCourse = (index: number, courseTrainees: Trainee[]) => {
        const member = crew[index];
        const currentIds = new Set(member.groupTraineeIds || []);
        const courseIds = courseTrainees.map(t => t.idNumber);
        
        const allSelected = courseIds.every(id => currentIds.has(id));
        
        if (allSelected) {
            courseIds.forEach(id => currentIds.delete(id));
        } else {
            courseIds.forEach(id => currentIds.add(id));
        }
        
        const newIds = Array.from(currentIds);
        const displayString = newIds.length > 0 
            ? `${newIds.length} Trainees Selected` 
            : '';

        const newCrew = [...crew];
        newCrew[index] = { ...member, groupTraineeIds: newIds, group: displayString };
        setCrew(newCrew);
    };

    const applyFlightNumberSelection = (newFlightNumber: string) => {
        setFlightNumber(newFlightNumber);

        const detail = getSyllabusItemForOption(newFlightNumber);
        if (detail) {
            setDuration(detail.duration);
            const detailType = String(detail.type || '').trim().toLowerCase();
            if (isFixedCrewModel && (detailType === 'flight' || detailType === 'ftd' || detailType === 'sim' || detailType === 'simulator')) {
                setEventType(detailType === 'flight' ? 'flight' : 'ftd');
                if (detail.crewRequirement) {
                    setCrewRequirement(detail.crewRequirement);
                }
                if (detail.acceptableAircraftConfigs?.length) {
                    setAircraftConfigId(detail.acceptableAircraftConfigs[0]);
                }
            }
        }

        console.log('Flight number changed to:', newFlightNumber);
        if (newFlightNumber === 'SCT FORM' && !formationType) {
            setFormationType(formationTypes[0]);
        }
        
           
           if (newFlightNumber === 'SCT FORM' && eventCategory === 'sct') {
               // Set defaults for SCT FORM
               setAircraftCount(2);
               // Update crew to Solo
               setCrew(crew.map(member => ({
                   ...member,
                   flightType: 'Solo'
               })));
           } else if (newFlightNumber !== 'SCT FORM') {
               setAircraftCount(1);
           }
    };

    const handleFixedCrewGroupChange = (nextGroup: string) => {
        setFixedCrewGroup(nextGroup);
        setFixedCrewPic('');
        setCrew(prevCrew => {
            const nextCrew = prevCrew.length > 0 ? [...prevCrew] : [{
                instructor: '',
                student: '',
                pilot: '',
                flightType: 'Dual' as const,
            }];
            nextCrew[0] = {
                ...nextCrew[0],
                instructor: '',
                pilot: '',
                student: '',
                group: nextGroup ? formatFixedCrewDisplayGroup(nextGroup) : '',
            };
            return nextCrew;
        });
    };

    const handleFixedCrewPicChange = (nextPic: string) => {
        setFixedCrewPic(nextPic);
        setCrew(prevCrew => {
            const nextCrew = prevCrew.length > 0 ? [...prevCrew] : [{
                instructor: '',
                student: '',
                pilot: '',
                flightType: 'Dual' as const,
            }];
            nextCrew[0] = {
                ...nextCrew[0],
                instructor: nextPic,
                pilot: nextPic,
                student: '',
                group: fixedCrewGroup ? formatFixedCrewDisplayGroup(fixedCrewGroup) : nextCrew[0].group,
            };
            return nextCrew;
        });
    };
    const handleAircraftCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCount = parseInt(e.target.value);
        setAircraftCount(newCount);
        // When changing aircraft count for SCT FORM, ensure all existing crew are Solo
        if (flightNumber === 'SCT FORM' && eventCategory === 'sct') {
            setTimeout(() => {
                setCrew(prevCrew => prevCrew.map(member => ({
                    ...member,
                    flightType: 'Solo' as 'Dual' | 'Solo'
                })));
            }, 100);
        }
    };

    // Helper function to convert time string (HH:MM) to decimal hours
    const parseTimeStringToHours = (timeString: string): number => {
        if (!timeString) return 0;
        
        // Handle both formats: "HH:MM" and "HHMM"
        if (timeString.includes(':')) {
            const [hours, minutes] = timeString.split(':').map(Number);
            return (hours || 0) + ((minutes || 0) / 60);
        } else {
            // Handle 4-digit format without colon (e.g., "0800", "1330")
            const hours = parseInt(timeString.substring(0, 2)) || 0;
            const minutes = parseInt(timeString.substring(2, 4)) || 0;
            return hours + (minutes / 60);
        }
    };

    const handleVisualAdjust = () => {
        console.log("Visual Adjust clicked");
        // Call parent callback FIRST before changing local state
        if (onVisualAdjustStart) {
            onVisualAdjustStart(event);
        }
        // Then set local state
        setIsVisualAdjustMode(true);
    };

    const handleVisualAdjustContinue = () => {
        setIsVisualAdjustMode(false);
        const updatedEvent = {
            ...event,
            startTime: visualAdjustStartTime,
            duration: visualAdjustEndTime - visualAdjustStartTime
        };
        if (onVisualAdjustEnd) {
            onVisualAdjustEnd(updatedEvent);
        }
        setStartTime(formatTime(visualAdjustStartTime));
        setDuration(visualAdjustEndTime - visualAdjustStartTime);
    };
    const handleSave = async () => {
        if (isReadOnly) {
            await showDarkAlert('Past DFPs are locked. Tile details cannot be amended.', 'Past DFP Locked', 'warning');
            return;
        }
        // System freeze check - read directly from localStorage to avoid stale closure
        const _freezeRaw = localStorage.getItem('systemFreezeState');
        if (_freezeRaw) {
            const _freeze = JSON.parse(_freezeRaw);
            if (_freeze.isFrozen) {
                await showDarkAlert('System is currently frozen. No modifications are allowed during a system freeze.', 'System Frozen', 'error');
                return;
            }
        }
        const eventsToSave: ScheduleEvent[] = crew.map((c, index) => {
            let eventColor = event.color;
            
            const traineeName = c.student || c.pilot;
            if (traineeName) {
                const traineeDetails = traineesData.find(t => t.fullName === traineeName);
                if (traineeDetails && courseColors[traineeDetails.course]) {
                    eventColor = courseColors[traineeDetails.course];
                }
            }
            
            // Handle deployment assignment
            let resourceId = event.resourceId;
            if (selectedDeploymentId) {
                // Find the selected deployment and assign its resourceId
                const selectedDeployment = getCurrentDeployments().find(d => d.id === selectedDeploymentId);
                if (selectedDeployment) {
                    resourceId = selectedDeployment.resourceId;
                    console.log(`Assigning event to deployment: ${selectedDeployment.id} (${resourceId})`);
                }
            }
            
            // For SCT FORM events with multiple aircraft, generate unique IDs for each event
            const eventId = (flightNumber === 'SCT FORM' && crew.length > 1) 
                ? `${event.id}-${index}-${Date.now()}` 
                : event.id;
            
            // For SCT FORM events with multiple aircraft, clear resourceId so findAvailableResourceId assigns them to different lines
            if (flightNumber === 'SCT FORM' && crew.length > 1) {
                resourceId = '';
            }
            
            const fixedCrewDisplayGroup = fixedCrewGroup ? formatFixedCrewDisplayGroup(fixedCrewGroup) : c.group;
            const fixedCrewDisplayPic = fixedCrewPic || c.pilot || c.instructor;

            const savedEvent = {
                ...event,
                id: eventId,
                type: eventType,
                flightNumber,
                startTime: convertTimeToDecimal(startTime),
                resourceId,
                duration: typeof duration === 'number' ? duration : 0, // Ensure duration is a number
                area: eventType === 'flight' ? area : undefined,
                aircraftNumber: eventType === 'flight' ? formatAircraftNumber(aircraftNumber, aircraftNumberPrefix, aircraftNumberSettings) : undefined,
                aircraftConfigId: eventType === 'flight' ? aircraftConfigId : undefined,
                acceptableAircraftConfigs: eventType === 'flight' ? [aircraftConfigId] : event.acceptableAircraftConfigs,
                crewRequirement: eventType === 'flight' ? crewRequirement : event.crewRequirement,
                color: eventColor,
                flightType: c.flightType,
                instructor: isFixedCrewCrewedEvent ? fixedCrewDisplayPic : c.instructor,
                student: isFixedCrewCrewedEvent ? '' : c.student,
                pilot: isFixedCrewCrewedEvent ? fixedCrewDisplayPic : c.pilot,
                group: isFixedCrewCrewedEvent ? fixedCrewDisplayGroup : c.group,
                groupTraineeIds: c.groupTraineeIds,
                locationType,
                origin: locationType === 'Local' ? school : origin,
                destination: locationType === 'Local' ? school : destination,
                formationType: flightNumber === 'SCT FORM' ? formationType : undefined,
                formationPosition: flightNumber === 'SCT FORM' ? index + 1 : undefined,
                callsign: flightNumber === 'SCT FORM' ? `${formationType}${index + 1}` : callsign,
                formationId: undefined,
                notes,
                fixedCrewGroup: isFixedCrewCrewedEvent ? fixedCrewGroup || undefined : undefined,
                fixedCrewPic: isFixedCrewCrewedEvent ? fixedCrewPic || undefined : undefined,
                fixedCrewManifestStatus: isFixedCrewCrewedEvent ? fixedCrewManifestStatus || 'pending' : undefined,
                fixedCrewManifestNotes: isFixedCrewCrewedEvent ? fixedCrewManifestNotes || undefined : undefined,
                isDeploy: eventType === 'flight' && locationType === 'Land Away' ? isDeploy : undefined,
                
                // Explicit Deployment Period
                deploymentStartDate: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentStartDate : undefined,
                deploymentStartTime: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentStartTime : undefined,
                deploymentEndDate: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentEndDate : undefined,
                deploymentEndTime: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentEndTime : undefined,
                deploymentAircraftCount: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentAircraftCount : undefined,
                assignedDeploymentId: selectedDeploymentId || undefined,
                
                // Save event category for LMP Currency handling
                eventCategory: eventCategory,
            };
            
            // Debug logging for SCT events
            if (eventCategory === 'sct') {
                console.log('💾 Saving SCT event:', {
                    id: savedEvent.id,
                    flightType: savedEvent.flightType,
                    pilot: savedEvent.pilot,
                    student: savedEvent.student,
                    instructor: savedEvent.instructor,
                    eventCategory: savedEvent.eventCategory,
                    crewData: c,
                    allCrew: crew
                });
            }
            
            return savedEvent;
        });
        
        // Create Deployment Tile if deployment period is populated and isDeploy is true
        console.log('Deployment Check:', {
            eventType,
            locationType,
            isDeploy,
            deploymentStartDate,
            deploymentStartTime,
            deploymentEndDate,
            deploymentEndTime
        });
        
        if (eventType === 'flight' && locationType === 'Land Away' && isDeploy && 
            deploymentStartDate && deploymentStartTime && deploymentEndDate && deploymentEndTime) {
            
            console.log('Creating deployment tile...');
            
            // Convert deployment time strings to hours
            const deployStartHour = parseTimeStringToHours(deploymentStartTime);
            const deployEndHour = parseTimeStringToHours(deploymentEndTime);
            
            // Calculate deployment duration in hours, accounting for multi-day deployments
            const startDate = new Date(deploymentStartDate);
            const endDate = new Date(deploymentEndDate);
            
            // Calculate the number of days between start and end dates
            const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Calculate total duration including multiple days
            let deployDuration = (daysDifference * 24) + (deployEndHour - deployStartHour);
            
            // If duration is negative or zero, something is wrong with the dates/times
            if (deployDuration <= 0) {
                deployDuration = 1; // Default to 1 hour minimum
            }
            
            // Create multiple deployment tiles based on aircraft count
            console.log(`Creating ${deploymentAircraftCount} deployment tiles...`);
            
            for (let i = 0; i < deploymentAircraftCount; i++) {
                const deploymentTile: ScheduleEvent = {
                    id: `deployment-${event.id}-${i}-${Date.now()}`,
                    date: deploymentStartDate,
                    type: 'deployment',
                    startTime: deployStartHour,
                    duration: deployDuration,
                    resourceId: 'Deployed', // Will be reassigned by findAvailableResourceId
                    color: 'bg-gray-600/30', // Base color, styling handled in FlightTile
                    flightNumber: 'DEPLOYMENT',
                    flightType: 'Dual',
                    locationType: 'Land Away',
                    origin: 'DEPLOY',
                    destination: 'DEPLOY',
                    instructor: '',
                    student: '',
                    pilot: '',
                    isDeploy: true,
                    deploymentStartDate: deploymentStartDate,
                    deploymentStartTime: deploymentStartTime,
                    deploymentEndDate: deploymentEndDate,
                    deploymentEndTime: deploymentEndTime,
                    deploymentAircraftCount: deploymentAircraftCount,
                };
                
                console.log(`Deployment tile ${i + 1} created:`, deploymentTile);
                eventsToSave.push(deploymentTile);
            }
        }
        
        console.log('Events to save:', eventsToSave);
        onSave(eventsToSave);
    }

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const totalHours = h + m / 60;
                const label = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`; // 24-hour format without colon
                options.push({ label, value: formatTime(totalHours) });
            }
        }
        return options;
    }, []);

    const traineeObject = useMemo(() => {
        const traineeFullName = event.flightType === 'Dual' ? event.student : event.pilot;
        if (!traineeFullName) return null;
        return traineesData.find(t => t.fullName === traineeFullName) || null;
    }, [event.flightType, event.student, event.pilot, traineesData]);

    const trainingReportStaffObject = useMemo(() => {
        const candidateNames = [event.fixedCrewPic, event.pilot, event.crew, event.instructor]
            .map(name => String(name || '').trim())
            .filter(Boolean);
        for (const candidateName of candidateNames) {
            const staff = instructorsData.find(instructor => instructor.name === candidateName);
            if (staff) return staff;
        }
        return null;
    }, [event.crew, event.fixedCrewPic, event.instructor, event.pilot, instructorsData]);

    const handleSyllabusFocus = () => {
        if (isOracleContext && !crew[0]?.student && !crew[0]?.instructor) {
            setSyllabusSelectionError(true);
            setTimeout(() => setSyllabusSelectionError(false), 2000);
        }
    };
    
    const handleTraineeScoresClick = () => {
        if (traineeObject) {
            setShowTraineeScoresModal(true);
        }
    };

    const handleLmpClick = () => {
        onNavigateToSyllabus(event.flightNumber);
        onClose();
    };

    const handlePt051Click = () => {
        if (traineeObject) {
            onOpenPt051(traineeObject);
            onClose();
        }
    };

    const handleTrainingReportClick = () => {
        if (trainingReportStaffObject && onOpenTrainingReport) {
            onOpenTrainingReport(trainingReportStaffObject, event);
            onClose();
        }
    };
    
    const handleAuthClick = () => {
        onOpenAuth(event);
    };

    const handlePostFlightClick = () => {
        onOpenPostFlight(event);
    };

    const handleCompleteClick = () => {
        // Check if this is a Mass Brief event
        if (event.flightNumber.includes('MB') || event.flightNumber.includes(' MB')) {
            setShowMassBriefComplete(true);
        } else {
            // For regular ground events, mark as complete and close
            // This would typically update the event status in the system
            if (traineeObject) {
                alert(`Ground event "${event.flightNumber}" marked as complete for ${traineeObject.rank} ${traineeObject.name}`);
            } else {
                alert(`Ground event "${event.flightNumber}" marked as complete`);
            }
            onClose();
        }
    };

    const handleMassBriefComplete = (confirmedTrainees: Trainee[]) => {
        console.log('Mass Brief completed for trainees:', confirmedTrainees.map(t => t.fullName));
        
        const currentDate = new Date().toISOString().split('T')[0];
        const instructor = event.instructor || 'System';
        
        // Create PT051 assessments for each trainee
        if (onSavePT051Assessment) {
            confirmedTrainees.forEach(trainee => {
                const assessment = {
                    id: `${trainee.idNumber}_${event.id}_${currentDate}`,
                    traineeName: trainee.name,
                    traineeFullName: trainee.fullName || `${trainee.rank} ${trainee.name}`,
                    eventId: event.id,
                    flightNumber: event.flightNumber,
                    date: currentDate,
                    instructorName: instructor,
                    dcoResult: 'DCO', // Check DCO box
                    overallGrade: 'No Grade', // Set to "No Grade"
                    overallResult: null, // null for ground events
                    overallComments: `Ground event completed via Mass Brief completion on ${currentDate}`, // String format for compatibility
                    scores: [], // Empty scores array for ground events
                    isCompleted: true,
                    groundSchoolAssessment: {
                        isAssessment: false,
                        result: 0
                    }
                };
                
                console.log('Saving PT051 assessment for:', trainee.fullName, assessment);
                onSavePT051Assessment(assessment);
            });
            console.log('PT051 assessments saved successfully');
        } else {
            console.warn('onSavePT051Assessment callback is not defined!');
        }
        
        // Show styled confirmation
        setCompletedTrainees(confirmedTrainees);
        setShowMassBriefConfirmation(true);
    };

    

const renderCrewFields = (crewMember: CrewMember, index: number) => {
    if (isFixedCrewCrewedEvent) return null;
    const isSctForm = flightNumber === 'SCT FORM';
    const isSctGeneric = flightNumber.startsWith('SCT');
    
    const formationCallsign = isSctForm && formationType
        ? `${formationType}${index + 1}` 
        : `Aircraft ${index + 1}`;
    
    // Determine if we should use staff-only instructors
    const useStaffOnly = eventCategory === 'lmp_currency' || eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di';
    
    // Determine if we should show Trainee/Group fields (only for LMP Event and LMP Currency)
    const showTraineeFields = eventCategory === 'lmp_event' || eventCategory === 'lmp_currency';
    
    // Determine if we should show Crew field (only for SCT and Staff CAT when Dual)
    const showCrewField = (eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di') && crewMember.flightType === 'Dual';
    
    return (
        <div key={index} className={`space-y-4 ${crew.length > 1 ? 'p-3 bg-gray-700/50 rounded-lg' : ''}`}>
            {crew.length > 1 && <h4 className="text-sm font-bold text-sky-400">{formationCallsign}</h4>}

            <div>
                <label className="block text-sm font-medium text-gray-400">Dual/Solo</label>
                <select value={crewMember.flightType} onChange={e => handleCrewChange(index, 'flightType', e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                    <option value="Dual">Dual</option>
                    <option value="Solo">Solo</option>
                </select>
            </div>

            {crewMember.flightType === 'Dual' ? (
                <>
                    {/* Instructor/Pilot Field - Staff only for certain categories */}
                    {useStaffOnly ? (
                        renderStaffInstructorDropdown(
                            // For SCT, use pilot field; for others, use instructor field
                            eventCategory === 'sct' ? crewMember.pilot : crewMember.instructor,
                            (value) => handleCrewChange(index, eventCategory === 'sct' ? 'pilot' : 'instructor', value),
                            (eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di') ? 'Pilot' : 'Instructor',
                            isDeploy
                        )
                       ) : (
                           renderStaffInstructorDropdown(
                               crewMember.instructor,
                               (value) => handleCrewChange(index, 'instructor', value),
                               'Instructor',
                               isDeploy
                           )
                       )}
                    
                    {/* Trainee/Group Fields - Only for LMP Event and LMP Currency */}
                    {showTraineeFields && (
                        <>
                            {renderTraineeDropdown(
                                crewMember.student,
                                (value) => handleCrewChange(index, 'student', value),
                                isDeploy,
                                localHighlight === 'student'
                            )}

                            <div className="flex items-center justify-center my-3">
                                <span className="text-base font-bold text-gray-500">- OR -</span>
                            </div>

                            <div className="p-4 border border-gray-600 rounded bg-gray-700/30 relative" ref={groupInputRef}>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium text-gray-300">Group</h4>
                                    {crewMember.groupTraineeIds?.length > 0 && (
                                        <span className="text-xs text-sky-400 font-mono bg-gray-800 px-2 py-0.5 rounded-full border border-gray-600">
                                            {crewMember.groupTraineeIds.length} Selected
                                        </span>
                                    )}
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => setActiveGroupInput(activeGroupInput === index ? null : index)}
                                    disabled={isDeploy}
                                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center shadow-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                                    </svg>
                                    Add Names
                                </button>
                                
                                {/* Group Selection Flyout */}
                                {activeGroupInput === index && (
                                    <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-xl max-h-60 overflow-y-auto left-0">
                                        {coursesStruct.map(course => {
                                            const courseTraineeIds = course.trainees.map(t => t.idNumber);
                                            const currentIds = new Set(crewMember.groupTraineeIds || []);
                                            const isAllSelected = courseTraineeIds.length > 0 && courseTraineeIds.every(id => currentIds.has(id));

                                            return (
                                                <div key={course.name}>
                                                    <div className="flex items-center px-3 py-2 bg-gray-900/80 font-bold text-gray-300 sticky top-0 z-10 border-b border-gray-700">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isAllSelected}
                                                            onChange={() => handleToggleCourse(index, course.trainees)}
                                                            className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded mr-2 cursor-pointer"
                                                        />
                                                        <span className="uppercase text-xs">{course.name}</span>
                                                    </div>
                                                    <div className="bg-gray-800">
                                                        {course.trainees.map(trainee => {
                                                            const isSelected = currentIds.has(trainee.idNumber);
                                                            return (
                                                                <div 
                                                                    key={trainee.idNumber}
                                                                    className="flex items-center px-3 py-2 pl-8 hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-700/50 last:border-0"
                                                                    onClick={() => handleToggleTrainee(index, trainee.idNumber)}
                                                                >
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isSelected} 
                                                                        readOnly 
                                                                        className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded mr-3 pointer-events-none"
                                                                    />
                                                                    <span className="text-sm text-gray-300">{trainee.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    
                    {/* Crew Field - Only for SCT and Staff CAT when Dual */}
                    {showCrewField && (
                        renderStaffInstructorDropdown(
                            crewMember.student,
                            (value) => handleCrewChange(index, 'student', value),
                            'Crew',
                            isDeploy,
                            eventCategory === 'sct' // Include PAX option for SCT events
                        )
                    )}
                </>
               ) : (
                   // Solo - Use staff dropdown for SCT and Staff CAT
                   useStaffOnly ? (
                       <div>
                           <label className="block text-sm font-medium text-gray-400">Pilot</label>
                           <select 
                               value={crewMember.pilot} 
                               onChange={e => handleCrewChange(index, 'pilot', e.target.value)} 
                               disabled={isDeploy}
                               className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed appearance-none cursor-pointer z-10"
                           >
                               <option value="" disabled>Select pilot</option>
                               {staffInstructorsByUnit.sortedUnits.map(unit => (
                                   <optgroup key={unit} label={`─── ${unit} ───`}>
                                       {staffInstructorsByUnit.grouped[unit]
                                           .filter(instructor => {
                                               // For formations, filter out pilots already assigned to other aircraft
                                               if (crew.length > 1) {
                                                   const alreadyAssignedPilots = crew
                                                       .filter((c, i) => i !== index) // Exclude current aircraft
                                                       .map(c => c.pilot)
                                                       .filter(p => p); // Remove empty values
                                                   return !alreadyAssignedPilots.includes(instructor.name);
                                               }
                                               return true;
                                           })
                                           .map(instructor => {
                                               const stats = personStats[instructor.name] || { rank: '' };
                                               const displayText = `${stats.rank} ${instructor.name}`;
                                               return (
                                                   <option key={instructor.name} value={instructor.name}>
                                                       {displayText}
                                                   </option>
                                               );
                                           })}
                                   </optgroup>
                               ))}
                           </select>
                       </div>
                   ) : (
                       <div>
                           <label className="block text-sm font-medium text-gray-400">Pilot</label>
                           <select value={crewMember.pilot} onChange={e => handleCrewChange(index, 'pilot', e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                               <option value="" disabled>Select pilot</option>
                               {traineeList
                                   .filter(name => {
                                       // For formations, filter out pilots already assigned to other aircraft
                                       if (crew.length > 1) {
                                           const alreadyAssignedPilots = crew
                                               .filter((c, i) => i !== index) // Exclude current aircraft
                                               .map(c => c.pilot)
                                               .filter(p => p); // Remove empty values
                                           return !alreadyAssignedPilots.includes(name);
                                       }
                                       return true;
                                   })
                                   .map(name => <option key={name} value={name}>{name}</option>)}
                           </select>
                       </div>
                   )
               )}
        </div>
    );
};    
    if (isVisualAdjustMode) {
        return (
            <VisualAdjustModal
                event={event}
                startTime={visualAdjustStartTime}
                endTime={visualAdjustEndTime}
                onContinue={handleVisualAdjustContinue}
                onClose={() => setIsVisualAdjustMode(false)}
            />
        );
    }

    if (isUnavailabilityDetailsEvent) {
        const detailRows = [
            { label: 'Person', value: `${unavailabilityDetails.rank} ${unavailabilityDetails.name}`.trim() },
            { label: 'Role', value: unavailabilityDetails.role },
        ];

        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-xl border border-red-900/50 transform transition-all animate-fade-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                    <div className="py-4 px-5 border-b border-red-900/40 bg-red-950/30 flex items-center justify-between">
                        <div className="w-8" aria-hidden="true" />
                        <h2 className="text-xl font-bold text-white">Unavailability Details</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-300 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded border border-gray-600 hover:border-gray-400"
                            aria-label="Close unavailability details"
                        >
                            &times;
                        </button>
                    </div>
                    <div className="p-5 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {detailRows.map(row => (
                                <div key={row.label} className="bg-gray-900/70 border border-gray-700 rounded p-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">{row.label}</div>
                                    <div className="text-base font-semibold text-white">{row.value || '-'}</div>
                                </div>
                            ))}
                            <div className="bg-gray-900/70 border border-gray-700 rounded p-3 sm:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">Unavailability</div>
                                <div className="text-base font-semibold text-white">
                                    <span className="text-cyan-300">{unavailabilityDetails.startTime}</span>
                                    <span> {unavailabilityDetails.startDate} - </span>
                                    <span className="text-cyan-300">{unavailabilityDetails.endTime}</span>
                                    <span> {unavailabilityDetails.endDate}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-900/70 border border-red-900/50 rounded p-3">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-gray-400 mb-1">Reason</div>
                            <div className="text-base font-semibold text-red-100">{unavailabilityDetails.reason}</div>
                        </div>
                    </div>
                    <div className="border-t border-gray-700 p-4 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 text-gray-900 rounded font-semibold hover:bg-white"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Trainee Scores Modal */}
            {showTraineeScoresModal && traineeObject && (
                <TraineeScoresModal
                    trainee={{ fullName: traineeObject.fullName, course: traineeObject.course }}
                    onClose={() => setShowTraineeScoresModal(false)}
                />
            )}
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl border border-gray-700 transform transition-all animate-fade-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                    <div className={`py-[5px] px-2 border-b border-gray-700 flex justify-center items-center relative ${event.color} flex-shrink-0 min-h-[65px]`}>
                        {/* ALERT button - LEFT side of header, aligned with Trainee Scores below */}
                        {canSendAlert && onSendAlert && (
                            <div className="absolute left-2 flex items-center">
                                <button
                                    onClick={() => {
                                        const rawPeople: string[] = [];
                                        if (event.flightType === 'Solo' && event.pilot) {
                                            rawPeople.push(event.pilot);
                                        } else {
                                            if (event.instructor) rawPeople.push(event.instructor);
                                            if (event.student) rawPeople.push(event.student);
                                            if (event.pilot) rawPeople.push(event.pilot);
                                        }
                                        // Also add OLD crew if crew changed vs baseline
                                        if (baselineEvent) {
                                            if (baselineEvent.instructor && baselineEvent.instructor !== event.instructor) rawPeople.push(baselineEvent.instructor);
                                            if (baselineEvent.student && baselineEvent.student !== event.student) rawPeople.push(baselineEvent.student);
                                            if (baselineEvent.pilot && baselineEvent.pilot !== event.pilot) rawPeople.push(baselineEvent.pilot);
                                        }
                                        // Deduplicate recipients
                                        const people = rawPeople.filter((p: string, i: number, arr: string[]) => arr.indexOf(p) === i).filter(Boolean);
                                        setAlertRecipients(people);
                                        // Auto-generate change description
                                        if (!alertData && baselineEvent) {
                                            const epsilon = 1/120;
                                            const fmt = (t: number) => {
                                                const h = Math.floor(t);
                                                const m = Math.round((t % 1) * 60);
                                                return String(h).padStart(2,'0') + String(m).padStart(2,'0');
                                            };
                                            const flightId = event.flightNumber || event.id;
                                            const changes: string[] = [];
                                            if (Math.abs(event.startTime - baselineEvent.startTime) > epsilon)
                                                changes.push('New start time ' + fmt(event.startTime) + ' (was ' + fmt(baselineEvent.startTime) + ')');
                                            const newEnd = event.startTime + event.duration;
                                            const oldEnd = baselineEvent.startTime + baselineEvent.duration;
                                            if (Math.abs(newEnd - oldEnd) > epsilon)
                                                changes.push('New end time ' + fmt(newEnd) + ' (was ' + fmt(oldEnd) + ')');
                                            if (event.resourceId !== baselineEvent.resourceId && baselineEvent.resourceId)
                                                changes.push('Aircraft changed to ' + event.resourceId + ' (was ' + baselineEvent.resourceId + ')');
                                            if (event.instructor !== baselineEvent.instructor && baselineEvent.instructor)
                                                changes.push('New instructor: ' + (event.instructor || 'unassigned') + ' (was ' + baselineEvent.instructor + ')');
                                            if (event.student !== baselineEvent.student && baselineEvent.student)
                                                changes.push('New student: ' + (event.student || 'unassigned') + ' (was ' + baselineEvent.student + ')');
                                            if (event.pilot !== baselineEvent.pilot && baselineEvent.pilot)
                                                changes.push('New pilot: ' + (event.pilot || 'unassigned') + ' (was ' + baselineEvent.pilot + ')');
                                            const autoDesc = changes.length > 0
                                                ? flightId + ': ' + changes.join('. ') + '.'
                                                : 'Change to ' + flightId + ' at ' + fmt(event.startTime);
                                            setAlertDescription(autoDesc);
                                        }
                                        setAlertUserNote('');
                                        setAlertSent(!!alertData);
                                        setShowAlertPanel(true);
                                    }}
                                    className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${alertData ? 'ring-1 ring-amber-500/50' : ''}`}
                                >
                                    {alertData ? (
                                        <span className="text-center leading-tight" style={{ color: '#16a34a', fontSize: '10px' }}>&#x2713; Alert<br/>Sent</span>
                                    ) : (
                                        <span className="text-center leading-tight" style={{ color: '#000000' }}>Send<br/>Alert</span>
                                    )}
                                </button>
                            </div>
                        )}
                        <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
                        <div className="absolute right-2 flex items-center space-x-4">
                            {isEditing && !isReadOnly && eventType === 'flight' && (
                                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-black/20">
                                    <input
                                        type="checkbox"
                                        checked={isDeploy}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setIsDeploy(checked);
                                            if (checked) {
                                                setLocationType('Land Away');
                                            }
                                        }}
                                        className="h-5 w-5 accent-sky-500 bg-gray-600 rounded border-gray-500 focus:ring-sky-500"
                                    />
                                    <span className="text-sm font-semibold text-white">Add Deployment</span>
                                </label>
                            )}
                            {!isReadOnly && <div className="relative">
                                {isFrozen && (
                                    <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                )}
                                <button onClick={() => setShowDeleteChoice(true)} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold rounded-md" style={{backgroundColor: "#FF6666", color: "white"}} aria-label="Delete Event">
                                    Delete
                                </button>
                            </div>}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-row overflow-hidden">
                        {/* Left Button Panel */}
                        <div className="w-[85px] flex-shrink-0 border-r border-gray-700 bg-gray-800/50 p-2 flex flex-col items-center">
                            <div className="flex-grow" /> {/* Spacer */}
                            {!isEditing && (
                                <>
                                    {!isFixedCrewModel && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handleTraineeScoresClick}
                                                disabled={!traineeObject}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-center leading-tight">Trainee<br/>Scores</span>
                                            </button>
                                        </div>
                                    )}
                                    
                                    {!isFixedCrewModel && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handleLmpClick}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                            >
                                                <span className="text-center leading-tight">LMP</span>
                                            </button>
                                        </div>
                                    )}
                                    {/* PT-051 button - frozen unless pt051Entries is allowed */}
                                    {traineeObject && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && !freezeAllowedActions.pt051Entries && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handlePt051Click}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                            >
                                                <span className="text-center leading-tight">PT-051</span>
                                            </button>
                                        </div>
                                    )}
                                    {!isFixedCrewModel && onOpenTrainingReport && trainingReportStaffObject && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && !freezeAllowedActions.pt051Entries && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handleTrainingReportClick}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                            >
                                                <span className="text-center leading-tight">Training<br/>Report</span>
                                            </button>
                                        </div>
                                    )}
                                    {!isReadOnly && <div className="relative w-[75px]">
                                        {isFrozen && (
                                            <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                        )}
                                        <button onClick={() => {
                                            if (isFixedCrewModel && onEditFixedCrewTile) {
                                                onEditFixedCrewTile();
                                                return;
                                            }
                                            setIsEditing(true);
                                        }} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md">
                                            <span className="text-center leading-tight">Edit</span>
                                        </button>
                                    </div>}
                                </>
                            )}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {isEditing ? (
                                <div className="space-y-5">
                                       {/* Event Category Selector */}
                                       <div>
                                           <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Category</label>
                                           <div className="flex flex-wrap gap-2">
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('lmp_event')}
                                                   className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                                                       eventCategory === 'lmp_event'
                                                           ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   LMP Event
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('lmp_currency')}
                                                   className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                                                       eventCategory === 'lmp_currency'
                                                           ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   LMP Currency
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('sct')}
                                                   className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                                                       eventCategory === 'sct'
                                                           ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   SCT
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('staff_cat')}
                                                   className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                                                       eventCategory === 'staff_cat'
                                                           ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   Staff CAT
                                               </button>
<button
                                                      type="button"
                                                      onClick={() => setEventCategory('twr_di')}
                                                      className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                                                          eventCategory === 'twr_di'
                                                              ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                                                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                      }`}
                                                  >
                                                      TWR DI
                                                  </button>                                           </div>
                                       </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Start Time</label>
                                            <select
                                                value={startTime}
                                                onChange={e => {
                                                    setStartTime(e.target.value);
                                                    setLocalHighlight(null);
                                                }}
                                                disabled={isDeploy}
                                                className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200 disabled:bg-gray-700/50 disabled:cursor-not-allowed ${localHighlight === 'startTime' ? 'ring-2 ring-red-500' : ''}`}
                                            >
                                                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="relative md:col-span-3">
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Syllabus Item</label>
                                            <select
                                                value={flightNumber}
                                                onChange={e => applyFlightNumberSelection(e.target.value)}
                                                onFocus={handleSyllabusFocus}
                                                disabled={isDeploy || (isOracleContext && filteredSyllabusOptions.length === 0) || (isFixedCrewCrewedEvent && fixedCrewEventOptions.length === 0)}
                                                className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed`}
                                            >
                                                <option value="" disabled>
                                                    {isFixedCrewCrewedEvent ? 'Select assigned course/package event' : isOracleContext ? 'Select a crew member first' : 'Select an item'}
                                                </option>
                                                {isFixedCrewCrewedEvent ? (
                                                    <>
                                                        {flightNumber && !fixedCrewEventOptions.some(item => item.id === flightNumber || item.code === flightNumber) && (
                                                            <option value={flightNumber}>{flightNumber}</option>
                                                        )}
                                                        {fixedCrewGroupedEventOptions.map(([groupLabel, items]) => (
                                                            <optgroup key={groupLabel} label={groupLabel}>
                                                                {items.map(item => {
                                                                    const optionValue = item.code || item.id || '';
                                                                    return (
                                                                        <option key={item.id || item.code} value={optionValue}>
                                                                            {formatSyllabusOptionLabel(optionValue)}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </optgroup>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        {isAddingTile && <option value="SCT FORM">SCT FORM</option>}
                                                        {filteredSyllabusOptions.filter(item => item !== 'SCT FORM').map(item => (
                                                            <option key={item} value={item}>{formatSyllabusOptionLabel(item)}</option>
                                                        ))}
                                                    </>
                                                )}
                                            </select>
                                            {syllabusSelectionError && (
                                                <div className="absolute -bottom-6 left-0 text-xs text-red-400 animate-fade-in">Select a crew member first.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Duration</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                value={duration}
                                                onChange={e => setDuration(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                disabled={isDeploy}
                                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                        {eventType === 'flight' && (
                                            <>
                                            <div className="md:col-span-2">
                                                <label className="block text-center text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Aircraft Number</label>
                                                <div className="mt-1 flex items-stretch">
                                                    {aircraftNumberSettings.usePrefix && (
                                                        <select
                                                            value={aircraftNumberPrefix}
                                                            onChange={e => setAircraftNumberPrefix(e.target.value)}
                                                            disabled={isDeploy}
                                                            aria-label={`${resourceDisplayNames.aircraft} number prefix`}
                                                            className="block w-32 flex-shrink-0 rounded-l-md rounded-r-none bg-gray-700 border border-r-0 border-gray-600 shadow-sm py-2 px-2 text-center text-white focus:z-10 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                        >
                                                            {aircraftNumberSettings.prefixes.map(prefix => <option key={prefix} value={prefix}>{prefix}</option>)}
                                                        </select>
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={aircraftNumber}
                                                        onChange={e => setAircraftNumber(e.target.value.toUpperCase())}
                                                        disabled={isDeploy}
                                                        list="flight-detail-aircraft-number-options"
                                                        aria-label={`${resourceDisplayNames.aircraft} number`}
                                                        className={`block min-w-0 flex-1 bg-gray-700 border border-gray-600 shadow-sm py-2 px-3 text-center text-white focus:z-10 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed ${
                                                            aircraftNumberSettings.usePrefix ? 'rounded-l-none rounded-r-md' : 'rounded-md'
                                                        }`}
                                                    />
                                                    <datalist id="flight-detail-aircraft-number-options">
                                                        {Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0')).map(num => <option key={num} value={num} />)}
                                                    </datalist>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Area</label>
                                                <select value={area} onChange={e => setArea(e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                    {areas.map(a => <option key={a} value={a}>{a}</option>)}
                                                </select>
                                            </div>
                                            </>
                                        )}
                                    </div>

                                    {eventType === 'flight' && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">CONFIG</label>
                                                <select
                                                    value={aircraftConfigId}
                                                    onChange={e => setAircraftConfigId(e.target.value)}
                                                    disabled={isDeploy}
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                    title={aircraftConfigOptions.find(definition => definition.id === aircraftConfigId)?.definition || BASE_AIRCRAFT_CONFIG.definition}
                                                >
                                                    {aircraftConfigOptions.map(definition => (
                                                        <option key={definition.id} value={definition.id}>
                                                            {definition.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                                                <select
                                                    value={locationType}
                                                    onChange={e => setLocationType(e.target.value as 'Local' | 'Land Away')}
                                                    disabled={isDeploy}
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                >
                                                    <option value="Local">Local</option>
                                                    <option value="Land Away">Land Away</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-3">
                                                <CrewRequirementEditor
                                                    value={crewRequirement}
                                                    aircraftCrewComposition={aircraftCrewComposition}
                                                    crewPositionTerminology={crewPositionTerminology}
                                                    operationalModel={operationalModel}
                                                    onChange={setCrewRequirement}
                                                />
                                            </div>
                                            {flightNumber !== 'SCT FORM' && !isFixedCrewCrewedEvent && (
                                                selectedPicHasIndividualCallsign || unitCallsignEntries.length === 0 ? (
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Callsign</label>
                                                        <input
                                                            type="text"
                                                            value={callsign}
                                                            onChange={e => setCallsign(e.target.value.toUpperCase())}
                                                            disabled={isDeploy}
                                                            placeholder={unitCallsignEntries.length === 0 ? 'Configure unit callsigns in Settings' : 'Optional callsign'}
                                                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Unit Callsign</label>
                                                        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                                                            <select
                                                                value={unitCallsignBase || defaultUnitCallsign}
                                                                onChange={e => {
                                                                    setUnitCallsignBase(e.target.value);
                                                                    setCallsign(buildUnitEventCallsign(e.target.value, unitCallsignNumber));
                                                                }}
                                                                disabled={isDeploy}
                                                                className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                            >
                                                                {unitCallsignEntries.map(entry => (
                                                                    <option key={entry.id} value={entry.callsign}>{entry.callsign}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={unitCallsignNumber}
                                                                onChange={e => {
                                                                    const nextNumber = Number(e.target.value);
                                                                    setUnitCallsignNumber(nextNumber);
                                                                    setCallsign(buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, nextNumber));
                                                                }}
                                                                disabled={isDeploy}
                                                                className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-2 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                            >
                                                                {callsignNumberOptions.map(option => (
                                                                    <option key={`flight-detail-callsign-number-${option.value}`} value={option.value}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="mt-1 text-[11px] font-semibold text-sky-200/80">{buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, unitCallsignNumber)}</div>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                    {eventType === 'flight' && locationType === 'Land Away' && !isDeploy && (
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Origin</label>
                                                <input
                                                    type="text"
                                                    value={origin}
                                                    onChange={e => setOrigin(e.target.value.toUpperCase())}
                                                    maxLength={3}
                                                    placeholder="e.g. ESL"
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Destination</label>
                                                <input
                                                    type="text"
                                                    value={destination}
                                                    onChange={e => setDestination(e.target.value.toUpperCase())}
                                                    maxLength={3}
                                                    placeholder="e.g. PEA"
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {eventType === 'flight' && locationType === 'Land Away' && (
                                        <>
                                            <fieldset className="p-4 border border-gray-600 rounded-lg mb-4">
                                                <legend className="px-2 text-sm font-semibold text-gray-300">Deployment Period</legend>
                                                <div className="mt-2 grid grid-cols-4 gap-2 bg-gray-700/30 p-3 rounded-lg">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">Start Time</label>
                                                        <input type="text" value={deploymentStartTime} onChange={e => {
                                                            // Remove colon and ensure 24-hour format
                                                            const value = e.target.value.replace(/:/g, '').replace(/\D/g, '').slice(0, 4);
                                                            setDeploymentStartTime(value);
                                                        }} placeholder="0800" className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">Start Date</label>
                                                        <input type="date" value={deploymentStartDate} onChange={e => setDeploymentStartDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">End Time</label>
                                                        <input type="text" value={deploymentEndTime} onChange={e => {
                                                            // Remove colon and ensure 24-hour format
                                                            const value = e.target.value.replace(/:/g, '').replace(/\D/g, '').slice(0, 4);
                                                            setDeploymentEndTime(value);
                                                        }} placeholder="1700" className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">End Date</label>
                                                        <input type="date" value={deploymentEndDate} onChange={e => setDeploymentEndDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm"/>
                                                    </div>
                                                </div>
                                                   <div className="mt-2 bg-gray-700/30 p-3 rounded-lg">
                                                       <label className="block text-xs font-medium text-gray-400 mb-1">Number of Aircraft</label>
                                                       <input 
                                                           type="number" 
                                                           min="1" 
                                                           max="20" 
                                                           value={deploymentAircraftCount} 
                                                           onChange={e => setDeploymentAircraftCount(parseInt(e.target.value) || 1)} 
                                                           className="w-24 bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"
                                                       />
                                                       <span className="ml-2 text-xs text-gray-500">aircraft deploying</span>
                                                   </div>
                                            </fieldset>

                                        </>
                                    )}
        
                                    {flightNumber === 'SCT FORM' && (
                                        <div className="p-3 bg-gray-900/50 rounded-lg space-y-4">
                                            <h3 className="font-semibold text-gray-300">Formation Details</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400">Formation Callsign</label>
                                                    <select value={formationType} onChange={e => setFormationType(e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                           {filteredCallsigns ? (
                                                               filteredCallsigns.map(cs => (
                                                                   <option key={cs.code} value={cs.code}>
                                                                       {cs.name} ({cs.code}) - {cs.unit}
                                                                   </option>
                                                               ))
                                                           ) : (
                                                               formationTypes.map(type => <option key={type} value={type}>{type}</option>)
                                                           )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400">Aircraft Count</label>
                                                    <select value={aircraftCount} onChange={e => setAircraftCount(parseInt(e.target.value))} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                        {Array.from({length: 7}, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            {renderFixedCrewRosterStatus()}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
                                        <textarea
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Optional notes..."
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 resize-none"
                                        />
                                    </div>
                                    {isFixedCrewCrewedEvent && (
                                        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-lg space-y-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <h3 className="font-semibold text-emerald-200">Fixed Crew Manifest</h3>
                                                <span className="text-[11px] uppercase tracking-wider text-emerald-300/80">Scheduled event assignment</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Crew</label>
                                                    <select
                                                        value={fixedCrewGroup}
                                                        onChange={e => handleFixedCrewGroupChange(e.target.value)}
                                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                                    >
                                                        <option value="">Select crew</option>
                                                        {fixedCrewGroups.map(group => (
                                                            <option key={group} value={group}>{formatFixedCrewDisplayGroup(group)}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">PIC</label>
                                                    <select
                                                        value={fixedCrewPic}
                                                        onChange={e => handleFixedCrewPicChange(e.target.value)}
                                                        disabled={!fixedCrewGroup || fixedCrewPicCandidates.length === 0}
                                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="">{fixedCrewGroup ? 'Select PIC' : 'Select crew first'}</option>
                                                        {fixedCrewPic && !fixedCrewPicCandidates.some(staff => staff.name === fixedCrewPic) && (
                                                            <option value={fixedCrewPic}>{fixedCrewPic}</option>
                                                        )}
                                                        {fixedCrewPicCandidates.map(staff => (
                                                            <option key={staff.id || staff.name} value={staff.name}>
                                                                {[staff.rank, staff.name].filter(Boolean).join(' ')}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Callsign</label>
                                                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                                                        <select
                                                            value={unitCallsignBase || defaultUnitCallsign}
                                                            onChange={e => {
                                                                setUnitCallsignBase(e.target.value);
                                                                setCallsign(buildUnitEventCallsign(e.target.value, unitCallsignNumber));
                                                            }}
                                                            disabled={isDeploy || unitCallsignEntries.length === 0}
                                                            className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                        >
                                                            {unitCallsignEntries.length === 0 ? (
                                                                <option value="">Configure unit callsigns in Settings</option>
                                                            ) : unitCallsignEntries.map(entry => (
                                                                <option key={entry.id} value={entry.callsign}>{entry.callsign}</option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            value={unitCallsignNumber}
                                                            onChange={e => {
                                                                const nextNumber = Number(e.target.value);
                                                                setUnitCallsignNumber(nextNumber);
                                                                setCallsign(buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, nextNumber));
                                                            }}
                                                            disabled={isDeploy || unitCallsignEntries.length === 0}
                                                            className="block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-2 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                                        >
                                                            {callsignNumberOptions.map(option => (
                                                                <option key={`fixed-crew-callsign-number-${option.value}`} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="mt-1 text-[11px] font-semibold text-emerald-200/80">
                                                        {unitCallsignEntries.length > 0 ? buildUnitEventCallsign(unitCallsignBase || defaultUnitCallsign, unitCallsignNumber) : 'No unit callsigns configured'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Manifest Status</label>
                                                    <select
                                                        value={fixedCrewManifestStatus || 'pending'}
                                                        onChange={e => setFixedCrewManifestStatus(e.target.value as ScheduleEvent['fixedCrewManifestStatus'])}
                                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="complete">Complete</option>
                                                        <option value="partial">Partial</option>
                                                        <option value="swapped">Swapped</option>
                                                        <option value="invalid">Invalid</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="bg-gray-900/50 border border-gray-700 rounded-md p-3">
                                                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Crew Members</div>
                                                    {fixedCrewMembers.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {fixedCrewMembers.map(staff => (
                                                                <div key={staff.id || staff.name} className="flex items-center justify-between gap-2 rounded bg-gray-800/70 px-2 py-1.5 text-sm">
                                                                    <span className="min-w-0 truncate text-gray-100">{[staff.rank, staff.name].filter(Boolean).join(' ')}</span>
                                                                    <span className="flex-shrink-0 text-xs font-semibold text-emerald-300">{staff.role || 'Staff'}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm text-gray-500 italic">Select a crew to preview its members.</div>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="bg-gray-900/50 border border-gray-700 rounded-md p-3">
                                                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">PIC Candidates</div>
                                                        {fixedCrewPicCandidates.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {fixedCrewPicCandidates.map(staff => (
                                                                    <div
                                                                        key={staff.id || staff.name}
                                                                        className={`rounded px-2 py-1.5 text-sm ${staff.name === fixedCrewPic ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40' : 'bg-gray-800/70 text-gray-100 border border-transparent'}`}
                                                                    >
                                                                        {[staff.rank, staff.name].filter(Boolean).join(' ')}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-gray-500 italic">
                                                                {fixedCrewGroup ? 'No PIC-qualified crew members found for this crew.' : 'Select a crew to show PIC candidates.'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Swap / Manifest Notes</label>
                                                        <textarea
                                                            value={fixedCrewManifestNotes}
                                                            onChange={e => setFixedCrewManifestNotes(e.target.value)}
                                                            rows={3}
                                                            placeholder="Optional swap reason or manifest notes..."
                                                            className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-emerald-500 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-4">{crew.map(renderCrewFields)}</div>
                                    
                                    {/* Add to Deployment Section */}
                                    {(eventType === 'flight' || eventType === 'ftd' || eventType === 'cpt') && (
                                        <div className="border-t border-gray-600 pt-6 mt-6">
                                            <h3 className="text-lg font-semibold text-white mb-4">Add to Deployment</h3>
                                            <div className="space-y-3">
                                                {getCurrentDeployments().length > 0 ? (
                                                    getCurrentDeployments().map(deployment => (
                                                        <label key={deployment.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-2 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDeploymentId === deployment.id}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedDeploymentId(deployment.id);
                                                                    } else {
                                                                        setSelectedDeploymentId('');
                                                                    }
                                                                }}
                                                                className="h-4 w-4 text-sky-600 bg-gray-700 border-gray-600 rounded focus:ring-sky-500"
                                                            />
                                                            <span className="text-sm text-gray-300">
                                                                {formatDeploymentTitle(deployment)}
                                                            </span>
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                ({deployment.resourceId})
                                                            </span>
                                                        </label>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">
                                                        No deployments available for this event type
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-300 space-y-2">
                                    {!isFixedCrewCrewedEvent && <p><strong>Syllabus Item:</strong> {event.flightNumber}</p>}
                                    {!isFixedCrewCrewedEvent && event.type === 'flight' && <p><strong>Route:</strong> {event.origin}-{event.destination}</p>}
                                    {!isFixedCrewCrewedEvent && event.type === 'flight' && event.area && <p><strong>Area:</strong> {event.area}</p>}
                                    {!isFixedCrewCrewedEvent && event.type === 'flight' && (
                                        <p><strong>CONFIG:</strong> {aircraftConfigOptions.find(definition => definition.id === (event.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id))?.label || BASE_AIRCRAFT_CONFIG.label}</p>
                                    )}
                                    {isFixedCrewCrewedEvent && (
                                        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">Syllabus Item</span>
                                                    <span className="text-gray-100">{event.flightNumber || 'Not set'}</span>
                                                </div>
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">Route</span>
                                                    <span className="text-gray-100">{event.origin || school}-{event.destination || school}</span>
                                                </div>
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">CONFIG</span>
                                                    <span className="text-gray-100">
                                                        {aircraftConfigOptions.find(definition => definition.id === (event.aircraftConfigId || BASE_AIRCRAFT_CONFIG.id))?.label || BASE_AIRCRAFT_CONFIG.label}
                                                    </span>
                                                </div>
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">PIC</span>
                                                    <span className="text-gray-100">{event.fixedCrewPic || event.pilot || 'Not selected'}</span>
                                                </div>
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">Duration</span>
                                                    <span className="text-gray-100">{event.duration.toFixed(1)} hours</span>
                                                </div>
                                                <div className="rounded bg-gray-900/50 px-3 py-2">
                                                    <span className="block text-xs uppercase tracking-wider text-gray-500">Start Time</span>
                                                    <span className="text-gray-100">{formatTime(event.startTime)}</span>
                                                </div>
                                            </div>
                                            {renderFixedCrewRosterStatus()}
                                        </div>
                                    )}
                                    {!isFixedCrewCrewedEvent && (
                                        <>
                                            <p><strong>Dual/Solo:</strong> <span className="font-semibold">{event.flightType}</span></p>
                                            {event.flightType === 'Dual' ? (
                                                <>
                                                    {event.eventCategory === 'sct' ? (
                                                        <p><strong>Instructor:</strong> {event.instructor || event.pilot}</p>
                                                    ) : (
                                                        <p><strong>Instructor:</strong> {event.instructor}</p>
                                                    )}
                                                    {(event.type === 'ground' && event.attendees && event.attendees.length > 0) ? (
                                                        <div>
                                                            <p><strong>Attendees ({event.attendees.length}):</strong></p>
                                                            <div className="mt-1 bg-gray-700/50 p-2 rounded-md max-h-32 overflow-y-auto">
                                                                <ul className="space-y-1">
                                                                    {event.attendees.map(attendee => (
                                                                        <li key={attendee} className="text-sm text-gray-300">{attendee.split(' – ')[0]}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    ) : event.eventCategory === 'sct' ? null : (
                                                        <p><strong>Student:</strong> {event.student || event.group}</p>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p><strong>PIC:</strong> {event.pilot}</p>
                                                    <p className="flex items-center gap-2">
                                                        <strong>Second Position:</strong>
                                                        <span className="inline-block px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 rounded text-sm font-semibold">
                                                            SOLO
                                                        </span>
                                                    </p>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {!isFixedCrewCrewedEvent && (
                                        <>
                                            <p><strong>Duration:</strong> {event.duration.toFixed(1)} hours</p>
                                            <p><strong>Start Time:</strong> {Math.floor(event.startTime)}:{String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Right Button Panel */}
                        <div className="w-[85px] flex-shrink-0 border-l border-gray-700 bg-gray-800/50 p-2 flex flex-col items-center">
                            {!isEditing && (
                                <>
                                    <div className="w-[75px] p-2 border border-gray-600 rounded-lg text-center bg-gray-700/50 mb-[1px]">
                                        <label className="block text-[10px] font-semibold text-gray-400">Conflict?</label>
                                        {isConflict ? (
                                            <p className="text-lg font-bold text-red-500">YES</p>
                                        ) : (
                                            <p className="text-lg font-bold text-green-500">NO</p>
                                        )}
                                    </div>
                                    {/* NEO button - always frozen when system is frozen */}
                                    {!isReadOnly && <div className="relative w-[75px]">
                                        {isFrozen && (
                                            <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                        )}
                                        <button
                                            onClick={() => onNeoClick(event)}
                                            className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                        >
                                            <span className="text-center leading-tight" style={{color: "#fb923c"}}>NEO</span>
                                        </button>
                                    </div>}
                                    {/* Auth button - frozen unless flightAuthorisation is allowed */}
                                    {!isReadOnly && event.type === 'flight' && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && !freezeAllowedActions.flightAuthorisation && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button onClick={handleAuthClick} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]">
                                                <span className="text-center leading-tight">Auth</span>
                                            </button>
                                        </div>
                                    )}
                                    {/* Complete button - always frozen when system is frozen */}
                                    {!isReadOnly && ((traineeObject && event.type === 'ground') || (event.flightNumber.includes('MB') || event.flightNumber.includes(' MB'))) && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handleCompleteClick}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                            >
                                                <span className="text-center leading-tight">Complete</span>
                                            </button>
                                        </div>
                                    )}
                                    {/* Post Flight remains available for past DFPs; it records actual outcomes, not schedule amendments. */}
                                    {(event.type === 'flight' || event.type === 'ftd') && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && !freezeAllowedActions.postFlightTimes && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button onClick={handlePostFlightClick} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]">
                                                <span className="text-center leading-tight">Post<br/>Flight</span>
                                            </button>
                                        </div>
                                    )}
                                    {isFixedCrewModel && (
                                        <div className="relative w-[75px]">
                                            {isFrozen && (
                                                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
                                            )}
                                            <button
                                                onClick={handleLmpClick}
                                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]"
                                            >
                                                <span className="text-center leading-tight">LMP</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="flex-grow" /> {/* Spacer */}
                            {isEditing ? (
                                   <>
                                <button onClick={handleSave} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[1px]">
                                    <span className="text-center leading-tight">Save</span>
                                </button>
                                       <button onClick={handleVisualAdjust} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md mb-[15px]">
                                           <span className="text-center leading-tight">Visual<br/>Adjust</span>
                                       </button>
                                   </>
                            ) : null}
                                <button onClick={onClose} className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md">
                                    <span className="text-center leading-tight">Close</span>
                                </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* ── Alert Panel Modal ────────────────────────────────────────── */}
            {showAlertPanel && canSendAlert && onSendAlert && (
                <div className="fixed inset-0 bg-black/75 z-[85] flex items-center justify-center animate-fade-in" onClick={() => setShowAlertPanel(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-amber-500/50" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-amber-900/20 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <h2 className="text-lg font-bold text-amber-400">Send Alert</h2>
                            </div>
                            {/* Audit button - top right of header */}
                            <AuditButton pageName={`Alert:${event.id}`} />
                        </div>
                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Already-sent state: show details from alertData */}
                            {(alertSent || alertData) ? (
                                <div className="space-y-3">
                                    {/* Sent confirmation banner */}
                                    <div className="bg-green-900/30 border border-green-600/40 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-green-400 text-sm font-semibold">&#x2705; Alert Sent</span>
                                        </div>
                                        {alertData?.sentAt && (
                                            <p className="text-gray-400 text-xs">
                                                {new Date(alertData.sentAt).toLocaleString('en-AU', {
                                                    day: '2-digit', month: 'short', year: '2-digit',
                                                    hour: '2-digit', minute: '2-digit', hour12: false
                                                })}
                                            </p>
                                        )}
                                        {/* Description of the change */}
                                        {alertData?.description && (
                                            <p className="text-amber-300 text-xs mt-1 italic">
                                                &ldquo;{alertData.description}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                    {/* Recipients with response status */}
                                    {alertData?.recipients && alertData.recipients.length > 0 && (
                                        <div>
                                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Recipients</p>
                                            <div className="space-y-1">
                                                {alertData.recipients.map((r: any) => {
                                                    const isStructuredRecipient = r && typeof r === 'object';
                                                    const recipientKey = isStructuredRecipient
                                                        ? (r.userId || r.reversedName || r.displayName)
                                                        : r;
                                                    const recipientLabel = isStructuredRecipient
                                                        ? (r.displayName || r.reversedName || r.userId)
                                                        : r;
                                                    const response = isStructuredRecipient
                                                        ? { status: r.status || 'pending', respondedAt: r.respondedAt || null }
                                                        : alertData?.responses?.[r];
                                                    const status = response?.status || 'pending';
                                                    return (
                                                        <div key={recipientKey} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg">
                                                            <span className="text-white text-sm">{recipientLabel}</span>
                                                            {status !== 'pending' ? (
                                                                <div className="text-right">
                                                                    <span className={`text-xs font-bold ${status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {status === 'accepted' ? '\u2713 Accepted' : '\u2717 Rejected'}
                                                                    </span>
                                                                    {response.respondedAt && (
                                                                        <p className="text-gray-400 text-[10px]">
                                                                            {new Date(response.respondedAt).toLocaleString('en-AU', {
                                                                                day: '2-digit', month: 'short',
                                                                                hour: '2-digit', minute: '2-digit', hour12: false
                                                                            })}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span className="text-amber-400 text-xs">Pending...</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {/* Show sent recipients from local state if alertData not yet refreshed */}
                                    {alertSent && !alertData && alertRecipients.length > 0 && (
                                        <div>
                                            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Recipients</p>
                                            <div className="space-y-1">
                                                {alertRecipients.map((r) => (
                                                    <div key={r} className="flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg">
                                                        <span className="text-white text-sm">{r}</span>
                                                        <span className="text-amber-400 text-xs">Pending...</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Not yet sent: show recipient selection + description */
                                <>
                                    <p className="text-gray-300 text-sm">
                                        Select recipients to notify about <span className="font-bold text-white">{event.flightNumber}</span>:
                                    </p>
                                    <div className="space-y-2">
                                        {(() => {
                                            const rawPeople: string[] = [];
                                            if (event.flightType === 'Solo' && event.pilot) {
                                                rawPeople.push(event.pilot);
                                            } else {
                                                if (event.instructor) rawPeople.push(event.instructor);
                                                if (event.student) rawPeople.push(event.student);
                                                if (event.pilot) rawPeople.push(event.pilot);
                                            }
                                            // Track old crew from baseline for labelling
                                            const oldCrew: string[] = [];
                                            if (baselineEvent) {
                                                if (baselineEvent.instructor && baselineEvent.instructor !== event.instructor) { rawPeople.push(baselineEvent.instructor); oldCrew.push(baselineEvent.instructor); }
                                                if (baselineEvent.student && baselineEvent.student !== event.student) { rawPeople.push(baselineEvent.student); oldCrew.push(baselineEvent.student); }
                                                if (baselineEvent.pilot && baselineEvent.pilot !== event.pilot) { rawPeople.push(baselineEvent.pilot); oldCrew.push(baselineEvent.pilot); }
                                            }
                                            const uniquePeople = rawPeople.filter((p, i, arr) => p && arr.indexOf(p) === i);
                                            return uniquePeople.length > 0 ? uniquePeople.map((person) => (
                                                <label key={person} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={alertRecipients.includes(person)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setAlertRecipients(prev => [...prev, person]);
                                                            } else {
                                                                setAlertRecipients(prev => prev.filter(r => r !== person));
                                                            }
                                                        }}
                                                        className="w-4 h-4 accent-amber-500"
                                                    />
                                                    <span className="text-white text-sm font-medium">{person}</span>
                                                    <span className="text-gray-400 text-xs ml-auto">
                                                        {oldCrew.includes(person) ? 'Previous crew' : person === event.instructor ? 'Instructor' : person === event.student ? 'Student' : 'Pilot'}
                                                    </span>
                                                </label>
                                            )) : (
                                                <p className="text-gray-400 text-sm text-center py-2">No personnel assigned to this event.</p>
                                            );
                                        })()}
                                    </div>
                                    {/* Auto-generated change description */}
                                    {alertDescription ? (
                                        <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-3">
                                            <label className="text-amber-400 text-xs font-semibold uppercase tracking-wide block mb-1">
                                                Change Detected
                                            </label>
                                            <p className="text-amber-200 text-sm">{alertDescription}</p>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-700/30 border border-gray-600/40 rounded-lg p-3">
                                            <p className="text-gray-400 text-sm italic">No baseline data — describe the change manually below.</p>
                                        </div>
                                    )}
                                    {/* Optional free-text note */}
                                    <div>
                                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">
                                            Additional message <span className="text-gray-500">(optional)</span>
                                        </label>
                                        <textarea
                                            value={alertUserNote}
                                            onChange={(e) => setAlertUserNote(e.target.value)}
                                            placeholder="Add any extra information for recipients..."
                                            rows={2}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-amber-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="p-4 border-t border-gray-700 flex gap-[1px] justify-end">
                            <button
                                onClick={() => setShowAlertPanel(false)}
                                className="w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md"
                            >
                                <span className="text-center leading-tight">Close</span>
                            </button>
                            {/* Clear Alert button - only shown when alert already sent */}
                            {(alertSent || alertData) && onClearAlert && (
                                <button
                                    onClick={async () => {
                                        const confirmed = await showDarkConfirm('This will allow a new alert to be sent for this event.', 'Clear this alert?', 'warning');
                                        if (confirmed) {
                                            logAudit('Alert:' + event.id, 'Delete', `Alert cleared for event ${event.flightNumber || event.id}`, `Recipients: ${alertData?.recipients?.join(', ') || alertRecipients.join(', ')}`);
                                            onClearAlert(event.id);
                                            setAlertSent(false);
                                            setAlertDescription('');
                                            setShowAlertPanel(false);
                                        }
                                    }}
                                    className="w-[75px] h-[55px] flex items-center justify-center text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                                >
                                    <span className="text-center leading-tight text-red-400">Clear<br/>Alert</span>
                                </button>
                            )}
                            {/* Send button - only when not yet sent */}
                            {!(alertSent || alertData) && (
                                <button
                                    disabled={alertRecipients.length === 0}
                                    onClick={async () => {
                                        const finalDesc = alertDescription && alertUserNote
                                            ? alertDescription + ' | ' + alertUserNote
                                            : alertDescription || alertUserNote || '';
                                        console.log('\ud83d\udd14 [Alert] Send button clicked - eventId:', event.id, 'recipients:', alertRecipients);
                                        logAudit('Alert:' + event.id, 'Add', `Alert sent for event ${event.flightNumber || event.id}`, `Recipients: ${alertRecipients.join(', ')} | Description: ${finalDesc}`);
                                        const sent = await onSendAlert(event.id, alertRecipients, finalDesc);
                                        if (sent) {
                                            setAlertSent(true);
                                        } else {
                                            await showDarkAlert('The alert was not saved to the backend. Please check that this schedule has been published for the selected location, then try again.', 'Alert Not Sent', 'error');
                                        }
                                    }}
                                    className={`w-[75px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md ${alertRecipients.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="text-center leading-tight" style={{ color: '#000000' }}>SEND<br/>ALERT</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Choice Modal ─────────────────────────────────────────────────── */}
            {showDeleteChoice && (
                <div className="fixed inset-0 bg-black/75 z-[85] flex items-center justify-center animate-fade-in" onClick={() => setShowDeleteChoice(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-red-500/50" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-red-900/20 flex items-center space-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h2 className="text-lg font-bold text-red-400">
                                {event.isCancelled ? 'Cancelled Event Options' : 'Delete Event'}
                            </h2>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-3">
                            <p className="text-gray-300 text-sm">
                                {event.isCancelled
                                    ? 'This event is cancelled. What would you like to do?'
                                    : 'What would you like to do with this event?'}
                            </p>

                            {/* CANCELLED TILE: Restore option */}
                            {event.isCancelled && (
                                <button
                                    onClick={() => {
                                        setShowDeleteChoice(false);
                                        setShowRestoreConfirm(true);
                                    }}
                                    className="w-full flex items-start gap-3 p-4 bg-green-900/20 border border-green-600/40 rounded-lg hover:bg-green-900/40 transition-colors text-left"
                                >
                                    <div className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-full bg-green-600/20 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-green-300 font-semibold text-sm">Restore to Schedule</div>
                                        <div className="text-gray-400 text-xs mt-0.5">Removes the cancellation and restores this event to active status with full functionality.</div>
                                    </div>
                                </button>
                            )}

                            {/* ACTIVE TILE: Cancel Flight option */}
                            {!event.isCancelled && (
                                <button
                                    onClick={() => {
                                        setShowDeleteChoice(false);
                                        setShowCancelConfirm(true);
                                    }}
                                    className="w-full flex items-start gap-3 p-4 bg-amber-900/20 border border-amber-600/40 rounded-lg hover:bg-amber-900/40 transition-colors text-left"
                                >
                                    <div className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-full bg-amber-600/20 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="text-amber-300 font-semibold text-sm">Cancel Flight</div>
                                        <div className="text-gray-400 text-xs mt-0.5">Stays on the schedule with a redline through it. Requires a cancellation code.</div>
                                    </div>
                                </button>
                            )}

                            {/* Remove from Schedule option (always shown) */}
                            <button
                                onClick={() => {
                                    setShowDeleteChoice(false);
                                    setShowRemovePin(true);
                                }}
                                className="w-full flex items-start gap-3 p-4 bg-red-900/20 border border-red-600/40 rounded-lg hover:bg-red-900/40 transition-colors text-left"
                            >
                                <div className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-full bg-red-600/20 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-red-300 font-semibold text-sm">Remove from Schedule</div>
                                    <div className="text-gray-400 text-xs mt-0.5">Permanently removes the event. Not visible on the schedule and deleted from the database.</div>
                                </div>
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700 flex justify-end">
                            <button
                                onClick={() => setShowDeleteChoice(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Remove from Schedule — Warning + PIN ────────────────────────────────── */}
            {showRemovePin && (
                <PinEntryFlyout
                    correctPin="1111"
                    onConfirm={() => {
                        setShowRemovePin(false);
                        onDeleteRequest();
                    }}
                    onCancel={() => setShowRemovePin(false)}
                    title="Confirm Permanent Removal"
                    message="⚠ This will permanently remove this event from the schedule and cannot be undone. Enter your PIN to confirm."
                />
            )}

            {/* ── Restore Cancelled Event Confirmation ────────────────────────────────── */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 bg-black/75 z-[85] flex items-center justify-center animate-fade-in" onClick={() => setShowRestoreConfirm(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-green-500/50" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-4 border-b border-gray-700 bg-green-900/20 flex items-center space-x-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <h2 className="text-xl font-bold text-green-400">Restore Event</h2>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-gray-300">
                                You are about to restore this cancelled event back to the active schedule.
                            </p>
                            <div className="bg-green-900/20 border border-green-600/40 rounded-md p-3 space-y-1">
                                <p className="text-green-300 text-sm font-semibold">What this will do:</p>
                                <p className="text-gray-300 text-sm">• Remove the cancellation mark and redline</p>
                                <p className="text-gray-300 text-sm">• Restore the event to its original position</p>
                                <p className="text-gray-300 text-sm">• Re-enable full scheduling functionality</p>
                            </div>
                            {event.cancellationCode && (
                                <div className="bg-gray-700/30 border border-gray-600 rounded-md p-3">
                                    <p className="text-gray-400 text-sm">
                                        <strong className="text-white">Previous cancellation code:</strong> {event.cancellationCode}
                                        {(event as any).cancellationManualEntry && ` (${(event as any).cancellationManualEntry})`}
                                    </p>
                                    {(event as any).cancelledBy && (
                                        <p className="text-gray-400 text-sm mt-1">
                                            <strong className="text-white">Cancelled by:</strong> {(event as any).cancelledBy}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowRestoreConfirm(false)}
                                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowRestoreConfirm(false);
                                    if (onRestoreEvent) {
                                        onRestoreEvent(event.id);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-semibold"
                            >
                                Yes, Restore Event
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCancelConfirm && (
                <CancelEventFlyout 
                    eventId={event.id}
                    eventType={event.type === 'ftd' ? 'ftd' : 'flight'}
                    onConfirm={(eventId, cancellationCode, manualCodeEntry) => {
                        if (onCancelEvent) {
                            onCancelEvent(eventId, cancellationCode, manualCodeEntry);
                        } else {
                            // Fallback to old delete behavior if onCancelEvent not provided
                            onDeleteRequest();
                        }
                        setShowCancelConfirm(false);
                    }}
                    onClose={() => setShowCancelConfirm(false)}
                    cancellationCodes={cancellationCodes}
                    resourceDisplayNames={resourceDisplayNames}
                />
            )}
            {showMassBriefComplete && (
                <MassBriefCompleteFlyout
                    isOpen={showMassBriefComplete}
                    onClose={() => setShowMassBriefComplete(false)}
                    event={event}
                    trainees={
                        (() => {
                            console.log('🔍 Processing trainees for MassBriefCompleteFlyout');
                            console.log('🔍 Event:', event);
                            console.log('🔍 Event.attendees:', event.attendees);
                            console.log('🔍 Event.group:', event.group);
                            console.log('🔍 Event.selectedTrainees:', event.selectedTrainees);
                            console.log('🔍 Event.trainees:', event.trainees);
                            console.log('🔍 Event keys:', Object.keys(event));
                            console.log('🔍 Available trainees (strings):', trainees);
                            console.log('🔍 Available traineesData (objects):', traineesData);
                            
                            // First try attendees array
                            if (event.attendees) {
                                console.log('🔍 Processing attendees array');
                                const processedAttendees = event.attendees.map((attendeeName, index) => {
                                    console.log(`🔍 Processing attendee ${index}: "${attendeeName}"`);
                                    
                                    // Find the trainee object from the traineesData list
                                    const trainee = traineesData.find(t => {
                                        const fullName = `${t.rank} ${t.name}`;
                                        console.log(`🔍 Comparing "${fullName}" with "${attendeeName.split(' – ')[0]}"`);
                                        return fullName === attendeeName.split(' – ')[0];
                                    });
                                    
                                    if (trainee) {
                                        console.log('🔍 Found matching trainee:', trainee);
                                        return trainee;
                                    } else {
                                        console.log('🔍 Creating fallback trainee object');
                                        const nameParts = attendeeName.split(' – ');
                                        const fullName = nameParts[0];
                                        const course = nameParts[1] || '';
                                        
                                        // Parse "Last, First" format
                                        let rank = '';
                                        let name = fullName;
                                        const commaIndex = fullName.indexOf(',');
                                        if (commaIndex !== -1) {
                                            const lastName = fullName.substring(0, commaIndex).trim();
                                            const firstName = fullName.substring(commaIndex + 1).trim();
                                            name = `${firstName} ${lastName}`;
                                        } else {
                                            // Try "Rank Last First" format
                                            const parts = fullName.trim().split(' ');
                                            if (parts.length >= 2) {
                                                rank = parts[0];
                                                name = parts.slice(1).join(' ');
                                            }
                                        }
                                        
                                        const fallbackTrainee = {
                                            idNumber: 0,
                                            fullName: fullName,
                                            name: name,
                                            rank: rank,
                                            course: course,
                                            isPaused: false,
                                            unit: '',
                                            seatConfig: 'Pilot' as any,
                                            id: fullName
                                        };
                                        console.log('🔍 Fallback trainee:', fallbackTrainee);
                                        return fallbackTrainee;
                                    }
                                });
                                console.log('🔍 Final processed attendees:', processedAttendees);
                                return processedAttendees;
                            }
                            
                            // If no attendees, try to get trainees from the course (for mass events)
                            if (event.group && event.group.includes('Trainees Selected')) {
                                console.log('🔍 Mass event detected, filtering trainees by course');
                                
                                // Extract course from event if available
                                let eventCourse = '';
                                if (event.course) {
                                    eventCourse = event.course;
                                    console.log('🔍 Event course:', eventCourse);
                                } else if (trainees.length > 0 && typeof trainees[0] === 'string') {
                                    // Try to extract course from first trainee string
                                    const firstTrainee = trainees[0];
                                    const parts = firstTrainee.split(' – ');
                                    if (parts.length > 1) {
                                        eventCourse = parts[1];
                                        console.log('🔍 Extracted course from trainees:', eventCourse);
                                    }
                                }
                                
                                // Filter traineesData by course
                                const filteredTrainees = eventCourse 
                                    ? traineesData.filter(t => t.course === eventCourse)
                                    : traineesData;
                                
                                console.log('🔍 Filtered trainees count:', filteredTrainees.length);
                                console.log('🔍 Filtered trainees:', filteredTrainees);
                                
                                return filteredTrainees;
                            }
                            
                            console.log('🔍 No attendees or mass event, returning empty array');
                            return [];
                        })()
                    }
                    onConfirm={handleMassBriefComplete}
                />
            )}
            {showMassBriefConfirmation && (
                <MassBriefConfirmationFlyout
                    isOpen={showMassBriefConfirmation}
                    onClose={() => {
                        setShowMassBriefConfirmation(false);
                        onClose();
                    }}
                    event={event}
                    confirmedTrainees={completedTrainees}
                />
            )}
        </>
    );
};
