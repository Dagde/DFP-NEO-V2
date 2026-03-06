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

// ─── Inline select styled to blend into the tile ─────────────────────────────
interface TileSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
}

const TileSelect: React.FC<TileSelectProps> = ({ value, onChange, options, placeholder, className = '', style }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className={`bg-transparent border-0 outline-none cursor-pointer appearance-none w-full ${className}`}
    style={style}
  >
    <option value="" disabled style={{ fontStyle: 'italic', color: '#888', background: '#1e293b' }}>
      {placeholder}
    </option>
    {options.map(o => (
      <option key={o.value} value={o.value} style={{ background: '#1e293b', color: '#fff' }}>
        {o.label}
      </option>
    ))}
  </select>
);

// ─── The enlarged interactive flight tile ─────────────────────────────────────
interface FlightTilePreviewProps {
  flightType: 'Dual' | 'Solo';
  instructor: string;
  student: string;
  flightNumber: string;
  startTime: number;
  duration: number;
  area: string;
  aircraftNumber: string;
  color: string;
  instructorOptions: { value: string; label: string }[];
  traineeOptions: { value: string; label: string }[];
  syllabusOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
  aircraftOptions: { value: string; label: string }[];
  timeOptions: { value: string; label: string }[];
  durationOptions: { value: string; label: string }[];
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
  onInstructorChange: (v: string) => void;
  onStudentChange: (v: string) => void;
  onFlightNumberChange: (v: string) => void;
  onStartTimeChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onAreaChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
}

const TILE_FONT = 13;
const SMALL_FONT = 11;

