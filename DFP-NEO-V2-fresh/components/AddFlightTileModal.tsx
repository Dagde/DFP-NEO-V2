import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { loadUserPreferences, saveUserPreference } from '../utils/userPreferencesService';
import { ScheduleEvent, SyllabusItemDetail, Trainee, Instructor, Score } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AddFlightTileModalProps {
  onClose: () => void;
  onSave: (events: ScheduleEvent[]) => void;
  instructors: string[];
  trainees: string[];
  syllabusDetails: SyllabusItemDetail[];
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
  instructorsData: Instructor[];
  courseColors: { [key: string]: string };
  date: string;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  scores?: Map<string, Score[]>;
  locationOpAreas?: Record<string, string[]>;
  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];
  userId?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (time: number): string => {
  const hours = Math.floor(time);
  const minutes = Math.round((time % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDate = (dateStr: string): string => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
};

// Rank sort order for instructors
const RANK_ORDER: Record<string, number> = {
  WGCDR: 1, SQNLDR: 2, FLTLT: 3, FLGOFF: 4, PLTOFF: 5, Mr: 6,
};

// ─── Scale constants for the large interactive tile ─────────────────────────
//
// Strategy: mirror the EXACT layout of FlightTile.tsx (the real schedule tile)
// but scale everything up proportionally.
//
// Real tile: rowHeight ≈ 34px, scaledFontSize = 11px
// Modal tile target: ~3× scale factor
//   Names font:   11px × 3 = 33px  (NAME_FONT)
//   Time font:    11 × 0.75 × 3 = 25px  (TIME_FONT)
//   Right font:   11 × 0.9 × 3 = 30px   ([dur] EVENT)
//   Bottom font:  11 × 0.85 × 3 = 28px  (#aircraft, area, callsign)
//   V padding:    4px × 3 = 12px
//   H padding:    8px × 3 = 24px (10% of tile width ≈ left indent for names)
//   Bottom strip height: 11px × 3 = 33px (bottom-1 of real tile)
//
// The tile height is NOT hardcoded — it's determined by content (flexbox),
// just like the real tile which gets height from rowHeight prop.
// We add enough bottom padding so the bottom-strip doesn't overlap names.
//
const SCALE       = 3.2;
const NAME_FONT   = Math.round(11 * SCALE);   // 35px — both PIC and co-pilot name
const TIME_FONT   = Math.round(11 * 0.75 * SCALE); // 26px — time top-left
const RIGHT_FONT  = Math.round(11 * 0.9 * SCALE);  // 32px — [dur] EVENT top-right
const BOT_FONT    = Math.round(11 * 0.85 * SCALE);  // 30px — bottom strip
const PAD_H       = Math.round(8 * SCALE);    // 26px — left/right padding
const PAD_TOP     = Math.round(4 * SCALE);    // 13px — top padding
const PAD_BOT     = BOT_FONT + Math.round(6 * SCALE); // bottom padding = bottom strip height + gap
const TILE_RADIUS = Math.round(4 * SCALE);    // 13px — border radius

// Inline select / input style — invisible, sits on top of rendered text
const ghostStyle = (
  fontSize: number,
  color: string,
  width: number | string,
  fontWeight: number = 400,
  fontStyle: 'normal' | 'italic' = 'normal',
  mono: boolean = false,
  textAlign: 'left' | 'right' | 'center' = 'left',
): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none' as any,
  WebkitAppearance: 'none' as any,
  MozAppearance: 'none' as any,
  fontFamily: mono
    ? 'ui-monospace, SFMono-Regular, "Courier New", monospace'
    : 'inherit',
  fontWeight,
  fontStyle,
  fontSize,
  color,
  width: typeof width === 'number' ? `${width}px` : width,
  padding: 0,
  margin: 0,
  lineHeight: 1.2,
  textAlign,
});

// ─── Convert Tailwind bg class to rgba matching FlightTile.tsx rendering ────
// Uses the same TAILWIND_COLORS palette and alpha mapping as FlightTile.tsx
// so the Add Flight Tile preview matches the actual schedule tile appearance.
const twClassToRgba = (cls: string): string => {
  const TAILWIND_COLORS: Record<string, Record<string, [number, number, number]>> = {
    sky:     { '400': [56,189,248],   '500': [14,165,233] },
    purple:  { '400': [192,132,252],  '500': [168,85,247] },
    yellow:  { '400': [250,204,21],   '500': [234,179,8] },
    pink:    { '400': [244,114,182],  '500': [236,72,153] },
    teal:    { '400': [45,212,191],   '500': [20,184,166] },
    indigo:  { '400': [129,140,248],  '500': [99,102,241] },
    cyan:    { '400': [34,211,238],   '500': [6,182,212] },
    blue:    { '400': [96,165,250],   '500': [59,130,246] },
    green:   { '400': [74,222,128],   '500': [34,197,94] },
    orange:  { '400': [251,146,60],   '500': [249,115,22] },
    red:     { '400': [248,113,113],  '500': [239,68,68],  '800': [153,27,27], '900': [127,29,29] },
    gray:    { '400': [156,163,175],  '500': [107,114,128],'600': [75,85,99] },
    amber:   { '400': [251,191,36],   '500': [245,158,11], '700': [180,83,9] },
    fuchsia: { '400': [232,121,249],  '500': [217,70,239] },
    lime:    { '400': [163,230,53],   '500': [132,204,22] },
    violet:  { '400': [167,139,250],  '500': [139,92,246] },
    rose:    { '400': [251,113,133],  '500': [244,63,94] },
    emerald: { '400': [52,211,153],   '500': [16,185,129] },
  };
  if (!cls || !cls.startsWith('bg-')) return 'rgba(107,114,128,0.57)'; // gray fallback
  const match = cls.match(/^bg-([a-z]+)-(\d+)(?:\/(\d+))?$/);
  if (!match) return 'rgba(107,114,128,0.57)';
  const [, colorName, shade, opacityStr] = match;
  const rgb = TAILWIND_COLORS[colorName]?.[shade];
  if (!rgb) return 'rgba(107,114,128,0.57)';
  const opacity = opacityStr ? parseInt(opacityStr, 10) : 100;
  let alpha: number;
  if (opacity >= 75) alpha = 0.57;
  else if (opacity >= 45) alpha = 0.42;
  else if (opacity >= 30) alpha = 0.35;
  else alpha = (opacity / 100) * 0.7;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
};
// Keep twClassToHex as an alias for backward-compat
const twClassToHex = twClassToRgba;

// ─── Cascading dropdown for Person selection (3 layers: Unit→Staff/Course→Names) ─
interface PersonDropdownProps {
  value: string;
  displayValue?: string;  // optional display label (e.g. "Davies, Mary (ADF301)") — if omitted, value is shown
  onChange: (name: string, callsigns: string[]) => void;
  allUnits: string[];
  getLayer2: (unit: string) => string[];
  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
  placeholder: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  allowSolo?: boolean;    // shows SOLO as first option
  onSoloSelect?: () => void;
  dropdownZIndex?: number; // z-index for the portal dropdown (default 9000)
  dropdownId?: string;     // unique id for portal element (default 'person-dropdown-portal')
}

