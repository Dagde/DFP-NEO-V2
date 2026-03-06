import React, { useState, useMemo, useEffect, useRef } from 'react';
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

// ─── Invisible inline select — blends into tile text ─────────────────────────
// Renders as plain text visually; clicking opens native dropdown
interface InlineSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  bold?: boolean;
  dim?: boolean;         // white/60 style
  mono?: boolean;
  fontSize?: number;
  color?: string;
  minWidth?: number;
  italic?: boolean;
}

const InlineSelect: React.FC<InlineSelectProps> = ({
  value, onChange, options, placeholder,
  bold, dim, mono, fontSize = 14, color, minWidth = 60, italic,
}) => {
  const baseColor = color || (value ? (dim ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.95)') : 'rgba(255,255,255,0.38)');
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? 'italic' : 'normal',
        fontSize: `${fontSize}px`,
        color: baseColor,
        minWidth: `${minWidth}px`,
        padding: 0,
        margin: 0,
        lineHeight: 'inherit',
      }}
    >
      <option value="" disabled style={{ background: '#2d1b69', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
        {placeholder}
      </option>
      {options.map(o => (
        <option key={o.value} value={o.value} style={{ background: '#2d1b69', color: '#fff', fontStyle: 'normal' }}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

// ─── Inline text input — blends into tile text ────────────────────────────────
interface InlineInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  bold?: boolean;
  mono?: boolean;
  fontSize?: number;
  color?: string;
  width?: number;
  dim?: boolean;
}

const InlineInput: React.FC<InlineInputProps> = ({
  value, onChange, placeholder, bold, mono, fontSize = 14, color, width = 80, dim,
}) => {
  const baseColor = color || (value ? (dim ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.95)') : 'rgba(255,255,255,0.38)');
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'transparent',
        border: 'none',
        outline: 'none',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : 'inherit',
        fontWeight: bold ? 700 : 400,
        fontSize: `${fontSize}px`,
        color: baseColor,
        width: `${width}px`,
        padding: 0,
        margin: 0,
        lineHeight: 'inherit',
      }}
    />
  );
};

// ─── The Flight Tile — exact replica of Screenshot 1, scaled up ───────────────
interface FlightTilePreviewProps {
  // values
  flightType: 'Dual' | 'Solo';
  startTime: number;
  picName: string;       // top name line (instructor or solo pilot)
  studentName: string;   // bottom name line
  duration: number;
  flightNumber: string;  // e.g. BGF19
  area: string;          // e.g. A
  callsign: string;      // e.g. ROLR
  aircraftNumber: string;// e.g. 053
  color: string;         // tailwind bg class
  // options
  instructorOptions: { value: string; label: string }[];
  traineeOptions: { value: string; label: string }[];
  syllabusOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  aircraftOptions: { value: string; label: string }[];
  timeOptions: { value: string; label: string }[];
  durationOptions: { value: string; label: string }[];
  // handlers
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
  onStartTimeChange: (v: number) => void;
  onPicNameChange: (v: string) => void;
  onStudentNameChange: (v: string) => void;
  onDurationChange: (v: number) => void;
  onFlightNumberChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onCallsignChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
}

const FlightTilePreview: React.FC<FlightTilePreviewProps> = ({
  flightType, startTime, picName, studentName, duration, flightNumber,
  area, callsign, aircraftNumber, color,
  instructorOptions, traineeOptions, syllabusOptions, areaOptions,
  aircraftOptions, timeOptions, durationOptions,
  onFlightTypeChange, onStartTimeChange, onPicNameChange, onStudentNameChange,
  onDurationChange, onFlightNumberChange, onAreaChange, onCallsignChange, onAircraftChange,
}) => {
  // Scale factor: real tile is ~40px tall, we want ~88px → scale ≈ 2.2×
  // All measurements below are the scaled-up values
  const SCALE = 2.2;

  // Typography sizes (matching Screenshot 1 proportions, scaled up)
  const timeFont    = Math.round(9  * SCALE);  // 09:25 top-left
  const picFont     = Math.round(11 * SCALE);  // Green, Olivia (N) — bold
  const studentFont = Math.round(10 * SCALE);  // Edwards, Ava (N)
  const rightTopFont= Math.round(10 * SCALE);  // [1.5]  BGF19
  const rightBotFont= Math.round(9  * SCALE);  // A  ROLR  053
  const btnFont     = Math.round(8  * SCALE);  // Dual / Solo buttons

  // Padding (scaled)
  const padH = Math.round(6 * SCALE);   // horizontal padding
  const padV = Math.round(4 * SCALE);   // vertical padding

  // Tile height (scaled from ~40px real)
  const tileH = Math.round(40 * SCALE);

  // Dual/Solo button style
  const btnBase: React.CSSProperties = {
    fontSize: btnFont,
    fontWeight: 700,
    padding: `${Math.round(1 * SCALE)}px ${Math.round(5 * SCALE)}px`,
    borderRadius: Math.round(3 * SCALE),
    cursor: 'pointer',
    border: 'none',
    lineHeight: 1.2,
    transition: 'background 0.15s',
  };

  const picOptions = flightType === 'Solo' ? traineeOptions : instructorOptions;

  return (
    <div
      className={`relative rounded-sm ${color}`}
      style={{
        width: '100%',
        height: tileH,
        borderRadius: Math.round(3 * SCALE),
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Top-left: start time (09:25 style) ── */}
      <div
        style={{
          position: 'absolute',
          top: Math.round(2 * SCALE),
          left: Math.round(4 * SCALE),
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: timeFont,
          color: 'rgba(255,255,255,0.65)',
          lineHeight: 1,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {formatTime(startTime)}
      </div>
      {/* Invisible time select overlaid on top of the time display */}
      <select
        value={String(startTime)}
        onChange={e => onStartTimeChange(parseFloat(e.target.value))}
        style={{
          position: 'absolute',
          top: Math.round(2 * SCALE),
          left: Math.round(4 * SCALE),
          width: Math.round(32 * SCALE),
          height: timeFont + 4,
          opacity: 0,
          cursor: 'pointer',
          zIndex: 3,
        }}
      >
        {timeOptions.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#2d1b69' }}>{o.label}</option>
        ))}
      </select>

      {/* ── Top-right: Dual / Solo buttons ── */}
      <div
        style={{
          position: 'absolute',
          top: Math.round(3 * SCALE),
          right: Math.round(4 * SCALE),
          display: 'flex',
          gap: Math.round(2 * SCALE),
          zIndex: 4,
        }}
      >
        <button
          type="button"
          onClick={() => onFlightTypeChange('Dual')}
          style={{
            ...btnBase,
            background: flightType === 'Dual' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
            color: flightType === 'Dual' ? '#fff' : 'rgba(255,255,255,0.45)',
          }}
        >
          Dual
        </button>
        <button
          type="button"
          onClick={() => onFlightTypeChange('Solo')}
          style={{
            ...btnBase,
            background: flightType === 'Solo' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
            color: flightType === 'Solo' ? '#fff' : 'rgba(255,255,255,0.45)',
          }}
        >
          Solo
        </button>
      </div>

      {/* ── Main body: left names | right flight info ── */}
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
          paddingLeft: padH,
          paddingRight: padH,
          paddingTop: padV,
          paddingBottom: padV,
        }}
      >
        {/* Left: two name lines */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: Math.round(2 * SCALE),
            paddingLeft: Math.round(10 * SCALE), // matches real tile's ~10% left indent
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Line 1: PIC name — bold, white */}
          <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
            <InlineSelect
              value={picName}
              onChange={onPicNameChange}
              options={picOptions}
              placeholder="Surname, First (N)"
              bold
              fontSize={picFont}
              minWidth={Math.round(120 * SCALE / 2.2)}
            />
          </div>
          {/* Line 2: Student name — normal weight, white/80 */}
          <div style={{ display: 'flex', alignItems: 'baseline', overflow: 'hidden' }}>
            {flightType === 'Dual' ? (
              <InlineSelect
                value={studentName}
                onChange={onStudentNameChange}
                options={traineeOptions}
                placeholder="Surname, First (N)"
                dim
                fontSize={studentFont}
                minWidth={Math.round(120 * SCALE / 2.2)}
              />
            ) : (
              <span
                style={{
                  fontSize: studentFont * 0.85,
                  fontWeight: 700,
                  color: 'rgba(255,220,80,0.9)',
                  background: 'rgba(255,200,0,0.18)',
                  padding: `${Math.round(1 * SCALE)}px ${Math.round(4 * SCALE)}px`,
                  borderRadius: Math.round(2 * SCALE),
                }}
              >
                SOLO
              </span>
            )}
          </div>
        </div>

        {/* Right: two info lines */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: Math.round(2 * SCALE),
            flexShrink: 0,
            paddingLeft: Math.round(4 * SCALE),
          }}
        >
          {/* Right line 1: [1.5]  BGF19 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: Math.round(3 * SCALE),
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: rightTopFont,
              color: 'rgba(255,255,255,0.85)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: rightTopFont * 0.9 }}>[</span>
            <select
              value={String(duration)}
              onChange={e => onDurationChange(parseFloat(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: rightTopFont * 0.9,
                color: 'rgba(255,255,255,0.85)',
                width: Math.round(22 * SCALE),
                padding: 0,
                textAlign: 'center',
              }}
            >
              {durationOptions.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#2d1b69' }}>{o.label}</option>
              ))}
            </select>
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: rightTopFont * 0.9 }}>]</span>
            <InlineSelect
              value={flightNumber}
              onChange={onFlightNumberChange}
              options={syllabusOptions}
              placeholder="BGF19"
              mono
              bold
              fontSize={rightTopFont}
              minWidth={Math.round(40 * SCALE)}
            />
          </div>

          {/* Right line 2: A  ROLR  053 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: Math.round(4 * SCALE),
              whiteSpace: 'nowrap',
            }}
          >
            {/* Area letter */}
            <InlineSelect
              value={area}
              onChange={onAreaChange}
              options={areaOptions}
              placeholder="A"
              fontSize={rightBotFont}
              color={['A','B','C','D','E','F','G','H'].includes(area) ? 'rgba(255,255,255,0.75)' : 'rgba(255,220,80,0.9)'}
              minWidth={Math.round(14 * SCALE)}
            />
            {/* Callsign */}
            <InlineInput
              value={callsign}
              onChange={onCallsignChange}
              placeholder="ROLR"
              mono
              fontSize={rightBotFont}
              dim
              width={Math.round(32 * SCALE)}
            />
            {/* Aircraft number */}
            <InlineSelect
              value={aircraftNumber}
              onChange={onAircraftChange}
              options={aircraftOptions}
              placeholder="053"
              mono
              dim
              fontSize={rightBotFont}
              minWidth={Math.round(24 * SCALE)}
            />
          </div>
        </div>
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
  const [picName, setPicName] = useState('');       // instructor (Dual) or pilot (Solo)
  const [studentName, setStudentName] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [startTime, setStartTime] = useState(9.0 + 25/60); // 09:25 default like screenshot
  const [duration, setDuration] = useState(1.5);
  const [area, setArea] = useState('A');
  const [callsign, setCallsign] = useState('');
  const [aircraftNumber, setAircraftNumber] = useState('001');
  const [locationType, setLocationType] = useState<'Local' | 'Land Away'>('Local');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // Tile colour from student's course
  const tileColor = useMemo(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name) return 'bg-purple-700'; // default purple like screenshot
    const trainee = traineesData.find(t => t.fullName === name || t.name === name);
    if (!trainee?.course) return 'bg-purple-700';
    return courseColors[trainee.course] || 'bg-purple-700';
  }, [picName, studentName, flightType, traineesData, courseColors]);

  // Options
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

  // Auto-set flightType from LMP
  useEffect(() => {
    const name = flightType === 'Solo' ? picName : studentName;
    if (!name || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(name);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (item?.sortieType) setFlightType(item.sortieType as 'Dual' | 'Solo');
  }, [picName, studentName, flightNumber, traineeLMPs]);

  const handleSave = () => {
    const errs: string[] = [];
    if (!flightNumber) errs.push('Syllabus item is required.');
    if (flightType === 'Dual' && !picName) errs.push('Instructor is required for Dual flights.');
    if (flightType === 'Dual' && !studentName) errs.push('Student is required for Dual flights.');
    if (flightType === 'Solo' && !picName) errs.push('Pilot is required for Solo flights.');
    if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    if (errs.length > 0) { setErrors(errs); return; }

    const instructor = flightType === 'Dual' ? picName : '';
    const student    = flightType === 'Dual' ? studentName : '';
    const pilot      = flightType === 'Solo' ? picName : picName;

    const newEvent: ScheduleEvent = {
      id: uuidv4(),
      date,
      type: 'flight',
      eventCategory,
      flightType,
      flightNumber,
      instructor,
      student,
      pilot,
      startTime,
      duration,
      area,
      aircraftNumber,
      callsign,
      locationType,
      color: tileColor,
      resourceId: flightType === 'Dual' ? picName : picName,
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
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-xl flex flex-col max-h-[90vh]"
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

          {/* ── The Flight Tile ── */}
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
              callsign={callsign}
              aircraftNumber={aircraftNumber}
              color={tileColor}
              instructorOptions={instructorOptions}
              traineeOptions={traineeOptions}
              syllabusOptions={syllabusOptions}
              areaOptions={areaOptions}
              aircraftOptions={aircraftOptions}
              timeOptions={timeOptions}
              durationOptions={durationOptions}
              onFlightTypeChange={setFlightType}
              onStartTimeChange={setStartTime}
              onPicNameChange={setPicName}
              onStudentNameChange={setStudentName}
              onDurationChange={setDuration}
              onFlightNumberChange={setFlightNumber}
              onAreaChange={setArea}
              onCallsignChange={setCallsign}
              onAircraftChange={setAircraftNumber}
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
                  {date}
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
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors text-sm font-semibold shadow-lg"
          >
            Add to Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFlightTileModal;