import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// ─── Cascading dropdown for Person selection (3 layers: Unit→Staff/Course→Names) ─
interface PersonDropdownProps {
  value: string;
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
}

const PersonDropdown: React.FC<PersonDropdownProps> = ({
  value, onChange, allUnits, getLayer2, getNames,
  placeholder, fontSize, color, bold = false, allowSolo, onSoloSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [hovUnit, setHovUnit] = useState<string | null>(null);
  const [hovL2, setHovL2] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
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
        {value || placeholder}
      </div>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 2000,
            display: 'flex',
            width: 520,
            maxHeight: 300,
            backgroundColor: '#1a2f4a',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            marginTop: 4,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* Col 1: Units */}
          <div style={{ width: 110, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300 }}>
            {allowSolo && (
              <div
                onClick={() => { onSoloSelect?.(); setOpen(false); }}
                style={{
                  padding: '9px 12px', color: '#ffd43b', fontWeight: 700, fontSize: 13,
                  cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.12)',
                  backgroundColor: 'transparent',
                }}
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
          <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.1)' }}>
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
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, backgroundColor: 'rgba(0,0,0,0.2)' }}>
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
        </div>
      )}
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => { if (!disabled) setOpen(o => !o); }}
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

      {open && !disabled && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 2000,
            display: 'flex',
            width: 400,
            maxHeight: 320,
            backgroundColor: '#1a2f4a',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            marginTop: 4,
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* Col 1: Courses */}
          <div style={{ width: 130, borderRight: '1px solid rgba(255,255,255,0.12)', overflowY: 'auto', maxHeight: 320 }}>
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
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, backgroundColor: 'rgba(0,0,0,0.15)' }}>
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
        </div>
      )}
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
  // cascading dropdown helpers
  allUnits: string[];
  getLayer2: (unit: string) => string[];
  getNames: (unit: string, sel: string) => { name: string; label: string; color?: string }[];
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
}

