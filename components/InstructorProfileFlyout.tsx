import { useSystemFreeze } from '../hooks/useSystemFreeze';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { InstructorRank, Instructor, InstructorCategory, SeatConfig, UnavailabilityPeriod, UnavailabilityReason, Trainee, LogbookExperience, MasterCurrency, CurrencyRequirement, PersonCurrencyStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import { addFile } from '../utils/db';
import { debouncedAuditLog, flushPendingAudits } from '../utils/auditDebounce';
import { logAudit } from '../utils/auditLogger';
import CurrencyPanel from './CurrencyPanel';
import CurrencyAuditFlyout from './CurrencyAuditFlyout';

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
  onNavigateToTrainee?: (trainee: Trainee) => void;
  masterCurrencies?: MasterCurrency[];
  currencyRequirements?: CurrencyRequirement[];
  profileInitialTab?: 'currency' | null;
  onProfileTabConsumed?: () => void;
  currentUserId?: string;
  currentUserName?: string;
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
  <div className="flex flex-col items-center bg-[#1a2a3a] border border-gray-500/50 rounded-lg p-3 flex-1 shadow-md" style={{boxShadow:'0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)'}}>
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
  <div className="flex flex-col items-center bg-[#1a2a3a] border border-gray-500/50 rounded-lg p-3 flex-1 shadow-md" style={{boxShadow:'0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)'}}>
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

// Returns "dd Mmm" e.g. "12 Apr"
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${day} ${month}`;
};

const initialExperience: LogbookExperience = {
  day: { p1: 0, p2: 0, dual: 0 },
  night: { p1: 0, p2: 0, dual: 0 },
  total: 0, captain: 0, instructor: 0,
  instrument: { sim: 0, actual: 0 },
  simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
};

// Shared 3D card style
const card3d = "rounded-lg border border-gray-500/60 shadow-md";
const card3dStyle = { background: 'linear-gradient(180deg, #243044 0%, #1e2d42 60%)', boxShadow: '0 6px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)' };

export const InstructorProfileFlyout: React.FC<InstructorProfileFlyoutProps> = ({
  instructor, onClose, school, personnelData, onUpdateInstructor,
  onNavigateToCurrency, originRect, isClosing, isCreating = false,
  locations, units, traineesData, onViewLogbook, onRequestSct, onNavigateToTrainee,
  masterCurrencies = [], currencyRequirements = [],
  profileInitialTab, onProfileTabConsumed,
  currentUserId, currentUserName,
}) => {
  const [isEditing, setIsEditing] = useState(isCreating);
    const { isFrozen } = useSystemFreeze();
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

  // ── Profile photo state ──────────────────────────────────────────────────────
  // photoUrl            = committed photo URL from DB (shown in view mode)
  // pendingPhotoDataUrl = photo selected in edit mode, not yet saved to DB
  // pendingPhotoRemoved = user clicked Remove in edit mode (applied on Save, reverted on Cancel)
  const [photoUrl, setPhotoUrl] = useState<string | null>(instructor.photoUrl || null);
  const [pendingPhotoDataUrl, setPendingPhotoDataUrl] = useState<string | null>(null);
  const [pendingPhotoRemoved, setPendingPhotoRemoved] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Edit mode only: read file → store as pendingPhotoDataUrl (no API call yet)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select an image file (JPG, PNG, GIF, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Image is too large. Please use an image under 2 MB.');
      return;
    }

    setPhotoError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPendingPhotoDataUrl(dataUrl);
      setPendingPhotoRemoved(false);
    } catch (err: any) {
      setPhotoError(`Could not read image: ${err.message}`);
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Edit mode only: mark photo for removal on Save
  const handlePhotoRemoveInEdit = () => {
    setPendingPhotoDataUrl(null);
    setPendingPhotoRemoved(true);
    setPhotoError(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  // ────────────────────────────────────────────────────────────────────────────

  const allPermissions = useMemo(() => ['Trainee', 'Staff', 'Ops', 'Scheduler', 'Course Supervisor', 'Admin', 'Super Admin'], []);

  const { primaryTrainees, secondaryTrainees } = useMemo(() => {
    if (!traineesData) return { primaryTrainees: [], secondaryTrainees: [] };
    const primary = traineesData.filter(t => {
      const p = t.primaryInstructor;
      return Array.isArray(p) ? p.includes(instructor.name) : p === instructor.name;
    }).sort((a, b) => a.name.localeCompare(b.name));
    const secondary = traineesData.filter(t => {
      const s = t.secondaryInstructor;
      return Array.isArray(s) ? s.includes(instructor.name) : s === instructor.name;
    }).sort((a, b) => a.name.localeCompare(b.name));
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
    setPhotoUrl(instructor.photoUrl || null);
    setPendingPhotoDataUrl(null);
    setPendingPhotoRemoved(false);
    setPhotoError(null);
  };

  useEffect(() => { resetState(); setIsEditing(isCreating); }, [instructor, isCreating]);
  
  // Use ref to prevent double-logging in React StrictMode
  const hasLoggedViewRef = useRef(false);
  useEffect(() => {
    if (!isCreating && !hasLoggedViewRef.current) {
      hasLoggedViewRef.current = true;
      logAudit({ action: 'View', description: `Viewed staff profile for ${instructor.rank} ${instructor.name}`, changes: `Role: ${instructor.role}, Unit: ${instructor.unit}`, page: 'Staff' });
    }
  }, []);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => { if (isCreating) onClose(); else { resetState(); setIsEditing(false); } };
  const handlePermissionChange = (permission: string, isChecked: boolean) => setPermissions(prev => isChecked ? [...prev, permission] : prev.filter(p => p !== permission));
  const handleExperienceChange = (section: keyof LogbookExperience, field: string | null, value: number) => {
    setPriorExperience(prev => field ? { ...prev, [section]: { ...(prev[section] as any), [field]: value } } : { ...prev, [section]: value });
  };

  const handleSave = async () => {
    if (!name) { alert("Name is required."); return; }

    // ── Handle pending photo changes ──────────────────────────────────────────
    let finalPhotoUrl = photoUrl;
    const dbId = (instructor as any).id;
    if (dbId) {
      if (pendingPhotoDataUrl) {
        // Upload new photo to DB
        setPhotoUploading(true);
        try {
          const response = await fetch(`/api/personnel/${dbId}/photo`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoUrl: pendingPhotoDataUrl }),
          });
          if (response.ok) {
            const result = await response.json();
            finalPhotoUrl = result.photoUrl;
            setPhotoUrl(finalPhotoUrl);
          } else {
            setPhotoError('Photo upload failed — other changes were saved.');
          }
        } catch {
          setPhotoError('Photo upload failed — other changes were saved.');
        } finally {
          setPhotoUploading(false);
          setPendingPhotoDataUrl(null);
        }
      } else if (pendingPhotoRemoved && photoUrl) {
        // Remove photo from DB
        setPhotoUploading(true);
        try {
          const response = await fetch(`/api/personnel/${dbId}/photo`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (response.ok) {
            finalPhotoUrl = null;
            setPhotoUrl(null);
          } else {
            setPhotoError('Photo removal failed — other changes were saved.');
          }
        } catch {
          setPhotoError('Photo removal failed — other changes were saved.');
        } finally {
          setPhotoUploading(false);
          setPendingPhotoRemoved(false);
        }
      }
    } else if (pendingPhotoDataUrl || pendingPhotoRemoved) {
      setPhotoError('Cannot save photo: personnel record has no database ID.');
      setPendingPhotoDataUrl(null);
      setPendingPhotoRemoved(false);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const updatedInstructor: Instructor = {
      ...instructor, idNumber, name, rank, role, callsignNumber, service, category, seatConfig,
      unavailability: unavailabilityPeriods, location, unit, flight, phoneNumber, email, permissions,
      priorExperience, isTestingOfficer, isExecutive, isFlyingSupervisor, isIRE,
      isCommandingOfficer, isCFI, isDeputyFlightCommander, isContractor, isAdminStaff, isQFI, isOFI,
      photoUrl: finalPhotoUrl,
    };
    flushPendingAudits();
    
    if (isCreating) {
      logAudit({ action: 'Add', description: `Added new staff ${rank} ${name}`, changes: `Role: ${role}, Unit: ${unit}, Location: ${location}`, page: 'Staff' });
    } else {
      // Track what changed for edit audit log
      const changes: string[] = [];
      if (instructor.name !== name) changes.push(`Name: ${instructor.name} → ${name}`);
      if (instructor.rank !== rank) changes.push(`Rank: ${instructor.rank} → ${rank}`);
      if (instructor.role !== role) changes.push(`Role: ${instructor.role} → ${role}`);
      if (instructor.unit !== unit) changes.push(`Unit: ${instructor.unit || '(none)'} → ${unit || '(none)'}`);
      if (instructor.flight !== flight) changes.push(`Flight: ${instructor.flight || '(none)'} → ${flight || '(none)'}`);
      if (instructor.location !== location) changes.push(`Location: ${instructor.location || '(none)'} → ${location || '(none)'}`);
      if (instructor.phoneNumber !== phoneNumber) changes.push(`Phone: ${instructor.phoneNumber || '(none)'} → ${phoneNumber || '(none)'}`);
      if (instructor.email !== email) changes.push(`Email: ${instructor.email || '(none)'} → ${email || '(none)'}`);
      if (instructor.category !== category) changes.push(`Category: ${instructor.category} → ${category}`);
      if (instructor.seatConfig !== seatConfig) changes.push(`Seat Config: ${instructor.seatConfig} → ${seatConfig}`);
      if (instructor.service !== service) changes.push(`Service: ${instructor.service || '(none)'} → ${service || '(none)'}`);
      if (instructor.isTestingOfficer !== isTestingOfficer) changes.push(`Testing Officer: ${instructor.isTestingOfficer} → ${isTestingOfficer}`);
      if (instructor.isExecutive !== isExecutive) changes.push(`Executive: ${instructor.isExecutive} → ${isExecutive}`);
      if (instructor.isFlyingSupervisor !== isFlyingSupervisor) changes.push(`Flying Supervisor: ${instructor.isFlyingSupervisor} → ${isFlyingSupervisor}`);
      if (instructor.isIRE !== isIRE) changes.push(`IRE: ${instructor.isIRE} → ${isIRE}`);
      if (instructor.isCommandingOfficer !== isCommandingOfficer) changes.push(`CO: ${instructor.isCommandingOfficer} → ${isCommandingOfficer}`);
      if (instructor.isCFI !== isCFI) changes.push(`CFI: ${instructor.isCFI} → ${isCFI}`);
      if (instructor.isDeputyFlightCommander !== isDeputyFlightCommander) changes.push(`Deputy FC: ${instructor.isDeputyFlightCommander} → ${isDeputyFlightCommander}`);
      if (instructor.isContractor !== isContractor) changes.push(`Contractor: ${instructor.isContractor} → ${isContractor}`);
      if (instructor.isAdminStaff !== isAdminStaff) changes.push(`Admin Staff: ${instructor.isAdminStaff} → ${isAdminStaff}`);
      if (instructor.isQFI !== isQFI) changes.push(`QFI: ${instructor.isQFI} → ${isQFI}`);
      if (instructor.isOFI !== isOFI) changes.push(`OFI: ${instructor.isOFI} → ${isOFI}`);
      
      const changesStr = changes.length > 0 ? changes.join(', ') : 'No field changes';
      logAudit({ action: 'Edit', description: `Edited staff profile for ${rank} ${name}`, changes: changesStr, page: 'Staff' });
    }
    
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

  // Tab state — null means no tab open (profile only)
  const [activeTab, setActiveTab] = useState<'unavailable' | 'currency' | 'logbook' | 'sct' | null>(null);

  // Logbook flight entries (fetched from DB when tab opens)
  const [logbookEntries, setLogbookEntries] = useState<any[]>([]);
  const [logbookLoading, setLogbookLoading] = useState(false);
  const [logbookError, setLogbookError] = useState<string | null>(null);
  // Month navigator: null = show all, 'YYYY-MM' for specific month
  const [logbookMonth, setLogbookMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (activeTab !== 'logbook') return;
    setLogbookLoading(true);
    setLogbookError(null);
    setLogbookMonth(new Date().toISOString().slice(0, 7)); // Reset to current month each time tab opens
    // Use the full instructor.name as stored in personName field of FlightLogEntry
    const fullName = instructor.name;
    fetch(`/api/flight-log?personName=${encodeURIComponent(fullName)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then((json: any) => {
        const entries: any[] = (json.entries || []).sort((a: any, b: any) =>
          (a.eventDate || '') < (b.eventDate || '') ? -1 : (a.eventDate || '') > (b.eventDate || '') ? 1 : 0
        );
        setLogbookEntries(entries);
        setLogbookLoading(false);
      })
      .catch(() => {
        setLogbookError('Could not load logbook data.');
        setLogbookLoading(false);
      });
  }, [activeTab, instructor.name]);

  // Edit controls exposed by CurrencyPanel (so we can render them in the tab header)
  const [currencyEditState, setCurrencyEditState] = useState<{
    isEditing: boolean; isSaving: boolean;
    onEdit: () => void; onSave: () => void; onCancel: () => void;
  } | null>(null);

  // Local currency status override — updated after successful save without triggering full onUpdateInstructor
  // Uses a ref to ensure the value persists across renders and instructor prop changes
  const [localCurrencyStatus, setLocalCurrencyStatus] = useState<PersonCurrencyStatus[] | undefined>(undefined);
  const localCurrencyStatusRef = useRef<PersonCurrencyStatus[] | undefined>(undefined);
  // Audit flyout visibility
  const [showCurrencyAudit, setShowCurrencyAudit] = useState(false);

  // Open to a specific tab if requested (e.g. from "My Currency" in MyDashboard)
  useEffect(() => {
    if (profileInitialTab) {
      setActiveTab(profileInitialTab);
      onProfileTabConsumed?.();
    }
  }, [profileInitialTab]);
  const btnClass = "w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed disabled:opacity-40 disabled:cursor-not-allowed";
  const tabBtnClass = (tab: string) => `w-[75px] h-[55px] flex items-center justify-center text-center px-1 py-1 text-[12px] font-semibold rounded-md btn-aluminium-brushed${activeTab === tab ? ' active' : ''}`;
  // Ref for the scrollable content area - used to scroll to top when a tab opens
  const contentScrollRef = useRef<HTMLDivElement>(null);

  // Toggle: clicking active tab closes it; clicking another opens it
  const handleTabClick = (tab: typeof activeTab) => {
    setActiveTab(prev => {
      const next = prev === tab ? null : tab;
      // Scroll to top so the tab panel is visible
      if (next !== null) {
        setTimeout(() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 0);
      }
      return next;
    });
  };
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

  // Trainee avatar icon
  const TraineeIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center" onClick={onClose}>
        <div className="bg-[#141e2e] rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-gray-600 overflow-hidden" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-600 flex justify-between items-center bg-[#0f1824] flex-shrink-0">
            <h2 className="text-lg font-bold text-white">{isCreating ? 'New Staff' : 'Staff Profile'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold leading-none">✕</button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* MAIN CONTENT — always full, scrollable */}
            <div ref={contentScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
              {/* Transparent freeze overlay — blocks all interaction with content */}
              {isFrozen && (
                <div className="absolute inset-0 z-50 bg-transparent cursor-not-allowed" style={{pointerEvents: 'all'}} />
              )}

              {/* ── TAB PANEL (shown inline above profile when a tab is active) ── */}
              {activeTab === 'currency' && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-white">Currency &mdash; {instructor.name}</h4>
                    <div className="flex items-center gap-[1px]">
                      {currencyEditState && !currencyEditState.isEditing && (
                        <button
                          onClick={currencyEditState.onEdit}
                          className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                          title="Edit currency dates"
                        >
                          Edit
                        </button>
                      )}
                      {currencyEditState && currencyEditState.isEditing && (
                        <>
                          <button
                            onClick={currencyEditState.onCancel}
                            disabled={currencyEditState.isSaving}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                            title="Cancel editing"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={currencyEditState.onSave}
                            disabled={currencyEditState.isSaving}
                            className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md disabled:opacity-50"
                            title="Save currency dates"
                          >
                            {currencyEditState.isSaving ? 'Saving\u2026' : 'Save'}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setActiveTab(null)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="Close currency panel"
                      >
                        Close
                      </button>
                      <button
                        onClick={() => setShowCurrencyAudit(true)}
                        className="w-[56px] h-[41px] flex items-center justify-center text-center px-1 py-1 text-[10px] font-semibold btn-aluminium-brushed rounded-md"
                        title="View currency audit log"
                      >
                        Audit
                      </button>
                    </div>
                  </div>
                  <CurrencyPanel
                    key={`currency-panel-${instructor.idNumber}`}
                    personId={(instructor as any).id}
                    idNumber={instructor.idNumber}
                    personType="instructor"
                    personName={instructor.name}
                    masterCurrencies={masterCurrencies}
                    currencyRequirements={currencyRequirements}
                    initialCurrencyStatus={localCurrencyStatusRef.current ?? localCurrencyStatus ?? instructor.currencyStatus}
                    onCurrencyStatusChange={(newStatus: PersonCurrencyStatus[]) => {
                      localCurrencyStatusRef.current = newStatus;
                      setLocalCurrencyStatus(newStatus);
                    }}
                    onEditStateChange={setCurrencyEditState}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                  />
                </div>
              )}

              {showCurrencyAudit && (
                <CurrencyAuditFlyout
                  personId={String((instructor as any).id || instructor.idNumber)}
                  personName={instructor.name}
                  onClose={() => setShowCurrencyAudit(false)}
                />
              )}

              {activeTab === 'logbook' && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    {/* Left: title + month navigator */}
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">Logbook — {instructor.name}</h4>
                       {(() => {
                         const ML: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'};
                         // Helper: increment or decrement a YYYY-MM string by one month (infinite in both directions)
                         const shiftMonth = (ym: string, delta: 1 | -1): string => {
                           const [y, m] = ym.split('-').map(Number);
                           let nm = m + delta; let ny = y;
                           if (nm > 12) { nm = 1; ny++; }
                           if (nm < 1)  { nm = 12; ny--; }
                           return `${ny}-${String(nm).padStart(2,'0')}`;
                         };
                         // Default to current month when "All" and user clicks an arrow
                                                const label = `${ML[logbookMonth.slice(5,7)]||''} ${logbookMonth.slice(2,4)}`;
                         return (
                           <div className="flex items-center gap-0.5">
                             <button onClick={() => setLogbookMonth(shiftMonth(logbookMonth, -1))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-sm leading-none">‹</button>
                             <span className="min-w-[50px] text-center text-[10px] font-mono text-sky-300 bg-gray-800/60 border border-gray-600 rounded px-1 py-0.5">{label}</span>
                             <button onClick={() => setLogbookMonth(shiftMonth(logbookMonth, 1))} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white text-sm leading-none">›</button>
                           </div>
                         );
                       })()} 
                    </div>
                    {/* Right: print + entry count + close */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const ML2: Record<string,string> = {'01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec'};
                          const printLabel = `${ML2[logbookMonth.slice(5,7)]||''} ${logbookMonth.slice(2,4)}`;
                          const filtered = logbookEntries.filter((e: any) => (e.eventDate || '').slice(0,7) === logbookMonth);
                          const rows = filtered.map((entry: any) => {
                            const snap: any = entry.captainLogSnapshot || entry.crewLogSnapshot || {};
                            const yr = snap.year || (entry.eventDate ? new Date(entry.eventDate).getFullYear().toString() : '');
                            const dt = snap.date || (entry.eventDate ? new Date(entry.eventDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '');
                            const role = entry.personRole === 'instructor' ? 'Captain' : 'Crew';
                            return `<tr><td>${role}</td><td>${entry.eventCode||''}</td><td>${yr}</td><td>${dt}</td><td>${snap.type||entry.eventType||''}</td><td>${snap.tail||entry.aircraftNumber||''}</td><td>${snap.captain||''}</td><td>${snap.crew||''}</td><td style="min-width:120px">${snap.duty||entry.duty||''}</td><td>${snap.dayP1||''}</td><td>${snap.dayP2||''}</td><td>${snap.dayDual||''}</td><td>${snap.nightP1||''}</td><td>${snap.nightP2||''}</td><td>${snap.nightDual||''}</td><td>${snap.total||entry.totalTime||''}</td><td>${snap.captTime||entry.captainTime||''}</td><td>${snap.instTime||entry.instructorTime||''}</td><td>${snap.simIf||''}</td><td>${snap.simActual||entry.ifActualTime||''}</td><td>${snap.app2D||''}</td><td>${snap.app3D||''}</td><td>${snap.simP1||''}</td><td>${snap.simP2||''}</td><td>${snap.simDual||''}</td><td>${snap.simTotal||''}</td></tr>`;
                          }).join('');
                          const w = window.open('','_blank','width=1400,height=800');
                          if (!w) return;
                          w.document.write(`<!DOCTYPE html><html><head><title>Logbook - ${instructor.name} - ${printLabel}</title><style>body{font-family:monospace;font-size:8px;margin:10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:2px 3px;text-align:center;white-space:nowrap}th{background:#ddd;font-weight:bold}tr:nth-child(even){background:#f5f5f5}h2{font-size:11px;margin-bottom:6px}@page{size:landscape;margin:6mm}</style></head><body><h2>Logbook — ${instructor.name} — ${printLabel}</h2><table><thead><tr><th>Role</th><th>Event</th><th>Year</th><th>Date</th><th>Type</th><th>Tail</th><th>Captain</th><th>Co-Pilot/Crew</th><th>Duty</th><th>Day P1</th><th>Day P2</th><th>Day Dual</th><th>Nt P1</th><th>Nt P2</th><th>Nt Dual</th><th>Total</th><th>Capt</th><th>Inst</th><th>SimIF</th><th>ActIF</th><th>2D</th><th>3D</th><th>Sim P1</th><th>Sim P2</th><th>Sim Dual</th><th>Sim Tot</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
                          w.document.close(); w.focus(); w.print();
                        }}
                        className="text-[10px] text-gray-400 hover:text-white border border-gray-600/50 hover:border-gray-400 rounded px-2 py-0.5 bg-transparent"
                      >Print</button>
                      <span className="text-[10px] text-gray-400">{logbookEntries.length} entr{logbookEntries.length === 1 ? 'y' : 'ies'}</span>
                      <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">× Close</button>
                    </div>
                  </div>
                  {logbookLoading && <div className="text-gray-400 text-xs py-4 text-center animate-pulse">Loading logbook…</div>}
                  {logbookError && <div className="text-red-400 text-xs py-4 text-center">{logbookError}</div>}
                  {!logbookLoading && !logbookError && logbookEntries.length === 0 && (
                    <div className="text-gray-500 text-xs py-4 text-center">No flight log entries found.</div>
                  )}
                  {!logbookLoading && !logbookError && logbookEntries.length > 0 && (() => {
                    // Filter entries by selected month
                    const filteredEntries = logbookEntries.filter((e: any) => (e.eventDate || '').slice(0, 7) === logbookMonth);
                    const rows: any[] = filteredEntries.map((entry: any) => {
                      const snap: any = entry.captainLogSnapshot || entry.crewLogSnapshot || {};
                      const role = entry.personRole === 'instructor' ? 'Captain' : 'Crew';
                      const yr = snap.year || (entry.eventDate ? new Date(entry.eventDate).getFullYear().toString() : '');
                      const dt = snap.date || (entry.eventDate ? new Date(entry.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '');
                      // Fallback to raw entry fields when snapshot values are missing
                      const total = snap.total || (entry.totalTime != null ? String(entry.totalTime) : '');
                      const captTime = snap.captTime || (entry.captainTime != null ? String(entry.captainTime) : '');
                      const instTime = snap.instTime || (entry.instructorTime != null ? String(entry.instructorTime) : '');
                      const nightP1raw = snap.nightP1 || (entry.nightTime != null ? String(entry.nightTime) : '');
                      const simActual = snap.simActual || (entry.ifActualTime != null ? String(entry.ifActualTime) : '');
                      const simIf = snap.simIf || (entry.ifSimTime != null ? String(entry.ifSimTime) : '');
                      const typeVal = snap.type || entry.eventType || '';
                      const tailVal = snap.tail || entry.aircraftNumber || '';
                      const dutyVal = snap.duty || entry.duty || '';
                      return { ...snap, year: yr, date: dt, total, captTime, instTime, nightP1: nightP1raw, simActual, simIf, type: typeVal, tail: tailVal, duty: dutyVal, _role: role, _eventCode: entry.eventCode || '' };
                    });
                    const C = ({ v, w, bg = 'bg-gray-800' }: { v: string; w: string; bg?: string }) => (
                      <div className={`flex items-center justify-center ${w} flex-shrink-0 border-r border-gray-700 last:border-r-0 ${bg} h-6`}>
                        <span className="text-white text-[10px] font-mono truncate px-0.5">{v || ''}</span>
                      </div>
                    );
                    const H = ({ l, w, sub = '' }: { l: string; w: string; sub?: string }) => (
                      <div className={`flex flex-col items-center justify-end ${w} flex-shrink-0 border-r border-gray-600 last:border-r-0 bg-gray-900/60 py-0.5`}>
                        <span className="text-[8px] font-bold text-gray-400 uppercase leading-tight text-center">{l}</span>
                        {sub && <span className="text-[7px] text-gray-500 leading-tight">{sub}</span>}
                      </div>
                    );
                    return (
                      <div className="overflow-x-auto max-h-72 overflow-y-auto rounded border border-gray-600">
                        <div className="inline-flex flex-col bg-gray-900 min-w-max">
                          <div className="flex flex-nowrap border-b border-gray-600 sticky top-0 z-10 bg-gray-900">
                            <div className="w-14 flex-shrink-0 border-r border-gray-600 bg-gray-900/60" />
                            <H l="Year" w="w-10" /><H l="Date" w="w-14" /><H l="Type" w="w-10" /><H l="Tail" w="w-14" />
                            <H l="Captain" w="w-20" /><H l="Co-Pilot" sub="Crew" w="w-20" /><H l="Duty" w="w-40" />
                            <div className="flex flex-col border-r border-gray-600">
                              <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Day</div>
                              <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /></div>
                            </div>
                            <div className="flex flex-col border-r border-gray-600">
                              <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Night</div>
                              <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /></div>
                            </div>
                            <H l="TOTAL" w="w-10" /><H l="Capt" w="w-10" /><H l="Inst" w="w-10" />
                            <H l="SimIF" w="w-8" /><H l="ActIF" w="w-8" /><H l="2D" w="w-8" /><H l="3D" w="w-8" />
                            <div className="flex flex-col">
                              <div className="text-[8px] font-bold text-gray-400 uppercase text-center bg-gray-900/60 border-b border-gray-700 px-1 leading-tight">Sim</div>
                              <div className="flex"><H l="P1" w="w-8" /><H l="P2" w="w-8" /><H l="Dual" w="w-8" /><H l="Tot" w="w-8" /></div>
                            </div>
                          </div>
                          {rows.map((row: any, idx: number) => (
                            <div key={idx} className={`flex flex-nowrap border-t border-gray-700/50 ${idx % 2 === 0 ? 'bg-gray-800/30' : 'bg-gray-800/10'} hover:bg-sky-900/20`}>
                              <div className="flex flex-col items-start justify-center w-14 flex-shrink-0 border-r border-gray-600 px-1">
                                <span className="text-[8px] font-bold text-sky-400 truncate w-full">{row._role}</span>
                                <span className="text-[7px] text-gray-500 truncate w-full">{row._eventCode}</span>
                              </div>
                              <C v={row.year} w="w-10" /><C v={row.date} w="w-14" /><C v={row.type} w="w-10" /><C v={row.tail} w="w-14" />
                              <C v={row.captain} w="w-20" /><C v={row.crew} w="w-20" /><C v={row.duty} w="w-40" />
                              <div className="flex border-r border-gray-600">
                                <C v={row.dayP1 ?? ''} w="w-8" /><C v={row.dayP2 ?? ''} w="w-8" /><C v={row.dayDual ?? ''} w="w-8" />
                              </div>
                              <div className="flex border-r border-gray-600">
                                <C v={row.nightP1 ?? ''} w="w-8" /><C v={row.nightP2 ?? ''} w="w-8" /><C v={row.nightDual ?? ''} w="w-8" />
                              </div>
                              <C v={row.total ?? ''} w="w-10" bg="bg-gray-700/30" />
                              <C v={row.captTime ?? ''} w="w-10" /><C v={row.instTime ?? ''} w="w-10" />
                              <C v={row.simIf ?? ''} w="w-8" /><C v={row.simActual ?? ''} w="w-8" />
                              <C v={String(row.app2D ?? '')} w="w-8" /><C v={String(row.app3D ?? '')} w="w-8" />
                              <div className="flex">
                                <C v={row.simP1 ?? ''} w="w-8" bg="bg-gray-800/50" />
                                <C v={row.simP2 ?? ''} w="w-8" bg="bg-gray-800/50" />
                                <C v={row.simDual ?? ''} w="w-8" bg="bg-gray-800/50" />
                                <C v={row.simTotal ?? ''} w="w-8" bg="bg-gray-800/50" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'unavailable' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white">Unavailability — {instructor.name}</h4>
                    <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>
                  <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
                    {unavailabilityPeriods.length > 0 ? unavailabilityPeriods.map(p => {
                      let periodDisplay = '';
                      if (p.allDay) {
                        const startDisplay = formatDate(p.startDate);
                        const endDisplay = formatDate(p.endDate);
                        periodDisplay = p.startDate !== p.endDate ? `${startDisplay} – ${endDisplay} @ All Day` : `${startDisplay} @ All Day`;
                      } else {
                        const startDisplay = `${formatMilitaryTime(p.startTime)} ${formatDate(p.startDate)}`;
                        const endDisplay   = `${formatMilitaryTime(p.endTime)} ${formatDate(p.endDate)}`;
                        periodDisplay = p.startDate !== p.endDate ? `${startDisplay} to ${endDisplay}` : `${startDisplay} - ${endDisplay}`;
                      }
                      return (
                        <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                          <span className="text-white font-medium">{p.reason}</span>
                          <span className="text-gray-300 font-mono">{periodDisplay}</span>
                          <button onClick={() => handleRemoveUnavailability(p.id)} className="text-red-400 hover:text-red-300 text-xs ml-2">✕</button>
                        </div>
                      );
                    }) : <p className="text-gray-500 text-xs italic text-center py-2">No unavailability periods scheduled.</p>}
                  </div>
                  <button onClick={() => setShowAddUnavailability(true)} className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded">+ Add Unavailability</button>
                </div>
              )}

              {activeTab === 'sct' && (
                <div className={card3d + " p-4"} style={card3dStyle}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-white">Request SCT — {instructor.name}</h4>
                    <button onClick={() => setActiveTab(null)} className="text-gray-400 hover:text-white text-xs">✕ Close</button>
                  </div>
                  <p className="text-gray-400 text-xs italic mb-4">Submit a Standardisation and Continuation Training request for this staff member.</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRequestSct();
                      setActiveTab(null);
                    }}
                    className="px-4 py-1.5 bg-sky-700 hover:bg-sky-600 text-white text-xs rounded"
                  >Submit SCT Request</button>
                </div>
              )}

              {/* ── SECTION 1: MAIN INFO CARD (always visible) ── */}
              <div className={card3d + " p-4"} style={card3dStyle}>
                {isEditing ? (
                  <div className="space-y-3">
                    {/* Edit mode photo upload */}
                    <div className="flex items-start gap-4">
                      {/* Hidden file input */}
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                      <div className="flex-shrink-0">
                        {/* Photo frame — clickable in edit mode */}
                        <div
                          className="relative w-20 h-24 bg-gray-700 rounded border border-gray-500 flex items-center justify-center overflow-hidden cursor-pointer group"
                          onClick={() => photoInputRef.current?.click()}
                          title="Click to change profile photo"
                        >
                          {(() => {
                            const displayUrl = pendingPhotoRemoved ? null : (pendingPhotoDataUrl || photoUrl);
                            return displayUrl ? (
                              <>
                                <img src={displayUrl} alt={name} className="w-full h-full object-cover object-top" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  <span className="text-[9px] text-white font-medium">Change</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-lg font-bold text-gray-300 leading-none select-none">
                                    {name.split(' ').filter((w: string) => /^[A-Z]/.test(w)).slice(-2).map((w: string) => w[0]).join('')}
                                  </span>
                                  <span className="text-[8px] text-gray-500 leading-none">No photo</span>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  <span className="text-[9px] text-white font-medium">Upload</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                        {/* Status / error */}
                        {photoUploading && (
                          <div className="mt-1 w-20 text-[8px] text-sky-400 text-center">Saving…</div>
                        )}
                        {photoError && (
                          <div className="mt-1 w-20 text-[8px] text-red-400 leading-tight break-words">{photoError}</div>
                        )}
                        {/* Pending indicator */}
                        {pendingPhotoDataUrl && !photoUploading && (
                          <div className="mt-1 w-20 text-[8px] text-amber-400 text-center leading-tight">Pending save</div>
                        )}
                        {/* Remove button — shown when there is a photo to remove */}
                        {(pendingPhotoDataUrl || (photoUrl && !pendingPhotoRemoved)) && !photoUploading && (
                          <button
                            onClick={handlePhotoRemoveInEdit}
                            className="mt-1 w-20 text-[8px] text-gray-500 hover:text-red-400 text-center transition-colors"
                            title="Remove profile photo"
                          >
                            Remove photo
                          </button>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 mt-1 leading-relaxed">
                        <p className="text-gray-400 font-medium mb-0.5">Profile Photo</p>
                        <p>Click the photo frame to upload.</p>
                        <p>Changes are saved when you click <span className="text-white">Save</span>.</p>
                        <p className="mt-0.5">Max 2 MB &mdash; JPG, PNG, GIF, WebP.</p>
                      </div>
                    </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <InputField label="Callsign Number" value={callsignNumber} onChange={e => setCallsignNumber(parseInt(e.target.value) || 0)} type="number" />
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
                        <option value="">Select...</option>
                        {(units || []).map(u => <option key={u} value={u}>{u}</option>)}
                      </Dropdown>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Dropdown label="Location" value={location} onChange={e => setLocation(e.target.value)}>
                        {(locations || []).map(loc => <option key={loc} value={loc}>{loc}</option>)}
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
                  /* VIEW MODE: avatar + data grid + permissions panel */
                  <div className="flex gap-4">
                    {/* Profile photo — static display only in view mode */}
                    <div className="flex-shrink-0">
                      <div className="relative w-20 h-24 bg-gray-700 rounded border border-gray-500 flex items-center justify-center overflow-hidden">
                        {photoUrl ? (
                          <img src={photoUrl} alt={instructor.name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-lg font-bold text-gray-300 leading-none select-none">
                              {instructor.name.split(' ').filter((w: string) => /^[A-Z]/.test(w)).slice(-2).map((w: string) => w[0]).join('')}
                            </span>
                            <span className="text-[8px] text-gray-500 leading-none">No photo</span>
                          </div>
                        )}
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
                        {/* Row 1 */}
                        <div><span className="text-gray-400 block text-[10px]">ID Number</span><span className="text-white font-medium">{instructor.idNumber}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Role</span><span className="text-sky-300 font-medium">{instructor.role}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Category</span><span className="text-white font-medium">{instructor.category}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Callsign</span><span className="text-white font-medium">{callsignData?.callsignPrefix || ''}{instructor.callsignNumber || ''}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Secondary Callsign</span><span className="text-gray-300">[None]</span></div>
                        <div></div>
                        {/* Row 2 */}
                        <div><span className="text-gray-400 block text-[10px]">Rank</span><span className="text-white font-medium">{instructor.rank}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Service</span><span className="text-white font-medium">{instructor.service || 'RAAF'}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Unit</span><span className="text-white font-medium">{instructor.unit}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Seat Config</span><span className="text-white font-medium">{instructor.seatConfig}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Location</span><span className="text-white font-medium">{instructor.location}</span></div>
                        <div><span className="text-gray-400 block text-[10px]">Flight</span><span className="text-white font-medium">{instructor.flight || 'N/A'}</span></div>
                        {/* Row 3 */}
                        <div className="col-span-2"><span className="text-gray-400 block text-[10px]">Phone Number</span><span className="text-white font-medium">{instructor.phoneNumber || 'N/A'}</span></div>
                        <div className="col-span-4"><span className="text-gray-400 block text-[10px]">Email</span><span className="text-white font-medium">{instructor.email || 'N/A'}</span></div>
                      </div>
                    </div>

                    {/* Permissions panel */}
                    <div className="flex-shrink-0 w-36">
                      <div className={card3d + " p-2 h-full"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                        <div className="text-[10px] text-gray-400 font-semibold mb-2">Permissions</div>
                        <div className="space-y-1">
                          {(instructor.permissions || []).length > 0
                            ? (instructor.permissions || []).map(p => (
                                <div key={p} className="text-white text-[10px]">• {p}</div>
                              ))
                            : <div className="text-gray-500 text-[10px] italic">None</div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── SECTION 2: ASSIGNED TRAINEES (always visible, not editing) ── */}
              {!isEditing && !isCreating && (
                <div className={card3d + " p-3"} style={card3dStyle}>
                  <h4 className="text-xs font-semibold text-gray-300 mb-3">Assigned Trainees</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Primary Trainee 1 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-sky-400 font-semibold mb-1.5">Primary</div>
                      {primaryTrainees[0] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(primaryTrainees[0])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {primaryTrainees[0].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Primary Trainee 2 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-sky-400 font-semibold mb-1.5">Primary</div>
                      {primaryTrainees[1] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(primaryTrainees[1])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {primaryTrainees[1].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Secondary Trainee 1 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-amber-400 font-semibold mb-1.5">Secondary</div>
                      {secondaryTrainees[0] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(secondaryTrainees[0])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {secondaryTrainees[0].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                    {/* Secondary Trainee 2 */}
                    <div className={card3d + " p-2"} style={{...card3dStyle, background:'linear-gradient(180deg, #1e2d42 0%, #192538 100%)'}}>
                      <div className="text-[9px] text-amber-400 font-semibold mb-1.5">Secondary</div>
                      {secondaryTrainees[1] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <button
                            onClick={() => onNavigateToTrainee?.(secondaryTrainees[1])}
                            className="text-white text-[10px] font-medium leading-tight hover:text-sky-400 hover:underline cursor-pointer"
                            title="View trainee profile"
                          >
                            {secondaryTrainees[1].name}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-700/50 rounded-full flex items-center justify-center flex-shrink-0"><TraineeIcon /></div>
                          <span className="text-gray-600 text-[10px] italic">Not assigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECTION 3: LOGBOOK VIEW (always visible, not editing) ── */}
              {!isEditing && (
                <div className={card3d + " p-3"} style={card3dStyle}>
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

              {/* ── SECTION 3: LOGBOOK EDIT (always visible, editing) ── */}
              {isEditing && (
                <div className={card3d + " p-3"} style={card3dStyle}>
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

              {/* ── SECTION 4: UNAVAILABILITY SUMMARY (always visible) ── */}
              <div className={card3d + " p-3"} style={card3dStyle}>
                <h4 className="text-xs font-semibold text-gray-300 mb-2">Unavailability</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {unavailabilityPeriods.length > 0 ? unavailabilityPeriods.map(p => {
                    let periodDisplay = '';
                    if (p.allDay) {
                      const startDisplay = formatDate(p.startDate);
                      const endDisplay = formatDate(p.endDate);
                      periodDisplay = p.startDate !== p.endDate ? `${startDisplay} – ${endDisplay} @ All Day` : `${startDisplay} @ All Day`;
                    } else {
                      const startDisplay = `${formatMilitaryTime(p.startTime)} ${formatDate(p.startDate)}`;
                      const endDisplay   = `${formatMilitaryTime(p.endTime)} ${formatDate(p.endDate)}`;
                      periodDisplay = p.startDate !== p.endDate ? `${startDisplay} to ${endDisplay}` : `${startDisplay} - ${endDisplay}`;
                    }
                    return (
                      <div key={p.id} className="flex justify-between items-center p-2 bg-gray-700/40 rounded text-xs">
                        <span className="text-white font-medium">{p.reason}</span>
                        <span className="text-gray-300 font-mono">{periodDisplay}</span>
                      </div>
                    );
                  }) : <p className="text-sm text-gray-500 text-center italic py-2">No unavailability periods scheduled.</p>}
                </div>
              </div>

            </div>

            {/* RIGHT BUTTON PANEL */}
            <div className="w-[95px] flex-shrink-0 border-l border-gray-600 bg-[#0f1824] pt-2 pb-2 px-[10px] flex flex-col space-y-[1px]">
              {!isEditing && !isCreating && (<>
                <button onClick={() => handleTabClick('unavailable')} className={tabBtnClass('unavailable')}>Unavailable</button>
                <button onClick={() => handleTabClick('currency')} className={tabBtnClass('currency')}>Currency</button>
                <button onClick={() => handleTabClick('logbook')} className={tabBtnClass('logbook')}>Logbook</button>
                <button onClick={() => handleTabClick('sct')} className={tabBtnClass('sct')}>Request SCT</button>
                <button onClick={() => { setActiveTab(null); handleEdit(); }} disabled={isFrozen} className={btnClass}>Edit</button>
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
        <AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnly} onSave={handleSaveUnavailability} unavailabilityPeriods={unavailabilityPeriods} onRemove={handleRemoveUnavailability} />
      )}
    </>
  );
};