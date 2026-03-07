import React, { useState, useMemo, useEffect } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Trainee, Instructor } from '../types';
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
}

const formatTime = (time: number): string => {
  const hours = Math.floor(time);
  const minutes = Math.round((time % 1) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Format date as DD Mmm YY (e.g., "06 Jun 25")
const formatDate = (dateStr: string): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = new Date(dateStr + 'T00:00:00');
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
};

// ─── Flight Tile Preview — exact replica of reference, 4× scaled ─────────────
const S = 4; // scale factor (kept for reference, not used for sizing)

// Large interactive tile — 50% of original 4× scale, all text 20px
const TILE_H        = Math.round(38 * S * 0.5);  // 76px (50% of 152px)
const TILE_RADIUS   = 8;
const PAD_H         = 12;
const PAD_V         = 6;
const TIME_FONT     = 20;
const NAME_FONT     = 20;
const RIGHT_FONT    = 20;
const BOT_FONT      = 20;
const NAME_INDENT   = '15%';
const NAME_GAP      = 12;
const RIGHT_GAP     = 6;

// ─── Real-size tile constants (matching actual schedule tile) ─────────────────
const RT_H          = 38;   // px — same as real tile
const RT_RADIUS     = 4;
const RT_PAD_H      = 6;
const RT_PAD_V      = 4;
const RT_TIME_FONT  = 9;
const RT_NAME_FONT  = 10;
const RT_RIGHT_FONT = 10;
const RT_BOT_FONT   = 9;
const RT_NAME_INDENT = '15%';
const RT_NAME_GAP   = 3;
const RT_RIGHT_GAP  = 4;

// ─── Real-size read-only tile (synced preview) ────────────────────────────────
interface RealTilePreviewProps {
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
}

const RealTilePreview: React.FC<RealTilePreviewProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber, area, aircraftNumber, callsign, color,
}) => {
  const timeColor    = 'rgba(255,255,255,0.95)';
  const nameColor    = (v: string) => v ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.35)';
  const rightColor   = (v: string) => v ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.35)';
  const botColor     = (v: string) => v ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)';
  const bracketColor = 'rgba(255,255,255,0.70)';
  const durBoldColor = 'rgba(255,255,255,0.95)';

  const picLabel = picName || 'Surname, First (N)';
  const studentLabel = studentName || 'Surname, First (N)';

  return (
    <div
      className={color}
      style={{
        position: 'relative',
        width: '100%',
        height: RT_H,
        borderRadius: RT_RADIUS,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        flexShrink: 0,
        pointerEvents: 'none', // read-only
      }}
    >
      {/* TOP-LEFT: time */}
      <div style={{
        position: 'absolute', top: RT_PAD_V, left: RT_PAD_H,
        fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
        fontSize: RT_TIME_FONT, fontWeight: 400, color: timeColor,
        lineHeight: 1, whiteSpace: 'nowrap',
      }}>
        {formatTime(startTime)}
      </div>

      {/* MAIN BODY: names left, flight info right */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingLeft: RT_PAD_H, paddingRight: RT_PAD_H,
        paddingTop: RT_TIME_FONT + RT_PAD_V + 4,
        paddingBottom: RT_BOT_FONT + RT_PAD_V + 2,
      }}>
        {/* LEFT: two name lines */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: RT_NAME_GAP,
          paddingLeft: RT_NAME_INDENT, minWidth: 0, overflow: 'hidden',
        }}>
          <div style={{
            fontSize: RT_NAME_FONT, fontStyle: 'italic',
            color: nameColor(picName), lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {picLabel}
          </div>
          {flightType === 'Dual' ? (
            <div style={{
              fontSize: RT_NAME_FONT, fontStyle: 'italic',
              color: nameColor(studentName), lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {studentLabel}
            </div>
          ) : (
            <span style={{
              fontSize: RT_NAME_FONT * 0.75, fontWeight: 700,
              color: 'rgba(255,220,60,0.95)', background: 'rgba(255,200,0,0.20)',
              padding: '1px 3px', borderRadius: 2, display: 'inline-block', lineHeight: 1.2,
            }}>SOLO</span>
          )}
        </div>

        {/* RIGHT: [dur] flightnum */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
          justifyContent: 'center', gap: RT_RIGHT_GAP, flexShrink: 0, paddingLeft: RT_PAD_H,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_RIGHT_FONT, color: bracketColor, lineHeight: 1.2 }}>[ </span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_RIGHT_FONT, fontWeight: 700, color: durBoldColor, lineHeight: 1.2 }}>{duration.toFixed(1)}</span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_RIGHT_FONT, color: bracketColor, lineHeight: 1.2 }}> ]</span>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_RIGHT_FONT, fontStyle: 'italic', color: rightColor(flightNumber), lineHeight: 1.2, marginLeft: 2 }}>
              {flightNumber || 'FLT#'}
            </span>
          </div>
        </div>
      </div>

      {/* BOTTOM-LEFT: #aircraft */}
      <div style={{
        position: 'absolute', bottom: RT_PAD_V, left: RT_PAD_H,
        display: 'flex', alignItems: 'baseline', gap: 1, zIndex: 2,
      }}>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_BOT_FONT, color: 'rgba(255,255,255,0.70)', lineHeight: 1 }}>#</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RT_BOT_FONT, color: botColor(aircraftNumber), lineHeight: 1 }}>{aircraftNumber || '---'}</span>
      </div>

      {/* BOTTOM-RIGHT: area + callsign */}
      <div style={{
        position: 'absolute', bottom: RT_PAD_V, right: RT_PAD_H,
        display: 'flex', alignItems: 'baseline', gap: RT_RIGHT_GAP, zIndex: 2,
      }}>
        <span style={{
          fontSize: RT_BOT_FONT, lineHeight: 1,
          color: ['A','B','C','D','E','F','G','H'].includes(area) ? 'rgba(255,255,255,0.80)' : 'rgba(255,220,60,0.95)',
        }}>{area}</span>
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
          fontSize: RT_BOT_FONT, fontStyle: 'italic', lineHeight: 1,
          color: callsign && callsign !== 'CALLSGN' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
        }}>{callsign || 'CALLSGN'}</span>
      </div>
    </div>
  );
};

