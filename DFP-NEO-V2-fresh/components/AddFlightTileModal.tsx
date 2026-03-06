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

const convertTimeToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + minutes / 60;
};

// ─── Enlarged Interactive Flight Tile ────────────────────────────────────────
interface FlightTilePreviewProps {
  instructor: string;
  student: string;
  flightNumber: string;
  startTime: number;
  duration: number;
  area: string;
  aircraftNumber: string;
  flightType: 'Dual' | 'Solo';
  color: string;
  // Dropdown options
  instructorOptions: { name: string; rank: string }[];
  traineeOptions: { name: string; rank: string }[];
  syllabusOptions: string[];
  areaOptions: string[];
  aircraftOptions: string[];
  timeOptions: { value: number; label: string }[];
  durationOptions: number[];
  // Handlers
  onInstructorChange: (v: string) => void;
  onStudentChange: (v: string) => void;
  onFlightNumberChange: (v: string) => void;
  onStartTimeChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onAreaChange: (v: string) => void;
  onAircraftChange: (v: string) => void;
  onFlightTypeChange: (v: 'Dual' | 'Solo') => void;
}

const selectClass =
  'bg-transparent border-0 border-b border-white/40 text-white text-sm font-semibold focus:outline-none focus:border-white/80 cursor-pointer w-full appearance-none text-center hover:border-white/60 transition-colors';

