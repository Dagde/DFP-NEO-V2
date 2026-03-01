import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Trainee, TraineeRank, SeatConfig, UnavailabilityPeriod, ScheduleEvent, Score, SyllabusItemDetail, UnavailabilityReason, Instructor, LogbookExperience } from '../types';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import PauseConfirmationFlyout from './PauseConfirmationFlyout';
import ScheduleWarningFlyout from './ScheduleWarningFlyout';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';

const COURSE_MASTER_LMPS = ['BPC+IPC', 'FIC', 'OFI', 'WSO', 'FIC(I)', 'PLT CONV', 'QFI CONV', 'PLT Refresh', 'Staff CAT'];

interface TraineeProfileFlyoutProps {
  trainee: Trainee;
  onClose: () => void;
  onUpdateTrainee: (data: Trainee) => void;
  events: ScheduleEvent[];
  school: 'ESL' | 'PEA';
  onNavigateToHateSheet: (trainee: Trainee) => void;
  onViewIndividualLMP: (trainee: Trainee) => void;
  onAddRemedialPackage: (trainee: Trainee) => void;
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
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
}

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean }> = ({ label, value, onChange, readOnly }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
    <input type="text" value={value} onChange={onChange} readOnly={readOnly}
      className={`block w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`} />
  </div>
);