const PersonDropdown: React.FC<PersonDropdownProps> = ({
  value, displayValue, onChange, allUnits, getLayer2, getNames,
  placeholder, fontSize, color, bold = false, allowSolo, onSoloSelect,
  dropdownZIndex = 9000,
  dropdownId = 'person-dropdown-portal',
}) => {
  const [open, setOpen] = useState(false);
  const [hovUnit, setHovUnit] = useState<string | null>(null);
  const [hovL2, setHovL2] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also check if click was inside the portal dropdown
        const portalEl = document.getElementById(dropdownId);
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownId]);

  const handleOpen = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // Store viewport-relative coords (BoundingClientRect is already viewport-relative, use directly with position:fixed)
      const DROPDOWN_WIDTH = 520;
      const left = Math.min(rect.left, window.innerWidth - DROPDOWN_WIDTH - 8);
      setDropdownPos({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setOpen(o => !o);
  };

  // Portal dropdown rendered at document.body level
  const dropdownPanel = open ? ReactDOM.createPortal(
    <div
      id={dropdownId}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: dropdownZIndex,
        display: 'flex',
        width: 520,
        maxHeight: 300,
        backgroundColor: '#1a2f4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      {/* Col 1: Units */}
      <div style={{ width: 110, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#1a2f4a' }}>
        {allowSolo && (
          <div
            onClick={() => { onSoloSelect?.(); setOpen(false); }}
            style={{ padding: '9px 12px', color: '#ffd43b', fontWeight: 700, fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,212,59,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            SOLO
          </div>
        )}
        {allUnits.map(unit => (
          <div
            key={unit}
            onMouseEnter={() => { setHovUnit(unit); setHovL2(null); }}
            onClick={() => setHovUnit(unit)}
            style={{
              padding: '9px 12px', fontSize: 13, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: hovUnit === unit ? '#fff' : 'rgba(255,255,255,0.8)',
              backgroundColor: hovUnit === unit ? 'rgba(255,255,255,0.12)' : 'transparent',
            }}
          >
            {unit}
            <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>
          </div>
        ))}
      </div>

      {/* Col 2: STAFF / Courses */}
      <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: '#16293f' }}>
        {hovUnit ? (
          getLayer2(hovUnit).map(opt => (
            <div
              key={opt}
              onMouseEnter={() => setHovL2(opt)}
              onClick={() => setHovL2(opt)}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: opt === 'STAFF' ? 600 : 400,
                color: hovL2 === opt ? '#fff' : 'rgba(255,255,255,0.8)',
                backgroundColor: hovL2 === opt ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {opt}
              <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            Select unit
          </div>
        )}
      </div>

      {/* Col 3: Names */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: '#122437' }}>
        {hovUnit && hovL2 ? (
          getNames(hovUnit, hovL2).map(person => (
            <div
              key={person.name}
              onClick={() => {
                onChange(person.name, []);
                setOpen(false);
                setHovUnit(null);
                setHovL2(null);
              }}
              style={{
                padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                color: person.color || '#fff',
                backgroundColor: 'transparent',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {person.label}
            </div>
          ))
        ) : (
          <div style={{ padding: '16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            {hovUnit ? 'Select category' : 'Select unit'}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleOpen}
        style={{
          fontSize,
          fontWeight: bold ? 700 : 400,
          fontStyle: 'italic',
          color,
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 120,
          padding: '2px 4px',
          borderRadius: 3,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {displayValue || value || placeholder}
      </div>
      {dropdownPanel}
    </div>
  );
};

// ─── Event (syllabus) cascading dropdown (2 layers: Course→Events) ─────────
interface EventDropdownProps {
  value: string;
  onChange: (code: string, durationHrs?: number) => void;
  courseOptions: string[];
  getEventsForCourse: (course: string) => SyllabusItemDetail[];
  nextLMPEvent: SyllabusItemDetail | null;
  fontSize: number;
  color: string;
  disabled?: boolean;
}

const EventDropdown: React.FC<EventDropdownProps> = ({
  value, onChange, courseOptions, getEventsForCourse, nextLMPEvent,
  fontSize, color, disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [hovCourse, setHovCourse] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const portalEl = document.getElementById('event-dropdown-portal');
        if (portalEl && portalEl.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      // right-align the dropdown to the trigger element
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(o => !o);
  };

  const dropdownPanel = open && !disabled ? ReactDOM.createPortal(
    <div
      id="event-dropdown-portal"
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        right: dropdownPos.right,
        zIndex: 9000,
        display: 'flex',
        width: 400,
        maxHeight: 320,
        backgroundColor: '#1a2f4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.18)',
      }}
    >
      {/* Col 1: Courses */}
      <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 320, backgroundColor: '#1a2f4a' }}>
        {courseOptions.map(course => (
          <div
            key={course}
            onMouseEnter={() => setHovCourse(course)}
            onClick={() => {
              if (course === 'SCT') {
                onChange('SCT');
                setOpen(false);
              }
            }}
            style={{
              padding: '9px 12px', fontSize: 13, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: hovCourse === course ? '#fff' : 'rgba(255,255,255,0.8)',
              backgroundColor: hovCourse === course ? 'rgba(255,255,255,0.12)' : 'transparent',
              fontWeight: course === 'SCT' ? 600 : 400,
            }}
          >
            {course}
            {course !== 'SCT' && <span style={{ fontSize: 9, opacity: 0.5 }}>▶</span>}
          </div>
        ))}
      </div>

      {/* Col 2: Events */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, backgroundColor: '#16293f' }}>
        {hovCourse && hovCourse !== 'SCT' ? (
          getEventsForCourse(hovCourse).map(ev => {
            const code = ev.code || ev.id || '';
            const isNext = nextLMPEvent && (nextLMPEvent.code === code || nextLMPEvent.id === code);
            return (
              <div
                key={code}
                onClick={() => {
                  onChange(code, ev.flightOrSimHours || ev.duration || undefined);
                  setOpen(false);
                  setHovCourse(null);
                }}
                style={{
                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                  color: isNext ? '#22c55e' : '#fff',
                  backgroundColor: isNext ? 'rgba(34,197,94,0.12)' : 'transparent',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isNext ? 'rgba(34,197,94,0.12)' : 'transparent')}
                title={ev.eventDescription || code}
              >
                <span>{code}</span>
                {isNext && <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 6 }}>NEXT</span>}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12, textAlign: 'center' }}>
            {hovCourse === 'SCT' ? 'SCT selected' : 'Hover a course'}
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={handleOpen}
        style={{
          fontSize,
          fontStyle: 'italic',
          fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
          color,
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          minWidth: 80,
          padding: '2px 4px',
          borderRadius: 3,
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        {value || 'EVENT'}
      </div>
      {dropdownPanel}
    </div>
  );
};


// ─── Large Interactive Flight Tile ─────────────────────────────────────────
// Layout mirrors real FlightTile.tsx exactly:
//  - Outer wrapper: position:relative, paddingBottom large enough for bottom strip
//  - Time: absolute top-0 left, tiny monospace (same as real tile)
//  - Body: flex row — left column (PIC + co-pilot stacked) + right column ([dur] EVENT)
//  - Bottom strip: absolute bottom, left (#aircraft) and right (area + callsign)
//  - Height is content-driven (flexbox), never hardcoded
interface TileProps {
  flightType: 'Dual' | 'Solo';
  startTime: number;
  picName: string;
  studentName: string;
  duration: number;
  flightNumber: string;
  area: string;
  aircraftNumber: string;
  callsign: string;
  color: string;
  // options
  timeOptions: { value: string; label: string }[];
  durationOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  aircraftOptions: { value: string; label: string }[];
  callsignOptions: string[];
  formationCallsigns?: { name: string; code: string; unit: string; location: string; locationCode: string }[];
  // cascading dropdown helpers
  allUnits: string[];
  getLayer2: (unit: string) => string[];
  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
  getDisplayLabel: (name: string) => string;  // returns "Name – Course" for trainees, "Name" for staff
  // event dropdown helpers
  courseOptions: string[];
  getEventsForCourse: (course: string) => SyllabusItemDetail[];
  nextLMPEvent: SyllabusItemDetail | null;
  eventCategory: string;
  // change handlers
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
  onStartTimeChange: (v: number) => void;
  onPicNameChange: (name: string, callsigns: string[]) => void;
  onStudentNameChange: (name: string) => void;
  onDurationChange: (v: number) => void;
  onFlightNumberChange: (code: string, durationHrs?: number) => void;
  onAreaChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
  onCallsignChange: (v: string) => void;
  // lifted layout state (owned by AddFlightTileModal)
  editMode: boolean;
  layoutSaved: boolean;
  positions: Record<string, { x: number; y: number }>;
  savedPositions: Record<string, { x: number; y: number }>;
  onEnterEditMode: () => void;
  onExitEditMode: (save: boolean) => void;
  onDragPosition: (key: string, pos: { x: number; y: number }) => void;
}

const FlightTile: React.FC<TileProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, aircraftNumber, callsign, color,
  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,
  formationCallsigns,
  allUnits, getLayer2, getNames, getDisplayLabel,
  courseOptions, getEventsForCourse, nextLMPEvent, eventCategory,
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,
  editMode, layoutSaved, positions, savedPositions,
  onEnterEditMode, onExitEditMode, onDragPosition,
}) => {
  // ── Design constants ──────────────────────────────────────────────────
  const TILE_BG    = '#7a6a2a';
  const TILE_BORDER= '#1a2340';
  const WHITE_FULL = 'rgba(255,255,255,0.95)';
  const WHITE_DIM  = 'rgba(255,255,255,0.75)';
  const WHITE_GHOST= 'rgba(255,255,255,0.35)';
  const TILE_H     = 110;
  const monoFamily = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft' | 'callsign';

  // Default positions — used for first render and after Cancel
  const DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 12 },
    picName:   { x: 110, y: 14 },
    coPilot:   { x: 110, y: 58 },
    duration:  { x: 420, y: 10 },
    event:     { x: 490, y: 10 },
    area:      { x: 490, y: 62 },
    aircraft:  { x: 420, y: 62 },
    callsign:  { x: 530, y: 62 },
  };

  // ── State ──────────────────────────────────────────────────────────────
  // Layout state is LIFTED to AddFlightTileModal — received via props:
  //   editMode, layoutSaved, positions, savedPositions
  //   onEnterEditMode, onExitEditMode, onDragPosition

  const tileRef   = useRef<HTMLDivElement>(null);
  const elemRefs  = useRef<Partial<Record<ElemKey, HTMLDivElement | null>>>({});
  const dragging  = useRef<{ key: ElemKey; startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);

  // When entering edit mode, capture the real DOM positions of each element
  const enterEditMode = () => {
    // Capture current DOM positions if no layout saved yet, then delegate to parent
    if (!layoutSaved && tileRef.current) {
      const tileRect = tileRef.current.getBoundingClientRect();
      const measuredPos: Record<string, { x: number; y: number }> = { ...DEFAULT_POSITIONS };
      (Object.keys(elemRefs.current) as ElemKey[]).forEach(key => {
        const el = elemRefs.current[key];
        if (el) {
          const r = el.getBoundingClientRect();
          measuredPos[key] = {
            x: Math.round(r.left - tileRect.left),
            y: Math.round(r.top  - tileRect.top),
          };
        }
      });
      // Push measured positions to parent before entering edit mode
      (Object.keys(measuredPos) as ElemKey[]).forEach(k =>
        onDragPosition(k, measuredPos[k])
      );
    }
    onEnterEditMode();
  };

  const exitEditMode = (save: boolean) => {
    onExitEditMode(save);
  };

  // Mouse drag handlers
  const onMouseDown = (key: ElemKey) => (e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    dragging.current = {
      key,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: positions[key].x,
      startPosY: positions[key].y,
    };
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !tileRef.current) return;
      const { key, startMouseX, startMouseY, startPosX, startPosY } = dragging.current;
      const tileRect = tileRef.current.getBoundingClientRect();
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      const newX = Math.max(0, Math.min(tileRect.width  - 20, startPosX + dx));
      const newY = Math.max(0, Math.min(TILE_H - 20, startPosY + dy));
      onDragPosition(key, { x: Math.round(newX), y: Math.round(newY) });
    };
    const onMouseUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [editMode, positions]);

  // ── Oval wrapper ──────────────────────────────────────────────────────
  const Oval: React.FC<{
    children: React.ReactNode;
    style?: React.CSSProperties;
    minW?: number; px?: number; py?: number;
  }> = ({ children, style, minW = 0, px = 10, py = 5 }) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 50, padding: `${py}px ${px}px`,
      minWidth: minW, boxSizing: 'border-box', lineHeight: 1, ...style,
    }}>
      {children}
    </div>
  );

  // ── Absolutely-positioned element (used in both edit mode and saved layout) ──
  const AbsElem: React.FC<{
    elemKey: ElemKey;
    children: React.ReactNode;
    draggable?: boolean;
  }> = ({ elemKey, children, draggable: isDraggable = false }) => {
    const pos = (editMode ? positions : savedPositions)[elemKey];
    return (
      <div
        ref={el => { elemRefs.current[elemKey] = el; }}
        onMouseDown={isDraggable ? onMouseDown(elemKey) : undefined}
        style={{
          position: 'absolute',
          left: pos.x,
          top:  pos.y,
          cursor: isDraggable ? 'grab' : 'default',
          zIndex: isDraggable ? 100 : 5,
          outline: isDraggable ? '2px dashed rgba(255,220,60,0.9)' : 'none',
          outlineOffset: isDraggable ? 3 : 0,
          borderRadius: 4,
          padding: isDraggable ? 2 : 0,
          userSelect: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
        title={isDraggable ? 'Drag to reposition' : undefined}
      >
        {children}
      </div>
    );
  };

  // ── Flex ref wrapper (used in normal non-saved layout) ────────────────
  const FlexElem: React.FC<{ elemKey: ElemKey; children: React.ReactNode; style?: React.CSSProperties }> = ({ elemKey, children, style }) => (
    <div ref={el => { elemRefs.current[elemKey] = el; }} style={{ display: 'inline-flex', ...style }}>
      {children}
    </div>
  );

  // ── All element content definitions ──────────────────────────────────
  const startTimeContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={12} py={6} minW={72}>
        <span style={{ fontFamily: monoFamily, fontSize: 22, fontWeight: 600, color: WHITE_FULL, lineHeight: 1, letterSpacing: 1 }}>
          {formatTime(startTime)}
        </span>
      </Oval>
      <select value={String(startTime)} onChange={e => onStartTimeChange(parseFloat(e.target.value))}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const picNameContent = () => (
    <PersonDropdown value={picName} onChange={onPicNameChange} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
      placeholder="Surname, First (N)" fontSize={30} color={picName ? WHITE_FULL : WHITE_GHOST} bold
      dropdownId="pic-dropdown-portal" />
  );

  const coPilotContent = () => {
    if (eventCategory === 'twr_di') {
      return <span style={{ fontSize: 22, color: WHITE_DIM, lineHeight: 1.25 }}>TWR DI</span>;
    }
    return flightType === 'Dual' ? (
      <PersonDropdown value={studentName} onChange={(name) => onStudentNameChange(name)} allUnits={allUnits} getLayer2={getLayer2} getNames={getNames}
        placeholder="Surname, First (N)" fontSize={22} color={studentName ? WHITE_DIM : WHITE_GHOST} allowSolo onSoloSelect={() => onFlightTypeChange('Solo')}
        dropdownId="copilot-dropdown-portal" />
    ) : (
      <span onClick={() => onFlightTypeChange('Dual')}
        style={{ display: 'inline-block', fontSize: 18, fontWeight: 800, letterSpacing: 1, color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)', padding: '3px 10px', borderRadius: 4, lineHeight: 1.25, cursor: 'pointer' }}
        title="Click to switch to Dual">SOLO</span>
    );
  };

  const durationContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={58}>
        <span style={{ fontFamily: monoFamily, fontSize: 18, fontWeight: 700, color: WHITE_FULL, lineHeight: 1 }}>[{duration.toFixed(1)}]</span>
      </Oval>
      <select value={String(duration)} onChange={e => onDurationChange(parseFloat(e.target.value))}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const eventContent = () => {
    const displayEvent = eventCategory === 'twr_di' ? 'TWR DI' : flightNumber;
    return (
      <div style={{ position: 'relative' }}>
        <Oval px={10} py={5} minW={58}>
          <span style={{ fontSize: 18, color: displayEvent ? WHITE_FULL : WHITE_GHOST, lineHeight: 1 }}>
            {displayEvent || 'EVENT'}
          </span>
        </Oval>
      </div>
    );
  };

  const areaContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <Oval px={10} py={5} minW={42}>
        <span style={{ fontSize: 18, fontWeight: 600, color: /^[A-H]$/.test(area) ? WHITE_FULL : 'rgba(255,220,60,0.95)', lineHeight: 1 }}>{area || '-'}</span>
      </Oval>
      <select value={area} onChange={e => onAreaChange(e.target.value)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const aircraftContent = (zOverride?: number) => (
    <div style={{ position: 'relative' }}>
      <span style={{ fontFamily: monoFamily, fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>#{aircraftNumber || '001'}</span>
      <select value={aircraftNumber} onChange={e => onAircraftChange(e.target.value)}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10 }}>
        {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
      </select>
    </div>
  );

  const callsignContent = (zOverride?: number) => (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {/* Editable text input — always visible and typeable */}
      <input
        type="text"
        value={callsign}
        onChange={e => onCallsignChange(e.target.value)}
        placeholder="CALLSGN"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontFamily: monoFamily, fontSize: 18, fontStyle: 'italic', lineHeight: 1,
          color: callsign ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.30)',
          width: callsignOptions.length > 0 ? 70 : 80, padding: 0, cursor: 'text',
        }}
      />
      {/* Dropdown arrow + overlay select — only when options are available */}
      {callsignOptions.length > 0 && (
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', pointerEvents: 'none', lineHeight: 1 }}>▼</span>
          <select
            value={callsign}
            onChange={e => onCallsignChange(e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              opacity: 0, cursor: 'pointer', zIndex: zOverride ?? 10,
            }}
          >
            <option value="" style={{ background: '#1a2f4a' }}>— select —</option>
            {callsignOptions.map(cs => (
              <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  // ── Normal flex layout (before any save) ─────────────────────────────
  const normalFlexLayout = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 14, paddingRight: 10, flex: 1, minWidth: 0, gap: 14 }}>
        <FlexElem elemKey="startTime" style={{ position: 'relative', flexShrink: 0, marginTop: -15 }}>
          {startTimeContent()}
        </FlexElem>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <FlexElem elemKey="picName">{picNameContent()}</FlexElem>
          <FlexElem elemKey="coPilot">{coPilotContent()}</FlexElem>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', paddingRight: 16, paddingLeft: 8, paddingTop: 10, paddingBottom: 10, flexShrink: 0, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlexElem elemKey="duration">{durationContent()}</FlexElem>
          <FlexElem elemKey="event">{eventContent()}</FlexElem>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlexElem elemKey="area">{areaContent()}</FlexElem>
          <FlexElem elemKey="aircraft">{aircraftContent()}</FlexElem>
          <FlexElem elemKey="callsign">{callsignContent()}</FlexElem>
        </div>
      </div>
    </>
  );

  // ── Saved layout (absolute, positions from savedPositions) ────────────
  const savedAbsLayout = (
    <>
      <AbsElem elemKey="startTime">{startTimeContent()}</AbsElem>
      <AbsElem elemKey="picName">{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot">{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration">{durationContent()}</AbsElem>
      <AbsElem elemKey="event">{eventContent()}</AbsElem>
      <AbsElem elemKey="area">{areaContent()}</AbsElem>
      <AbsElem elemKey="aircraft">{aircraftContent()}</AbsElem>
      <AbsElem elemKey="callsign">{callsignContent()}</AbsElem>
    </>
  );

  // ── Edit layout (absolute, draggable, positions from positions state) ─
  const editAbsLayout = (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 1, pointerEvents: 'none' }} />
      <AbsElem elemKey="startTime" draggable>{startTimeContent(110)}</AbsElem>
      <AbsElem elemKey="picName"   draggable>{picNameContent()}</AbsElem>
      <AbsElem elemKey="coPilot"   draggable>{coPilotContent()}</AbsElem>
      <AbsElem elemKey="duration"  draggable>{durationContent(110)}</AbsElem>
      <AbsElem elemKey="event"     draggable>{eventContent()}</AbsElem>
      <AbsElem elemKey="area"      draggable>{areaContent(110)}</AbsElem>
      <AbsElem elemKey="aircraft"  draggable>{aircraftContent(110)}</AbsElem>
      <AbsElem elemKey="callsign"  draggable>{callsignContent(110)}</AbsElem>
    </>
  );

  const showAbsolute = editMode || layoutSaved;

  return (
    <div style={{ width: '100%' }}>
      {/* EDIT / SAVE / CANCEL buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
        {!editMode ? (
          <button type="button" onClick={enterEditMode}
            style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', letterSpacing: 0.5 }}>
            ✎ EDIT LAYOUT
          </button>
        ) : (
          <>
            <button type="button" onClick={() => exitEditMode(false)}
              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(255,100,100,0.5)', background: 'rgba(200,50,50,0.25)', color: 'rgba(255,180,180,0.95)', cursor: 'pointer' }}>
              ✕ CANCEL
            </button>
            <button type="button" onClick={() => exitEditMode(true)}
              style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid rgba(60,200,100,0.5)', background: 'rgba(30,150,60,0.35)', color: 'rgba(120,255,160,0.95)', cursor: 'pointer' }}>
              ✔ SAVE LAYOUT
            </button>
          </>
        )}
      </div>

      {/* Tile */}
      <div ref={tileRef}
        style={{
          position: 'relative',
          width: '100%',
          height: TILE_H,
          backgroundColor: twClassToHex(color),
          border: editMode ? `3px solid rgba(255,220,60,0.7)` : `3px solid ${TILE_BORDER}`,
          borderRadius: 10,
          boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
          userSelect: 'none',
          overflow: 'visible',
          boxSizing: 'border-box',
          display: showAbsolute ? 'block' : 'flex',
          alignItems: showAbsolute ? undefined : 'stretch',
        }}
      >
        {editMode ? editAbsLayout : layoutSaved ? savedAbsLayout : normalFlexLayout}
      </div>

      {editMode && (
        <p style={{ fontSize: 11, color: 'rgba(255,220,60,0.75)', marginTop: 6, textAlign: 'center', letterSpacing: 0.3 }}>
          Drag any element to reposition it · Click SAVE LAYOUT to lock positions
        </p>
      )}
    </div>
  );
};// ─── Main Modal ───────────────────────────────────────────────────────────────
const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({
  onClose, onSave, instructors, trainees, syllabusDetails, school,
  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,
  locationOpAreas = {},
  formationCallsigns = [],
  userId,
}) => {
  const [eventCategory, setEventCategory] = useState<'lmp_event'|'lmp_currency'|'sct'|'staff_cat'|'twr_di'>('lmp_event');
  const [flightType,    setFlightType]    = useState<'Dual'|'Solo'>('Dual');
  const [picName,       setPicName]       = useState('');
  const [studentName,   setStudentName]   = useState('');
  const [flightNumber,  setFlightNumber]  = useState('');
  const [startTime,     setStartTime]     = useState(8.0);
  const [duration,      setDuration]      = useState(1.2);
  const [area,          setArea]          = useState('');
  const [aircraftNumber,setAircraftNumber]= useState('001');
  const [locationType,  setLocationType]  = useState<'Local'|'Land Away'>('Local');
  const [callsign,      setCallsign]      = useState('');
  const [callsignOptions, setCallsignOptions] = useState<string[]>([]);
  const [notes,         setNotes]         = useState('');
  const [errors,        setErrors]        = useState<string[]>([]);
  const [isDeploy,      setIsDeploy]      = useState(false);
  const [deploymentStartDate,  setDeploymentStartDate]  = useState(date);
  const [deploymentStartTime,  setDeploymentStartTime]  = useState('08:00');
  const [deploymentEndDate,    setDeploymentEndDate]    = useState(date);
  const [deploymentEndTime,    setDeploymentEndTime]    = useState('08:00');
  const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(1);

  // ── Tile Layout State (lifted here so it survives modal re-renders) ─────────────
  type ElemKey = 'startTime' | 'picName' | 'coPilot' | 'duration' | 'event' | 'area' | 'aircraft' | 'callsign';
  const LAYOUT_ELEM_KEYS: ElemKey[] = ['startTime','picName','coPilot','duration','event','area','aircraft','callsign'];
  const MODAL_DEFAULT_POSITIONS: Record<ElemKey, { x: number; y: number }> = {
    startTime: { x: 14,  y: 12 },
    picName:   { x: 110, y: 14 },
    coPilot:   { x: 110, y: 58 },
    duration:  { x: 420, y: 10 },
    event:     { x: 490, y: 10 },
    area:      { x: 490, y: 62 },
    aircraft:  { x: 420, y: 62 },
    callsign:  { x: 530, y: 62 },
  };
  const LAYOUT_PREF_KEY = 'flightTileLayout_v1';

  // Helper: validate a positions object has all required keys
  const isValidPositions = (posData: any): posData is Record<ElemKey, { x: number; y: number }> => {
    return posData && typeof posData === 'object' &&
      LAYOUT_ELEM_KEYS.every((k: ElemKey) => posData[k] && typeof posData[k].x === 'number');
  };

  // Helper: read from localStorage fallback
  const readLocalLayout = (): Record<ElemKey, { x: number; y: number }> | null => {
    try {
      const raw = localStorage.getItem(LAYOUT_PREF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.positions && isValidPositions(parsed.positions)) return parsed.positions;
      }
    } catch { /* ignore */ }
    return null;
  };

  // Helper: write to localStorage fallback
  const writeLocalLayout = (pos: Record<ElemKey, { x: number; y: number }>) => {
    try { localStorage.setItem(LAYOUT_PREF_KEY, JSON.stringify({ positions: pos })); } catch { /* ignore */ }
  };

  // Initialise from localStorage immediately (synchronous, no flash)
  const _localInit = readLocalLayout();
  const [tileEditMode,      setTileEditMode]      = useState(false);
  const [tileLayoutSaved,   setTileLayoutSaved]   = useState(_localInit !== null);
  const [tilePositions,     setTilePositions]     = useState<Record<ElemKey, { x: number; y: number }>>(_localInit ?? MODAL_DEFAULT_POSITIONS);
  const [tileSavedPositions,setTileSavedPositions]= useState<Record<ElemKey, { x: number; y: number }>>(_localInit ?? MODAL_DEFAULT_POSITIONS);

  // Load from DB when userId is available — DB is authoritative over localStorage
  useEffect(() => {
    if (!userId) {
      console.log('[TileLayout] No userId available — using localStorage only');
      return;
    }
    console.log('[TileLayout] Loading layout from DB for userId:', userId);
    loadUserPreferences(userId).then(prefs => {
      const stored = prefs[LAYOUT_PREF_KEY];
      if (stored && typeof stored === 'object' && 'positions' in stored) {
        const posData = stored.positions as Record<ElemKey, { x: number; y: number }>;
        if (isValidPositions(posData)) {
          console.log('[TileLayout] Restored layout from DB');
          setTilePositions(posData);
          setTileSavedPositions(posData);
          setTileLayoutSaved(true);
          writeLocalLayout(posData); // keep localStorage in sync
        }
      } else {
        console.log('[TileLayout] No layout found in DB');
      }
    }).catch(err => console.warn('[TileLayout] DB load failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Handlers passed down to FlightTile
  const handleEnterEditMode = () => setTileEditMode(true);

  const handleExitEditMode = (save: boolean) => {
    if (save) {
      setTileSavedPositions({ ...tilePositions });
      setTileLayoutSaved(true);
      // Write to localStorage immediately (synchronous — no flash on next open)
      writeLocalLayout(tilePositions);
      // Write to DB (async — authoritative store)
      if (userId) {
        console.log('[TileLayout] Saving layout to DB for userId:', userId);
        saveUserPreference(userId, LAYOUT_PREF_KEY, { positions: tilePositions })
          .then(ok => console.log('[TileLayout] DB save result:', ok))
          .catch(err => console.warn('[TileLayout] DB save failed:', err));
      } else {
        console.warn('[TileLayout] No userId — layout saved to localStorage only');
      }
    } else {
      setTilePositions({ ...tileSavedPositions });
    }
    setTileEditMode(false);
  };

  const handleDragPosition = (key: string, pos: { x: number; y: number }) => {
    setTilePositions(prev => ({ ...prev, [key]: pos }));
  };

  // ── Determine the current location full name from school ──────────────────
  const locationFullName = school === 'ESL' ? 'East Sale' : 'Pearce';

  // ── Op Areas for this location ────────────────────────────────────────────
  const opAreas = useMemo(() => {
    const areas = locationOpAreas[locationFullName];
    if (areas && areas.length > 0) return areas;
    // fallback defaults
    if (school === 'ESL') return ['A','B','C','D','E','F','G','H','S','T','U','V','W','X','Y','Z'];
    return ['-'];
  }, [locationOpAreas, locationFullName, school]);

  // Set default area from opAreas
  useEffect(() => {
    setArea(opAreas[0] || '-');
  }, [opAreas]);

  const areaOptions = useMemo(() => opAreas.map(a => ({ value: a, label: a })), [opAreas]);

  // ── Aircraft options ──────────────────────────────────────────────────────
  const aircraftOptions = useMemo(() =>
    Array.from({ length: 49 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return { value: n, label: n };
    }), []);

  // ── Time options (06:00–23:45, 15-min intervals) ──────────────────────────
  const timeOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let h = 6; h <= 23; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = h + m / 60;
        opts.push({ value: String(val), label: formatTime(val) });
      }
    }
    return opts;
  }, []);

  // ── Duration options (0.3–4.0, 0.1 steps) ────────────────────────────────
  const durationOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let d = 0.3; d <= 4.01; d = Math.round((d + 0.1) * 10) / 10) {
      opts.push({ value: String(d), label: d.toFixed(1) });
    }
    return opts;
  }, []);

  // ── All units ─────────────────────────────────────────────────────────────
  const allUnits = useMemo(() => {
    const s = new Set<string>();
    instructorsData.forEach(i => s.add(i.unit || 'Unassigned'));
    traineesData.forEach(t => s.add(t.unit || 'Unassigned'));
    return Array.from(s).sort();
  }, [instructorsData, traineesData]);

  // ── Layer 2: STAFF or course list for a unit ──────────────────────────────
  const getLayer2 = (unit: string): string[] => {
    const opts: string[] = [];
    if (instructorsData.some(i => (i.unit || 'Unassigned') === unit)) opts.push('STAFF');
    const courses = new Set<string>();
    traineesData.forEach(t => { if ((t.unit || 'Unassigned') === unit && t.course) courses.add(t.course); });
    opts.push(...Array.from(courses).sort());
    return opts;
  };

  // ── Layer 3: Names for unit+selection ────────────────────────────────────
  // Staff sorted by rank order then alphabetically; trainees coloured by course
  const getNames = (unit: string, selection: string): { name: string; label: string; color?: string }[] => {
    if (selection === 'STAFF') {
      return instructorsData
        .filter(i => (i.unit || 'Unassigned') === unit)
        .sort((a, b) => {
          const ra = RANK_ORDER[a.rank] ?? 99;
          const rb = RANK_ORDER[b.rank] ?? 99;
          if (ra !== rb) return ra - rb;
          return a.name.localeCompare(b.name);
        })
        .map(i => ({
          name: i.name,
          label: `${i.rank ? i.rank + ' ' : ''}${i.name}`,
          color: '#fff',
        }));
    }
    // Trainee course — sort alphabetically, colour by course
    return traineesData
      .filter(t => (t.unit || 'Unassigned') === unit && t.course === selection)
      .sort((a, b) => (a.fullName || a.name).localeCompare(b.fullName || b.name))
      .map(t => {
        // courseColors stores Tailwind class like 'bg-sky-500'; extract a CSS colour hint
        const twClass = courseColors[t.course] || '';
        // Map common Tailwind colours to readable hex for dropdown text
        const colourMap: Record<string, string> = {
          'bg-sky-500': '#38bdf8', 'bg-sky-400': '#38bdf8',
          'bg-violet-500': '#8b5cf6', 'bg-purple-500': '#a855f7',
          'bg-emerald-500': '#10b981', 'bg-green-500': '#22c55e',
          'bg-rose-500': '#f43f5e', 'bg-red-500': '#ef4444',
          'bg-amber-500': '#f59e0b', 'bg-yellow-500': '#eab308',
          'bg-orange-500': '#f97316', 'bg-teal-500': '#14b8a6',
          'bg-cyan-500': '#06b6d4', 'bg-pink-500': '#ec4899',
          'bg-indigo-500': '#6366f1', 'bg-blue-500': '#3b82f6',
          'bg-lime-500': '#84cc16', 'bg-fuchsia-500': '#d946ef',
        };
        const textColor = colourMap[twClass] || '#fff';
        return {
          name: t.fullName || t.name,
          label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}${t.course ? ' (' + t.course + ')' : ''}`,
          color: textColor,
        };
      });
  };

  // ── Tile colour from trainee course ──────────────────────────────────────
  // ── Helper: get display label for a person (name + course if trainee) ────────
  const getDisplayLabel = (name: string): string => {
    if (!name) return '';
    const trainee = traineesData.find(t => (t.fullName || t.name) === name);
    if (trainee && trainee.course) return `${name} – ${trainee.course}`;
    return name;
  };

  const tileColor = useMemo(() => {
    // SCT events are always grey
    if (eventCategory === 'sct') return 'bg-gray-500';
    // Staff CAT / TWR DI - no trainee involved, use grey
    if (eventCategory === 'staff_cat' || eventCategory === 'twr_di') return 'bg-gray-500';
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-gray-500';
    const t = traineesData.find(t => (t.fullName || t.name) === name);
    // If the person found is not a trainee (i.e. instructor in solo), use grey
    if (!t) return 'bg-gray-500';
    return (t.course && courseColors[t.course]) || 'bg-gray-500';
  }, [picName, studentName, flightType, traineesData, courseColors, eventCategory]);

  // ── Syllabus by course (for event dropdown) ───────────────────────────────
  const syllabusByCourse = useMemo(() => {
    const grouped = new Map<string, SyllabusItemDetail[]>();
    const flightItems = syllabusDetails.filter(d =>
      d.type === 'Flight' || d.type === 'flight' ||
      (!d.type && !d.id?.includes('FTD') && !d.id?.includes('CPT'))
    );
    flightItems.forEach(item => {
      (item.courses || []).forEach(course => {
        if (!grouped.has(course)) grouped.set(course, []);
        grouped.get(course)!.push(item);
      });
      if (!item.courses || item.courses.length === 0) {
        if (!grouped.has('Other')) grouped.set('Other', []);
        grouped.get('Other')!.push(item);
      }
    });
    // Natural sort within each course
    const natSort = (a: string, b: string) => {
      const parse = (s: string) => { const m = s.match(/^([A-Za-z]*)(\d*)$/); return { l: (m?.[1] || s).toUpperCase(), n: m?.[2] ? parseInt(m[2]) : 0 }; };
      const ap = parse(a), bp = parse(b);
      const lc = ap.l.localeCompare(bp.l);
      return lc !== 0 ? lc : ap.n - bp.n;
    };
    grouped.forEach((items, c) => grouped.set(c, items.sort((a, b) => natSort(a.code || a.id || '', b.code || b.id || ''))));
    return grouped;
  }, [syllabusDetails]);

  const courseOptions = useMemo(() => {
    const courses = Array.from(syllabusByCourse.keys()).sort();
    return ['SCT', ...courses.filter(c => c !== 'SCT')];
  }, [syllabusByCourse]);

  const getEventsForCourse = (course: string): SyllabusItemDetail[] =>
    course === 'SCT' ? [] : (syllabusByCourse.get(course) || []);

  // ── Next LMP event for the selected trainee ───────────────────────────────
  const nextLMPEvent = useMemo(() => {
    if (eventCategory !== 'lmp_event') return null;
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !traineeLMPs) return null;
    const lmp = traineeLMPs.get(name);
    if (!lmp?.length) return null;
    const done = new Set((scores?.get(name) || []).map(s => s.event));
    const isFlight = (item: SyllabusItemDetail) =>
      item.type === 'Flight' || item.type === 'flight' ||
      (!item.type && !item.id?.includes('FTD') && !item.id?.includes('CPT') && !item.id?.includes('GS'));
    for (const item of lmp) {
      if (!isFlight(item) || item.isRemedial) continue;
      if (done.has(item.id) || done.has(item.code)) continue;
      if (item.prerequisites.every(p => done.has(p))) return item;
    }
    return lmp.find(item => isFlight(item) && !done.has(item.id) && !done.has(item.code)) || null;
  }, [picName, studentName, flightType, traineeLMPs, scores, eventCategory]);

  // ── Auto-fill callsign from PIC profile + formation callsigns for same unit ──────────
  // Helper: build callsign string from callsignNumber + school prefix (ESL=ROLR, PEA=VIPR)
  const buildCallsignFromNumber = (num: number | undefined | null): string => {
    if (!num || num <= 0) return '';
    const prefix = school === 'ESL' ? 'ROLR' : 'VIPR';
    return `${prefix}${num}`;
  };

  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }

    // Determine PIC's unit (for filtering formation callsigns)
    let picUnit: string | null = null;

    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      picUnit = inst.unit || null;
      // Build callsign: prefer explicit callsign string, fall back to callsignNumber + school prefix
      const primary   = inst.callsign || buildCallsignFromNumber((inst as any).callsignNumber) || '';
      const secondary = inst.secondaryCallsign || '';
      const personal  = [primary, secondary].filter(Boolean);
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(primary || (allOpts[0] || ''));
      return;
    }

    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      picUnit = (trainee as any).unit || null;
      const cs = trainee.traineeCallsign || buildCallsignFromNumber((trainee as any).callsignNumber) || '';
      const personal = cs ? [cs] : [];
      // Add formation callsigns that belong to the same unit as the PIC
      const formation = (formationCallsigns || []).filter(fc => fc.unit && picUnit && fc.unit === picUnit).map(fc => fc.name || fc.code).filter(Boolean);
      const allOpts   = [...new Set([...personal, ...formation])];
      setCallsignOptions(allOpts);
      setCallsign(cs || (allOpts[0] || ''));
      return;
    }

    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData, formationCallsigns, school]);

  // ── Auto-set duration from selected LMP event ─────────────────────────────
  // (handled in onFlightNumberChange handler — see handleFlightNumberChange below)

  // ── Reset on category change ──────────────────────────────────────────────
  useEffect(() => {
    setPicName(''); setStudentName(''); setFlightNumber('');
    setStartTime(8.0); setDuration(1.2);
    setArea(opAreas[0] || '-'); setAircraftNumber('001');
    setCallsign(''); setCallsignOptions([]); setNotes(''); setErrors([]);
  }, [eventCategory]);

  useEffect(() => {
    if (eventCategory === 'sct' || eventCategory === 'twr_di') setFlightType('Solo');
    else setFlightType('Dual');
  }, [eventCategory]);

  useEffect(() => {
    if (eventCategory === 'lmp_currency') setFlightNumber('CURR');
  }, [eventCategory]);

  // ── Set sortie type from LMP item when event chosen ───────────────────────
  useEffect(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(name);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (item?.sortieType) setFlightType(item.sortieType as 'Dual'|'Solo');
  }, [picName, studentName, flightNumber, traineeLMPs]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFlightNumberChange = (code: string, durationHrs?: number) => {
    setFlightNumber(code);
    if (durationHrs && durationHrs > 0) setDuration(durationHrs);
  };

  const handlePicNameChange = (name: string) => {
    setPicName(name);
  };

  const handleSave = () => {
    const errs: string[] = [];
    if (isDeploy) {
      if (!deploymentStartDate || !deploymentStartTime || !deploymentEndDate || !deploymentEndTime)
        errs.push('Deployment start/end date and time are required.');
    } else {
      if (!flightNumber) errs.push('Syllabus event is required.');
      if (flightType === 'Dual' && !picName) errs.push('Instructor / PIC is required for Dual flights.');
      if (flightType === 'Dual' && !studentName) errs.push('Co-Pilot / Student is required for Dual flights.');
      if (flightType === 'Solo' && !picName) errs.push('Pilot is required for Solo flights.');
      if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    }
    if (errs.length > 0) { setErrors(errs); return; }

    const eventsToSave: ScheduleEvent[] = [];

    if (!isDeploy) {
      eventsToSave.push({
        id: uuidv4(),
        date,
        type: 'flight',
        eventCategory,
        flightType,
        flightNumber,
        instructor: flightType === 'Dual' ? picName : '',
        student: flightType === 'Dual' ? studentName : '',
        pilot: picName,
        startTime,
        duration,
        area,
        aircraftNumber,
        callsign,
        locationType,
        color: tileColor,
        resourceId: '',
        notes,
        group: '',
        groupTraineeIds: [],
        attendees: [],
        origin: '',
        destination: '',
      } as any);
    } else {
      // Deployment tiles
      const parseHrs = (t: string) => { const [h,m] = t.split(':').map(Number); return h + m/60; };
      const dStart = parseHrs(deploymentStartTime);
      const dEnd   = parseHrs(deploymentEndTime);
      const dayDiff = Math.floor((new Date(deploymentEndDate).getTime() - new Date(deploymentStartDate).getTime()) / 86400000);
      const deployDur = Math.max(1, dayDiff * 24 + (dEnd - dStart));
      for (let i = 0; i < deploymentAircraftCount; i++) {
        eventsToSave.push({
          id: `deployment-${uuidv4()}-${i}`,
          date,
          type: 'deployment',
          startTime: dStart,
          duration: deployDur,
          resourceId: '',
          color: 'bg-gray-600/30',
          flightNumber: 'DEPLOYMENT',
          flightType: 'Dual',
          locationType: 'Land Away',
          origin: 'DEPLOY', destination: 'DEPLOY',
          instructor: '', student: '', pilot: '',
          isDeploy: true,
          deploymentStartDate, deploymentStartTime,
          deploymentEndDate, deploymentEndTime,
          deploymentAircraftCount,
        } as any);
      }
    }

    onSave(eventsToSave);
    onClose();
  };

  const categoryLabels: Record<string, string> = {
    lmp_event: 'LMP Event', lmp_currency: 'LMP Currency',
    sct: 'SCT', staff_cat: 'Staff CAT', twr_di: 'TWR DI',
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 flex flex-col"
        style={{ width: '90vw', maxWidth: 720, maxHeight: '95vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">Add Flight Tile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ minHeight: 0 }}>

          {/* Event Category */}
          {!isDeploy && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Category</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <button
                    key={key} type="button"
                    onClick={() => setEventCategory(key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      eventCategory === key
                        ? 'bg-sky-600 text-white ring-2 ring-sky-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Large Flight Tile */}
          {!isDeploy && (
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Flight Tile</label>
              <div style={{ padding: '0 2px' }}>
                <FlightTile
                  flightType={flightType}
                  startTime={startTime}
                  picName={picName}
                  studentName={studentName}
                  duration={duration}
                  flightNumber={flightNumber}
                  area={area}
                  aircraftNumber={aircraftNumber}
                  callsign={callsign}
                  color={tileColor}
                  timeOptions={timeOptions}
                  durationOptions={durationOptions}
                  areaOptions={areaOptions}
                  aircraftOptions={aircraftOptions}
                  callsignOptions={callsignOptions}
                  formationCallsigns={formationCallsigns}
                  editMode={tileEditMode}
                  layoutSaved={tileLayoutSaved}
                  positions={tilePositions}
                  savedPositions={tileSavedPositions}
                  onEnterEditMode={handleEnterEditMode}
                  onExitEditMode={handleExitEditMode}
                  onDragPosition={handleDragPosition}
                  allUnits={allUnits}
                  getLayer2={getLayer2}
                  getNames={getNames}
                  getDisplayLabel={getDisplayLabel}
                  courseOptions={courseOptions}
                  getEventsForCourse={getEventsForCourse}
                  nextLMPEvent={nextLMPEvent}
                  eventCategory={eventCategory}
                  onFlightTypeChange={setFlightType}
                  onStartTimeChange={setStartTime}
                  onPicNameChange={handlePicNameChange}
                  onStudentNameChange={setStudentName}
                  onDurationChange={setDuration}
                  onFlightNumberChange={handleFlightNumberChange}
                  onAreaChange={setArea}
                  onAircraftChange={setAircraftNumber}
                  onCallsignChange={setCallsign}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Click any field on the tile to edit. Names open a cascading dropdown. Duration & Event are in the top-right. Click SOLO badge to switch to Dual.
              </p>
            </div>
          )}

          {/* Deployment checkbox + fields */}
          <div className="border-t border-gray-700 pt-4">
            <label className="flex items-center gap-2 cursor-pointer py-2 mb-3">
              <input
                type="checkbox"
                checked={isDeploy}
                onChange={e => { setIsDeploy(e.target.checked); if (e.target.checked) setLocationType('Land Away'); }}
                className="h-5 w-5 accent-sky-500 bg-gray-600 rounded border-gray-500"
              />
              <span className="text-sm text-white">Add Deployment Tile</span>
            </label>

            {isDeploy && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4 border border-gray-600">
                <h4 className="text-sm font-semibold text-white mb-3">Deployment Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input type="date" value={deploymentStartDate} onChange={e => setDeploymentStartDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Time (24hr)</label>
                    <input type="time" value={deploymentStartTime} onChange={e => setDeploymentStartTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input type="date" value={deploymentEndDate} onChange={e => setDeploymentEndDate(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Time (24hr)</label>
                    <input type="time" value={deploymentEndTime} onChange={e => setDeploymentEndTime(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Aircraft Count</label>
                    <input type="number" min="1" max="10" value={deploymentAircraftCount}
                      onChange={e => setDeploymentAircraftCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Flight type toggle + Location + Date + Notes — hidden when deploying */}
            {!isDeploy && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Flight Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFlightType('Dual')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${flightType === 'Dual' ? 'bg-sky-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        Dual
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlightType('Solo')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition-colors ${flightType === 'Solo' ? 'bg-amber-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        Solo
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                    <select
                      value={locationType}
                      onChange={e => setLocationType(e.target.value as 'Local'|'Land Away')}
                      className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500"
                    >
                      <option value="Local">Local</option>
                      <option value="Land Away">Land Away</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                    <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-gray-300 text-sm font-mono">
                      {formatDate(date)}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes..."
                    className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              {errors.map((e, i) => <p key={i} className="text-red-300 text-sm">• {e}</p>)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-[1px] px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-[90px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="w-[90px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed text-green-500"
          >
            Add to Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFlightTileModal;