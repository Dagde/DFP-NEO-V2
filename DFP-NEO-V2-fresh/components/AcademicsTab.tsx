import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { SyllabusItemDetail, Trainee, Score, ScheduleEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

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

interface AcademicsTabProps {
  syllabusDetails: SyllabusItemDetail[];
  allTraineesByCourse: { [course: string]: Trainee[] };
  traineesData: Trainee[];
  scores: Map<string, Score[]>;
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  events: ScheduleEvent[]; // existing events for conflict detection
  date: string;
  courseColors: { [key: string]: string };
  school: 'ESL' | 'PEA';
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
  isAcademic: true;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMELINE_START = 5;  // 05:00
const TIMELINE_END   = 21; // 21:00
const SNAP_MINS      = 5;
const SNAP           = SNAP_MINS / 60;

// Strip course code suffix from fullName (e.g. "Brown, Charles – ADF301" → "Brown, Charles")
// Handles both em-dash (–) and hyphen (-) separators
const stripCourse = (fullName: string): string => {
  // Match " – COURSE" or " - COURSE" at the end (em dash or regular hyphen)
  return fullName.replace(/\s[–—-]\s\S+$/, '').trim();
};

const STANDARD_EVENTS = [
  { code: 'MORNING_BREAK', label: 'Morning Break',    duration: 0.25,  color: '#64748b' },
  { code: 'LUNCH',         label: 'Lunch',            duration: 1.0,   color: '#78716c' },
  { code: 'AFTERNOON_BREAK', label: 'Afternoon Break',duration: 0.25,  color: '#64748b' },
  { code: 'SELF_STUDY',    label: 'Self-Study',       duration: 1.0,   color: '#475569' },
  { code: 'SPORT',         label: 'Sport',            duration: 1.0,   color: '#15803d' },
  { code: 'ADMIN',         label: 'Admin',            duration: 0.5,   color: '#7c3aed' },
  { code: 'FREE_TIME',     label: 'Free Time',        duration: 1.0,   color: '#0f766e' },
  { code: 'OTHER',         label: 'Other',            duration: 1.0,   color: '#b45309' },
];

const ACADEMIC_TILE_COLOR = '#1d4ed8'; // blue-700 for academic lessons

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (dec: number): string => {
  const h = Math.floor(dec);
  const m = Math.round((dec % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const snap = (val: number): number => Math.round(val / SNAP) * SNAP;

// Subject area colour mapping
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
  // If all items share the same module value (e.g. all = "PC-21 Ground School"),
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
  date: string
): { status: 'available' | 'unavailable' | 'paused'; reason?: string } {
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
  defaultLocality,
  onSave,
  onClose,
}) => {
  // ── Control bar state ──
  const localities = useMemo(() => {
    const locs = new Set<string>();
    traineesData.forEach(t => { if (t.location) locs.add(t.location); });
    if (locs.size === 0) locs.add(school === 'ESL' ? 'East Sale' : 'Pearce');
    return Array.from(locs);
  }, [traineesData, school]);

  const [selectedLocality, setSelectedLocality] = useState(() => {
    // Default to the locality currently selected in the header (passed as defaultLocality)
    if (defaultLocality && localities.includes(defaultLocality)) return defaultLocality;
    return localities[0] || '';
  });
  const [selectedDate, setSelectedDate] = useState(date);
  const [workStart, setWorkStart] = useState(8);
  const [workEnd, setWorkEnd]   = useState(17);
  const [otherText, setOtherText] = useState('');
  const [resourceId, setResourceId] = useState(''); // blank by default

  // Courses filtered by locality
  const coursesForLocality = useMemo(() => {
    const courses = new Set<string>();
    traineesData.forEach(t => {
      if (!selectedLocality || t.location === selectedLocality || localities.length <= 1) {
        courses.add(t.course);
      }
    });
    return Array.from(courses).sort();
  }, [traineesData, selectedLocality, localities]);

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

  const traineeStatuses = useMemo(() =>
    courseTrainees.reduce((acc, t) => {
      acc[t.fullName] = getTraineeStatus(t, events, selectedDate);
      return acc;
    }, {} as Record<string, { status: 'available' | 'unavailable' | 'paused'; reason?: string }>),
    [courseTrainees, events, selectedDate]
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

  const toggleTrainee = (name: string) => {
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
      const confirmed = window.confirm(
        `⚠️ ${stripCourse(name)} is ${statusLabel}\n\n${reason}\n\nDo you still want to include them in this academic session?`
      );
      if (!confirmed) return;
    }
    setSelectedTrainees(prev => [...prev, name]);
  };

  // ── Academic LMP courses (from syllabusDetails where type === 'Academics') ──
  const academicLmpCourses = useMemo(() => {
    // Find all unique course codes from syllabus items of type 'Academics' or Ground School (non-CPT)
    const courseCodeSet = new Set<string>();
    syllabusDetails.forEach(s => {
      if (s.type === 'Academics' || (s.type === 'Ground School' && !s.methodOfDelivery?.includes('CPT'))) {
        (s.courses || []).forEach(c => courseCodeSet.add(c));
      }
    });
    // Build list with display titles: use module field of first matching item as title
    return Array.from(courseCodeSet).map(code => {
      const firstItem = syllabusDetails.find(s =>
        (s.type === 'Academics' || (s.type === 'Ground School' && !s.methodOfDelivery?.includes('CPT'))) &&
        s.courses?.includes(code)
      );
      // module field holds the full course title (e.g. "PC-21 Ground School")
      const title = firstItem?.module?.trim() || code;
      return { code, title };
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [syllabusDetails]);

  const [selectedAcademicLmp, setSelectedAcademicLmp] = useState<string>('');

  // Auto-select first academic LMP course on load
  useEffect(() => {
    if (academicLmpCourses.length > 0 && !selectedAcademicLmp) {
      setSelectedAcademicLmp(academicLmpCourses[0].code);
    }
  }, [academicLmpCourses, selectedAcademicLmp]);

  // ── Academic syllabus filtered by selected Academic LMP course ──
  const academicSyllabus = useMemo(() => {
    if (!selectedAcademicLmp) return [];
    return syllabusDetails.filter(s =>
      (s.type === 'Academics' || (s.type === 'Ground School' && !s.methodOfDelivery?.includes('CPT'))) &&
      s.courses?.includes(selectedAcademicLmp)
    );
  }, [syllabusDetails, selectedAcademicLmp]);

  const moduleGroups = useMemo(() => groupByModule(academicSyllabus), [academicSyllabus]);

  // ── Timeline tiles ──
  const [tiles, setTiles] = useState<TimelineTile[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [selectedStandard, setSelectedStandard] = useState<Set<string>>(new Set());

  // Next available time on timeline (after last tile, within working hours)
  const getNextStart = useCallback((newDuration: number) => {
    if (tiles.length === 0) return workStart;
    const lastEnd = Math.max(...tiles.map(t => t.startTime + t.duration));
    const proposed = snap(lastEnd);
    if (proposed + newDuration > TIMELINE_END) return snap(workStart);
    return proposed;
  }, [tiles, workStart]);

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
      setTiles(prev => [...prev, {
        id: uuidv4(),
        lessonCode: key,
        label: `${key}: ${item.eventDescription}`,
        startTime: start,
        duration: dur,
        color: ACADEMIC_TILE_COLOR,
      }]);
    }
  }, [selectedLessons, getNextStart]);

  // Add/remove standard event
  const toggleStandard = useCallback((ev: typeof STANDARD_EVENTS[0]) => {
    const key = ev.code;
    if (selectedStandard.has(key)) {
      setSelectedStandard(prev => { const s = new Set(prev); s.delete(key); return s; });
      setTiles(prev => prev.filter(t => t.lessonCode !== key));
    } else {
      setSelectedStandard(prev => new Set(prev).add(key));
      const label = key === 'OTHER' ? (otherText || 'Other') : ev.label;
      const start = getNextStart(ev.duration);
      setTiles(prev => [...prev, {
        id: uuidv4(),
        lessonCode: key,
        label,
        startTime: start,
        duration: ev.duration,
        color: ev.color,
        isStandard: true,
        customDescription: key === 'OTHER' ? otherText : undefined,
      }]);
    }
  }, [selectedStandard, getNextStart, otherText]);

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

  const timelineWidth = () => timelineRef.current?.clientWidth || 800;
  const pixelsPerHour = () => timelineWidth() / (TIMELINE_END - TIMELINE_START);

  const xToTime = (x: number): number => snap(x / pixelsPerHour() + TIMELINE_START);
  const timeToX = (t: number): number => (t - TIMELINE_START) * pixelsPerHour();
  const durationToW = (d: number): number => d * pixelsPerHour();

  const onMouseDownTile = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).closest('.acad-tile')?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = e.clientX - rect.left;
    dragging.current = { tileId, offsetX };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.current.offsetX;
    const newStart = Math.max(TIMELINE_START, Math.min(xToTime(x), TIMELINE_END - 0.25));
    setTiles(prev => prev.map(t =>
      t.id === dragging.current!.tileId ? { ...t, startTime: newStart } : t
    ));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
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
  const handleSave = () => {
    if (!selectedCourse) { alert('Please select a course.'); return; }
    if (selectedTrainees.length === 0) { alert('Please select at least one trainee.'); return; }
    if (tiles.length === 0) { alert('Please add at least one lesson to the timeline.'); return; }

    const lessons = tiles
      .filter(t => !t.isStandard)
      .map(t => {
        const s = academicSyllabus.find(s => s.code === t.lessonCode);
        return { code: t.lessonCode, description: s?.eventDescription || t.label, duration: t.duration };
      });

    onSave({
      lessons,
      timeline: tiles,
      selectedTrainees,
      course: selectedCourse,
      date: selectedDate,
      workStart,
      workEnd,
      resourceId,
      isAcademic: true,
    });
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

      {/* ── Main 3-Panel Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10 }}>

        {/* Left Panel: Trainees */}
        <div style={{ ...S.card, maxHeight: 360, overflowY: 'auto' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

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
          <div style={{ ...S.card, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <div style={S.label}>LMP Lessons</div>
              <span style={{ fontSize: 10, color: '#6b7280' }}>
                ✅ = course complete &nbsp;🟡 = in progress &nbsp;⬜ = not started
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
                    minWidth: 180, flexShrink: 0,
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
                        // Course-level completion: complete = ALL trainees done, partial = some done, none = none done
                        const completion = getLessonCompletion(item.code, courseTrainees, scores);
                        const isSelected = selectedLessons.has(item.code);
                        // Strikethrough completed lessons to indicate they are done at course level
                        const isCourseDone = completion === 'complete';
                        return (
                          <div key={item.code}
                            onClick={() => toggleLesson(item)}
                            title={isCourseDone ? 'All trainees in this course have completed this lesson' : completion === 'partial' ? 'Some trainees have completed this lesson' : 'Not yet completed by this course'}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 5, padding: '3px 6px',
                              cursor: 'pointer', borderRadius: 4,
                              backgroundColor: isSelected ? 'rgba(29,78,216,0.35)' : 'transparent',
                              border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                              marginBottom: 1,
                            }}>
                            {/* Course-level completion indicator */}
                            <span style={{ fontSize: 11, width: 16, textAlign: 'center', flexShrink: 0, marginTop: 1 }}>
                              {completion === 'complete' ? '✅' : completion === 'partial' ? '🟡' : '⬜'}
                            </span>
                            <span style={{
                              fontSize: 11, flex: 1, lineHeight: 1.3,
                              color: isCourseDone ? '#6b7280' : isSelected ? '#93c5fd' : '#d1d5db',
                              textDecoration: isCourseDone ? 'line-through' : 'none',
                            }}>
                              <span style={{ fontWeight: 700, color: isCourseDone ? '#6b7280' : '#f9fafb', fontSize: 10 }}>{item.code}</span>
                              {' '}{item.eventDescription}
                            </span>
                            {item.duration ? (
                              <span style={{ fontSize: 10, color: '#4b5563', flexShrink: 0, marginTop: 1 }}>
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
            <div style={S.label}>Standard Events</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STANDARD_EVENTS.map(ev => {
                const isSelected = selectedStandard.has(ev.code);
                return (
                  <div key={ev.code} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => {
                        if (ev.code === 'OTHER' && !otherText && !isSelected) return;
                        toggleStandard(ev);
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', backgroundColor: isSelected ? ev.color : '#374151',
                        border: `1px solid ${isSelected ? ev.color : '#4b5563'}`,
                        color: '#f9fafb', transition: 'all 0.1s'
                      }}>
                      {ev.label}
                    </button>
                    {ev.code === 'OTHER' && !isSelected && (
                      <input
                        type="text"
                        placeholder="Description..."
                        value={otherText}
                        onChange={e => setOtherText(e.target.value)}
                        style={{ ...S.input, width: 120, fontSize: 11 }}
                      />
                    )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={S.label}>Classroom</div>
            <select style={{ ...S.select, width: 120 }} value={resourceId} onChange={e => setResourceId(e.target.value)}>
              <option value="">— Select —</option>
              {Array.from({ length: 6 }, (_, i) => `Ground ${i + 1}`).map(g => (
                <option key={g} value={g}>{g}</option>
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
            borderLeft: '1px dashed #374151', borderRight: '1px dashed #374151',
          }} />

          {/* Hour markers */}
          {hourMarkers.map(h => (
            <div key={h} style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${((h - TIMELINE_START) / (TIMELINE_END - TIMELINE_START)) * 100}%`,
              borderLeft: '1px solid #1f2937',
            }}>
              <span style={{ fontSize: 9, color: '#4b5563', paddingLeft: 2, paddingTop: 2, display: 'block' }}>
                {String(h).padStart(2,'0')}
              </span>
            </div>
          ))}

          {/* Tiles */}
          {tiles.map(tile => {
            const conflict = hasConflict(tile);
            const pph = timelineWidth() / (TIMELINE_END - TIMELINE_START);
            const x = (tile.startTime - TIMELINE_START) * pph;
            const w = Math.max(tile.duration * pph - 2, 20);
            return (
              <div
                key={tile.id}
                className="acad-tile"
                onMouseDown={e => onMouseDownTile(e, tile.id)}
                title={`${tile.label} — ${fmtTime(tile.startTime)} to ${fmtTime(tile.startTime + tile.duration)}`}
                style={{
                  position: 'absolute',
                  top: 18,
                  height: 52,
                  left: x,
                  width: w,
                  backgroundColor: conflict ? '#991b1b' : tile.color,
                  border: conflict ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 4,
                  cursor: 'grab',
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
              </div>
            );
          })}
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
                  onClick={() => {
                    setTiles(prev => prev.filter(t => t.id !== tile.id));
                    if (!tile.isStandard) {
                      setSelectedLessons(prev => { const s = new Set(prev); s.delete(tile.lessonCode); return s; });
                    } else {
                      setSelectedStandard(prev => { const s = new Set(prev); s.delete(tile.lessonCode); return s; });
                    }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 4 }}>
        <button onClick={onClose} className="w-[90px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed">
          Cancel
        </button>
        <button onClick={handleSave} className="w-[120px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500">
          Save Academic Session
        </button>
      </div>
    </div>
  );
};

export default AcademicsTab;