const FlightTilePreview: React.FC<FlightTilePreviewProps> = ({
  instructor, student, flightNumber, startTime, duration, area, aircraftNumber, flightType, color,
  instructorOptions, traineeOptions, syllabusOptions, areaOptions, aircraftOptions, timeOptions, durationOptions,
  onInstructorChange, onStudentChange, onFlightNumberChange, onStartTimeChange, onDurationChange,
  onAreaChange, onAircraftChange, onFlightTypeChange,
}) => {
  const endTime = startTime + duration;

  return (
    <div
      className={`relative rounded-lg shadow-2xl border-2 border-white/20 ${color} overflow-visible`}
      style={{ width: '100%', minHeight: 140 }}
    >
      {/* Top time bar */}
      <div className="flex justify-between items-center px-3 pt-1.5 pb-0.5 border-b border-white/20">
        <span className="font-mono text-white/70 text-xs">{formatTime(startTime)}</span>
        <span className="font-mono text-white/50 text-xs">→</span>
        <span className="font-mono text-white/70 text-xs">{formatTime(endTime)}</span>
      </div>

      {/* Main tile body */}
      <div className="flex items-stretch px-3 py-2 gap-3">

        {/* Left: Crew */}
        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
          {/* Flight type toggle */}
          <div className="flex gap-1 mb-1">
            {(['Dual', 'Solo'] as const).map(ft => (
              <button
                key={ft}
                type="button"
                onClick={() => onFlightTypeChange(ft)}
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  flightType === ft
                    ? 'bg-white/30 text-white'
                    : 'bg-white/10 text-white/50 hover:bg-white/20'
                }`}
              >
                {ft}
              </button>
            ))}
          </div>

          {/* Instructor / PIC */}
          <div className="relative">
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">
              {flightType === 'Solo' ? 'Pilot (Solo)' : 'Instructor'}
            </div>
            <select
              value={flightType === 'Solo' ? student : instructor}
              onChange={e => flightType === 'Solo' ? onStudentChange(e.target.value) : onInstructorChange(e.target.value)}
              className={selectClass}
            >
              <option value="">— Select —</option>
              {flightType === 'Solo'
                ? traineeOptions.map(t => (
                    <option key={t.name} value={t.name}>{t.rank} {t.name}</option>
                  ))
                : instructorOptions.map(i => (
                    <option key={i.name} value={i.name}>{i.rank} {i.name}</option>
                  ))
              }
            </select>
          </div>

          {/* Student (only for Dual) */}
          {flightType === 'Dual' && (
            <div className="relative">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Student</div>
              <select
                value={student}
                onChange={e => onStudentChange(e.target.value)}
                className={`${selectClass} text-white/80`}
              >
                <option value="">— Select —</option>
                {traineeOptions.map(t => (
                  <option key={t.name} value={t.name}>{t.rank} {t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px bg-white/20 self-stretch" />

        {/* Right: Event details */}
        <div className="flex flex-col justify-between gap-2" style={{ minWidth: 130 }}>
          {/* Syllabus / Flight Number */}
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Syllabus Item</div>
            <select
              value={flightNumber}
              onChange={e => onFlightNumberChange(e.target.value)}
              className={`${selectClass} font-mono text-sky-300`}
            >
              <option value="">— Select —</option>
              {syllabusOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Start Time + Duration */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Start</div>
              <select
                value={startTime}
                onChange={e => onStartTimeChange(parseFloat(e.target.value))}
                className={selectClass}
              >
                {timeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Dur (hr)</div>
              <select
                value={duration}
                onChange={e => onDurationChange(parseFloat(e.target.value))}
                className={selectClass}
              >
                {durationOptions.map(d => (
                  <option key={d} value={d}>{d.toFixed(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Area + Aircraft */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">Area</div>
              <select
                value={area}
                onChange={e => onAreaChange(e.target.value)}
                className={`${selectClass} text-yellow-300`}
              >
                {areaOptions.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-0.5">A/C #</div>
              <select
                value={aircraftNumber}
                onChange={e => onAircraftChange(e.target.value)}
                className={`${selectClass} font-mono`}
              >
                {aircraftOptions.map(n => (
                  <option key={n} value={n}>#{n}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: aircraft number + area display */}
      <div className="flex justify-between items-center px-3 pb-1.5 pt-0.5 border-t border-white/20">
        <span className="font-mono text-white/60 text-xs">#{aircraftNumber}</span>
        <span className="font-mono text-sky-300 text-xs font-bold">{flightNumber || '—'}</span>
        <span className={`text-xs font-bold ${['A','B','C','D','E','F','G','H'].includes(area) ? 'text-white/70' : 'text-yellow-300'}`}>
          {area}
        </span>
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const AddFlightTileModal: React.FC<AddFlightTileModalProps> = ({
  onClose, onSave, instructors, trainees, syllabusDetails, school,
  traineesData, instructorsData, courseColors, date, traineeLMPs,
}) => {
  // ── State ──
  const [eventCategory, setEventCategory] = useState<'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di'>('lmp_event');
  const [flightType, setFlightType] = useState<'Dual' | 'Solo'>('Dual');
  const [instructor, setInstructor] = useState('');
  const [student, setStudent] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [startTime, setStartTime] = useState(8.0);
  const [duration, setDuration] = useState(1.0);
  const [area, setArea] = useState('A');
  const [aircraftNumber, setAircraftNumber] = useState('001');
  const [locationType, setLocationType] = useState<'Local' | 'Land Away'>('Local');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // ── Derived colour from student's course ──
  const tileColor = useMemo(() => {
    const name = flightType === 'Solo' ? student : student;
    if (!name) return 'bg-sky-700';
    const trainee = traineesData.find(t => t.fullName === name || t.name === name);
    if (!trainee?.course) return 'bg-sky-700';
    return courseColors[trainee.course] || 'bg-sky-700';
  }, [student, flightType, traineesData, courseColors]);

  // ── Options ──
  const areas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const aircraftOptions = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0'));

  const timeOptions = useMemo(() => {
    const opts: { value: number; label: string }[] = [];
    for (let h = 6; h <= 23; h++) {
      for (let m = 0; m < 60; m += 15) {
        const val = h + m / 60;
        opts.push({ value: val, label: formatTime(val) });
      }
    }
    return opts;
  }, []);

  const durationOptions = useMemo(() => {
    const opts: number[] = [];
    for (let d = 0.5; d <= 4.0; d += 0.1) {
      opts.push(Math.round(d * 10) / 10);
    }
    return opts;
  }, []);

  const instructorOptions = useMemo(() =>
    instructorsData.map(i => ({ name: i.name, rank: i.rank || '' })),
    [instructorsData]
  );

  const traineeOptions = useMemo(() =>
    traineesData.map(t => ({ name: t.fullName || t.name, rank: t.rank || '' })),
    [traineesData]
  );

  const syllabusOptions = useMemo(() => {
    const flightItems = syllabusDetails
      .filter(d => d.type === 'Flight' || d.type === 'flight' || (!d.type && !d.id?.includes('FTD') && !d.id?.includes('CPT')))
      .map(d => d.id || d.code || '')
      .filter(Boolean);
    const unique = Array.from(new Set(flightItems)).sort();
    if (eventCategory === 'sct') return ['SCT FORM', ...unique];
    return unique;
  }, [syllabusDetails, eventCategory]);

  // Auto-set flightType from LMP when student + flightNumber change
  useEffect(() => {
    if (!student || !flightNumber || !traineeLMPs) return;
    const lmp = traineeLMPs.get(student);
    if (!lmp) return;
    const item = lmp.find(i => i.id === flightNumber || i.code === flightNumber);
    if (item?.sortieType) setFlightType(item.sortieType);
  }, [student, flightNumber, traineeLMPs]);

  // ── Validation & Save ──
  const handleSave = () => {
    const errs: string[] = [];
    if (!flightNumber) errs.push('Syllabus item is required.');
    if (flightType === 'Dual' && !instructor) errs.push('Instructor is required for Dual flights.');
    if (!student && flightType === 'Dual') errs.push('Student is required for Dual flights.');
    if (flightType === 'Solo' && !student) errs.push('Pilot is required for Solo flights.');
    if (!startTime) errs.push('Start time is required.');
    if (!duration || duration <= 0) errs.push('Duration must be greater than 0.');
    if (errs.length > 0) { setErrors(errs); return; }

    const eventType = 'flight';
    const pilot = flightType === 'Solo' ? student : instructor;

    const newEvent: ScheduleEvent = {
      id: uuidv4(),
      date,
      type: eventType,
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
        className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh] animate-fade-in"
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Event Category ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Event Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEventCategory(key as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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

          {/* ── Enlarged Interactive Flight Tile ── */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Flight Tile — click any field to edit
            </label>
            <FlightTilePreview
              instructor={instructor}
              student={student}
              flightNumber={flightNumber}
              startTime={startTime}
              duration={duration}
              area={area}
              aircraftNumber={aircraftNumber}
              flightType={flightType}
              color={tileColor}
              instructorOptions={instructorOptions}
              traineeOptions={traineeOptions}
              syllabusOptions={syllabusOptions}
              areaOptions={areas}
              aircraftOptions={aircraftOptions}
              timeOptions={timeOptions}
              durationOptions={durationOptions}
              onInstructorChange={setInstructor}
              onStudentChange={setStudent}
              onFlightNumberChange={setFlightNumber}
              onStartTimeChange={setStartTime}
              onDurationChange={setDuration}
              onAreaChange={setArea}
              onAircraftChange={setAircraftNumber}
              onFlightTypeChange={setFlightType}
            />
          </div>

          {/* ── Additional Fields ── */}
          <div className="border-t border-gray-700 pt-5">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Additional Details</label>
            <div className="grid grid-cols-2 gap-4">
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Location Type</label>
                <select
                  value={locationType}
                  onChange={e => setLocationType(e.target.value as 'Local' | 'Land Away')}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="Local">Local</option>
                  <option value="Land Away">Land Away</option>
                </select>
              </div>

              {/* Date display */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Date</label>
                <div className="w-full bg-gray-700/50 border border-gray-600 rounded-md py-2 px-3 text-gray-300 text-sm font-mono">
                  {date}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-400 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes..."
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
            </div>
          </div>

          {/* ── Errors ── */}
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