const FlightTilePreview: React.FC<FlightTilePreviewProps> = ({
  flightType, instructor, student, flightNumber, startTime, duration, area, aircraftNumber, color,
  instructorOptions, traineeOptions, syllabusOptions, areaOptions, aircraftOptions, timeOptions, durationOptions,
  onFlightTypeChange, onInstructorChange, onStudentChange, onFlightNumberChange,
  onStartTimeChange, onDurationChange, onAreaChange, onAircraftChange,
}) => {
  const picValue = flightType === 'Solo' ? student : instructor;
  const picOptions = flightType === 'Solo' ? traineeOptions : instructorOptions;
  const picOnChange = flightType === 'Solo' ? onStudentChange : onInstructorChange;
  const picPlaceholder = flightType === 'Solo' ? 'Surname, First (N)' : 'Surname, First (N)';

  const dimStyle = { color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' as const };
  const activeStyle = { color: '#fff' };

  return (
    <div
      className={`relative rounded-sm shadow-2xl overflow-hidden ${color}`}
      style={{ width: '100%', height: 76, fontSize: TILE_FONT }}
    >
      {/* ── Time stamp top-left ── */}
      <div
        className="absolute top-px left-1 font-mono text-white/60 pointer-events-none"
        style={{ fontSize: TILE_FONT * 0.75, lineHeight: 1 }}
      >
        {formatTime(startTime)}
      </div>

      {/* ── Dual / Solo toggle top-right ── */}
      <div className="absolute top-0.5 right-1 flex gap-1 z-10">
        {(['Dual', 'Solo'] as const).map(ft => (
          <button
            key={ft}
            type="button"
            onClick={() => onFlightTypeChange(ft)}
            className={`px-1.5 py-px rounded text-[10px] font-bold transition-all leading-tight ${
              flightType === ft
                ? 'bg-white/30 text-white'
                : 'bg-white/10 text-white/40 hover:bg-white/20'
            }`}
          >
            {ft}
          </button>
        ))}
      </div>

      {/* ── Main body ── */}
      <div
        className="flex items-center justify-between h-full w-full px-2"
        style={{ paddingTop: 16, paddingBottom: 16 }}
      >
        {/* Left: PIC + Student */}
        <div className="flex-1 overflow-hidden pr-1" style={{ paddingLeft: '10%', minWidth: 0 }}>
          {/* PIC */}
          <TileSelect
            value={picValue}
            onChange={picOnChange}
            options={picOptions}
            placeholder={picPlaceholder}
            className="font-semibold"
            style={{
              fontSize: TILE_FONT,
              lineHeight: '1.3',
              ...(picValue ? activeStyle : dimStyle),
            }}
          />
          {/* Student / SOLO badge */}
          {flightType === 'Dual' ? (
            <TileSelect
              value={student}
              onChange={onStudentChange}
              options={traineeOptions}
              placeholder="Surname, First (N)"
              style={{
                fontSize: TILE_FONT,
                lineHeight: '1.3',
                ...(student ? { color: 'rgba(255,255,255,0.8)' } : dimStyle),
              }}
            />
          ) : (
            <span
              className="px-1.5 py-0.5 rounded-sm font-bold text-yellow-100 bg-yellow-500/20 inline-block"
              style={{ fontSize: SMALL_FONT }}
            >
              SOLO
            </span>
          )}
        </div>

        {/* Right: [dur] flightNumber */}
        <div
          className="flex flex-col items-end justify-start pl-1 flex-shrink-0"
          style={{ minWidth: 'fit-content', paddingTop: 2 }}
        >
          <div className="font-mono text-white/80 text-right whitespace-nowrap flex items-center gap-0.5">
            <span style={{ fontSize: SMALL_FONT }} className="text-white/50">[</span>
            <select
              value={String(duration)}
              onChange={e => onDurationChange(parseFloat(e.target.value))}
              className="bg-transparent border-0 outline-none cursor-pointer appearance-none font-mono text-center"
              style={{ fontSize: SMALL_FONT, width: 30, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' }}
            >
              {durationOptions.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>
              ))}
            </select>
            <span style={{ fontSize: SMALL_FONT }} className="text-white/50">]</span>
            <select
              value={flightNumber}
              onChange={e => onFlightNumberChange(e.target.value)}
              className="bg-transparent border-0 outline-none cursor-pointer appearance-none font-mono"
              style={{
                fontSize: TILE_FONT,
                minWidth: 56,
                ...(flightNumber ? { color: 'rgba(255,255,255,0.9)' } : { color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }),
              }}
            >
              <option value="" disabled style={{ fontStyle: 'italic', color: '#888', background: '#1e293b' }}>FLT#</option>
              {syllabusOptions.map(o => (
                <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Bottom-left: #aircraft ── */}
      <div
        className="absolute bottom-0.5 left-1 font-mono flex items-center"
        style={{ fontSize: SMALL_FONT, lineHeight: 1, opacity: 0.8 }}
      >
        <span className="text-white/40">#</span>
        <select
          value={aircraftNumber}
          onChange={e => onAircraftChange(e.target.value)}
          className="bg-transparent border-0 outline-none cursor-pointer appearance-none font-mono text-white/80"
          style={{ fontSize: SMALL_FONT, width: 34, fontStyle: 'italic' }}
        >
          {aircraftOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Bottom-right: start time + area ── */}
      <div className="absolute bottom-0.5 right-1 flex items-center gap-1">
        <select
          value={String(startTime)}
          onChange={e => onStartTimeChange(parseFloat(e.target.value))}
          className="bg-transparent border-0 outline-none cursor-pointer appearance-none font-mono text-white/50"
          style={{ fontSize: SMALL_FONT, width: 38, fontStyle: 'italic' }}
        >
          {timeOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>
          ))}
        </select>
        <select
          value={area}
          onChange={e => onAreaChange(e.target.value)}
          className={`bg-transparent border-0 outline-none cursor-pointer appearance-none font-sans font-light ${
            ['A','B','C','D','E','F','G','H'].includes(area) ? 'text-white/70' : 'text-yellow-300'
          }`}
          style={{ fontSize: TILE_FONT, width: 26, opacity: 0.9, fontStyle: 'italic' }}
        >
          {areaOptions.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>{o.label}</option>
          ))}
        </select>
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
  const [instructor, setInstructor] = useState('');
  const [student, setStudent] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [startTime, setStartTime] = useState(8.0);
  const [duration, setDuration] = useState(1.5);
  const [area, setArea] = useState('A');
  const [aircraftNumber, setAircraftNumber] = useState('001');
  const [locationType, setLocationType] = useState<'Local' | 'Land Away'>('Local');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const tileColor = useMemo(() => {
    if (!student) return 'bg-sky-700';
    const trainee = traineesData.find(t => t.fullName === student || t.name === student);
    if (!trainee?.course) return 'bg-sky-700';
    return courseColors[trainee.course] || 'bg-sky-700';
  }, [student, traineesData, courseColors]);

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

  useEffect(() => {
    if (!student || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(student);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (item?.sortieType) setFlightType(item.sortieType as 'Dual' | 'Solo');
  }, [student, flightNumber, traineeLMPs]);

  const handleSave = () => {
    const errs: string[] = [];
    if (!flightNumber) errs.push('Syllabus item is required.');
    if (flightType === 'Dual' && !instructor) errs.push('Instructor is required for Dual flights.');
    if (flightType === 'Dual' && !student) errs.push('Student is required for Dual flights.');
    if (flightType === 'Solo' && !student) errs.push('Pilot is required for Solo flights.');
    if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    if (errs.length > 0) { setErrors(errs); return; }

    const pilot = flightType === 'Solo' ? student : instructor;

    const newEvent: ScheduleEvent = {
      id: uuidv4(),
      date,
      type: 'flight',
      eventCategory,
      flightType,
      flightNumber,
      instructor: flightType === 'Dual' ? instructor : '',
      student: flightType === 'Dual' ? student : '',
      pilot,
      startTime,
      duration,
      area,
      aircraftNumber,
      locationType,
      color: tileColor,
      resourceId: flightType === 'Dual' ? instructor : student,
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
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-lg flex flex-col max-h-[90vh]"
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

          {/* Flight Tile */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Flight Tile</label>
            <FlightTilePreview
              flightType={flightType}
              instructor={instructor}
              student={student}
              flightNumber={flightNumber}
              startTime={startTime}
              duration={duration}
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
              onFlightTypeChange={setFlightType}
              onInstructorChange={setInstructor}
              onStudentChange={setStudent}
              onFlightNumberChange={setFlightNumber}
              onStartTimeChange={setStartTime}
              onDurationChange={setDuration}
              onAreaChange={setArea}
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