const FlightTile: React.FC<TileProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, aircraftNumber, callsign, color,
  timeOptions, durationOptions, areaOptions, aircraftOptions, callsignOptions,
  allUnits, getLayer2, getNames,
  courseOptions, getEventsForCourse, nextLMPEvent, eventCategory,
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,
}) => {
  // ── Colours (matching real FlightTile.tsx) ──────────────────────────────
  const timeColor    = 'rgba(255,255,255,0.60)';
  const name1Color   = (v: string) => v ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
  const name2Color   = (v: string) => v ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)';
  const durColor     = 'rgba(255,255,255,0.80)';
  const brkColor     = 'rgba(255,255,255,0.55)';
  const evtColor     = (v: string) => v ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)';
  const botColor     = (v: string) => v ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.30)';
  const areaColor    = (v: string) => /^[A-H]$/.test(v) ? 'rgba(255,255,255,0.70)' : 'rgba(255,220,60,0.95)';

  const monoFamily = 'ui-monospace, SFMono-Regular, "Courier New", monospace';

  return (
    <div
      className={color}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: TILE_RADIUS,
        overflow: 'visible',
        boxShadow: '0 3px 14px rgba(0,0,0,0.45)',
        userSelect: 'none',
        // paddingTop leaves room above names for the time label
        // paddingBottom leaves room below names for the bottom strip
        paddingTop: PAD_TOP + TIME_FONT - 13,
        paddingBottom: PAD_BOT,
        paddingLeft: PAD_H + 70,
        paddingRight: PAD_H,
        boxSizing: 'border-box',
      }}
    >
      {/* ══ TOP-LEFT: start time (absolute, same as real tile "absolute -top-px left-1") ══ */}
      <div style={{ position: 'absolute', top: PAD_TOP, left: PAD_H, display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{
          fontFamily: monoFamily,
          fontSize: TIME_FONT,
          fontWeight: 400,
          color: timeColor,
          lineHeight: 1,
          pointerEvents: 'none',
        }}>
          {formatTime(startTime)}
        </span>
        {/* Invisible select overlaid on time label */}
        <select
          value={String(startTime)}
          onChange={e => onStartTimeChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', zIndex: 10,
          }}
        >
          {timeOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
        </select>
      </div>

      {/* ══ BODY: flex row — names (left) + [dur] EVENT (right) ══ */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: 8,
      }}>
        {/* LEFT column: PIC name on top, co-pilot below (same as real tile flex-1 overflow-hidden) */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {/* PIC name — bold, same size as co-pilot */}
          <PersonDropdown
            value={picName}
            onChange={onPicNameChange}
            allUnits={allUnits}
            getLayer2={getLayer2}
            getNames={getNames}
            placeholder="Surname, First (N)"
            fontSize={Math.round(NAME_FONT * 0.88)}
            color={name1Color(picName)}
            bold
          />
          {/* Co-pilot / SOLO */}
          {flightType === 'Dual' ? (
            <PersonDropdown
              value={studentName}
              onChange={(name) => onStudentNameChange(name)}
              allUnits={allUnits}
              getLayer2={getLayer2}
              getNames={getNames}
              placeholder="Surname, First (N)"
              fontSize={Math.round(NAME_FONT * 0.88)}
              color={name2Color(studentName)}
              allowSolo
              onSoloSelect={() => onFlightTypeChange('Solo')}
            />
          ) : (
            <span
              onClick={() => onFlightTypeChange('Dual')}
              style={{
                display: 'inline-block',
                fontSize: Math.round(NAME_FONT * 0.75),
                fontWeight: 800,
                letterSpacing: 1,
                color: 'rgba(255,220,60,0.95)',
                background: 'rgba(255,200,0,0.20)',
                padding: `${Math.round(NAME_FONT * 0.1)}px ${Math.round(NAME_FONT * 0.25)}px`,
                borderRadius: 4,
                lineHeight: 1.25,
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="Click to switch to Dual"
            >
              SOLO
            </span>
          )}
        </div>

        {/* RIGHT column: [duration] EVENT — moved left 40px */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          marginTop: -20,  // Move Event up by 20px
          // duration and event at normal position
        }}>
          {/* [duration] */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: monoFamily, fontSize: RIGHT_FONT, color: brkColor, lineHeight: 1 }}>[</span>
            <div style={{ position: 'relative' }}>
              <span style={{
                fontFamily: monoFamily, fontSize: RIGHT_FONT,
                fontWeight: 700, color: durColor, lineHeight: 1, pointerEvents: 'none',
              }}>
                {duration.toFixed(1)}
              </span>
              <select
                value={String(duration)}
                onChange={e => onDurationChange(parseFloat(e.target.value))}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer', zIndex: 10,
                }}
              >
                {durationOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
              </select>
            </div>
            <span style={{ fontFamily: monoFamily, fontSize: RIGHT_FONT, color: brkColor, lineHeight: 1 }}>]</span>
          </div>
          {/* EVENT code */}
          <EventDropdown
            value={flightNumber}
            onChange={onFlightNumberChange}
            courseOptions={courseOptions}
            getEventsForCourse={getEventsForCourse}
            nextLMPEvent={nextLMPEvent}
            fontSize={RIGHT_FONT}
            color={evtColor(flightNumber)}
            disabled={eventCategory === 'lmp_currency'}
          />
        </div>
      </div>

      {/* ══ BOTTOM STRIP: absolute bottom — mirrors real tile exactly ══ */}
      {/* Left: #aircraft */}
      <div style={{
        position: 'absolute',
        bottom: Math.round(PAD_BOT * 0.35),
        left: PAD_H,
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        zIndex: 5,
      }}>
        <span style={{ fontFamily: monoFamily, fontSize: BOT_FONT, color: 'rgba(255,255,255,0.50)', lineHeight: 1 }}>#</span>
        <div style={{ position: 'relative' }}>
          <span style={{
            fontFamily: monoFamily, fontSize: BOT_FONT,
            color: botColor(aircraftNumber), lineHeight: 1, pointerEvents: 'none',
          }}>
            {aircraftNumber || '---'}
          </span>
          <select
            value={aircraftNumber}
            onChange={e => onAircraftChange(e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: BOT_FONT * 2.8, height: BOT_FONT + 6,
              opacity: 0, cursor: 'pointer', zIndex: 10,
            }}
          >
            {aircraftOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Right: area + callsign */}
      <div style={{
        position: 'absolute',
        bottom: Math.round(PAD_BOT * 0.35),
        right: PAD_H,
        display: 'flex',
        alignItems: 'baseline',
        gap: BOT_FONT * 0.4,
        zIndex: 5,
      }}>
        {/* Area */}
        <div style={{ position: 'relative' }}>
          <span style={{ fontSize: BOT_FONT, lineHeight: 1, color: areaColor(area), pointerEvents: 'none' }}>
            {area || '-'}
          </span>
          <select
            value={area}
            onChange={e => onAreaChange(e.target.value)}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: BOT_FONT * 2, height: BOT_FONT + 6,
              opacity: 0, cursor: 'pointer', zIndex: 10,
            }}
          >
            {areaOptions.map(o => <option key={o.value} value={o.value} style={{ background: '#1a2f4a' }}>{o.label}</option>)}
          </select>
        </div>
        {/* Callsign */}
        {callsignOptions.length > 1 ? (
          <div style={{ position: 'relative' }}>
            <span style={{
              fontFamily: monoFamily,
              fontSize: BOT_FONT, fontStyle: 'italic', lineHeight: 1,
              color: callsign ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
              pointerEvents: 'none',
            }}>
              {callsign || 'CALLSGN'}
            </span>
            <select
              value={callsign}
              onChange={e => onCallsignChange(e.target.value)}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: BOT_FONT * 6, height: BOT_FONT + 6,
                opacity: 0, cursor: 'pointer', zIndex: 10,
              }}
            >
              <option value="" style={{ background: '#1a2f4a' }}>—</option>
              {callsignOptions.map(cs => <option key={cs} value={cs} style={{ background: '#1a2f4a' }}>{cs}</option>)}
            </select>
          </div>
        ) : (
          <input
            type="text"
            value={callsign}
            onChange={e => onCallsignChange(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: monoFamily,
              fontSize: BOT_FONT, fontStyle: 'italic', lineHeight: 1,
              color: callsign ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.30)',
              width: BOT_FONT * 6, padding: 0, cursor: 'text', textAlign: 'right',
            }}
            placeholder="CALLSGN"
          />
        )}
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({
  onClose, onSave, instructors, trainees, syllabusDetails, school,
  traineesData, instructorsData, courseColors, date, traineeLMPs, scores,
  locationOpAreas = {},
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
          label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}`,
          color: textColor,
        };
      });
  };

  // ── Tile colour from trainee course ──────────────────────────────────────
  const tileColor = useMemo(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-sky-500';
    const t = traineesData.find(t => (t.fullName || t.name) === name);
    return (t?.course && courseColors[t.course]) || 'bg-sky-500';
  }, [picName, studentName, flightType, traineesData, courseColors]);

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

  // ── Auto-fill callsign from PIC profile ──────────────────────────────────
  useEffect(() => {
    if (!picName) { setCallsign(''); setCallsignOptions([]); return; }
    // Check instructor first
    const inst = instructorsData.find(i => i.name === picName);
    if (inst) {
      const primary   = inst.callsign || '';
      const secondary = inst.secondaryCallsign || '';
      const opts = [primary, secondary].filter(Boolean);
      setCallsignOptions(opts);
      setCallsign(primary);
      return;
    }
    // Check trainee
    const trainee = traineesData.find(t => (t.fullName || t.name) === picName);
    if (trainee) {
      const cs = trainee.traineeCallsign || '';
      setCallsignOptions(cs ? [cs] : []);
      setCallsign(cs);
      return;
    }
    setCallsign('');
    setCallsignOptions([]);
  }, [picName, instructorsData, traineesData]);

  // ── Auto-set duration from selected LMP event ─────────────────────────────
  // (handled in onFlightNumberChange handler — see handleFlightNumberChange below)

  // ── Reset on category change ──────────────────────────────────────────────
  useEffect(() => {
    setPicName(''); setStudentName(''); setFlightNumber('');
    setStartTime(8.0); setDuration(1.2);
    setArea(opAreas[0] || '-'); setAircraftNumber('001');
    setCallsign(''); setCallsignOptions(''); setNotes(''); setErrors([]);
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
        style={{ width: '90vw', maxWidth: 720, maxHeight: '92vh' }}
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

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
                  allUnits={allUnits}
                  getLayer2={getLayer2}
                  getNames={getNames}
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