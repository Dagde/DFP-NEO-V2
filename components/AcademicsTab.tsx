import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { CourseLmpPauseEntry, SyllabusItemDetail, Trainee, Score, ScheduleEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { showDarkAlert, showDarkConfirm, showDarkPrompt } from './DarkMessageModal';
import type { ClassroomResourceOption } from '../utils/classroomResources';
import { DEFAULT_ACADEMIC_STANDARD_EVENTS, normaliseAcademicStandardEvents, type AcademicStandardEventConfig } from '../utils/academicStandardEvents';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineTile {
  id: string;
  lessonCode: string;
  label: string;
  startTime: number; // decimal hours (e.g. 8.5 = 08:30)
  duration: number;  // decimal hours
  color: string;
  isStandard?: boolean; // standard event (break, lunch, etc.)
  customDescription?: string;
}

interface PresavedAcademicSchedule {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  workStart: number;
  workEnd: number;
  tiles: TimelineTile[];
}

interface AcademicsTabProps {
  syllabusDetails: SyllabusItemDetail[];
  allTraineesByCourse: { [course: string]: Trainee[] };
  traineesData: Trainee[];
  scores: Map<string, Score[]>;
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  events: ScheduleEvent[]; // existing events for conflict detection
  date: string;
  courseColors: { [key: string]: string };
  school: string;
  locationAbbreviations?: Record<string, string>; // long name -> short code
  // Course-level academic completion: Map<courseCode, Set<lessonCode>>
  courseAcademicProgress?: Map<string, Set<string>>;
  onUpdateCourseAcademicProgress?: (courseCode: string, lessonCode: string, completed: boolean) => void;
  // Persisted Academic LMP selection (survives hard reset)
  persistedAcademicLmp?: string;
  onUpdatePersistedAcademicLmp?: (lmp: string) => void;
  instructors?: string[];    // list of instructor names for allocation dropdown
  instructorLabel?: string;
  groundResources?: string[];
  classroomOptions?: ClassroomResourceOption[];
  standardEvents?: AcademicStandardEventConfig[];
  courseLmpPauses?: Record<string, CourseLmpPauseEntry>;
  onNavigateToStandardEventsSettings?: () => void;
  onSave: (data: AcademicSaveData) => void;
  onClose: () => void;
}

export interface AcademicSaveData {
  lessons: { code: string; description: string; duration: number }[];
  timeline: TimelineTile[];
  selectedTrainees: string[];
  course: string;
  date: string;
  workStart: number;
  workEnd: number;
  resourceId: string;
  instructor: string;
  isAcademic: true;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMELINE_START = 5;  // 05:00
const TIMELINE_END   = 21; // 21:00
const SNAP_MINS      = 5;
const SNAP           = SNAP_MINS / 60;
const PRESAVED_ACADEMIC_SCHEDULES_KEY = 'dfp_neo_presaved_academic_schedules_v1';

// Strip course code suffix from fullName, for example "Surname, First - COURSE".
// Handles both em-dash (–) and hyphen (-) separators
const stripCourse = (fullName: string): string => {
  // Match " – COURSE" or " - COURSE" at the end (em dash or regular hyphen)
  return fullName.replace(/\s[–—-]\s\S+$/, '').trim();
};

const ACADEMIC_TILE_COLOR = '#1d4ed8'; // blue-700 for academic lessons

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (dec: number): string => {
  const h = Math.floor(dec);
  const m = Math.round((dec % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const snap = (val: number): number => Math.round(val / SNAP) * SNAP;

// Subject area colour mapping — full name keys
const subjectColor = (subject: string): string => {
  const map: Record<string, string> = {
    'Aerodynamics':    '#1e40af',
    'Meteorology':     '#0e7490',
    'Navigation':      '#065f46',
    'ATC':             '#7c3aed',
    'Airmanship':      '#9a3412',
    'Aircraft Systems':'#1f2937',
    'Regulations':     '#374151',
    'Human Factors':   '#6b21a8',
    'Instruments':     '#1d4ed8',
    'Performance':     '#0369a1',
  };
  return map[subject] || '#1f2937';
};

// Lesson-code prefix → subtle tile colour for the schedule tile insets.
// Covers common academic module codes. All colours are desaturated
// enough to remain readable against white label text at small sizes.
const LESSON_CODE_COLORS: Record<string, string> = {
  // Aerodynamics
  'AERODY':   '#1e3a6e',  // deep navy-blue
  'AERO':     '#1e3a6e',
  // Air Traffic Control
  'ATC':      '#4a1d6e',  // muted purple
  // Meteorology / Weather
  'MET':      '#0e4d6e',  // steel teal
  'METEO':    '#0e4d6e',
  'WX':       '#0e4d6e',
  // Navigation
  'NAV':      '#0a4a30',  // forest green
  'NAVS':     '#0a4a30',
  // Performance
  'PERF':     '#0a3d6e',  // dark slate-blue
  // Airmanship / Flight Rules
  'AIR':      '#5a2d0c',  // warm dark-brown
  'AIRMAN':   '#5a2d0c',
  // Aircraft Systems
  'SYS':      '#1f2937',  // near-black slate
  'ACFT':     '#1f2937',
  'SYSTEM':   '#1f2937',
  // Instruments / Instrument Flying
  'INSTR':    '#1a3a6e',  // blue-grey
  'IFR':      '#1a3a6e',
  // Human Factors
  'HF':       '#5b1a8a',  // dim violet
  'HUFAC':    '#5b1a8a',
  'HUMAN':    '#5b1a8a',
  // Regulations / Rules of the Air
  'REG':      '#374151',  // dark grey
  'REGS':     '#374151',
  'ROA':      '#374151',
  // Leadership / Command
  'LEAD':     '#6b2d00',  // dark burnt-orange
  // Survival
  'SURV':     '#1a4a1a',  // dark olive
  // Communications
  'COMM':     '#1a4a5a',  // dark cyan-slate
  // Engines / Propulsion
  'ENG':      '#2a1a3e',  // very dark indigo
  // Electronic Warfare
  'EW':       '#2a3a0a',  // dark military-olive
  // Standard / admin tiles (keep their original colors)
  ...Object.fromEntries(DEFAULT_ACADEMIC_STANDARD_EVENTS.map(event => [event.code, event.color])),
};

/**
 * Returns a subtle background colour for a lesson tile based on its lesson code.
 * Tries exact match first, then matches by common prefixes (longest first).
 * Falls back to a default academic blue.
 */
function getLessonTileColor(lessonCode: string, existingColor?: string): string {
  // Standard event tiles keep their configured colour
  const isStandardCode = DEFAULT_ACADEMIC_STANDARD_EVENTS.some(event => event.code === lessonCode);
  if (isStandardCode && existingColor) return existingColor;

  const upper = lessonCode.toUpperCase();

  // 1. Exact match
  if (LESSON_CODE_COLORS[upper]) return LESSON_CODE_COLORS[upper];

  // 2. Prefix match — longest prefix wins
  const prefixKeys = Object.keys(LESSON_CODE_COLORS).sort((a, b) => b.length - a.length);
  for (const prefix of prefixKeys) {
    if (upper.startsWith(prefix)) return LESSON_CODE_COLORS[prefix];
  }

  // 3. Fall back to default academic blue
  return '#1d3461';
}

// ── Lesson Completion ─────────────────────────────────────────────────────────

function getLessonCompletion(
  lessonCode: string,
  trainees: Trainee[],
  scores: Map<string, Score[]>
): 'complete' | 'partial' | 'none' {
  if (trainees.length === 0) return 'none';
  let completedCount = 0;
  for (const t of trainees) {
    const ts = scores.get(t.fullName) || [];
    if (ts.some(s => s.event === lessonCode && s.score >= 1)) completedCount++;
  }
  if (completedCount === 0) return 'none';
  if (completedCount === trainees.length) return 'complete';
  return 'partial';
}

// ── Subject grouping ─────────────────────────────────────────────────────────

// Derive a subject/module key from an event description prefix
// e.g. "AERODY1" -> "AERODY", "MET Review" -> "MET", "ATC Exam" -> "ATC"
function getDescriptionPrefix(desc: string): string {
  if (!desc) return 'General';
  // Strip trailing numbers and keywords like Review/Exam/Debrief/CBT
  return desc.replace(/\s*(\d+|Review|Exam|Debrief|CBT|\d+\s*CBT)\s*$/i, '').trim() || desc;
}

function groupByModule(items: SyllabusItemDetail[]): { moduleKey: string; label: string; items: SyllabusItemDetail[] }[] {
  // Determine grouping strategy:
  // 1. If items have meaningful module field values (numeric or short non-title values), group by module
  // 2. Otherwise, group by event description prefix (subject area)
  const groups: Record<string, SyllabusItemDetail[]> = {};

  // Check if module fields contain meaningful module numbers/names
  // (not just the course title repeated on every item)
  const moduleValues = items.map(i => i.module?.trim()).filter(Boolean);
  const uniqueModules = new Set(moduleValues);
  // If all items share the same module value (for example, a ground school course name),
  // or module values are missing, fall back to grouping by description prefix
  const hasMeaningfulModules = uniqueModules.size > 1 ||
    (uniqueModules.size === 1 && /^\d+$/.test([...uniqueModules][0] || ''));

  for (const item of items) {
    let key: string;
    if (hasMeaningfulModules) {
      // Use module field, fallback to phase, then description prefix
      key = item.module?.trim() || item.phase?.trim() || getDescriptionPrefix(item.eventDescription);
    } else {
      // Fall back to event description prefix as the grouping key
      key = getDescriptionPrefix(item.eventDescription);
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }

  // Sort keys: numeric keys first (1, 2, 3...), then alphabetical
  const sortedKeys = Object.keys(groups).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    if (!isNaN(numA)) return -1;
    if (!isNaN(numB)) return 1;
    return a.localeCompare(b);
  });

  return sortedKeys.map(key => {
    // Build a nice display label: "Module 1" for numeric keys, else the key itself
    const num = parseFloat(key);
    const label = !isNaN(num) ? `Module ${num}` : key;
    return { moduleKey: key, label, items: groups[key] };
  });
}

// ── Trainee Status ────────────────────────────────────────────────────────────

function getTraineeStatus(
  trainee: Trainee,
  events: ScheduleEvent[],
  date: string,
  courseLmpPauseReason?: string
): { status: 'available' | 'unavailable' | 'paused'; reason?: string } {
  if (courseLmpPauseReason) return { status: 'paused', reason: courseLmpPauseReason };
  if (trainee.isPaused) return { status: 'paused', reason: 'Trainee is currently paused' };

  // Check unavailability periods
  for (const u of trainee.unavailability || []) {
    if (date >= u.startDate && date <= u.endDate) {
      return { status: 'unavailable', reason: `Unavailable: ${u.reason}` };
    }
  }

  // Check existing events on this date
  const todayEvents = events.filter(e => e.date === date);
  for (const e of todayEvents) {
    const attendees = [e.student, e.instructor, e.pilot, ...(e.attendees || [])].filter(Boolean);
    if (attendees.includes(trainee.fullName)) {
      return { status: 'unavailable', reason: `Has event: ${e.flightNumber} at ${fmtTime(e.startTime)}` };
    }
  }

  return { status: 'available' };
}

// ── Main Component ────────────────────────────────────────────────────────────

const AcademicsTab: React.FC<AcademicsTabProps> = ({
  syllabusDetails,
  allTraineesByCourse,
  traineesData,
  scores,
  traineeLMPs,
  events,
  date,
  courseColors,
  school,
  locationAbbreviations,
  defaultLocality,
  courseAcademicProgress,
  onUpdateCourseAcademicProgress,
  persistedAcademicLmp,
  onUpdatePersistedAcademicLmp,
  instructors = [],
  instructorLabel = 'Instructor',
  groundResources = [],
  classroomOptions = [],
  standardEvents = DEFAULT_ACADEMIC_STANDARD_EVENTS,
  courseLmpPauses = {},
  onNavigateToStandardEventsSettings,
  onSave,
  onClose,
}) => {
  // ── Control bar state ──
  const localities = useMemo(() => {
    const locs = new Set<string>();
    traineesData.forEach(t => { if (t.location) locs.add(t.location); });
    if (locs.size === 0 && defaultLocality) locs.add(defaultLocality);
    // Consolidate locations that have the same long name (mapped via locationAbbreviations)
    const locsArray = Array.from(locs);
    const consolidated: string[] = [];
    const seen = new Set<string>();
    for (const loc of locsArray) {
      const longName = Object.entries(locationAbbreviations || {}).find(([_, code]) => code === loc)?.[0] || loc;
      if (!seen.has(longName)) {
        consolidated.push(longName);
        seen.add(longName);
      }
    }
    return consolidated.length > 0 ? consolidated : locsArray;
  }, [traineesData, defaultLocality, locationAbbreviations]);

  const [selectedLocality, setSelectedLocality] = useState(() => {
    // Default to the locality currently selected in the header (passed as defaultLocality)
    if (defaultLocality && localities.includes(defaultLocality)) return defaultLocality;
    return localities[0] || '';
  });
  const [selectedDate, setSelectedDate] = useState(date);
  const [workStart, setWorkStart] = useState(8);
  const [workEnd, setWorkEnd]   = useState(17);
  const [resourceId, setResourceId] = useState(''); // blank by default
  const [instructor, setInstructor] = useState(''); // allocated instructor for this academic session
  const effectiveClassroomOptions = useMemo<ClassroomResourceOption[]>(() => {
    if (classroomOptions.length > 0) return classroomOptions;
    return groundResources.map(resource => ({ id: resource, label: resource }));
  }, [classroomOptions, groundResources]);
  const effectiveStandardEvents = useMemo(
    () => normaliseAcademicStandardEvents(standardEvents),
    [standardEvents],
  );
  const displayedStandardEvents = useMemo(() => (
    [...effectiveStandardEvents].sort((left, right) => {
      const leftIsOther = left.code === 'OTHER' || left.label.trim().toLowerCase() === 'other';
      const rightIsOther = right.code === 'OTHER' || right.label.trim().toLowerCase() === 'other';
      if (leftIsOther === rightIsOther) return 0;
      return leftIsOther ? 1 : -1;
    })
  ), [effectiveStandardEvents]);

  // Edit-tile modal state
  const [editTileId, setEditTileId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [timelineEditTileId, setTimelineEditTileId] = useState<string | null>(null);
  const [timelineContextMenu, setTimelineContextMenu] = useState<{ tileId: string; x: number; y: number } | null>(null);

  // Courses filtered by locality
  const coursesForLocality = useMemo(() => {
    const courses = new Set<string>();
    const locationShortCode = Object.entries(locationAbbreviations || {}).find(([name, _]) => name === selectedLocality)?.[1] || '';
    traineesData.forEach(t => {
      if (!selectedLocality || t.location === selectedLocality || t.location === locationShortCode || localities.length <= 1) {
        courses.add(t.course);
      }
    });
    return Array.from(courses).sort();
  }, [traineesData, selectedLocality, localities, locationAbbreviations]);

  const [selectedCourse, setSelectedCourse] = useState(coursesForLocality[0] || '');

  useEffect(() => {
    if (!coursesForLocality.includes(selectedCourse)) {
      setSelectedCourse(coursesForLocality[0] || '');
    }
  }, [coursesForLocality, selectedCourse]);

  // ── Trainees ──
  const courseTrainees = useMemo(() =>
    allTraineesByCourse[selectedCourse] || [],
    [allTraineesByCourse, selectedCourse]
  );

  const academicPauseEntry = useMemo(() => {
    const lmpType = String(persistedAcademicLmp || '').trim();
    if (!selectedCourse || !lmpType) return null;
    return courseLmpPauses[`${String(selectedCourse || '').trim().toUpperCase()}::${lmpType.toUpperCase()}`] || null;
  }, [courseLmpPauses, persistedAcademicLmp, selectedCourse]);

  const traineeStatuses = useMemo(() =>
    courseTrainees.reduce((acc, t) => {
      const aliases = [t.fullName, t.name]
        .map(value => String(value || '').trim().toUpperCase())
        .filter(Boolean);
      const pausedForAcademicLmp = academicPauseEntry?.traineeNames?.some(name => aliases.includes(String(name || '').trim().toUpperCase()));
      acc[t.fullName] = getTraineeStatus(
        t,
        events,
        selectedDate,
        pausedForAcademicLmp ? `Course is paused for ${academicPauseEntry?.lmpType || 'this LMP'}` : undefined
      );
      return acc;
    }, {} as Record<string, { status: 'available' | 'unavailable' | 'paused'; reason?: string }>),
    [academicPauseEntry, courseTrainees, events, selectedDate]
  );

  const [selectedTrainees, setSelectedTrainees] = useState<string[]>([]);
  useEffect(() => {
    // Only auto-select trainees who are available — paused/unavailable start unchecked
    setSelectedTrainees(
      courseTrainees
        .filter(t => traineeStatuses[t.fullName]?.status === 'available')
        .map(t => t.fullName)
    );
  }, [courseTrainees, traineeStatuses]);

  const toggleTrainee = async (name: string) => {
    const isCurrentlySelected = selectedTrainees.includes(name);
    if (isCurrentlySelected) {
      // Deselecting — always allowed
      setSelectedTrainees(prev => prev.filter(n => n !== name));
      return;
    }
    // Selecting — check status first
    const st = traineeStatuses[name];
    if (st && st.status !== 'available') {
      const statusLabel = st.status === 'paused' ? 'PAUSED' : 'UNAVAILABLE';
      const reason = st.reason || (st.status === 'paused' ? 'This trainee is currently paused.' : 'This trainee has a scheduling conflict or unavailability.');
      const confirmed = await showDarkConfirm(
        `${stripCourse(name)} is ${statusLabel}\n\n${reason}\n\nDo you still want to include them in this academic session?`,
        'Trainee Availability Warning',
        'warning'
      );
      if (!confirmed) return;
    }
    setSelectedTrainees(prev => [...prev, name]);
  };

  // Academic LMP courses include all syllabus types, not just Academics,
  // so configured ground school courses are selectable.
  const academicLmpCourses = useMemo(() => {
    const courseCodeSet = new Set<string>();
    syllabusDetails.forEach(s => {
      (s.courses || []).forEach(c => courseCodeSet.add(c));
    });
    return Array.from(courseCodeSet).map(code => {
      const firstItem = syllabusDetails.find(s => s.courses?.includes(code));
      // The module field holds the full course title for academic courses.
      const title = firstItem?.module?.trim() || code;
      return { code, title };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [syllabusDetails]);

  // selectedAcademicLmp: initialise from persisted DB value, fall back to first available
  const [selectedAcademicLmp, setSelectedAcademicLmp] = useState<string>(() => persistedAcademicLmp || '');

  // When persistedAcademicLmp arrives from DB (async), update if we don't have a value yet
  useEffect(() => {
    if (persistedAcademicLmp && !selectedAcademicLmp) {
      setSelectedAcademicLmp(persistedAcademicLmp);
    }
  }, [persistedAcademicLmp]);

  // Auto-select first academic LMP course if nothing is persisted yet
  useEffect(() => {
    const availableCodes = new Set(academicLmpCourses.map(course => course.code));
    if (academicLmpCourses.length === 0) {
      if (selectedAcademicLmp) {
        setSelectedAcademicLmp('');
        onUpdatePersistedAcademicLmp?.('');
      }
      return;
    }
    if (!selectedAcademicLmp || !availableCodes.has(selectedAcademicLmp)) {
      const firstCode = academicLmpCourses[0].code;
      setSelectedAcademicLmp(firstCode);
      onUpdatePersistedAcademicLmp?.(firstCode);
    }
  }, [academicLmpCourses, selectedAcademicLmp, onUpdatePersistedAcademicLmp]);

  // ── Academic syllabus filtered by selected Academic LMP course ─────────────
  // Includes all event types — Ground School, Academics, etc.
  const academicSyllabus = useMemo(() => {
    if (!selectedAcademicLmp) return [];
    return syllabusDetails.filter(s => s.courses?.includes(selectedAcademicLmp));
  }, [syllabusDetails, selectedAcademicLmp]);

  const moduleGroups = useMemo(() => groupByModule(academicSyllabus), [academicSyllabus]);

  // ── Timeline tiles ──
  const [tiles, setTiles] = useState<TimelineTile[]>([]);
  // Derived: the tile currently being edited (must be after tiles declaration)
  const editTile = editTileId ? tiles.find(t => t.id === editTileId) ?? null : null;
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [selectedStandard, setSelectedStandard] = useState<Set<string>>(new Set());
  const [showPresavedSchedules, setShowPresavedSchedules] = useState(false);
  const [presavedScheduleMode, setPresavedScheduleMode] = useState<'list' | 'save'>('list');
  const [presavedSchedules, setPresavedSchedules] = useState<PresavedAcademicSchedule[]>([]);
  const [presavedScheduleName, setPresavedScheduleName] = useState('');

  const syncSelectedSetsFromTiles = useCallback((nextTiles: TimelineTile[]) => {
    setSelectedLessons(new Set(nextTiles.filter(tile => !tile.isStandard).map(tile => tile.lessonCode)));
    setSelectedStandard(new Set(nextTiles.filter(tile => tile.isStandard).map(tile => tile.lessonCode)));
  }, []);

  const loadPresavedSchedules = useCallback((): PresavedAcademicSchedule[] => {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PRESAVED_ACADEMIC_SCHEDULES_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item: any) => ({
          id: String(item?.id || uuidv4()),
          name: String(item?.name || 'Untitled Academic Schedule'),
          createdAt: String(item?.createdAt || new Date().toISOString()),
          updatedAt: String(item?.updatedAt || item?.createdAt || new Date().toISOString()),
          workStart: Number.isFinite(Number(item?.workStart)) ? Number(item.workStart) : 8,
          workEnd: Number.isFinite(Number(item?.workEnd)) ? Number(item.workEnd) : 17,
          tiles: Array.isArray(item?.tiles) ? item.tiles.map((tile: any) => ({
            id: String(tile?.id || uuidv4()),
            lessonCode: String(tile?.lessonCode || ''),
            label: String(tile?.label || tile?.lessonCode || 'Academic'),
            startTime: Number.isFinite(Number(tile?.startTime)) ? Number(tile.startTime) : 8,
            duration: Number.isFinite(Number(tile?.duration)) ? Number(tile.duration) : 1,
            color: String(tile?.color || ACADEMIC_TILE_COLOR),
            isStandard: Boolean(tile?.isStandard),
            customDescription: tile?.customDescription ? String(tile.customDescription) : undefined,
          })).filter((tile: TimelineTile) => tile.lessonCode && tile.duration > 0) : [],
        }))
        .filter((item: PresavedAcademicSchedule) => item.tiles.length > 0);
    } catch {
      return [];
    }
  }, []);

  const persistPresavedSchedules = useCallback((nextSchedules: PresavedAcademicSchedule[]) => {
    setPresavedSchedules(nextSchedules);
    try {
      window.localStorage.setItem(PRESAVED_ACADEMIC_SCHEDULES_KEY, JSON.stringify(nextSchedules));
    } catch (error) {
      console.error('[AcademicsTab] Could not save pre-saved schedules', error);
    }
  }, []);

  useEffect(() => {
    setPresavedSchedules(loadPresavedSchedules());
  }, [loadPresavedSchedules]);

  // Next available time on timeline (after last tile, within working hours)
  const getNextStart = useCallback((newDuration: number) => {
    if (tiles.length === 0) return workStart;
    const lastEnd = Math.max(...tiles.map(t => t.startTime + t.duration));
    const proposed = snap(lastEnd);
    if (proposed + newDuration > TIMELINE_END) return snap(workStart);
    return proposed;
  }, [tiles, workStart]);

  const handleOpenPresavedSchedules = () => {
    setPresavedSchedules(loadPresavedSchedules());
    setPresavedScheduleMode('list');
    setShowPresavedSchedules(true);
  };

  const handleOpenSavePresavedSchedule = () => {
    setPresavedSchedules(loadPresavedSchedules());
    setPresavedScheduleMode('save');
    setShowPresavedSchedules(true);
  };

  const handleSavePresavedSchedule = async () => {
    const name = presavedScheduleName.trim();
    if (!name) {
      await showDarkAlert('Enter a name for the pre-saved academic schedule.', 'Pre-Saved Schedules', 'warning');
      return;
    }
    if (tiles.length === 0) {
      await showDarkAlert('Add at least one tile to the timeline before saving it as a pre-saved schedule.', 'Pre-Saved Schedules', 'warning');
      return;
    }
    const now = new Date().toISOString();
    const existingIndex = presavedSchedules.findIndex(schedule => schedule.name.trim().toLowerCase() === name.toLowerCase());
    const existing = existingIndex >= 0 ? presavedSchedules[existingIndex] : null;
    const nextSchedule: PresavedAcademicSchedule = {
      id: existing?.id || uuidv4(),
      name,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      workStart,
      workEnd,
      tiles: tiles.map(tile => ({ ...tile, id: uuidv4() })),
    };
    const nextSchedules = existingIndex >= 0
      ? presavedSchedules.map((schedule, index) => index === existingIndex ? nextSchedule : schedule)
      : [nextSchedule, ...presavedSchedules];
    persistPresavedSchedules(nextSchedules);
    setPresavedScheduleName('');
    setShowPresavedSchedules(false);
  };

  const handleEditPresavedSchedule = async (schedule: PresavedAcademicSchedule) => {
    if (tiles.length > 0) {
      const ok = await showDarkConfirm(
        'Load this pre-saved academic schedule for editing? This will replace the current Academics timeline.',
        'Edit Pre-Saved Schedule',
        'warning',
      );
      if (!ok) return;
    }
    const editableTiles = schedule.tiles.map(tile => ({ ...tile, id: uuidv4() }));
    setTiles(editableTiles);
    syncSelectedSetsFromTiles(editableTiles);
    setWorkStart(schedule.workStart);
    setWorkEnd(schedule.workEnd);
    setPresavedScheduleName(schedule.name);
    setShowPresavedSchedules(false);
    await showDarkAlert('Pre-saved schedule loaded for editing. Adjust the timeline, then click Save to update this pre-saved schedule.', 'Edit Pre-Saved Schedule', 'info');
  };

  const handleInsertPresavedSchedule = async (schedule: PresavedAcademicSchedule) => {
    if (tiles.length > 0) {
      const ok = await showDarkConfirm(
        'Insert this pre-saved academic schedule into the current timeline? Existing tiles will remain and overlaps may need adjustment.',
        'Insert Pre-Saved Schedule',
        'info',
      );
      if (!ok) return;
    }
    const insertedTiles = schedule.tiles.map(tile => ({ ...tile, id: uuidv4() }));
    const nextTiles = [...tiles, ...insertedTiles].sort((a, b) => a.startTime - b.startTime);
    setTiles(nextTiles);
    syncSelectedSetsFromTiles(nextTiles);
    setWorkStart(schedule.workStart);
    setWorkEnd(schedule.workEnd);
    setShowPresavedSchedules(false);
    await showDarkAlert('Pre-saved schedule inserted. Select the course, attendees, date, classroom and instructor as required, then publish when the academic event is ready.', 'Pre-Saved Schedule Inserted', 'info');
  };

  const handleDeletePresavedSchedule = async (schedule: PresavedAcademicSchedule) => {
    const ok = await showDarkConfirm(`Delete pre-saved academic schedule "${schedule.name}"?`, 'Delete Pre-Saved Schedule', 'warning');
    if (!ok) return;
    persistPresavedSchedules(presavedSchedules.filter(item => item.id !== schedule.id));
  };

  const handleMovePresavedSchedule = (scheduleId: string, direction: -1 | 1) => {
    const index = presavedSchedules.findIndex(schedule => schedule.id === scheduleId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= presavedSchedules.length) return;
    const nextSchedules = [...presavedSchedules];
    [nextSchedules[index], nextSchedules[nextIndex]] = [nextSchedules[nextIndex], nextSchedules[index]];
    persistPresavedSchedules(nextSchedules);
  };

  const removeTimelineTile = useCallback((tileId: string) => {
    const tile = tiles.find(candidate => candidate.id === tileId);
    setTiles(prev => prev.filter(candidate => candidate.id !== tileId));
    setTimelineEditTileId(current => current === tileId ? null : current);
    dragging.current = null;
    resizing.current = null;
    if (!tile) return;
    if (tile.isStandard) {
      setSelectedStandard(prev => { const next = new Set(prev); next.delete(tile.lessonCode); return next; });
    } else {
      setSelectedLessons(prev => { const next = new Set(prev); next.delete(tile.lessonCode); return next; });
    }
  }, [tiles]);

  // Add/remove lesson from timeline
  const toggleLesson = useCallback((item: SyllabusItemDetail) => {
    const key = item.code;
    if (selectedLessons.has(key)) {
      setSelectedLessons(prev => { const s = new Set(prev); s.delete(key); return s; });
      setTiles(prev => prev.filter(t => t.lessonCode !== key));
    } else {
      setSelectedLessons(prev => new Set(prev).add(key));
      const dur = item.duration || 1;
      const start = getNextStart(dur);
      // Avoid duplicate: if eventDescription already starts with the code, use it directly
      const tileLabel = item.eventDescription?.startsWith(key)
        ? item.eventDescription
        : `${key} ${item.eventDescription}`;
      setTiles(prev => [...prev, {
        id: uuidv4(),
        lessonCode: key,
        label: tileLabel,
        startTime: start,
        duration: dur,
        color: getLessonTileColor(key),
      }]);
    }
  }, [selectedLessons, getNextStart]);

  // Add/remove standard event
  const toggleStandard = useCallback(async (ev: AcademicStandardEventConfig) => {
    const key = ev.code;
    const isOtherEvent = key === 'OTHER' || ev.label.trim().toLowerCase() === 'other';
    if (selectedStandard.has(key)) {
      setSelectedStandard(prev => { const s = new Set(prev); s.delete(key); return s; });
      setTiles(prev => prev.filter(t => t.lessonCode !== key));
    } else {
      let label = ev.label;
      if (isOtherEvent) {
        const description = await showDarkPrompt({
          title: 'Other Standard Event',
          message: 'Enter the description to show on the academic schedule tile.',
          inputLabel: 'Description',
          inputPlaceholder: 'Description',
          confirmText: 'Add',
          cancelText: 'Cancel',
          variant: 'info',
        });
        label = String(description || '').trim();
        if (!label) return;
      }
      setSelectedStandard(prev => new Set(prev).add(key));
      const start = getNextStart(ev.duration);
      setTiles(prev => [...prev, {
        id: uuidv4(),
        lessonCode: key,
        label,
        startTime: start,
        duration: ev.duration,
        color: ev.color,
        isStandard: true,
        customDescription: isOtherEvent ? label : undefined,
      }]);
    }
  }, [selectedStandard, getNextStart]);

  // ── Suggestions ──
  const suggestions = useMemo(() => {
    if (!selectedCourse || courseTrainees.length === 0) return [];
    // Find lessons that are not yet complete for most trainees
    return academicSyllabus
      .filter(s => {
        const c = getLessonCompletion(s.code, courseTrainees, scores);
        return c === 'none' || c === 'partial';
      })
      .filter(s => !selectedLessons.has(s.code))
      .slice(0, 6);
  }, [academicSyllabus, courseTrainees, scores, selectedLessons, selectedCourse]);

  // ── Timeline drag ──
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ tileId: string; offsetX: number } | null>(null);
  const resizing = useRef<{ tileId: string; edge: 'start' | 'end' } | null>(null);

  const timelineWidth = () => timelineRef.current?.clientWidth || 800;
  const pixelsPerHour = () => timelineWidth() / (TIMELINE_END - TIMELINE_START);

  const xToTime = (x: number): number => snap(x / pixelsPerHour() + TIMELINE_START);
  const timeToX = (t: number): number => (t - TIMELINE_START) * pixelsPerHour();
  const durationToW = (d: number): number => d * pixelsPerHour();

  const onMouseDownTile = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    if (timelineEditTileId === tileId) return;
    const rect = (e.target as HTMLElement).closest('.acad-tile')?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = e.clientX - rect.left;
    dragging.current = { tileId, offsetX };
  };

  const onTileContextMenu = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTimelineContextMenu({ tileId, x: e.clientX, y: e.clientY });
  };

  const startResizeTile = (e: React.MouseEvent, tileId: string, edge: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setTimelineContextMenu(null);
    setTimelineEditTileId(tileId);
    dragging.current = null;
    resizing.current = { tileId, edge };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    const resizeState = resizing.current;
    if (resizeState && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const pointerTime = xToTime(e.clientX - rect.left);
      const minDuration = 0.25;
      setTiles(prev => prev.map(t => {
        if (t.id !== resizeState.tileId) return t;
        const start = t.startTime;
        const end = t.startTime + t.duration;
        if (resizeState.edge === 'start') {
          const newStart = Math.max(TIMELINE_START, Math.min(pointerTime, end - minDuration));
          return { ...t, startTime: newStart, duration: end - newStart };
        }
        const newEnd = Math.min(TIMELINE_END, Math.max(pointerTime, start + minDuration));
        return { ...t, duration: newEnd - start };
      }));
      return;
    }
    const dragState = dragging.current;
    if (!dragState || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragState.offsetX;
    const newStart = Math.max(TIMELINE_START, Math.min(xToTime(x), TIMELINE_END - 0.25));
    setTiles(prev => prev.map(t =>
      t.id === dragState.tileId ? { ...t, startTime: newStart } : t
    ));
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    resizing.current = null;
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    const closeContextMenu = () => setTimelineContextMenu(null);
    document.addEventListener('click', closeContextMenu);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', closeContextMenu);
    };
  }, [onMouseMove, onMouseUp]);

  // ── Conflict detection (overlap) ──
  const hasConflict = (tile: TimelineTile): boolean => {
    return tiles.some(t =>
      t.id !== tile.id &&
      tile.startTime < t.startTime + t.duration &&
      tile.startTime + tile.duration > t.startTime
    );
  };

  // ── Save ──
  const handleSave = async () => {

    if (!selectedCourse) {
      console.error('🎓 [AcademicsTab.handleSave] ❌ BLOCKED: no selectedCourse');
      await showDarkAlert('Please select a course.', 'Academic Event', 'warning');
      return;
    }
    if (selectedTrainees.length === 0) {
      console.error('🎓 [AcademicsTab.handleSave] ❌ BLOCKED: no selectedTrainees');
      await showDarkAlert('Please select at least one trainee.', 'Academic Event', 'warning');
      return;
    }
    if (tiles.length === 0) {
      console.error('🎓 [AcademicsTab.handleSave] ❌ BLOCKED: no tiles in timeline');
      await showDarkAlert('Please add at least one lesson to the timeline.', 'Academic Event', 'warning');
      return;
    }
    if (!resourceId) {
      console.error('🎓 [AcademicsTab.handleSave] ❌ BLOCKED: no classroom resource selected');
      await showDarkAlert('Please select a configured classroom before saving the academic event.', 'Academic Event', 'warning');
      return;
    }

    const lessons = tiles
      .filter(t => !t.isStandard)
      .map(t => {
        const s = academicSyllabus.find(s => s.code === t.lessonCode);
        return { code: t.lessonCode, description: s?.eventDescription || t.label, duration: t.duration };
      });

    const saveData = {
      lessons,
      timeline: tiles,
      selectedTrainees,
      course: selectedCourse,
      date: selectedDate,
      workStart,
      workEnd,
      resourceId,
      instructor,
      isAcademic: true as const,
    };


    onSave(saveData);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hourMarkers = useMemo(() => {
    const marks = [];
    for (let h = TIMELINE_START; h <= TIMELINE_END; h++) marks.push(h);
    return marks;
  }, []);

  const S = {
    container: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
    card: { backgroundColor: '#1f2937', borderRadius: 8, border: '1px solid #374151', padding: 12 },
    label: { fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 },
    select: { background: '#374151', border: '1px solid #4b5563', borderRadius: 6, color: '#f9fafb', fontSize: 13, padding: '5px 8px', width: '100%' },
    input: { background: '#374151', border: '1px solid #4b5563', borderRadius: 6, color: '#f9fafb', fontSize: 13, padding: '5px 8px', width: '100%' },
    row: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
    checkRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer', userSelect: 'none' as const },
  };

  const renderReadOnlyTimeline = (previewTiles: TimelineTile[], previewWorkStart: number, previewWorkEnd: number) => (
    <div style={{ position: 'relative', height: 80, backgroundColor: '#111827', borderRadius: 6, overflow: 'hidden', userSelect: 'none' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${((previewWorkStart - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
        width: `${((previewWorkEnd - previewWorkStart) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderLeft: '1px dashed #374151',
        borderRight: '1px dashed #374151',
      }} />
      {hourMarkers.map(h => (
        <div key={h} style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${((h - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
          borderLeft: '1px solid #1f2937',
        }}>
          <span style={{ fontSize: 9, color: '#4b5563', paddingLeft: 2, paddingTop: 2, display: 'block' }}>
            {String(h).padStart(2,'0')}
          </span>
        </div>
      ))}
      {previewTiles.map(tile => {
        const left = ((tile.startTime - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100;
        const width = (tile.duration / (TIMELINE_END - TIMELINE_START)) * 100;
        return (
          <div
            key={tile.id}
            title={`${tile.label} — ${fmtTime(tile.startTime)} to ${fmtTime(tile.startTime + tile.duration)}`}
            style={{
              position: 'absolute',
              top: 18,
              height: 52,
              left: `${left}%`,
              width: `max(${width}%, 20px)`,
              backgroundColor: tile.color,
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '2px 5px',
              pointerEvents: 'auto',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tile.label}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
              {fmtTime(tile.startTime)}–{fmtTime(tile.startTime + tile.duration)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={S.container}>
      {/* ── Control Bar ── */}
      <div style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: 10 }}>
        <div>
          <div style={S.label}>Locality</div>
          <select style={S.select} value={selectedLocality} onChange={e => setSelectedLocality(e.target.value)}>
            {localities.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>Course</div>
          <select style={S.select} value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>
            <option value="">-- Select --</option>
            {coursesForLocality.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <div style={{ ...S.label, color: '#93c5fd' }}>Academic LMP</div>
          <select
            style={{ ...S.select, borderColor: '#1d4ed8' }}
            value={selectedAcademicLmp}
            onChange={e => {
              setSelectedAcademicLmp(e.target.value);
              onUpdatePersistedAcademicLmp?.(e.target.value);
              setSelectedLessons(new Set());
              setTiles(prev => prev.filter(t => t.isStandard));
            }}
          >
            <option value="">-- Select LMP --</option>
            {academicLmpCourses.map(c => <option key={c.code} value={c.code}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>Date</div>
          <input type="date" style={S.input} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div>
          <div style={S.label}>Work Start</div>
          <input type="time" style={S.input}
            value={`${String(Math.floor(workStart)).padStart(2,'0')}:${String(Math.round((workStart%1)*60)).padStart(2,'0')}`}
            onChange={e => {
              const [h,m] = e.target.value.split(':').map(Number);
              setWorkStart(h + m / 60);
            }}
          />
        </div>
        <div>
          <div style={S.label}>Work End</div>
          <input type="time" style={S.input}
            value={`${String(Math.floor(workEnd)).padStart(2,'0')}:${String(Math.round((workEnd%1)*60)).padStart(2,'0')}`}
            onChange={e => {
              const [h,m] = e.target.value.split(':').map(Number);
              setWorkEnd(h + m / 60);
            }}
          />
        </div>
      </div>

      {/* ── Main 2-Panel Layout (fixed combined width = timeline) ── */}
      <div style={{ display: 'flex', gap: 10 }}>

        {/* Left Panel: Trainees - fixed width */}
        <div style={{ ...S.card, width: 200, minWidth: 200, maxWidth: 200, maxHeight: 360, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Attendees
            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 10, marginLeft: 6 }}>
              {selectedTrainees.length}/{courseTrainees.length}
            </span>
          </div>
          {courseTrainees.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>Select a course</div>
          )}
          {courseTrainees.map(t => {
            const st = traineeStatuses[t.fullName];
            const checked = selectedTrainees.includes(t.fullName);
            const dotColor = st?.status === 'available' ? '#22c55e' : st?.status === 'paused' ? '#f59e0b' : '#ef4444';
            return (
              <div key={t.fullName} title={st?.reason || ''} style={{ ...S.checkRow }}
                onClick={() => toggleTrainee(t.fullName)}>
                <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: '#38bdf8', width: 14, height: 14 }} />
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor,
                  flexShrink: 0, display: 'inline-block'
                }} />
                <span style={{ fontSize: 12, color: checked ? '#f9fafb' : '#9ca3af', flex: 1 }}>{stripCourse(t.fullName)}</span>
              </div>
            );
          })}
        </div>

        {/* Centre Panel: Lesson Selector + Standard Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ ...S.card, backgroundColor: '#1e3a5f', border: '1px solid #1d4ed8' }}>
              <div style={{ ...S.label, color: '#93c5fd' }}>💡 Suggested Next Lessons</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {suggestions.map(s => (
                  <button key={s.code}
                    onClick={() => toggleLesson(s)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      backgroundColor: selectedLessons.has(s.code) ? '#1d4ed8' : '#1e3a5f',
                      border: `1px solid ${selectedLessons.has(s.code) ? '#3b82f6' : '#1d4ed8'}`,
                      color: '#93c5fd'
                    }}>
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lesson columns by module */}
          <div style={{ ...S.card, maxHeight: 300, overflowY: 'auto', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={S.label}>LMP Lessons</div>
              <span style={{ fontSize: 10, color: '#6b7280' }}>
                Click the event text to schedule it. The checkbox only toggles course completion.
              </span>
            </div>
            {moduleGroups.length === 0 ? (
              <div style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>
                No academic lessons found for this course
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {moduleGroups.map(({ moduleKey, label, items: moduleItems }) => (
                  <div key={moduleKey} style={{
                    minWidth: 190, flexShrink: 0,
                    backgroundColor: '#111827', borderRadius: 6, border: '1px solid #1d4ed8',
                    overflow: 'hidden'
                  }}>
                    {/* Module header */}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: '#bfdbfe',
                      backgroundColor: '#1e3a5f',
                      padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 1
                    }}>{label}</div>
                    {/* Lessons list */}
                    <div style={{ padding: '4px 2px' }}>
                      {moduleItems.map(item => {
                        // Course-level completion: from courseAcademicProgress prop
                        // This is separate from individual training report scores
                        const courseProgress = courseAcademicProgress?.get(selectedCourse);
                        const isCourseDone = courseProgress?.has(item.code) ?? false;
                        const isSelected = selectedLessons.has(item.code);
                        return (
                          <div key={item.code}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 6px',
                              borderRadius: 4,
                              backgroundColor: isSelected ? 'rgba(29,78,216,0.35)' : 'transparent',
                              border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                              marginBottom: 1,
                            }}>
                            {/* Course-level completion toggle button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (onUpdateCourseAcademicProgress && selectedCourse) {
                                  const ok = await showDarkConfirm(
                                    'This checkbox does not schedule the event. It marks the event as complete for the selected course.\n\nDo you want to proceed?',
                                    'Course Completion',
                                    'info'
                                  );
                                  if (!ok) return;
                                  onUpdateCourseAcademicProgress(selectedCourse, item.code, !isCourseDone);
                                }
                              }}
                              title={isCourseDone ? 'Mark as NOT completed by this course' : 'Mark as completed by this course cohort'}
                              style={{
                                background: 'none', border: 'none', cursor: onUpdateCourseAcademicProgress ? 'pointer' : 'default',
                                fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0, padding: 0, marginTop: 0,
                                opacity: onUpdateCourseAcademicProgress ? 1 : 0.6,
                                filter: 'brightness(1.3)',
                              }}
                            >
                              {isCourseDone ? '✅' : '⬜'}
                            </button>
                            {/* Lesson label — click to add to timeline */}
                            <span
                              onClick={() => toggleLesson(item)}
                              style={{
                                fontSize: 11, flex: 1, lineHeight: 1.3, cursor: 'pointer',
                                color: isCourseDone ? '#9ca3af' : isSelected ? '#93c5fd' : '#e5e7eb',
                                textDecoration: isCourseDone ? 'line-through' : 'none',
                              }}>
                              <span style={{ fontWeight: 700, color: isCourseDone ? '#9ca3af' : '#f9fafb', fontSize: 11 }}>{item.code}</span>
                              {item.eventDescription && !item.eventDescription.startsWith(item.code)
                                ? <>{' '}{item.eventDescription}</>
                                : null}
                            </span>
                            {item.duration ? (
                              <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginTop: 1 }}>
                                {item.duration}h
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Standard Events */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <div style={{ ...S.label, marginBottom: 0 }}>Standard Events</div>
              {onNavigateToStandardEventsSettings ? (
                <button
                  type="button"
                  onClick={onNavigateToStandardEventsSettings}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#7dd3fc',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: 0,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  Configure
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {displayedStandardEvents.map(ev => {
                const isSelected = selectedStandard.has(ev.code);
                const isOtherEvent = ev.code === 'OTHER' || ev.label.trim().toLowerCase() === 'other';
                return (
                  <div key={ev.code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => {
                        void toggleStandard(ev);
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', backgroundColor: isSelected ? ev.color : '#374151',
                        border: `1px solid ${isSelected ? ev.color : '#4b5563'}`,
                        color: '#f9fafb', transition: 'all 0.1s'
                      }}>
                      {ev.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={S.label}>Timeline — {fmtTime(workStart)} to {fmtTime(workEnd)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Instructor allocation */}
            {instructors.length > 0 && (
              <>
                <div style={S.label}>{instructorLabel}</div>
                <select style={{ ...S.select, width: 160 }} value={instructor} onChange={e => setInstructor(e.target.value)}>
                  <option value="">— Unallocated —</option>
                  {instructors.map(i => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </>
            )}
            <div style={S.label}>Classroom</div>
            <select style={{ ...S.select, width: 120 }} value={resourceId} onChange={e => setResourceId(e.target.value)}>
              <option value="">— Select —</option>
              {effectiveClassroomOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline ruler + tiles */}
        <div
          ref={timelineRef}
          style={{ position: 'relative', height: 80, backgroundColor: '#111827', borderRadius: 6, overflow: 'hidden', userSelect: 'none' }}
        >
          {/* Working hours shading */}
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((workStart - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
            width: `${((workEnd - workStart) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderLeft: '1px dashed #64748b', borderRight: '1px dashed #64748b',
          }} />

          {/* Hour markers */}
          {hourMarkers.map(h => (
            <div key={h} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${((h - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
              borderLeft: '1px solid rgba(148, 163, 184, 0.42)',
            }}>
              <span style={{ fontSize: 9, color: '#cbd5e1', paddingLeft: 2, paddingTop: 2, display: 'block', fontWeight: 600 }}>
                {String(h).padStart(2,'0')}
              </span>
            </div>
          ))}

          {/* Tiles */}
          {tiles.map(tile => {
            const conflict = hasConflict(tile);
            const isEditingTimelineTile = timelineEditTileId === tile.id;
            const pph = timelineWidth() / (TIMELINE_END - TIMELINE_START);
            const x = (tile.startTime - TIMELINE_START) * pph;
            const w = Math.max(tile.duration * pph - 2, 20);
            return (
              <div
                key={tile.id}
                className="acad-tile"
                onMouseDown={e => onMouseDownTile(e, tile.id)}
                onContextMenu={e => onTileContextMenu(e, tile.id)}
                onDoubleClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditTileId(tile.id);
                  setEditStartTime(fmtTime(tile.startTime));
                  setEditDuration(String(tile.duration));
                }}
                title={`${tile.label} — ${fmtTime(tile.startTime)} to ${fmtTime(tile.startTime + tile.duration)} | Right-click for EDIT`}
                style={{
                  position: 'absolute',
                  top: 18,
                  height: 52,
                  left: x,
                  width: w,
                  backgroundColor: conflict ? '#991b1b' : tile.color,
                  border: isEditingTimelineTile ? '1px solid rgba(125,211,252,0.85)' : conflict ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.2)',
                  boxShadow: isEditingTimelineTile ? '0 0 0 1px rgba(14,165,233,0.22)' : 'none',
                  borderRadius: 4,
                  cursor: isEditingTimelineTile ? 'default' : 'grab',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '2px 5px',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {tile.label}
                </span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>
                  {fmtTime(tile.startTime)}–{fmtTime(tile.startTime + tile.duration)}
                </span>
                {isEditingTimelineTile && (
                  <>
                    <button
                      type="button"
                      aria-label={`Adjust start time for ${tile.label}`}
                      onMouseDown={event => startResizeTile(event, tile.id, 'start')}
                      title="Drag to adjust start time"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        border: 0,
                        padding: 0,
                        cursor: 'ew-resize',
                        background: 'rgba(125,211,252,0.55)',
                        boxShadow: '1px 0 4px rgba(0,0,0,0.25)',
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Adjust end time for ${tile.label}`}
                      onMouseDown={event => startResizeTile(event, tile.id, 'end')}
                      title="Drag to adjust end time"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 5,
                        border: 0,
                        padding: 0,
                        cursor: 'ew-resize',
                        background: 'rgba(125,211,252,0.55)',
                        boxShadow: '-1px 0 4px rgba(0,0,0,0.25)',
                      }}
                    />
                  </>
                )}
              </div>
            );
          })}
          {timelineContextMenu && (
            <div
              onMouseDown={event => event.stopPropagation()}
              onClick={event => event.stopPropagation()}
              style={{
                position: 'fixed',
                left: timelineContextMenu.x,
                top: timelineContextMenu.y,
                zIndex: 9500,
                minWidth: 120,
                border: '1px solid #475569',
                borderRadius: 6,
                background: '#020617',
                boxShadow: '0 16px 36px rgba(0,0,0,0.45)',
                padding: 4,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setTimelineEditTileId(timelineContextMenu.tileId);
                  setTimelineContextMenu(null);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 0,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '8px 10px',
                  textAlign: 'left',
                }}
              >
                Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimelineEditTileId(null);
                  dragging.current = null;
                  resizing.current = null;
                  setTimelineContextMenu(null);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 0,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '8px 10px',
                  textAlign: 'left',
                }}
              >
                De-Select
              </button>
              <button
                type="button"
                onClick={() => {
                  removeTimelineTile(timelineContextMenu.tileId);
                  setTimelineContextMenu(null);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  border: 0,
                  borderRadius: 4,
                  background: 'transparent',
                  color: '#fecaca',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '8px 10px',
                  textAlign: 'left',
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Tile list below timeline */}
        {tiles.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tiles.map(tile => (
              <div key={tile.id} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                backgroundColor: tile.color, borderRadius: 12, fontSize: 11, color: '#fff'
              }}>
                <span>{fmtTime(tile.startTime)} {tile.lessonCode}</span>
                <button
                  onClick={() => removeTimelineTile(tile.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Tile Modal ── */}
      {editTile && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setEditTileId(null)}
        >
          <div
            style={{
              background: '#1e2535', border: '1px solid #334155', borderRadius: 8,
              padding: '20px 24px', minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, color: '#93c5fd', fontSize: 14, marginBottom: 12 }}>
              Edit: {editTile.lessonCode}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ color: '#94a3b8', fontSize: 12 }}>
                Start Time (HH:MM)
                <input
                  type="text"
                  value={editStartTime}
                  onChange={e => setEditStartTime(e.target.value)}
                  placeholder="e.g. 09:00"
                  style={{
                    display: 'block', marginTop: 4, width: '100%',
                    background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                    color: '#fff', padding: '6px 10px', fontSize: 13,
                  }}
                />
              </label>
              <label style={{ color: '#94a3b8', fontSize: 12 }}>
                Duration (hours, e.g. 1.0)
                <input
                  type="number"
                  min="0.25"
                  max="8"
                  step="0.25"
                  value={editDuration}
                  onChange={e => setEditDuration(e.target.value)}
                  style={{
                    display: 'block', marginTop: 4, width: '100%',
                    background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                    color: '#fff', padding: '6px 10px', fontSize: 13,
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setEditTileId(null)}
                style={{
                  padding: '6px 14px', background: 'transparent',
                  border: '1px solid #475569', borderRadius: 4, color: '#94a3b8',
                  cursor: 'pointer', fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Parse HH:MM start time
                  const parts = editStartTime.split(':');
                  const h = parseInt(parts[0] || '0', 10);
                  const m = parseInt(parts[1] || '0', 10);
                  const newStart = snap(h + m / 60);
                  const newDur = Math.max(0.25, parseFloat(editDuration) || 1);
                  setTiles(prev => prev.map(t =>
                    t.id === editTileId ? { ...t, startTime: newStart, duration: newDur } : t
                  ));
                  setEditTileId(null);
                }}
                style={{
                  padding: '6px 14px', background: '#2563eb',
                  border: 'none', borderRadius: 4, color: '#fff',
                  cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pre-Saved Schedules Modal ── */}
      {showPresavedSchedules && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 210,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={() => setShowPresavedSchedules(false)}
        >
          <div
            style={{
              width: 'min(980px, 96vw)', maxHeight: '86vh', overflow: 'hidden',
              background: '#111827', border: '1px solid #334155', borderRadius: 10,
              boxShadow: '0 18px 60px rgba(0,0,0,0.65)', display: 'flex', flexDirection: 'column',
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{presavedScheduleMode === 'save' ? 'Save Academic Schedule' : 'Pre-Saved Schedules'}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                  {presavedScheduleMode === 'save'
                    ? 'Name the current Academics timeline so it can be reused later.'
                    : 'Select a saved Academics timeline to insert into the schedule you are building.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPresavedSchedules(false)}
                style={{ width: 44, height: 40, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#e5e7eb', fontWeight: 800, cursor: 'pointer' }}
              >
                X
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: 20 }}>
              {presavedScheduleMode === 'list' ? (
              <div>
                <div style={S.label}>Saved daily academic schedules</div>
                {presavedSchedules.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {presavedSchedules.map((schedule, scheduleIndex) => {
                      const firstStart = Math.min(...schedule.tiles.map(tile => tile.startTime));
                      const lastEnd = Math.max(...schedule.tiles.map(tile => tile.startTime + tile.duration));
                      const isFirstSchedule = scheduleIndex === 0;
                      const isLastSchedule = scheduleIndex === presavedSchedules.length - 1;
                      return (
                        <div key={schedule.id} style={{ border: '1px solid #334155', borderRadius: 8, background: '#0f172a', padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 800 }}>{schedule.name}</div>
                              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                                {schedule.tiles.length} tile{schedule.tiles.length === 1 ? '' : 's'} | {fmtTime(firstStart)} to {fmtTime(lastEnd)} | Updated {new Date(schedule.updatedAt).toLocaleString()}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                              <div style={{ display: 'flex', gap: 4, paddingRight: 2 }}>
                                <button
                                  type="button"
                                  disabled={isFirstSchedule}
                                  title="Move schedule up"
                                  onClick={() => handleMovePresavedSchedule(schedule.id, -1)}
                                  style={{ border: '1px solid #334155', background: isFirstSchedule ? 'rgba(15,23,42,0.6)' : '#111827', color: isFirstSchedule ? '#475569' : '#cbd5e1', borderRadius: 6, width: 30, height: 32, fontSize: 13, fontWeight: 900, cursor: isFirstSchedule ? 'not-allowed' : 'pointer' }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={isLastSchedule}
                                  title="Move schedule down"
                                  onClick={() => handleMovePresavedSchedule(schedule.id, 1)}
                                  style={{ border: '1px solid #334155', background: isLastSchedule ? 'rgba(15,23,42,0.6)' : '#111827', color: isLastSchedule ? '#475569' : '#cbd5e1', borderRadius: 6, width: 30, height: 32, fontSize: 13, fontWeight: 900, cursor: isLastSchedule ? 'not-allowed' : 'pointer' }}
                                >
                                  ↓
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleEditPresavedSchedule(schedule)}
                                style={{ border: '1px solid rgba(148,163,184,0.45)', background: 'rgba(148,163,184,0.12)', color: '#e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInsertPresavedSchedule(schedule)}
                                style={{ border: '1px solid #38bdf8', background: 'rgba(14,165,233,0.18)', color: '#bae6fd', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Insert
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePresavedSchedule(schedule)}
                                style={{ border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(239,68,68,0.12)', color: '#fecaca', borderRadius: 6, padding: '7px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            {renderReadOnlyTimeline(schedule.tiles, schedule.workStart, schedule.workEnd)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ border: '1px dashed #475569', borderRadius: 8, background: '#0f172a', color: '#94a3b8', padding: 18, fontSize: 13, fontWeight: 600 }}>
                    No pre-saved academic schedules yet.
                  </div>
                )}
              </div>
              ) : (
              <div style={{ border: '1px solid #334155', borderRadius: 8, background: '#0f172a', padding: 14, maxWidth: 520 }}>
                <div style={{ color: '#f8fafc', fontWeight: 800, fontSize: 15 }}>Add Current Timeline</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>
                  Name the current Academics timeline using your own naming convention, then save it for reuse.
                </div>
                <label style={{ display: 'block', marginTop: 12 }}>
                  <span style={S.label}>Schedule name</span>
                  <input
                    value={presavedScheduleName}
                    onChange={event => setPresavedScheduleName(event.target.value)}
                    placeholder="Day 1"
                    style={{ ...S.input, marginTop: 4 }}
                  />
                </label>
                <div style={{ marginTop: 12, color: '#cbd5e1', fontSize: 12, lineHeight: 1.6 }}>
                  Current timeline: <strong>{tiles.length}</strong> tile{tiles.length === 1 ? '' : 's'} | {fmtTime(workStart)} to {fmtTime(workEnd)}
                </div>
                <button
                  type="button"
                  onClick={handleSavePresavedSchedule}
                  style={{ marginTop: 14, width: '100%', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.16)', color: '#bbf7d0', borderRadius: 7, padding: '10px 12px', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}
                >
                  + Add To Pre-Saved Schedules
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 4 }}>
        <button onClick={handleOpenSavePresavedSchedule} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500">
          Save
        </button>
        <button onClick={handleOpenPresavedSchedules} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[11px] font-semibold rounded-md btn-aluminium-brushed text-sky-500">
          Pre-Saved
        </button>
        <button onClick={onClose} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed">
          Cancel
        </button>
        <button onClick={handleSave} className="w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500">
          Publish
        </button>
      </div>
    </div>
  );
};

export default AcademicsTab;