const Dropdown: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }> = ({ label, value, onChange, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
    <select value={value} onChange={onChange}
      className="block w-full bg-gray-700 border border-gray-600 rounded py-1 px-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500">
      {children}
    </select>
  </div>
);

const ExperienceInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => (
  <div className="flex flex-col items-center">
    <label className="text-xs text-gray-400 mb-1">{label}</label>
    <input type="number" min="0" step="0.1" value={value} onFocus={(e) => e.target.select()}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-16 bg-gray-700 border border-gray-600 rounded py-1 px-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
  </div>
);

const CircularGauge: React.FC<{ title: string; mainValue: number; subItems: { label: string; value: number }[] }> = ({ title, mainValue, subItems }) => (
  <div className="flex flex-col items-center bg-gray-800 border border-gray-600 rounded-lg p-3 flex-1">
    <span className="text-xs text-gray-300 font-semibold mb-2">{title}</span>
    <div className="relative flex items-center justify-center mb-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="32" cy="32" r="26" fill="none" stroke="#4b5563" strokeWidth="6"
          strokeDasharray={`${Math.min(mainValue / 100 * 163, 163)} 163`}
          strokeLinecap="round" transform="rotate(-90 32 32)" />
        <circle cx="32" cy="56" r="3" fill="#ef4444" />
      </svg>
      <span className="absolute text-white font-bold text-sm">{mainValue.toFixed(1)}</span>
    </div>
    <div className="w-full space-y-0.5">
      {subItems.map(item => (
        <div key={item.label} className="flex justify-between text-xs">
          <span className="text-gray-400">{item.label}</span>
          <span className="text-white font-mono">{item.value.toFixed(1)}</span>
        </div>
      ))}
    </div>
  </div>
);

const InstrumentGauge: React.FC<{ sim: number; actual: number }> = ({ sim, actual }) => (
  <div className="flex flex-col items-center bg-gray-800 border border-gray-600 rounded-lg p-3 flex-1">
    <span className="text-xs text-gray-300 font-semibold mb-2">Instrument</span>
    <div className="relative flex items-center justify-center mb-2">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="#374151" strokeWidth="6" />
        <circle cx="32" cy="56" r="3" fill="#ef4444" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-gray-400 text-[9px]">Sim</span>
        <span className="text-white font-bold text-xs">{sim.toFixed(1)}</span>
      </div>
    </div>
    <div className="w-full space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">Actual</span>
        <span className="text-white font-mono">{actual.toFixed(1)}</span>
      </div>
    </div>
  </div>
);

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const initialExperience: LogbookExperience = {
  day: { p1: 0, p2: 0, dual: 0 },
  night: { p1: 0, p2: 0, dual: 0 },
  total: 0, captain: 0, instructor: 0,
  instrument: { sim: 0, actual: 0 },
  simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
};

const TraineeProfileFlyout: React.FC<TraineeProfileFlyoutProps> = ({
  trainee, onClose, onUpdateTrainee, events, school,
  onNavigateToHateSheet, onViewIndividualLMP, onAddRemedialPackage,
  personnelData, courseColors, scores, syllabusDetails,
  onNavigateToSyllabus, onNavigateToCurrency, locations, units,
  individualLmp, onViewLogbook, isCreating = false, activeCourses = []
}) => {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [showAddUnavailability, setShowAddUnavailability] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showScheduleWarning, setShowScheduleWarning] = useState(false);

  const [name, setName] = useState(trainee.name);
  const [idNumber, setIdNumber] = useState(trainee.idNumber);
  const [rank, setRank] = useState<TraineeRank>(trainee.rank);
  const [service, setService] = useState(trainee.service || '');
  const [course, setCourse] = useState(trainee.course || activeCourses[0] || '');
  const [lmpType, setLmpType] = useState(trainee.lmpType || 'BPC+IPC');
  const [traineeCallsign, setTraineeCallsign] = useState(trainee.traineeCallsign || '');
  const [seatConfig, setSeatConfig] = useState<SeatConfig>(trainee.seatConfig);
  const [isPaused, setIsPaused] = useState(trainee.isPaused);
  const [unavailability, setUnavailability] = useState<UnavailabilityPeriod[]>(trainee.unavailability || []);
  const [location, setLocation] = useState(trainee.location || locations[0] || '');
  const [unit, setUnit] = useState(trainee.unit || units[0] || '');
  const [flight, setFlight] = useState(trainee.flight || '');
  const [phoneNumber, setPhoneNumber] = useState(trainee.phoneNumber || '');
  const [email, setEmail] = useState(trainee.email || '');
  const [permissions, setPermissions] = useState<string[]>(trainee.permissions || []);
  const [priorExperience, setPriorExperience] = useState<LogbookExperience>(trainee.priorExperience || initialExperience);

  const allPermissions = useMemo(() => ['Trainee', 'Staff', 'Ops', 'Course Supervisor', 'Admin', 'Super Admin'], []);
  const callsignData = useMemo(() => personnelData.get(trainee.fullName), [personnelData, trainee.fullName]);

  const { lastFlight, lastEvent, daysSinceLastFlight, daysSinceLastEvent } = useMemo(() => {
    const traineeScores = scores.get(trainee.fullName) || [];
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const calculateDays = (dateStr: string | undefined): number | null => {
      if (!dateStr) return null;
      return Math.round((today.getTime() - new Date(dateStr + 'T00:00:00Z').getTime()) / (1000 * 60 * 60 * 24));
    };
    if (traineeScores.length === 0) return { lastFlight: null, lastEvent: null, daysSinceLastFlight: null, daysSinceLastEvent: null };
    const sortedScores = [...traineeScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastEvt = sortedScores[0] || null;
    const lastFlt = sortedScores.find(score => syllabusDetails.find(item => item.id === score.event)?.type === 'Flight') || null;
    return { lastFlight: lastFlt, lastEvent: lastEvt, daysSinceLastFlight: calculateDays(lastFlt?.date), daysSinceLastEvent: calculateDays(lastEvt?.date) };
  }, [trainee.fullName, scores, syllabusDetails]);

  const { nextEvent, subsequentEvent, nextEventReason } = useMemo(() => {
    if (isCreating) return { nextEvent: null, subsequentEvent: null, nextEventReason: 'New Trainee' };
    const traineeScores = scores.get(trainee.fullName) || [];
    const completedEventIds = new Set(traineeScores.map(s => s.event));
    let nextEvt: SyllabusItemDetail | null = null, subsequentEvt: SyllabusItemDetail | null = null, reason = '', nextEventIndex = -1;
    for (let i = 0; i < individualLmp.length; i++) {
      const item = individualLmp[i];
      if (completedEventIds.has(item.id) || item.code.includes(' MB')) continue;
      if (item.prerequisites.every(prereqId => completedEventIds.has(prereqId))) { nextEvt = item; nextEventIndex = i; break; }
    }
    if (nextEventIndex !== -1) {
      for (let i = nextEventIndex + 1; i < individualLmp.length; i++) {
        if (!individualLmp[i].code.includes(' MB')) { subsequentEvt = individualLmp[i]; break; }
      }
    }
    if (!nextEvt) {
      const allStandard = individualLmp.filter(item => !item.isRemedial && !item.code.includes(' MB'));
      reason = allStandard.every(item => completedEventIds.has(item.id)) ? 'Syllabus complete.' : 'Prerequisites incomplete.';
    }
    return { nextEvent: nextEvt, subsequentEvent: subsequentEvt, nextEventReason: reason };
  }, [trainee.fullName, scores, individualLmp, isCreating]);

  const resetState = () => {
    setName(trainee.name); setIdNumber(trainee.idNumber); setRank(trainee.rank);
    setService(trainee.service || ''); setCourse(trainee.course || activeCourses[0] || '');
    setLmpType(trainee.lmpType || 'BPC+IPC'); setTraineeCallsign(trainee.traineeCallsign || '');
    setSeatConfig(trainee.seatConfig); setIsPaused(trainee.isPaused);
    setUnavailability(trainee.unavailability || []); setLocation(trainee.location || locations[0] || '');
    setUnit(trainee.unit || units[0] || ''); setFlight(trainee.flight || '');
    setPhoneNumber(trainee.phoneNumber || ''); setEmail(trainee.email || '');
    setPermissions(trainee.permissions || []); setPriorExperience(trainee.priorExperience || initialExperience);
  };

  useEffect(() => { resetState(); setIsEditing(isCreating); }, [trainee, isCreating]);
  useEffect(() => {
    if (!isCreating) logAudit({ action: 'View', description: `Viewed trainee profile for ${trainee.rank} ${trainee.name}`, changes: `Course: ${trainee.course}, Unit: ${trainee.unit}`, page: 'Trainee Roster' });
  }, []);

  const traineeHasEventsToday = useMemo(() => events.some(e => e.student === trainee.fullName || e.pilot === trainee.fullName), [events, trainee.fullName]);
  const handlePauseToggle = () => { if (!isPaused && traineeHasEventsToday) setShowScheduleWarning(true); else setShowPauseConfirm(true); };
  const confirmPause = () => { onUpdateTrainee({ ...trainee, isPaused: !trainee.isPaused }); setShowPauseConfirm(false); };

  const handleNameChange = (v: string) => { const old = name; setName(v); if (old && v !== old) debouncedAuditLog(`trainee-${trainee.idNumber}-name`, 'Edit', 'Updated trainee name', `Name: ${old} → ${v}`, 'Trainee Roster'); };
  const handleRankChange = (v: TraineeRank) => { const old = rank; setRank(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-rank`, 'Edit', 'Updated trainee rank', `Rank: ${old} → ${v}`, 'Trainee Roster'); };
  const handleCourseChange = (v: string) => { const old = course; setCourse(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-course`, 'Edit', 'Updated trainee course', `Course: ${old} → ${v}`, 'Trainee Roster'); };
  const handleLmpTypeChange = (v: string) => { const old = lmpType; setLmpType(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-lmptype`, 'Edit', 'Updated trainee LMP type', `LMP: ${old} → ${v}`, 'Trainee Roster'); };
  const handleTraineeCallsignChange = (v: string) => { const old = traineeCallsign; setTraineeCallsign(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-callsign`, 'Edit', 'Updated trainee callsign', `Callsign: ${old} → ${v}`, 'Trainee Roster'); };
  const handleUnitChange = (v: string) => { const old = unit; setUnit(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-unit`, 'Edit', 'Updated trainee unit', `Unit: ${old} → ${v}`, 'Trainee Roster'); };
  const handleLocationChange = (v: string) => { const old = location; setLocation(v); if (old !== v) debouncedAuditLog(`trainee-${trainee.idNumber}-location`, 'Edit', 'Updated trainee location', `Location: ${old} → ${v}`, 'Trainee Roster'); };

  const handleSave = async () => {
    if (!name || !course) { alert("Name and Course are required."); return; }
    const fullName = `${name} – ${course}`;
    const updatedTrainee: Trainee = { ...trainee, idNumber, name, fullName, course, lmpType, traineeCallsign, rank, seatConfig, isPaused, unavailability, location, unit, flight, phoneNumber, email, permissions, priorExperience };
    flushPendingAudits();
    if (isCreating) logAudit({ action: 'Add', description: `Added new trainee ${rank} ${name}`, changes: `Course: ${course}, Unit: ${unit}, Location: ${location}`, page: 'Trainee Roster' });
    onUpdateTrainee(updatedTrainee);
    try {
      const cleanName = name.replace(/,\s/g, '_');
      const fileName = `Logbook_${cleanName}_${idNumber}.json`;
      const file = new File([JSON.stringify(priorExperience, null, 2)], fileName, { type: "application/json" });
      await addFile(file, 'trainee_logbook', fileName);
    } catch (error) { console.error("Failed to save logbook data:", error); }
    setIsEditing(false);
    if (isCreating) onClose();
  };

  const handleCancel = () => { if (isCreating) onClose(); else { resetState(); setIsEditing(false); } };
  const handlePermissionChange = (permission: string, isChecked: boolean) => setPermissions(prev => isChecked ? [...prev, permission] : prev.filter(p => p !== permission));
  const handleHateSheetClick = () => { onNavigateToHateSheet(trainee); onClose(); };
  const handleIndividualLMPClick = () => { onViewIndividualLMP(trainee); onClose(); };
  const handleExperienceChange = (section: keyof LogbookExperience, field: string | null, value: number) => {
    setPriorExperience(prev => field ? { ...prev, [section]: { ...(prev[section] as any), [field]: value } } : { ...prev, [section]: value });
  };

  const handleAddTodayOnlyUnavailability = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newPeriod: UnavailabilityPeriod = { id: uuidv4(), startDate: todayStr, endDate: todayStr, allDay: false, startTime: '0001', endTime: '2359', reason: 'Other', notes: 'Today Only' };
    if (isCreating) { setUnavailability(prev => [...prev, newPeriod]); setShowAddUnavailability(false); }
    else { logAudit({ action: 'Add', description: `Added unavailability for ${trainee.rank} ${trainee.name}`, changes: `Today Only - ${todayStr}`, page: 'Trainee Roster' }); onUpdateTrainee({ ...trainee, unavailability: [...(trainee.unavailability || []), newPeriod] }); setShowAddUnavailability(false); }
  };

  const handleSaveCustomUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
    const newPeriod = { ...periodData, id: uuidv4(), startTime: periodData.allDay ? undefined : periodData.startTime, endTime: periodData.allDay ? undefined : periodData.endTime };
    if (isCreating) setUnavailability(prev => [...prev, newPeriod]);
    else onUpdateTrainee({ ...trainee, unavailability: [...(trainee.unavailability || []), newPeriod] });
  };

  const handleRemoveUnavailabilityFromFlyout = (idToRemove: string) => {
    if (isCreating) setUnavailability(prev => prev.filter(p => p.id !== idToRemove));
    else onUpdateTrainee({ ...trainee, unavailability: (trainee.unavailability || []).filter(p => p.id !== idToRemove) });
  };

  const formatMilitaryTime = (t: string | undefined) => t ? t.replace(':', '') : '';
  const btnClass = "w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed";
  const exp = priorExperience;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={onClose}>
        <div className="bg-[#1a2235] rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-600 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-600 flex justify-between items-center bg-[#151d2e] flex-shrink-0">
            <h2 className="text-lg font-bold text-white">{isCreating ? 'New Trainee' : 'Trainee Profile'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold leading-none">✕</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* TOP CARD */}
              <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InputField label="Name (Surname, Firstname)" value={name} onChange={e => handleNameChange(e.target.value)} />
                      <InputField label="ID Number" value={idNumber} onChange={e => setIdNumber(parseInt(e.target.value) || 0)} />
                      <Dropdown label="Course" value={course} onChange={e => handleCourseChange(e.target.value)}>
                        {activeCourses.length > 0 ? activeCourses.map(c => <option key={c} value={c}>{c}</option>) : <option disabled>No courses</option>}
                      </Dropdown>
                      <Dropdown label="LMP" value={lmpType} onChange={e => handleLmpTypeChange(e.target.value)}>
                        {COURSE_MASTER_LMPS.map(lmp => <option key={lmp} value={lmp}>{lmp}</option>)}
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <InputField label="Trainee Callsign" value={traineeCallsign} onChange={e => handleTraineeCallsignChange(e.target.value)} />
                      <Dropdown label="Rank" value={rank} onChange={e => handleRankChange(e.target.value as TraineeRank)}>
                        <option value="OCDT">OCDT</option><option value="MIDN">MIDN</option><option value="PLTOFF">PLTOFF</option>
                        <option value="FLGOFF">FLGOFF</option><option value="SBLT">SBLT</option><option value="2LT">2LT</option><option value="FLTLT">FLTLT</option>
                      </Dropdown>
                      <Dropdown label="Service" value={service} onChange={e => setService(e.target.value)}>
                        <option value="">Select...</option><option value="RAAF">RAAF</option><option value="RAN">RAN</option><option value="ARA">ARA</option>
                      </Dropdown>
                      <Dropdown label="Unit" value={unit} onChange={e => handleUnitChange(e.target.value)}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}>
                        <option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option>
                      </Dropdown>
                      <Dropdown label="Location" value={location} onChange={e => handleLocationChange(e.target.value)}>
                        {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </Dropdown>
                      <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                      <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Permissions</label>
                        <div className="grid grid-cols-3 gap-1">
                          {allPermissions.map(perm => (
                            <label key={perm} className="flex items-center space-x-1 cursor-pointer">
                              <input type="checkbox" checked={permissions.includes(perm)} onChange={e => handlePermissionChange(perm, e.target.checked)} className="h-3 w-3 accent-sky-500" />
                              <span className="text-white text-xs">{perm}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {!isCreating && (
                      <div className="flex items-center justify-between p-2 bg-gray-700/30 rounded">
                        <span className="text-sm text-gray-300 font-semibold">Pause Trainee (NTSC)</span>
                        <button onClick={handlePauseToggle} className={`relative inline-flex items-center h-5 rounded-full w-10 transition-colors ${isPaused ? 'bg-amber-500' : 'bg-gray-600'}`}>
                          <span className={`transform transition-transform inline-block w-4 h-4 bg-white rounded-full ${isPaused ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-4">
                    {/* Profile photo */}
                    <div className="flex-shrink-0">
                      <div className="w-16 h-20 bg-gray-600 rounded border border-gray-500 flex items-center justify-center overflow-hidden">
                        <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      </div>
                    </div>

                    {/* Name + data grid */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-xl font-bold text-white">{trainee.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${trainee.isPaused ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'}`}>
                          {trainee.isPaused ? 'Paused' : 'Active'}
                        </span>
                      </div>
                      <div className="grid grid-cols-6 gap-x-4 gap-y-2 text-xs">
                        <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{trainee.idNumber}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Course</span><span className={`font-semibold px-1 rounded text-white text-[10px] ${courseColors[trainee.course] || 'bg-gray-500'}`}>{trainee.course}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">LMP</span><span className="text-sky-300 font-medium">{trainee.lmpType || 'BPC+IPC'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{trainee.traineeCallsign || `${callsignData?.callsignPrefix || ''}${callsignData?.callsignNumber || ''}`}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Permissions</span><span className="text-white">• {(trainee.permissions || ['Trainee']).join(', ')}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{trainee.rank}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{trainee.service || 'RAAF'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{trainee.unit}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{trainee.seatConfig}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{trainee.location}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{trainee.flight || 'N/A'}</span></div>
                        <div className="col-span-2"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{trainee.phoneNumber || 'N/A'}</span></div>
                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{trainee.email || 'N/A'}</span></div>
                      </div>
                    </div>

                    {/* Instructors */}
                    <div className="flex-shrink-0 w-44 space-y-2">
                      <div className="bg-[#151d2e] border border-gray-600 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-semibold mb-2">Primary Instructor</div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                          </div>
                          <span className="text-white text-xs font-medium">{trainee.primaryInstructor || 'Not Assigned'}</span>
                        </div>
                      </div>
                      <div className="bg-[#151d2e] border border-gray-600 rounded-lg p-2">
                        <div className="text-[10px] text-gray-400 font-semibold mb-2">Secondary Instructor</div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                          </div>
                          <span className="text-white text-xs font-medium">{trainee.secondaryInstructor || 'Not Assigned'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LOGBOOK - VIEW MODE */}
              {!isEditing && (
                <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-gray-300 mb-3">Logbook – Prior Experience (PC-21 only)</h4>
                  <div className="flex gap-2">
                    <CircularGauge title="Day Flying" mainValue={exp.day.p1 + exp.day.p2 + exp.day.dual}
                      subItems={[{ label: 'P1', value: exp.day.p1 }, { label: 'P2', value: exp.day.p2 }, { label: 'Dual', value: exp.day.dual }]} />
                    <CircularGauge title="Night Flying" mainValue={exp.night.p1 + exp.night.p2 + exp.night.dual}
                      subItems={[{ label: 'P1', value: exp.night.p1 }, { label: 'P2', value: exp.night.p2 }, { label: 'Dual', value: exp.night.dual }]} />
                    <CircularGauge title="Totals" mainValue={exp.total}
                      subItems={[{ label: 'TOTAL', value: exp.total }, { label: 'Captain', value: exp.captain }, { label: 'Instructor', value: exp.instructor }]} />
                    <InstrumentGauge sim={exp.instrument.sim} actual={exp.instrument.actual} />
                    <CircularGauge title="Simulator" mainValue={exp.simulator.total}
                      subItems={[{ label: 'P1', value: exp.simulator.p1 }, { label: 'P2', value: exp.simulator.p2 }, { label: 'Dual', value: exp.simulator.dual }, { label: 'Total', value: exp.simulator.total }]} />
                  </div>
                </div>
              )}

              {/* LOGBOOK - EDIT MODE */}
              {isEditing && (
                <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-sky-400 mb-3">Logbook – Prior Experience (PC-21 only)</h4>
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
                    <div><span className="block text-xs font-bold text-gray-300 mb-2 text-center">Simulator</span>
                      <div className="flex justify-center space-x-2">
                        <ExperienceInput label="P1" value={exp.simulator.p1} onChange={v => handleExperienceChange('simulator', 'p1', v)} />
                        <ExperienceInput label="P2" value={exp.simulator.p2} onChange={v => handleExperienceChange('simulator', 'p2', v)} />
                        <ExperienceInput label="Dual" value={exp.simulator.dual} onChange={v => handleExperienceChange('simulator', 'dual', v)} />
                        <ExperienceInput label="Total" value={exp.simulator.total} onChange={v => handleExperienceChange('simulator', 'total', v)} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NEXT/LAST EVENT CARDS */}
              {!isCreating && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">Next Event</div>
                    {nextEvent ? (<>
                      <div className="text-white font-bold text-sm">{nextEvent.id}</div>
                      <div className="text-gray-300 text-xs">{nextEvent.code}</div>
                      <div className="flex justify-between mt-1 text-xs"><span className="text-gray-400">{nextEvent.type}</span><span className="text-white">{nextEvent.duration.toFixed(1)} hrs</span></div>
                    </>) : <div className="text-gray-500 text-xs italic">{nextEventReason || 'No event found.'}</div>}
                  </div>
                  <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">Next Event +1</div>
                    {subsequentEvent ? (<>
                      <div className="text-white font-bold text-sm">{subsequentEvent.id}</div>
                      <div className="text-gray-300 text-xs">{subsequentEvent.code}</div>
                      <div className="flex justify-between mt-1 text-xs"><span className="text-gray-400">{subsequentEvent.type}</span><span className="text-white">{subsequentEvent.duration.toFixed(1)} hrs</span></div>
                    </>) : <div className="text-gray-500 text-xs italic">No event found.</div>}
                  </div>
                  <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">Last Flight</div>
                    {lastFlight ? (<>
                      <div className="text-white font-bold text-sm">{lastFlight.event}</div>
                      <div className="flex justify-between mt-1 text-xs"><span className="text-white">{formatDate(lastFlight.date)}</span><span className="text-gray-300">{daysSinceLastFlight} days since</span></div>
                    </>) : <div className="text-gray-500 text-xs italic">No flight recorded.</div>}
                  </div>
                  <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">Last Event</div>
                    {lastEvent ? (<>
                      <div className="text-white font-bold text-sm">{lastEvent.event}</div>
                      <div className="flex justify-between mt-1 text-xs"><span className="text-white">{formatDate(lastEvent.date)}</span><span className="text-gray-300">{daysSinceLastEvent} days since</span></div>
                    </>) : <div className="text-gray-500 text-xs italic">No event recorded.</div>}
                  </div>
                </div>
              )}

              {/* UNAVAILABILITY */}
              <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Unavailability</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unavailability.length > 0 ? unavailability.map(p => {
                    const startDisplay = formatDate(p.startDate);
                    const endDisplay = formatDate(p.endDate);
                    const timeStr = p.allDay ? 'All Day' : `${formatMilitaryTime(p.startTime)}-${formatMilitaryTime(p.endTime)}`;
                    return (
                      <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                        <span className="text-white font-medium">{p.reason}</span>
                        <span className="text-gray-300 font-mono">{startDisplay}{p.startDate !== p.endDate ? ` – ${endDisplay}` : ''} {timeStr}</span>
                      </div>
                    );
                  }) : <p className="text-sm text-gray-500 text-center italic py-2">No unavailability periods scheduled.</p>}
                </div>
              </div>

            </div>

            {/* RIGHT BUTTON PANEL */}
            <div className="w-[95px] flex-shrink-0 border-l border-gray-600 bg-[#151d2e] pt-2 pb-2 px-[10px] flex flex-col space-y-[1px]">
              {!isEditing && (<>
                <button onClick={() => setShowAddUnavailability(true)} className={btnClass}>Unavailable</button>
                <button onClick={() => { onNavigateToCurrency(trainee); onClose(); }} className={btnClass}>Currency</button>
                <button onClick={handleHateSheetClick} className={btnClass}>PT-051</button>
                <button onClick={handleIndividualLMPClick} className={btnClass}>View Individual LMP</button>
                <button onClick={() => onAddRemedialPackage(trainee)} className={btnClass}>Add Remedial Package</button>
                <button onClick={() => { if (onViewLogbook) { onViewLogbook(trainee); onClose(); } }} className={btnClass}>Logbook</button>
                <button onClick={() => setIsEditing(true)} className={btnClass}>✦ Edit</button>
                <button onClick={onClose} className={btnClass}>Close</button>
              </>)}
              {isEditing && (<>
                <button onClick={handleSave} className={btnClass}>Save</button>
                <button onClick={handleCancel} className={btnClass}>Cancel</button>
              </>)}
            </div>
          </div>
        </div>
      </div>
      {showAddUnavailability && <AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnlyUnavailability} onSave={handleSaveCustomUnavailability} unavailabilityPeriods={trainee.unavailability || []} onRemove={handleRemoveUnavailabilityFromFlyout} />}
      {showScheduleWarning && <ScheduleWarningFlyout traineeName={trainee.name} onAcknowledge={() => { setShowScheduleWarning(false); setShowPauseConfirm(true); }} />}
      {showPauseConfirm && <PauseConfirmationFlyout onConfirm={confirmPause} onCancel={() => setShowPauseConfirm(false)} />}
    </>
  );
};

export default TraineeProfileFlyout;