interface FlightTilePreviewProps {
  flightType: 'Dual' | 'Solo';
  startTime: number;
  picName: string;
  studentName: string;
  duration: number;
  flightNumber: string;
  area: string;
  aircraftNumber: string;
  color: string; // tailwind bg class
  instructorOptions: { value: string; label: string }[];
  traineeOptions: { value: string; label: string }[];
  syllabusOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  aircraftOptions: { value: string; label: string }[];
  timeOptions: { value: string; label: string }[];
  durationOptions: { value: string; label: string }[];
  callsign: string;
  // 3-layer cascading dropdown props
  allUnits: string[];
  getLayer2OptionsForUnit: (unit: string) => string[];
  getNamesForUnitAndSelection: (unit: string, selection: string) => { name: string; label: string; type: 'instructor' | 'trainee' }[];
  // PIC dropdown state
  showPicDropdown: boolean;
  hoveredPicUnit: string | null;
  hoveredPicLayer2: string | null;
  // Student dropdown state
  showStudentDropdown: boolean;
  hoveredStudentUnit: string | null;
  hoveredStudentLayer2: string | null;
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
  onStartTimeChange: (v: number) => void;
  onPicNameChange: (v: string) => void;
  onStudentNameChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onFlightNumberChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
  onCallsignChange: (v: string) => void;
  onShowPicDropdownChange: (v: boolean) => void;
  onHoveredPicUnitChange: (v: string | null) => void;
  onHoveredPicLayer2Change: (v: string | null) => void;
  onShowStudentDropdownChange: (v: boolean) => void;
  onHoveredStudentUnitChange: (v: string | null) => void;
  onHoveredStudentLayer2Change: (v: string | null) => void;
}

