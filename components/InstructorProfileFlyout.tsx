import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InstructorRank, Instructor, InstructorCategory, SeatConfig, UnavailabilityPeriod, UnavailabilityReason, Trainee, LogbookExperience } from '../types';
import { v4 as uuidv4 } from 'uuid';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';

interface InstructorProfileFlyoutProps {
  instructor: Instructor;
  onClose: () => void;
  school: 'ESL' | 'PEA';
  personnelData: Map<string, { callsignPrefix: string; callsignNumber: number }>;
  onUpdateInstructor: (data: Instructor) => void;
  onNavigateToCurrency: (person: Instructor) => void;
  originRect: DOMRect | null;
  isClosing: boolean;
  isCreating?: boolean;
  locations: string[];
  units: string[];
  traineesData: Trainee[];
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: () => void;
}

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; type?: string }> = ({ label, value, onChange, readOnly, type = 'text' }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
    <input type={type} value={value} onChange={onChange} readOnly={readOnly}
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

export const InstructorProfileFlyout: React.FC<InstructorProfileFlyoutProps> = ({
  instructor, onClose, school, personnelData, onUpdateInstructor,
  onNavigateToCurrency, originRect, isClosing, isCreating = false,
  locations, units, traineesData, onViewLogbook, onRequestSct
}) => {
  const [isEditing, setIsEditing] = useState(isCreating);
  const [showAddUnavailability, setShowAddUnavailability] = useState(false);

  const [idNumber, setIdNumber] = useState(instructor.idNumber);
  const [name, setName] = useState(instructor.name);
  const [rank, setRank] = useState<InstructorRank>(instructor.rank);
  const [role, setRole] = useState<'QFI' | 'SIM IP'>(instructor.role);
  const [callsignNumber, setCallsignNumber] = useState(instructor.callsignNumber);
  const [service, setService] = useState<'RAAF' | 'RAN' | 'ARA' | undefined>(instructor.service);
  const [category, setCategory] = useState<InstructorCategory>(instructor.category);
  const [seatConfig, setSeatConfig] = useState<SeatConfig>(instructor.seatConfig);
  const [unavailabilityPeriods, setUnavailabilityPeriods] = useState<UnavailabilityPeriod[]>(instructor.unavailability || []);
  const [location, setLocation] = useState(instructor.location || '');
  const [unit, setUnit] = useState(instructor.unit || '');
  const [flight, setFlight] = useState(instructor.flight || '');
  const [phoneNumber, setPhoneNumber] = useState(instructor.phoneNumber || '');
  const [email, setEmail] = useState(instructor.email || '');
  const [permissions, setPermissions] = useState<string[]>(instructor.permissions || []);
  const [priorExperience, setPriorExperience] = useState<LogbookExperience>(instructor.priorExperience || initialExperience);

  const [isTestingOfficer, setIsTestingOfficer] = useState(instructor.isTestingOfficer);
  const [isExecutive, setIsExecutive] = useState(instructor.isExecutive);
  const [isFlyingSupervisor, setIsFlyingSupervisor] = useState(instructor.isFlyingSupervisor);
  const [isIRE, setIsIRE] = useState(instructor.isIRE);
  const [isCommandingOfficer, setIsCommandingOfficer] = useState(instructor.isCommandingOfficer || false);
  const [isCFI, setIsCFI] = useState(instructor.isCFI || false);
  const [isDeputyFlightCommander, setIsDeputyFlightCommander] = useState(instructor.isDeputyFlightCommander || false);
  const [isContractor, setIsContractor] = useState(instructor.isContractor || false);
  const [isAdminStaff, setIsAdminStaff] = useState(instructor.isAdminStaff || false);
  const [isQFI, setIsQFI] = useState(instructor.isQFI || false);
  const [isOFI, setIsOFI] = useState(instructor.isOFI || false);

  const allPermissions = useMemo(() => ['Trainee', 'Staff', 'Ops', 'Scheduler', 'Course Supervisor', 'Admin', 'Super Admin'], []);

  const { primaryTrainees, secondaryTrainees } = useMemo(() => {
    if (!traineesData) return { primaryTrainees: [], secondaryTrainees: [] };
    const primary = traineesData.filter(t => t.primaryInstructor === instructor.name).sort((a, b) => a.name.localeCompare(b.name));
    const secondary = traineesData.filter(t => t.secondaryInstructor === instructor.name).sort((a, b) => a.name.localeCompare(b.name));
    return { primaryTrainees: primary, secondaryTrainees: secondary };
  }, [traineesData, instructor.name]);

  const callsignData = useMemo(() => personnelData.get(instructor.name), [personnelData, instructor.name]);

  const resetState = () => {
    setIdNumber(instructor.idNumber); setName(instructor.name); setRank(instructor.rank);
    setRole(instructor.role); setCallsignNumber(instructor.callsignNumber); setService(instructor.service);
    setCategory(instructor.category); setSeatConfig(instructor.seatConfig);
    setUnavailabilityPeriods(instructor.unavailability || []); setLocation(instructor.location || '');
    setUnit(instructor.unit || ''); setFlight(instructor.flight || '');
    setPhoneNumber(instructor.phoneNumber || ''); setEmail(instructor.email || '');
    setPermissions(instructor.permissions || []); setPriorExperience(instructor.priorExperience || initialExperience);
    setIsTestingOfficer(instructor.isTestingOfficer); setIsExecutive(instructor.isExecutive);
    setIsFlyingSupervisor(instructor.isFlyingSupervisor); setIsIRE(instructor.isIRE);
    setIsCommandingOfficer(instructor.isCommandingOfficer || false); setIsCFI(instructor.isCFI || false);
    setIsDeputyFlightCommander(instructor.isDeputyFlightCommander || false);
    setIsContractor(instructor.isContractor || false); setIsAdminStaff(instructor.isAdminStaff || false);
    setIsQFI(instructor.isQFI || false); setIsOFI(instructor.isOFI || false);
  };

  useEffect(() => { resetState(); setIsEditing(isCreating); }, [instructor, isCreating]);
  useEffect(() => {
    if (!isCreating) logAudit({ action: 'View', description: `Viewed staff profile for ${instructor.rank} ${instructor.name}`, changes: `Role: ${instructor.role}, Unit: ${instructor.unit}`, page: 'Staff' });
  }, []);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => { if (isCreating) onClose(); else { resetState(); setIsEditing(false); } };
  const handlePermissionChange = (permission: string, isChecked: boolean) => setPermissions(prev => isChecked ? [...prev, permission] : prev.filter(p => p !== permission));
  const handleExperienceChange = (section: keyof LogbookExperience, field: string | null, value: number) => {
    setPriorExperience(prev => field ? { ...prev, [section]: { ...(prev[section] as any), [field]: value } } : { ...prev, [section]: value });
  };

  const handleSave = async () => {
    if (!name) { alert("Name is required."); return; }
    const updatedInstructor: Instructor = {
      ...instructor, idNumber, name, rank, role, callsignNumber, service, category, seatConfig,
      unavailability: unavailabilityPeriods, location, unit, flight, phoneNumber, email, permissions,
      priorExperience, isTestingOfficer, isExecutive, isFlyingSupervisor, isIRE,
      isCommandingOfficer, isCFI, isDeputyFlightCommander, isContractor, isAdminStaff, isQFI, isOFI
    };
    flushPendingAudits();
    if (isCreating) logAudit({ action: 'Add', description: `Added new staff ${rank} ${name}`, changes: `Role: ${role}, Unit: ${unit}, Location: ${location}`, page: 'Staff' });
    onUpdateInstructor(updatedInstructor);
    try {
      const cleanName = name.replace(/,\s/g, '_');
      const fileName = `Logbook_${cleanName}_${idNumber}.json`;
      const file = new File([JSON.stringify(priorExperience, null, 2)], fileName, { type: "application/json" });
      await addFile(file, 'staff_logbook', fileName);
    } catch (error) { console.error("Failed to save logbook data:", error); }
    setIsEditing(false);
    if (isCreating) onClose();
  };

  const handleAddTodayOnly = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const newPeriod: UnavailabilityPeriod = { id: uuidv4(), startDate: todayStr, endDate: todayStr, allDay: false, startTime: '0001', endTime: '2359', reason: 'Other', notes: 'Today Only' };
    logAudit({ action: 'Add', description: `Added unavailability for ${instructor.rank} ${instructor.name}`, changes: `Today Only - ${todayStr}`, page: 'Staff' });
    onUpdateInstructor({ ...instructor, unavailability: [...(instructor.unavailability || []), newPeriod] });
    setShowAddUnavailability(false);
  };

  const handleSaveUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
    const newPeriod = { ...periodData, id: uuidv4(), startTime: periodData.allDay ? undefined : periodData.startTime, endTime: periodData.allDay ? undefined : periodData.endTime };
    onUpdateInstructor({ ...instructor, unavailability: [...(instructor.unavailability || []), newPeriod] });
  };

  const handleRemoveUnavailability = (idToRemove: string) => {
    onUpdateInstructor({ ...instructor, unavailability: (instructor.unavailability || []).filter(p => p.id !== idToRemove) });
  };

  const formatMilitaryTime = (t: string | undefined) => t ? t.replace(':', '') : '';
  const btnClass = "w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed";
  const exp = priorExperience;

  // Build role badges
  const roleBadges: string[] = [];
  if (isCommandingOfficer) roleBadges.push('CO');
  if (isCFI) roleBadges.push('CFI');
  if (isExecutive) roleBadges.push('Exec');
  if (isFlyingSupervisor) roleBadges.push('Fly Sup');
  if (isTestingOfficer) roleBadges.push('TO');
  if (isIRE) roleBadges.push('IRE');
  if (isQFI) roleBadges.push('QFI');
  if (isOFI) roleBadges.push('OFI');
  if (isDeputyFlightCommander) roleBadges.push('DFC');
  if (isContractor) roleBadges.push('Contractor');
  if (isAdminStaff) roleBadges.push('Admin Staff');

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={onClose}>
        <div className="bg-[#1a2235] rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-600 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-600 flex justify-between items-center bg-[#151d2e] flex-shrink-0">
            <h2 className="text-lg font-bold text-white">{isCreating ? 'New Staff' : 'Staff Profile'}</h2>
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
                      <InputField label="Name (Surname, Firstname)" value={name} onChange={e => setName(e.target.value)} />
                      <InputField label="ID Number" value={idNumber} onChange={e => setIdNumber(parseInt(e.target.value) || 0)} />
                      <Dropdown label="Rank" value={rank} onChange={e => setRank(e.target.value as InstructorRank)}>
                        <option value="WGCDR">WGCDR</option><option value="SQNLDR">SQNLDR</option>
                        <option value="FLTLT">FLTLT</option><option value="FLGOFF">FLGOFF</option>
                        <option value="PLTOFF">PLTOFF</option><option value="Mr">Mr</option><option value="Mrs">Mrs</option>
                      </Dropdown>
                      <Dropdown label="Role" value={role} onChange={e => setRole(e.target.value as 'QFI' | 'SIM IP')}>
                        <option value="QFI">QFI</option><option value="SIM IP">SIM IP</option>
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Dropdown label="Service" value={service || ''} onChange={e => setService(e.target.value as any)}>
                        <option value="">Select...</option><option value="RAAF">RAAF</option><option value="RAN">RAN</option><option value="ARA">ARA</option>
                      </Dropdown>
                      <Dropdown label="Category" value={category} onChange={e => setCategory(e.target.value as InstructorCategory)}>
                        <option value="UnCat">UnCat</option><option value="D">D</option><option value="C">C</option><option value="B">B</option><option value="A">A</option>
                      </Dropdown>
                      <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}>
                        <option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option>
                      </Dropdown>
                      <Dropdown label="Unit" value={unit} onChange={e => setUnit(e.target.value)}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Dropdown label="Location" value={location} onChange={e => setLocation(e.target.value)}>
                        {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </Dropdown>
                      <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                      <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                      <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    {/* Role checkboxes */}
                    <div className="bg-gray-700/30 rounded p-3">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Roles & Qualifications</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[['isCommandingOfficer', 'CO', isCommandingOfficer, setIsCommandingOfficer],
                          ['isCFI', 'CFI', isCFI, setIsCFI],
                          ['isExecutive', 'Executive', isExecutive, setIsExecutive],
                          ['isFlyingSupervisor', 'Flying Supervisor', isFlyingSupervisor, setIsFlyingSupervisor],
                          ['isTestingOfficer', 'Testing Officer', isTestingOfficer, setIsTestingOfficer],
                          ['isIRE', 'IRE', isIRE, setIsIRE],
                          ['isQFI', 'QFI', isQFI, setIsQFI],
                          ['isOFI', 'OFI', isOFI, setIsOFI],
                          ['isDeputyFlightCommander', 'DFC', isDeputyFlightCommander, setIsDeputyFlightCommander],
                          ['isContractor', 'Contractor', isContractor, setIsContractor],
                          ['isAdminStaff', 'Admin Staff', isAdminStaff, setIsAdminStaff],
                        ].map(([key, label, val, setter]: any) => (
                          <label key={key} className="flex items-center space-x-1 cursor-pointer">
                            <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="h-3 w-3 accent-sky-500" />
                            <span className="text-white text-xs">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Permissions */}
                    <div className="bg-gray-700/30 rounded p-3">
                      <label className="block text-xs font-medium text-gray-400 mb-2">Permissions</label>
                      <div className="grid grid-cols-4 gap-2">
                        {allPermissions.map(perm => (
                          <label key={perm} className="flex items-center space-x-1 cursor-pointer">
                            <input type="checkbox" checked={permissions.includes(perm)} onChange={e => handlePermissionChange(perm, e.target.checked)} className="h-3 w-3 accent-sky-500" />
                            <span className="text-white text-xs">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
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
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-xl font-bold text-white">{instructor.name}</h3>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">Active</span>
                        {roleBadges.map(badge => (
                          <span key={badge} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-800 text-sky-200">{badge}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-x-4 gap-y-2 text-xs">
                        <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{instructor.idNumber}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Role</span><span className="text-sky-300 font-medium">{instructor.role}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Category</span><span className="text-white font-medium">{instructor.category}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{callsignData?.callsignPrefix || ''}{instructor.callsignNumber || ''}</span></div>
                        <div className="col-span-2"><span className="text-gray-400 block text-[10px]">&nbsp;</span></div>

                        <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{instructor.rank}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{instructor.service || 'RAAF'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{instructor.unit}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                        <div className="col-span-2"><span className="text-gray-400 block text-[10px]">&nbsp;</span></div>

                        <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{instructor.seatConfig}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{instructor.location}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{instructor.flight || 'N/A'}</span></div>
                        <div className="col-span-2"><span className="text-gray-400 block text-[10px]">&nbsp;</span></div>

                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                        <div className="col-span-3"><span className="text-gray-400 block text-[10px]">Permissions</span><span className="text-white">• {(instructor.permissions || []).join(' • ') || 'None'}</span></div>
                      </div>
                    </div>

                    {/* Assigned Trainees - 4 slots (Primary + Secondary combined) */}
                    {!isCreating && (
                      <div className="flex-shrink-0 w-44">
                        <div className="bg-[#151d2e] border border-gray-600 rounded-lg p-2">
                          <div className="text-[10px] text-gray-400 font-semibold mb-2">Assigned Trainees</div>
                          <div className="space-y-1">
                            {(() => {
                              const allAssigned = [
                                ...primaryTrainees.map(t => ({ ...t, type: 'P' as const })),
                                ...secondaryTrainees.map(t => ({ ...t, type: 'S' as const }))
                              ].slice(0, 4);
                              const slots = Array.from({ length: 4 }, (_, i) => allAssigned[i] || null);
                              return slots.map((t, i) => (
                                <div key={i} className="flex items-center gap-1 min-h-[20px]">
                                  <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                                  </div>
                                  {t ? (
                                    <span className="text-white text-[10px] truncate">{t.name} <span className="text-gray-400">({t.type})</span></span>
                                  ) : (
                                    <span className="text-gray-600 text-[10px] italic">—</span>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
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

              {/* UNAVAILABILITY */}
              <div className="bg-[#1e2d42] border border-gray-600 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Unavailability</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unavailabilityPeriods.length > 0 ? unavailabilityPeriods.map(p => {
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
              {!isEditing && !isCreating && (<>
                <button onClick={() => setShowAddUnavailability(true)} className={btnClass}>Unavailable</button>
                <button onClick={() => onNavigateToCurrency(instructor)} className={btnClass}>Currency</button>
                <button onClick={() => { if (onViewLogbook) onViewLogbook(instructor); }} className={btnClass}>Logbook</button>
                <button onClick={onRequestSct} className={btnClass}>Request SCT</button>
                <button onClick={handleEdit} className={btnClass}>✦ Edit</button>
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
      {showAddUnavailability && !isCreating && (
        <AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnly} onSave={handleSaveUnavailability} unavailabilityPeriods={instructor.unavailability || []} onRemove={handleRemoveUnavailability} />
      )}
    </>
  );
};