// Shared style for all invisible inline selects inside the tile
const inlineSelectStyle = (
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

const FlightTilePreview: React.FC<FlightTilePreviewProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, aircraftNumber, color, callsign,
  instructorOptions, traineeOptions, syllabusOptions, areaOptions,
  aircraftOptions, timeOptions, durationOptions,
  allUnits, getLayer2OptionsForUnit, getNamesForUnitAndSelection,
  showPicDropdown, hoveredPicUnit, hoveredPicLayer2,
  showStudentDropdown, hoveredStudentUnit, hoveredStudentLayer2,
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onAircraftChange, onCallsignChange,
  onShowPicDropdownChange, onHoveredPicUnitChange, onHoveredPicLayer2Change,
  onShowStudentDropdownChange, onHoveredStudentUnitChange, onHoveredStudentLayer2Change,
}) => {
  const picOptions = flightType === 'Solo' ? traineeOptions : instructorOptions;

  // Colours matching the reference screenshot exactly
  const timeColor     = 'rgba(255,255,255,0.95)';  // bright white — time top-left
  const nameColor     = (v: string) => v ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.45)';
  const rightColor    = (v: string) => v ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.45)';
  const botColor      = (v: string) => v ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)';
  const bracketColor  = 'rgba(255,255,255,0.70)';
  const durBoldColor  = 'rgba(255,255,255,0.95)';  // [1.5] — bold white

  return (
    <div
      className={color}
      style={{
        position: 'relative',
        width: '100%',
        height: TILE_H,
        borderRadius: TILE_RADIUS,
        overflow: 'visible',
        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        flexShrink: 0,
      }}
    >
      {/* ── TOP-LEFT: start time ── */}
      {/* We show the formatted time as a visible label, with an invisible select on top */}
      <div
        style={{
          position: 'absolute',
          top: PAD_V,
          left: PAD_H,
          fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
          fontSize: TIME_FONT,
          fontWeight: 400,
          color: timeColor,
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {formatTime(startTime)}
      </div>
      {/* Invisible select overlay for time */}
      <select
        value={String(startTime)}
        onChange={e => onStartTimeChange(parseFloat(e.target.value))}
        style={{
          position: 'absolute',
          top: PAD_V,
          left: PAD_H,
          width: TIME_FONT * 3,
          height: TIME_FONT + 4,
          opacity: 0,
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        {timeOptions.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#1e3a5f' }}>{o.label}</option>
        ))}
      </select>

      {/* ── TOP-RIGHT: [duration] FLT# ── */}
      <div
        style={{
          position: 'absolute',
          top: PAD_V,
          right: PAD_H,
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          zIndex: 5,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RIGHT_FONT, color: bracketColor, lineHeight: 1 }}>[ </span>
        <select
          value={String(duration)}
          onChange={e => onDurationChange(parseFloat(e.target.value))}
          style={inlineSelectStyle(RIGHT_FONT, durBoldColor, RIGHT_FONT * 2.2, 700, 'normal', true, 'center')}
        >
          {durationOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e3a5f', fontStyle: 'normal' }}>{o.label}</option>
          ))}
        </select>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace', fontSize: RIGHT_FONT, color: bracketColor, lineHeight: 1 }}> ]</span>
        <select
          value={flightNumber}
          onChange={e => onFlightNumberChange(e.target.value)}
          style={inlineSelectStyle(RIGHT_FONT, rightColor(flightNumber), RIGHT_FONT * 4, 400, 'italic', true)}
        >
          <option value="" disabled style={{ background: '#1e3a5f', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            EVENT
          </option>
          {syllabusOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e3a5f', color: '#fff', fontStyle: 'normal' }}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── MAIN BODY: left names | right flight info ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: PAD_H,
          paddingRight: PAD_H,
          paddingTop: TIME_FONT + PAD_V + 2,
          paddingBottom: BOT_FONT + PAD_V + 2,
        }}
      >
        {/* LEFT: two name lines, indented */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: NAME_GAP,
            paddingLeft: NAME_INDENT,
            minWidth: 0,
            overflow: 'visible',
          }}
        >
          {/* Line 1: PIC / Instructor with 3-layer cascading dropdown */}
          {/* Structure: Unit → STAFF or Course → Names */}
          <div style={{ position: 'relative', marginTop: -6 }}>
            <div
              onClick={() => onShowPicDropdownChange(!showPicDropdown)}
              style={{
                ...inlineSelectStyle(NAME_FONT, nameColor(picName), '100%', 700, 'italic'),
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {picName || 'Surname, First (N)'}
            </div>
            {showPicDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 1000,
                  width: 540,
                  backgroundColor: '#1e3a5f',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  maxHeight: 320,
                  display: 'flex',
                  flexDirection: 'row',
                }}
              >
                {/* Column 1: Units list */}
                <div
                  style={{
                    width: 120,
                    borderRight: '1px solid rgba(255,255,255,0.2)',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {/* SOLO option - first, no cascading */}
                  <div
                    onClick={() => {
                      onPicNameChange('SOLO');
                      onShowPicDropdownChange(false);
                      onHoveredPicUnitChange(null);
                      onHoveredPicLayer2Change(null);
                    }}
                    style={{
                      padding: '10px 12px',
                      color: '#ffd43b',
                      backgroundColor: hoveredPicUnit === 'SOLO' ? 'rgba(255,212,59,0.2)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      borderBottom: '1px solid rgba(255,255,255,0.2)',
                    }}
                    onMouseEnter={() => onHoveredPicUnitChange('SOLO')}
                    onMouseLeave={() => onHoveredPicUnitChange(null)}
                  >
                    SOLO
                    <span style={{ fontSize: 10, opacity: 0.8, color: '#ffd43b' }}>SELECT</span>
                  </div>
                  {allUnits.map(unit => (
                    <div
                      key={unit}
                      onMouseEnter={() => onHoveredPicUnitChange(unit)}
                      onClick={() => onHoveredPicUnitChange(unit)}
                      style={{
                        padding: '10px 12px',
                        color: hoveredPicUnit === unit ? '#fff' : 'rgba(255,255,255,0.8)',
                        backgroundColor: hoveredPicUnit === unit ? 'rgba(255,255,255,0.15)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                      }}
                    >
                      {unit}
                      <span style={{ fontSize: 10, opacity: 0.6 }}>▶</span>
                    </div>
                  ))}
                </div>
                {/* Column 2: STAFF or Courses (not shown for SOLO) */}
                <div
                  style={{
                    width: 140,
                    borderRight: '1px solid rgba(255,255,255,0.2)',
                    maxHeight: 320,
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0,0,0,0.1)',
                  }}
                >
                  {hoveredPicUnit && hoveredPicUnit !== 'SOLO' ? (
                    getLayer2OptionsForUnit(hoveredPicUnit).map(option => (
                      <div
                        key={option}
                        onMouseEnter={() => onHoveredPicLayer2Change(option)}
                        onClick={() => onHoveredPicLayer2Change(option)}
                        style={{
                          padding: '10px 12px',
                          color: hoveredPicLayer2 === option ? '#fff' : 'rgba(255,255,255,0.8)',
                          backgroundColor: hoveredPicLayer2 === option ? 'rgba(255,255,255,0.15)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13,
                          fontWeight: option === 'STAFF' ? 600 : 400,
                        }}
                      >
                        {option}
                        <span style={{ fontSize: 10, opacity: 0.6 }}>▶</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
                      Select unit
                    </div>
                  )}
                </div>
                {/* Column 3: Names (Staff or Trainees) */}
                <div
                  style={{
                    flex: 1,
                    maxHeight: 320,
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                  }}
                >
                  {hoveredPicUnit && hoveredPicLayer2 ? (
                    getNamesForUnitAndSelection(hoveredPicUnit, hoveredPicLayer2).map(person => (
                      <div
                        key={person.name}
                        onClick={() => {
                          onPicNameChange(person.name);
                          onShowPicDropdownChange(false);
                          onHoveredPicUnitChange(null);
                          onHoveredPicLayer2Change(null);
                        }}
                        style={{
                          padding: '10px 12px',
                          color: '#fff',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                      >
                        {person.label}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
                      {hoveredPicUnit === 'SOLO' ? 'SOLO selected' : hoveredPicUnit ? 'Select STAFF or course' : 'Select unit'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Line 2: Student (Dual) or SOLO badge */}
          {/* Structure: Unit → STAFF or Course → Names (same as PIC dropdown) */}
          {flightType === 'Dual' ? (
            <div style={{ position: 'relative' }}>
              {/* Student name display - triggers dropdown */}
              <div
                onClick={() => onShowStudentDropdownChange(!showStudentDropdown)}
                style={{
                  fontSize: NAME_FONT,
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: nameColor(studentName),
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: 2,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
              >
                {studentName || 'Surname, First (N)'}
              </div>

              {/* 3-layer cascading dropdown: Units -> STAFF/Courses -> Names */}
              {showStudentDropdown && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 100,
                    display: 'flex',
                    width: 540,
                    maxHeight: 320,
                    backgroundColor: '#1e3a5f',
                    borderRadius: 6,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    marginTop: 4,
                  }}
                >
                  {/* Column 1: Units list */}
                  <div
                    style={{
                      width: 120,
                      borderRight: '1px solid rgba(255,255,255,0.2)',
                      maxHeight: 320,
                      overflowY: 'auto',
                    }}
                  >
                    {/* SOLO option - first, no cascading */}
                    <div
                      onClick={() => {
                        onStudentNameChange('SOLO');
                        onShowStudentDropdownChange(false);
                        onHoveredStudentUnitChange(null);
                        onHoveredStudentLayer2Change(null);
                      }}
                      style={{
                        padding: '10px 12px',
                        color: '#ffd43b',
                        backgroundColor: hoveredStudentUnit === 'SOLO' ? 'rgba(255,212,59,0.2)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 13,
                        fontWeight: 700,
                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                      }}
                      onMouseEnter={() => onHoveredStudentUnitChange('SOLO')}
                      onMouseLeave={() => onHoveredStudentUnitChange(null)}
                    >
                      SOLO
                      <span style={{ fontSize: 10, opacity: 0.8, color: '#ffd43b' }}>SELECT</span>
                    </div>
                    {allUnits.map(unit => (
                      <div
                        key={unit}
                        onMouseEnter={() => onHoveredStudentUnitChange(unit)}
                        onClick={() => onHoveredStudentUnitChange(unit)}
                        style={{
                          padding: '10px 12px',
                          color: hoveredStudentUnit === unit ? '#fff' : 'rgba(255,255,255,0.8)',
                          backgroundColor: hoveredStudentUnit === unit ? 'rgba(255,255,255,0.15)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 13,
                        }}
                      >
                        {unit}
                        <span style={{ fontSize: 10, opacity: 0.6 }}>▶</span>
                      </div>
                    ))}
                  </div>

                  {/* Column 2: STAFF or Courses (not shown for SOLO) */}
                  <div
                    style={{
                      width: 140,
                      borderRight: '1px solid rgba(255,255,255,0.2)',
                      maxHeight: 320,
                      overflowY: 'auto',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                    }}
                  >
                    {hoveredStudentUnit && hoveredStudentUnit !== 'SOLO' ? (
                      getLayer2OptionsForUnit(hoveredStudentUnit).map(option => (
                        <div
                          key={option}
                          onMouseEnter={() => onHoveredStudentLayer2Change(option)}
                          onClick={() => onHoveredStudentLayer2Change(option)}
                          style={{
                            padding: '10px 12px',
                            color: hoveredStudentLayer2 === option ? '#fff' : 'rgba(255,255,255,0.8)',
                            backgroundColor: hoveredStudentLayer2 === option ? 'rgba(255,255,255,0.15)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 13,
                            fontWeight: option === 'STAFF' ? 600 : 400,
                          }}
                        >
                          {option}
                          <span style={{ fontSize: 10, opacity: 0.6 }}>▶</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
                        Select unit
                      </div>
                    )}
                  </div>

                  {/* Column 3: Names (Staff or Trainees) */}
                  <div
                    style={{
                      flex: 1,
                      maxHeight: 320,
                      overflowY: 'auto',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    {hoveredStudentUnit && hoveredStudentLayer2 ? (
                      getNamesForUnitAndSelection(hoveredStudentUnit, hoveredStudentLayer2).map(person => (
                        <div
                          key={person.name}
                          onClick={() => {
                            onStudentNameChange(person.name);
                            onShowStudentDropdownChange(false);
                            onHoveredStudentUnitChange(null);
                            onHoveredStudentLayer2Change(null);
                          }}
                          style={{
                            padding: '10px 12px',
                            color: '#fff',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                            fontSize: 13,
                            whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={e => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                        >
                          {person.label}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '20px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>
                        {hoveredStudentUnit === 'SOLO' ? 'SOLO selected' : hoveredStudentUnit ? 'Select STAFF or course' : 'Select unit'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span
              style={{
                fontSize: NAME_FONT * 0.75,
                fontWeight: 700,
                color: 'rgba(255,220,60,0.95)',
                background: 'rgba(255,200,0,0.20)',
                padding: `4px 8px`,
                borderRadius: 4,
                display: 'inline-block',
                lineHeight: 1.2,
              }}
            >
              SOLO
            </span>
          )}
        </div>

        </div>

      {/* ── BOTTOM-LEFT: #aircraft ── */}
      <div
        style={{
          position: 'absolute',
          bottom: PAD_V,
          left: PAD_H,
          display: 'flex',
          alignItems: 'baseline',
          gap: 2,
          zIndex: 2,
        }}
      >
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
          fontSize: BOT_FONT,
          color: 'rgba(255,255,255,0.70)',
          lineHeight: 1,
        }}>#</span>
        <select
          value={aircraftNumber}
          onChange={e => onAircraftChange(e.target.value)}
          style={inlineSelectStyle(BOT_FONT, botColor(aircraftNumber), BOT_FONT * 2.2, 400, 'normal', true)}
        >
          {aircraftOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e3a5f' }}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── BOTTOM-RIGHT: area + callsign ── */}
      <div
        style={{
          position: 'absolute',
          bottom: PAD_V,
          right: PAD_H,
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          zIndex: 2,
        }}
      >
        {/* Area — left of callsign, below [1.5] */}
        <select
          value={area}
          onChange={e => onAreaChange(e.target.value)}
          style={inlineSelectStyle(
            BOT_FONT,
            ['A','B','C','D','E','F','G','H'].includes(area)
              ? 'rgba(255,255,255,0.80)'
              : 'rgba(255,220,60,0.95)',
            BOT_FONT * 1.4,
            400, 'normal', false
          )}
        >
          {areaOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e3a5f' }}>{o.label}</option>
          ))}
        </select>
        {/* Callsign */}
        <input
          type="text"
          value={callsign}
          onChange={e => onCallsignChange(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'ui-monospace, SFMono-Regular, "Courier New", monospace',
            fontSize: BOT_FONT,
            color: callsign && callsign !== 'CALLSGN' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
            fontStyle: 'italic',
            lineHeight: 1,
            textAlign: 'right',
            width: BOT_FONT * 5,
            padding: 0,
            cursor: 'text',
          }}
          placeholder="CALLSGN"
        />
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({
  onClose, onSave, instructors, trainees, syllabusDetails, school,
  traineesData, instructorsData, courseColors, date, traineeLMPs,
}) => {
  const [eventCategory, setEventCategory] = useState<'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di'>('lmp_event');
  const [flightType, setFlightType] = useState<'Dual' | 'Solo'>('Dual');
  const [picName, setPicName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [startTime, setStartTime] = useState(8.0);
  const [duration, setDuration] = useState(1.5);
  const [area, setArea] = useState('A');
  const [aircraftNumber, setAircraftNumber] = useState('001');
  const [locationType, setLocationType] = useState<'Local' | 'Land Away'>('Local');
  const [callsign, setCallsign] = useState('CALLSGN');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [showPicDropdown, setShowPicDropdown] = useState(false);
  const [hoveredPicUnit, setHoveredPicUnit] = useState<string | null>(null);
  const [hoveredPicLayer2, setHoveredPicLayer2] = useState<string | null>(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [hoveredStudentUnit, setHoveredStudentUnit] = useState<string | null>(null);
  const [hoveredStudentLayer2, setHoveredStudentLayer2] = useState<string | null>(null);

  // Tile colour from student's course (default sky-blue matching reference)
  const tileColor = useMemo(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-sky-500';
    const trainee = traineesData.find(t => t.fullName === name || t.name === name);
    if (!trainee?.course) return 'bg-sky-500';
    return courseColors[trainee.course] || 'bg-sky-500';
  }, [picName, studentName, flightType, traineesData, courseColors]);

  const areas = ['A','B','C','D','E','F','G','H','S','T','U','V','W','X','Y','Z'];
  const areaOptions = areas.map(a => ({ value: a, label: a }));

  const aircraftOptions = useMemo(() =>
    Array.from({ length: 49 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return { value: n, label: n };
    }), []);

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

  const durationOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let d = 0.5; d <= 4.0; d = Math.round((d + 0.1) * 10) / 10) {
      opts.push({ value: String(d), label: d.toFixed(1) });
    }
    return opts;
  }, []);

  const instructorOptions = useMemo(() =>
    instructorsData.map(i => ({ value: i.name, label: `${i.rank ? i.rank + ' ' : ''}${i.name}` })),
    [instructorsData]
  );

  // Combined 3-layer structure: Unit → "STAFF" or Course → Names
  // Layer 1: Units (1FTS, CFS)
  // Layer 2: "STAFF" or Courses (ADF301, ADF302, etc.)
  // Layer 3: Staff list (if STAFF) or Trainees (if course)

  // Get all unique units from both instructors and trainees
  const allUnits = useMemo(() => {
    const units = new Set<string>();
    instructorsData.forEach(inst => units.add(inst.unit || 'Unassigned'));
    traineesData.forEach(trainee => units.add(trainee.unit || 'Unassigned'));
    return Array.from(units).sort();
  }, [instructorsData, traineesData]);

  // Get Layer 2 options for a unit: ["STAFF", ...courses]
  const getLayer2OptionsForUnit = (unit: string): string[] => {
    const options: string[] = [];
    
    // Check if unit has instructors (add STAFF option)
    const hasInstructors = instructorsData.some(inst => (inst.unit || 'Unassigned') === unit);
    if (hasInstructors) {
      options.push('STAFF');
    }
    
    // Get unique courses for this unit from trainees
    const courses = new Set<string>();
    traineesData.forEach(trainee => {
      if ((trainee.unit || 'Unassigned') === unit && trainee.course) {
        courses.add(trainee.course);
      }
    });
    options.push(...Array.from(courses).sort());
    
    return options;
  };

  // Get Layer 3 names based on unit and selection (STAFF or course)
  const getNamesForUnitAndSelection = (unit: string, selection: string): { name: string; label: string; type: 'instructor' | 'trainee' }[] => {
    if (selection === 'STAFF') {
      // Return instructors for this unit
      return instructorsData
        .filter(inst => (inst.unit || 'Unassigned') === unit)
        .map(inst => ({
          name: inst.name,
          label: `${inst.rank ? inst.rank + ' ' : ''}${inst.name}`,
          type: 'instructor' as const
        }));
    } else {
      // Return trainees for this unit and course
      return traineesData
        .filter(trainee => 
          (trainee.unit || 'Unassigned') === unit && 
          trainee.course === selection
        )
        .map(trainee => ({
          name: trainee.fullName || trainee.name,
          label: `${trainee.rank ? trainee.rank + ' ' : ''}${trainee.fullName || trainee.name}`,
          type: 'trainee' as const
        }));
    }
  };

  // Legacy support - keep for reference but not used in new dropdown
  const instructorsByUnitAndFlight = useMemo(() => {
    const grouped = new Map<string, Map<string, typeof instructorsData>>();
    instructorsData.forEach(inst => {
      const unit = inst.unit || 'Unassigned';
      const flight = inst.flight || inst.role || 'Staff';
      if (!grouped.has(unit)) {
        grouped.set(unit, new Map());
      }
      if (!grouped.get(unit)!.has(flight)) {
        grouped.get(unit)!.set(flight, []);
      }
      grouped.get(unit)!.get(flight)!.push(inst);
    });
    return grouped;
  }, [instructorsData]);

  const traineesByUnitAndCourse = useMemo(() => {
    const grouped = new Map<string, Map<string, typeof traineesData>>();
    traineesData.forEach(trainee => {
      const unit = trainee.unit || 'Unassigned';
      const course = trainee.course || 'Unassigned';
      if (!grouped.has(unit)) {
        grouped.set(unit, new Map());
      }
      if (!grouped.get(unit)!.has(course)) {
        grouped.get(unit)!.set(course, []);
      }
      grouped.get(unit)!.get(course)!.push(trainee);
    });
    return grouped;
  }, [traineesData]);

  const traineeOptions = useMemo(() =>
    traineesData.map(t => ({ value: t.fullName || t.name, label: `${t.rank ? t.rank + ' ' : ''}${t.fullName || t.name}` })),
    [traineesData]
  );

  const syllabusOptions = useMemo(() => {
    const flightItems = syllabusDetails
      .filter(d => d.type === 'Flight' || d.type === 'flight' || (!d.type && !d.id?.includes('FTD') && !d.id?.includes('CPT')))
      .map(d => d.id || d.code || '')
      .filter(Boolean);
    const unique = Array.from(new Set(flightItems)).sort();
    const base = eventCategory === 'sct' ? ['SCT FORM', ...unique] : unique;
    return base.map(s => ({ value: s, label: s }));
  }, [syllabusDetails, eventCategory]);

  useEffect(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(name);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (item?.sortieType) setFlightType(item.sortieType as 'Dual' | 'Solo');
  }, [picName, studentName, flightNumber, traineeLMPs]);

  // Auto-populate callsign from Captain's profile (primary callsign)
  useEffect(() => {
    if (!picName) return;
    const instructor = instructorsData.find(i => i.name === picName);
    if (instructor?.callsignNumber) {
      // Format full callsign with prefix (e.g., "ROLR042", "VIPR023")
      const prefix = school === 'ESL' ? 'ROLR' : 'VIPR';
      setCallsign(`${prefix}${String(instructor.callsignNumber).padStart(3, '0')}`);
    }
  }, [picName, instructorsData, school]);

  // Reset form data when event category changes
  useEffect(() => {
    setPicName('');
    setStudentName('');
    setFlightNumber('');
    setStartTime(8.0);
    setDuration(1.5);
    setArea('A');
    setAircraftNumber('001');
    setCallsign('CALLSGN');
    setNotes('');
    setErrors([]);
  }, [eventCategory]);

  // Default to Solo for SCT and TWR DI event categories
  useEffect(() => {
    if (eventCategory === 'sct' || eventCategory === 'twr_di') {
      setFlightType('Solo');
    }
  }, [eventCategory]);

  const handleSave = () => {
    const errs: string[] = [];
    if (!flightNumber) errs.push('Syllabus item is required.');
    if (flightType === 'Dual' && !picName) errs.push('Instructor is required for Dual flights.');
    if (flightType === 'Dual' && !studentName) errs.push('Student is required for Dual flights.');
    if (flightType === 'Solo' && !picName) errs.push('Pilot is required for Solo flights.');
    if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    if (errs.length > 0) { setErrors(errs); return; }

    const newEvent: ScheduleEvent = {
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
      locationType,
      color: tileColor,
      resourceId: '', // Will be assigned by handleSaveEvents
      notes,
      group: '',
      groupTraineeIds: [],
      attendees: [],
    } as any;

    onSave([newEvent]);
    onClose();
  };

  const categoryLabels: Record<string, string> = {
    lmp_event: 'LMP Event',
    lmp_currency: 'LMP Currency',
    sct: 'SCT',
    staff_cat: 'Staff CAT',
    twr_di: 'TWR DI',
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh]"
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
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
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

          {/* Flight Tile label + tile */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Flight Tile</label>
            <FlightTilePreview
              flightType={flightType}
              startTime={startTime}
              picName={picName}
              studentName={studentName}
              duration={duration}
              flightNumber={flightNumber}
              area={area}
              aircraftNumber={aircraftNumber}
              color={tileColor}
              instructorOptions={instructorOptions}
              traineeOptions={traineeOptions}
              syllabusOptions={syllabusOptions}
              areaOptions={areaOptions}
              aircraftOptions={aircraftOptions}
              timeOptions={timeOptions}
              durationOptions={durationOptions}
              callsign={callsign}
              allUnits={allUnits}
              getLayer2OptionsForUnit={getLayer2OptionsForUnit}
              getNamesForUnitAndSelection={getNamesForUnitAndSelection}
              showPicDropdown={showPicDropdown}
              hoveredPicUnit={hoveredPicUnit}
              hoveredPicLayer2={hoveredPicLayer2}
              showStudentDropdown={showStudentDropdown}
              hoveredStudentUnit={hoveredStudentUnit}
              hoveredStudentLayer2={hoveredStudentLayer2}
              onFlightTypeChange={setFlightType}
              onStartTimeChange={setStartTime}
              onPicNameChange={setPicName}
              onStudentNameChange={setStudentName}
              onDurationChange={setDuration}
              onFlightNumberChange={setFlightNumber}
              onAreaChange={setArea}
              onAircraftChange={setAircraftNumber}
              onCallsignChange={setCallsign}
              onShowPicDropdownChange={setShowPicDropdown}
              onHoveredPicUnitChange={setHoveredPicUnit}
              onHoveredPicLayer2Change={setHoveredPicLayer2}
              onShowStudentDropdownChange={setShowStudentDropdown}
              onHoveredStudentUnitChange={setHoveredStudentUnit}
              onHoveredStudentLayer2Change={setHoveredStudentLayer2}
            />
          </div>

          {/* Additional Fields */}
          <div className="border-t border-gray-700 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</label>
                <select
                  value={locationType}
                  onChange={e => setLocationType(e.target.value as 'Local' | 'Land Away')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
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
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              {errors.map((e, i) => (
                <p key={i} className="text-red-300 text-sm">• {e}</p>
              ))}
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