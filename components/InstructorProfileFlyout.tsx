import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InstructorRank, Instructor, InstructorCategory, SeatConfig, UnavailabilityPeriod, UnavailabilityReason, Trainee, LogbookExperience } from '../types';
import { v4 as uuidv4 } from 'uuid';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import CircularGauge from './CircularGauge';
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

const InfoRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <div className={`mt-1 text-white p-2 bg-gray-700/50 rounded-md min-h-[38px] flex items-center`}>
            {value}
        </div>
    </div>
);

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; type?: string }> = ({ label, value, onChange, readOnly, type = 'text' }) => (
     <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm ${readOnly ? 'bg-gray-700/50 cursor-not-allowed' : ''}`}
        />
    </div>
);


const Dropdown: React.FC<{ label: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; }> = ({ label, value, onChange, children }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <select
            value={value}
            onChange={onChange}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
        >
            {children}
        </select>
    </div>
);

// Reusable Components for Experience fields
const ExperienceInput: React.FC<{ label: string; value: number; onChange: (val: number) => void }> = ({ label, value, onChange }) => (
    <div className="flex flex-col items-center">
        <label className="text-xs text-gray-400 mb-1">{label}</label>
        <input
            type="number"
            min="0"
            step="0.1"
            value={value}
            onFocus={(e) => e.target.select()}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-white text-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
    </div>
);

const ExperienceDisplay: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex flex-col items-center">
        <label className="text-xs text-gray-500 mb-1">{label}</label>
        <div className="w-20 bg-gray-800/50 rounded-md py-1 px-2 text-white text-sm text-center font-mono border border-gray-700">
            {value.toFixed(1)}
        </div>
    </div>
);

const ProfileField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <div className="text-xs text-gray-400 mb-1">{label}</div>
        <div className="text-white text-sm font-medium">{value}</div>
    </div>
);

const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00Z`);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const formatMilitaryTime = (timeString: string | undefined): string => {
    if (!timeString) return '';
    return timeString.replace(':', '');
};

const initialExperience: LogbookExperience = {
    day: { p1: 0, p2: 0, dual: 0 },
    night: { p1: 0, p2: 0, dual: 0 },
    total: 0,
    captain: 0,
    instructor: 0,
    instrument: { sim: 0, actual: 0 },
    simulator: { p1: 0, p2: 0, dual: 0, total: 0 }
};


// FIX: Changed to a named export to resolve module resolution errors.
export const InstructorProfileFlyout: React.FC<InstructorProfileFlyoutProps> = ({ instructor, onClose, school, personnelData, onUpdateInstructor, onNavigateToCurrency, originRect, isClosing, isCreating = false, locations, units, traineesData, onViewLogbook, onRequestSct }) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const [showAddUnavailability, setShowAddUnavailability] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0, transform: 'scale(0.1)' });

    // State for editable fields
    const [idNumber, setIdNumber] = useState(instructor.idNumber);
    const [name, setName] = useState(instructor.name);
    const [rank, setRank] = useState<InstructorRank>(instructor.rank);
    const [role, setRole] = useState<'QFI' | 'SIM IP'>(instructor.role);
    const [callsignNumber, setCallsignNumber] = useState(instructor.callsignNumber);
    const [service, setService] = useState< 'RAAF' | 'RAN' | 'ARA' | undefined>(instructor.service);
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
    
    // Boolean states for roles
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
        const primary = traineesData.filter(t => t.primaryInstructor === instructor.name).sort((a,b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown'));
        const secondary = traineesData.filter(t => t.secondaryInstructor === instructor.name).sort((a,b) => (a.name ?? 'Unknown').localeCompare(b.name ?? 'Unknown'));
        return { primaryTrainees: primary, secondaryTrainees: secondary };
    }, [traineesData, instructor.name]);

    const hasAssignedTrainees = primaryTrainees.length > 0 || secondaryTrainees.length > 0;

    const resetState = () => {
        setIdNumber(instructor.idNumber);
        setName(instructor.name);
        setRank(instructor.rank);
        setRole(instructor.role);
        setCallsignNumber(instructor.callsignNumber);
        setService(instructor.service);
        setCategory(instructor.category);
        setSeatConfig(instructor.seatConfig);
        setUnavailabilityPeriods(instructor.unavailability || []);
        setIsTestingOfficer(instructor.isTestingOfficer);
        setIsExecutive(instructor.isExecutive);
        setIsFlyingSupervisor(instructor.isFlyingSupervisor);
        setIsIRE(instructor.isIRE);
        setIsCommandingOfficer(instructor.isCommandingOfficer || false);
        setIsCFI(instructor.isCFI || false);
        setIsDeputyFlightCommander(instructor.isDeputyFlightCommander || false);
        setIsContractor(instructor.isContractor || false);
        setIsAdminStaff(instructor.isAdminStaff || false);
        setIsQFI(instructor.isQFI || false);
        setIsOFI(instructor.isOFI || false);
        setLocation(instructor.location || locations[0] || '');
        setUnit(instructor.unit || units[0] || '');
        setFlight(instructor.flight || '');
        setPhoneNumber(instructor.phoneNumber || '');
        setEmail(instructor.email || '');
        setPermissions(instructor.permissions || []);
        setPriorExperience(instructor.priorExperience || initialExperience);
    };

    useEffect(() => {
        resetState();
        setIsEditing(isCreating);
    }, [instructor, isCreating]);

    // Log view on component mount (only if not creating)
    useEffect(() => {
        if (!isCreating) {
            logAudit({
                action: 'View',
                description: `Viewed instructor profile for ${instructor.rank} ${instructor.name}`,
                changes: `Role: ${instructor.role}, Category: ${instructor.category}`,
                page: 'Staff'
            });
        }
    }, []);

    useEffect(() => {
        const panelElement = panelRef.current;
        if (!panelElement) return;
    
        // If no originRect (e.g., when creating new instructor), use center animation
        if (!originRect) {
            setStyle({
                opacity: 0,
                transform: 'scale(0.95)',
            });
        
            const timeoutId = setTimeout(() => {
                setStyle({
                    opacity: 1,
                    transform: 'scale(1)',
                    transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease-out',
                });
            }, 10);
        
            return () => clearTimeout(timeoutId);
        }
    
        const panelRect = panelElement.getBoundingClientRect();
        const originX = originRect.left + originRect.width / 2 - panelRect.left;
        const originY = originRect.top + originRect.height / 2 - panelRect.top;
        const transformOrigin = `${originX}px ${originY}px`;
    
        setStyle({
            transformOrigin,
            opacity: 0,
            transform: 'scale(0.1)',
        });
    
        const timeoutId = setTimeout(() => {
            setStyle({
                transformOrigin,
                opacity: 1,
                transform: 'scale(1)',
                transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease-out',
            });
        }, 10);
    
        return () => clearTimeout(timeoutId);
    }, [instructor, originRect, isCreating]);
    
    useEffect(() => {
        if (isClosing && style.transformOrigin) {
            setStyle(prev => ({
                ...prev,
                opacity: 0,
                transform: 'scale(0.1)',
            }));
        }
    }, [isClosing, style.transformOrigin]);

    const handleEdit = () => setIsEditing(true);

    const handleCancel = () => {
      if (isCreating) {
        onClose();
      } else {
        resetState();
        setIsEditing(false);
      }
    };
    
    const callsignPrefix = school === 'ESL' ? 'ROLR' : 'VIPR';
    const callsignNumbers = useMemo(() => Array.from({ length: 99 }, (_, i) => i + 1), []);
    
    // Debounced field change handlers
    const handleNameChange = (newName: string) => {
        const oldName = name;
        setName(newName);
        if (oldName && newName !== oldName) {
            debouncedAuditLog(
                `instructor-${instructor.idNumber}-name`,
                'Edit',
                `Updated instructor name`,
                `Name: ${oldName} → ${newName}`,
                'Staff'
            );
        }
    };
    
    const handleRankChange = (newRank: InstructorRank) => {
        const oldRank = rank;
        setRank(newRank);
        if (oldRank !== newRank) {
            debouncedAuditLog(
                `instructor-${instructor.idNumber}-rank`,
                'Edit',
                `Updated instructor rank`,
                `Rank: ${oldRank} → ${newRank}`,
                'Staff'
            );
        }
    };
    
    const handleRoleChange = (newRole: 'QFI' | 'SIM IP') => {
        const oldRole = role;
        setRole(newRole);
        if (oldRole !== newRole) {
            debouncedAuditLog(
                `instructor-${instructor.idNumber}-role`,
                'Edit',
                `Updated instructor role`,
                `Role: ${oldRole} → ${newRole}`,
                'Staff'
            );
        }
    };
    
    const handleCategoryChange = (newCategory: InstructorCategory) => {
        const oldCategory = category;
        setCategory(newCategory);
        if (oldCategory !== newCategory) {
            debouncedAuditLog(
                `instructor-${instructor.idNumber}-category`,
                'Edit',
                `Updated instructor category`,
                `Category: ${oldCategory} → ${newCategory}`,
                'Staff'
            );
        }
    };

    const handleSave = async () => {
        if (!name || !idNumber) {
            alert('ID Number and Name are required.');
            return;
        }

        const updatedInstructor: Instructor = {
            ...instructor,
            idNumber: Number(idNumber),
            name,
            rank,
            role,
            callsignNumber,
            service,
            category,
            isTestingOfficer,
            seatConfig,
            isExecutive,
            isFlyingSupervisor,
            isIRE,
            isCommandingOfficer,
            isCFI,
            isDeputyFlightCommander,
            isContractor,
            isAdminStaff,
            isQFI,
            isOFI,
            unavailability: unavailabilityPeriods,
            location,
            unit,
            flight,
            phoneNumber,
            email,
            permissions,
            priorExperience
        };
        
        // Flush any pending debounced logs before saving
        flushPendingAudits();
        
        // Log the save action
        if (isCreating) {
            logAudit({
                action: 'Add',
                description: `Added new instructor ${rank} ${name}`,
                changes: `Role: ${role}, Category: ${category}, Unit: ${unit}`,
                page: 'Staff'
            });
        } else {
            // Detect changes for edit
            const changes: string[] = [];
            if (instructor.name !== name) changes.push(`Name: ${instructor.name} → ${name}`);
            if (instructor.rank !== rank) changes.push(`Rank: ${instructor.rank} → ${rank}`);
            if (instructor.role !== role) changes.push(`Role: ${instructor.role} → ${role}`);
            if (instructor.category !== category) changes.push(`Category: ${instructor.category} → ${category}`);
            if (instructor.unit !== unit) changes.push(`Unit: ${instructor.unit} → ${unit}`);
            if (instructor.location !== location) changes.push(`Location: ${instructor.location} → ${location}`);
            
            if (changes.length > 0) {
                logAudit({
                    action: 'Edit',
                    description: `Updated instructor ${rank} ${name}`,
                    changes: changes.join(', '),
                    page: 'Staff'
                });
            }
        }
        
        onUpdateInstructor(updatedInstructor);

        // Persist Logbook Data to Storage
        try {
            const fileName = `Logbook_${name.replace(/,\s/g, '_')}_${updatedInstructor.idNumber}.json`;
            const fileContent = JSON.stringify(priorExperience, null, 2);
            const file = new File([fileContent], fileName, { type: "application/json" });
            // 'staff_logbook' is the ID for the Staff Data -> Logbook folder
            await addFile(file, 'staff_logbook', fileName);
        } catch (error) {
            console.error("Failed to save logbook data to storage:", error);
        }

        if (isCreating) {
            onClose();
        } else {
            setIsEditing(false);
        }
    };

    const handlePermissionChange = (permission: string, isChecked: boolean) => {
        setPermissions(prev => 
            isChecked ? [...prev, permission] : prev.filter(p => p !== permission)
        );
    };

    const handleExperienceChange = (
        section: keyof LogbookExperience, 
        field: string | null, 
        value: number
    ) => {
        setPriorExperience(prev => {
            if (field) {
                return {
                    ...prev,
                    [section]: {
                        ...(prev[section] as any),
                        [field]: value
                    }
                };
            } else {
                return {
                    ...prev,
                    [section]: value
                };
            }
        });
    };

    // --- Unavailability Handlers ---
    const handleAddTodayOnly = () => {
        const today = new Date();
        const formatForInput = (date: Date) => date.toISOString().split('T')[0];
        const todayStr = formatForInput(today);

        const newPeriod: UnavailabilityPeriod = {
            id: uuidv4(),
            startDate: todayStr,
            endDate: todayStr,
            allDay: false,
            startTime: '0001',
            endTime: '2359',
            reason: 'Other',
            notes: 'Today Only',
        };

           // Log audit entry for Today Only unavailability
           logAudit({
               action: "Add",
               description: `Added unavailability for ${instructor.rank} ${instructor.name}`,
               changes: `Date: ${todayStr}, Time: 0001-2359, Reason: Other (Today Only)`,
               page: "Staff"
           });

           onUpdateInstructor({
               ...instructor,
               unavailability: [...(instructor.unavailability || []), newPeriod]
           });
    };

    const handleSaveUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
        const newPeriod: UnavailabilityPeriod = {
            ...periodData,
            id: uuidv4(),
            startTime: periodData.allDay ? undefined : periodData.startTime,
            endTime: periodData.allDay ? undefined : periodData.endTime,
        };

        const dateRange = newPeriod.startDate === newPeriod.endDate 
            ? newPeriod.startDate 
            : `${newPeriod.startDate} to ${newPeriod.endDate}`;
        const timeInfo = newPeriod.allDay ? 'All Day' : `${newPeriod.startTime}-${newPeriod.endTime}`;
        
        logAudit({
            action: 'Add',
            description: `Added unavailability for ${instructor.rank} ${instructor.name}`,
            changes: `${dateRange} (${timeInfo}) - ${newPeriod.reason}`,
            page: 'Staff'
        });

        onUpdateInstructor({
            ...instructor,
            unavailability: [...(instructor.unavailability || []), newPeriod]
        });
    };
    
    const handleRemoveUnavailability = (id: string) => {
        const periodToRemove = instructor.unavailability?.find(p => p.id === id);
        if (periodToRemove) {
            const dateRange = periodToRemove.startDate === periodToRemove.endDate 
                ? periodToRemove.startDate 
                : `${periodToRemove.startDate} to ${periodToRemove.endDate}`;
            
            logAudit({
                action: 'Delete',
                description: `Removed unavailability for ${instructor.rank} ${instructor.name}`,
                changes: `${dateRange} - ${periodToRemove.reason}`,
                page: 'Staff'
            });
        }
        
        onUpdateInstructor({ 
            ...instructor, 
            unavailability: instructor.unavailability.filter(p => p.id !== id)
        });
    };

    const assignedTraineesWindow = (
        <fieldset className="p-3 border border-gray-600 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Assigned Trainees</legend>
            <div className="mt-1 h-24 overflow-y-auto p-2 space-y-1 text-sm scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {hasAssignedTrainees ? (
                    <>
                        {primaryTrainees.map(t => <div key={t.idNumber} className="text-white truncate"><span className="font-semibold text-sky-400">Primary:</span> {t.name}</div>)}
                        {secondaryTrainees.map(t => <div key={t.idNumber} className="text-gray-300 truncate"><span className="font-semibold text-sky-500">Secondary:</span> {t.name}</div>)}
                    </>
                ) : (
                    <p className="text-gray-500 italic text-center">No trainees assigned.</p>
                )}
            </div>
        </fieldset>
    );

    const buttonClasses = "w-full px-4 py-2 rounded-md transition-colors text-sm font-semibold shadow-md text-center";

    const callsignDisplay = instructor.callsignNumber > 0
        ? `${callsignPrefix} ${String(instructor.callsignNumber).padStart(3, '0')}`
        : 'None';

    const activeQualifications = [
        { name: 'Executive', active: instructor.isExecutive },
        { name: 'Flying Supervisor', active: instructor.isFlyingSupervisor },
        { name: 'Testing Officer', active: instructor.isTestingOfficer },
        { name: 'IRE', active: instructor.isIRE },
        { name: 'CO', active: instructor.isCommandingOfficer },
        { name: 'CFI', active: instructor.isCFI },
        { name: 'DFC', active: instructor.isDeputyFlightCommander },
        { name: 'Contractor', active: instructor.isContractor },
        { name: 'Admin Staff', active: instructor.isAdminStaff },
        { name: 'QFI', active: instructor.isQFI },
        { name: 'OFI', active: instructor.isOFI },
    ].filter(q => q.active).map(q => q.name);

    const dayTotal = priorExperience.day.p1 + priorExperience.day.p2 + priorExperience.day.dual;
    const nightTotal = priorExperience.night.p1 + priorExperience.night.p2 + priorExperience.night.dual;
    const instrumentTotal = priorExperience.instrument.sim + priorExperience.instrument.actual;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 flex-shrink-0">
                        <h2 className="text-xl font-bold text-sky-400">{isCreating ? 'New Staff' : 'Staff Profile'}</h2>
                        <button onClick={onClose} className="text-white hover:text-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex flex-row overflow-hidden">
                        {/* LEFT: Content Panel */}
                        <div className="flex-1 p-6 space-y-4 overflow-y-auto">

                            {/* SECTION 1: Profile Card */}
                            {!isEditing ? (
                                <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 flex gap-4">
                                    {/* Avatar */}
                                    <div className="rounded-full w-20 h-20 bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    {/* Profile Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-2xl font-bold text-white truncate">{instructor.name}</h3>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-700 text-green-100 flex-shrink-0">Active</span>
                                        </div>
                                        <hr className="border-gray-600 mb-3" />
                                        {/* Row 1: ID Number, Role, Callsign */}
                                        <div className="grid grid-cols-3 gap-x-4 gap-y-3 mb-3">
                                            <ProfileField label="ID Number" value={instructor.idNumber} />
                                            <ProfileField label="Role" value={instructor.role} />
                                            <ProfileField label="Callsign" value={callsignDisplay} />
                                        </div>
                                        {/* Row 2: Rank, Service, Unit, Flight */}
                                        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mb-3">
                                            <ProfileField label="Rank" value={instructor.rank} />
                                            <ProfileField label="Service" value={instructor.service || '—'} />
                                            <ProfileField label="Unit" value={instructor.unit || '—'} />
                                            <ProfileField label="Flight" value={instructor.flight || '—'} />
                                        </div>
                                        {/* Row 3: Seat Config, Location, Phone, Email, Permissions */}
                                        <div className="grid grid-cols-5 gap-x-4 gap-y-3">
                                            <ProfileField label="Seat Config" value={instructor.seatConfig} />
                                            <ProfileField label="Location" value={instructor.location || '—'} />
                                            <ProfileField label="Phone Number" value={instructor.phoneNumber || '—'} />
                                            <ProfileField label="Email" value={instructor.email || '—'} />
                                            <div>
                                                <div className="text-xs text-gray-400 mb-1">Permissions</div>
                                                <div className="text-white text-sm">
                                                    {instructor.permissions && instructor.permissions.length > 0
                                                        ? instructor.permissions.map(p => <div key={p} className="leading-5">• {p}</div>)
                                                        : <span className="text-gray-500">None</span>
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Edit mode profile form */
                                <div className="bg-gray-900/50 rounded-xl border border-gray-700 p-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InputField label="Name (Surname, Firstname)" value={name} onChange={e => handleNameChange(e.target.value)} />
                                        <InputField label="ID Number" value={idNumber} onChange={e => setIdNumber(parseInt(e.target.value, 10) || 0)} type="number" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Rank" value={rank} onChange={e => handleRankChange(e.target.value as InstructorRank)}>
                                            <option value="WGCDR">WGCDR</option><option value="SQNLDR">SQNLDR</option><option value="FLTLT">FLTLT</option><option value="FLGOFF">FLGOFF</option><option value="PLTOFF">PLTOFF</option><option value="Mr">Mr</option>
                                        </Dropdown>
                                        <Dropdown label="Role" value={role} onChange={e => handleRoleChange(e.target.value as 'QFI' | 'SIM IP')}>
                                            <option value="QFI">QFI</option><option value="SIM IP">SIM IP</option>
                                        </Dropdown>
                                        {role === 'QFI' && (
                                            <Dropdown label="Callsign" value={String(callsignNumber)} onChange={e => setCallsignNumber(parseInt(e.target.value, 10) || 0)}>
                                                <option value="0">None</option>
                                                {callsignNumbers.map(num => <option key={num} value={num}>{callsignPrefix} {String(num).padStart(3, '0')}</option>)}
                                            </Dropdown>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Service" value={service || ''} onChange={e => setService((e.target.value || undefined) as 'RAAF' | 'RAN' | 'ARA' | undefined)}>
                                            <option value="">N/A</option><option value="RAAF">RAAF</option><option value="RAN">RAN</option><option value="ARA">ARA</option>
                                        </Dropdown>
                                        <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}>
                                            <option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option>
                                        </Dropdown>
                                        <Dropdown label="Category" value={category} onChange={e => handleCategoryChange(e.target.value as InstructorCategory)}>
                                            <option value="UnCat">UnCat</option><option value="D">D</option><option value="C">C</option><option value="B">B</option><option value="A">A</option>
                                        </Dropdown>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Location" value={location} onChange={e => setLocation(e.target.value)}>{locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</Dropdown>
                                        <Dropdown label="Unit" value={unit} onChange={e => setUnit(e.target.value)}>{units.map(u => <option key={u} value={u}>{u}</option>)}</Dropdown>
                                        <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                                        <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                    <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-gray-300">Permissions</legend>
                                        <div className="mt-1 min-h-[4rem] p-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                                            {allPermissions.map(perm => (
                                                <label key={perm} className="flex items-center space-x-3 cursor-pointer">
                                                    <input type="checkbox" checked={permissions.includes(perm)} onChange={e => handlePermissionChange(perm, e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600 rounded" />
                                                    <span className="text-white">{perm}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </fieldset>
                                </div>
                            )}

                            {/* SECTION 2: Logbook – Prior Experience */}
                            <div className="bg-gray-900/30 rounded-xl border border-gray-700 p-4">
                                <h3 className="text-sm font-semibold text-sky-400 mb-4">Logbook – Prior Experience (PC-21 only)</h3>
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-700 pb-4">
                                            <div>
                                                <span className="block text-sm font-bold text-gray-300 mb-2 text-center">Day Flying</span>
                                                <div className="flex justify-center space-x-2">
                                                    <ExperienceInput label="P1" value={priorExperience.day.p1} onChange={v => handleExperienceChange('day', 'p1', v)} />
                                                    <ExperienceInput label="P2" value={priorExperience.day.p2} onChange={v => handleExperienceChange('day', 'p2', v)} />
                                                    <ExperienceInput label="Dual" value={priorExperience.day.dual} onChange={v => handleExperienceChange('day', 'dual', v)} />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-gray-300 mb-2 text-center">Night Flying</span>
                                                <div className="flex justify-center space-x-2">
                                                    <ExperienceInput label="P1" value={priorExperience.night.p1} onChange={v => handleExperienceChange('night', 'p1', v)} />
                                                    <ExperienceInput label="P2" value={priorExperience.night.p2} onChange={v => handleExperienceChange('night', 'p2', v)} />
                                                    <ExperienceInput label="Dual" value={priorExperience.night.dual} onChange={v => handleExperienceChange('night', 'dual', v)} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-700 pb-4">
                                            <div>
                                                <span className="block text-sm font-bold text-gray-300 mb-2 text-center">Totals</span>
                                                <div className="flex justify-center space-x-2">
                                                    <ExperienceInput label="TOTAL" value={priorExperience.total} onChange={v => handleExperienceChange('total', null, v)} />
                                                    <ExperienceInput label="Captain" value={priorExperience.captain} onChange={v => handleExperienceChange('captain', null, v)} />
                                                    <ExperienceInput label="Instructor" value={priorExperience.instructor} onChange={v => handleExperienceChange('instructor', null, v)} />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-gray-300 mb-2 text-center">Instrument</span>
                                                <div className="flex justify-center space-x-2">
                                                    <ExperienceInput label="Sim" value={priorExperience.instrument.sim} onChange={v => handleExperienceChange('instrument', 'sim', v)} />
                                                    <ExperienceInput label="Actual" value={priorExperience.instrument.actual} onChange={v => handleExperienceChange('instrument', 'actual', v)} />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-gray-300 mb-2 text-center">Simulator</span>
                                            <div className="flex justify-center space-x-4">
                                                <ExperienceInput label="P1" value={priorExperience.simulator.p1} onChange={v => handleExperienceChange('simulator', 'p1', v)} />
                                                <ExperienceInput label="P2" value={priorExperience.simulator.p2} onChange={v => handleExperienceChange('simulator', 'p2', v)} />
                                                <ExperienceInput label="Dual" value={priorExperience.simulator.dual} onChange={v => handleExperienceChange('simulator', 'dual', v)} />
                                                <ExperienceInput label="Total" value={priorExperience.simulator.total} onChange={v => handleExperienceChange('simulator', 'total', v)} />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-5 gap-3">
                                        {/* Day Flying */}
                                        <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-300 mb-2 text-center">Day Flying</span>
                                            <CircularGauge value={dayTotal} maxValue={500} size={72} strokeWidth={7} />
                                            <div className="mt-3 w-full space-y-1 text-xs">
                                                <div className="flex justify-between text-gray-400"><span>P1</span><span className="text-white">{priorExperience.day.p1.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>P2</span><span className="text-white">{priorExperience.day.p2.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Dual</span><span className="text-white">{priorExperience.day.dual.toFixed(1)}</span></div>
                                            </div>
                                            <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((dayTotal / 500) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        {/* Night Flying */}
                                        <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-300 mb-2 text-center">Night Flying</span>
                                            <CircularGauge value={nightTotal} maxValue={200} size={72} strokeWidth={7} />
                                            <div className="mt-3 w-full space-y-1 text-xs">
                                                <div className="flex justify-between text-gray-400"><span>P1</span><span className="text-white">{priorExperience.night.p1.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>P2</span><span className="text-white">{priorExperience.night.p2.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Dual</span><span className="text-white">{priorExperience.night.dual.toFixed(1)}</span></div>
                                            </div>
                                            <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((nightTotal / 200) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        {/* Totals */}
                                        <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-300 mb-2 text-center">Totals</span>
                                            <CircularGauge value={priorExperience.total} maxValue={2000} size={72} strokeWidth={7} />
                                            <div className="mt-3 w-full space-y-1 text-xs">
                                                <div className="flex justify-between text-gray-400"><span>TOTAL</span><span className="text-white">{priorExperience.total.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Captain</span><span className="text-white">{priorExperience.captain.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Instructor</span><span className="text-white">{priorExperience.instructor.toFixed(1)}</span></div>
                                            </div>
                                            <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((priorExperience.total / 2000) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        {/* Instrument */}
                                        <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-300 mb-2 text-center">Instrument</span>
                                            <CircularGauge value={instrumentTotal} maxValue={200} size={72} strokeWidth={7} />
                                            <div className="mt-3 w-full space-y-1 text-xs">
                                                <div className="flex justify-between text-gray-400"><span>Sim</span><span className="text-white">{priorExperience.instrument.sim.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Actual</span><span className="text-white">{priorExperience.instrument.actual.toFixed(1)}</span></div>
                                            </div>
                                            <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((instrumentTotal / 200) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                        {/* Simulator */}
                                        <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col items-center">
                                            <span className="text-xs font-semibold text-gray-300 mb-2 text-center">Simulator</span>
                                            <CircularGauge value={priorExperience.simulator.total} maxValue={500} size={72} strokeWidth={7} />
                                            <div className="mt-3 w-full space-y-1 text-xs">
                                                <div className="flex justify-between text-gray-400"><span>P1</span><span className="text-white">{priorExperience.simulator.p1.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>P2</span><span className="text-white">{priorExperience.simulator.p2.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Dual</span><span className="text-white">{priorExperience.simulator.dual.toFixed(1)}</span></div>
                                                <div className="flex justify-between text-gray-400"><span>Total</span><span className="text-white">{priorExperience.simulator.total.toFixed(1)}</span></div>
                                            </div>
                                            <div className="mt-2 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((priorExperience.simulator.total / 500) * 100, 100)}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: Assigned Trainees */}
                            {!isCreating && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-900/30 rounded-xl border border-gray-700 p-4">
                                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Assigned Trainees (Primary)</h3>
                                        <div className="space-y-2">
                                            {primaryTrainees.length > 0 ? primaryTrainees.map(t => (
                                                <div key={t.idNumber} className="flex items-center gap-2">
                                                    <div className="rounded-full w-7 h-7 bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    </div>
                                                    <span className="text-white text-sm truncate">{t.name}</span>
                                                </div>
                                            )) : (
                                                <div className="flex items-center gap-2 text-gray-500 italic text-sm">
                                                    <div className="rounded-full w-7 h-7 bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    </div>
                                                    No trainees assigned
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-gray-900/30 rounded-xl border border-gray-700 p-4">
                                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Assigned Trainees (Secondary)</h3>
                                        <div className="space-y-2">
                                            {secondaryTrainees.length > 0 ? secondaryTrainees.map(t => (
                                                <div key={t.idNumber} className="flex items-center gap-2">
                                                    <div className="rounded-full w-7 h-7 bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    </div>
                                                    <span className="text-white text-sm truncate">{t.name}</span>
                                                </div>
                                            )) : (
                                                <div className="flex items-center gap-2 text-gray-500 italic text-sm">
                                                    <div className="rounded-full w-7 h-7 bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    </div>
                                                    No trainees assigned
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 4: Unavailability */}
                            <div className="bg-gray-900/30 rounded-xl border border-gray-700 p-4">
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Unavailability</h3>
                                {unavailabilityPeriods.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {unavailabilityPeriods.map(p => {
                                            let displayString = '';
                                            const startDisplayDate = formatDate(p.startDate);
                                            if (p.allDay) {
                                                const lastDayOfUnavailability = new Date(`${p.endDate}T00:00:00Z`);
                                                lastDayOfUnavailability.setUTCDate(lastDayOfUnavailability.getUTCDate() - 1);
                                                const lastDayStr = lastDayOfUnavailability.toISOString().split('T')[0];
                                                const lastDayDisplay = formatDate(lastDayStr);
                                                const dateRange = p.startDate === lastDayStr ? startDisplayDate : `${startDisplayDate} to ${lastDayDisplay}`;
                                                displayString = `${dateRange} @ All Day`;
                                            } else {
                                                const endDisplayDate = formatDate(p.endDate);
                                                const startTimeDisplay = formatMilitaryTime(p.startTime);
                                                const endTimeDisplay = formatMilitaryTime(p.endTime);
                                                if (p.startDate === p.endDate) {
                                                    displayString = `${startTimeDisplay} ${startDisplayDate} - ${endTimeDisplay} ${endDisplayDate}`;
                                                } else {
                                                    displayString = `${startTimeDisplay} ${startDisplayDate} to ${endTimeDisplay} ${endDisplayDate}`;
                                                }
                                            }
                                            return (
                                                <div key={p.id} className="p-2 bg-gray-700/50 rounded-md text-sm">
                                                    <span className="font-semibold text-white">{p.reason}</span>
                                                    <div className="text-xs text-gray-300 mt-0.5 font-mono">{displayString}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-lg bg-gray-800/50 text-center text-gray-500 italic text-sm">
                                        No unavailability periods scheduled.
                                    </div>
                                )}
                            </div>

                            {/* SECTION 5: Qualifications & Roles */}
                            <div className="bg-gray-900/30 rounded-xl border border-gray-700 p-4">
                                <h3 className="text-sm font-semibold text-gray-300 mb-3">Qualifications & Roles</h3>
                                {isEditing ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isExecutive} onChange={e => setIsExecutive(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>Executive</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isFlyingSupervisor} onChange={e => setIsFlyingSupervisor(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>Flying Supervisor</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isTestingOfficer} onChange={e => setIsTestingOfficer(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>Testing Officer</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isIRE} onChange={e => setIsIRE(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>IRE</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isCommandingOfficer} onChange={e => setIsCommandingOfficer(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>CO</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isCFI} onChange={e => setIsCFI(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>CFI</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isDeputyFlightCommander} onChange={e => setIsDeputyFlightCommander(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>DFC</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isContractor} onChange={e => setIsContractor(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>Contractor</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isAdminStaff} onChange={e => setIsAdminStaff(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>Admin Staff</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isQFI} onChange={e => setIsQFI(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>QFI</span></label>
                                        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isOFI} onChange={e => setIsOFI(e.target.checked)} className="h-4 w-4 accent-sky-500 bg-gray-600" /><span>OFI</span></label>
                                    </div>
                                ) : (
                                    activeQualifications.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {activeQualifications.map(q => (
                                                <span key={q} className="px-2 py-1 bg-sky-900/40 text-sky-300 rounded-full text-xs font-medium border border-sky-700/50">{q}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 italic text-sm">No qualifications assigned.</p>
                                    )
                                )}
                            </div>

                        </div>
                        {/* RIGHT: Button Panel */}
                        <div className="w-56 flex-shrink-0 border-l border-gray-700 bg-gray-800/50 p-4 flex flex-col space-y-3">
                            {!isEditing && !isCreating && (
                                <>
                                    <button onClick={() => setShowAddUnavailability(true)} className={`${buttonClasses} bg-amber-600 text-white hover:bg-amber-700`}>Unavailability</button>
                                    <button onClick={() => onNavigateToCurrency(instructor)} className={`${buttonClasses} btn-aluminium-brushed`}>Currency</button>
                                    <button onClick={() => { if(onViewLogbook) onViewLogbook(instructor); }} className={`${buttonClasses} btn-aluminium-brushed`}>Logbook</button>
                                    <button onClick={onRequestSct} className={`${buttonClasses} btn-aluminium-brushed`}>Request SCT</button>
                                </>
                            )}
                            <div className="flex-grow"></div>
                            {isEditing ? (
                                <>
                                    <button onClick={handleSave} className={`${buttonClasses} btn-aluminium-brushed`}>Save</button>
                                    <button onClick={handleCancel} className={`${buttonClasses} btn-aluminium-brushed`}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={handleEdit} className={`${buttonClasses} btn-aluminium-brushed`}>Edit</button>
                                    <button onClick={onClose} className={`${buttonClasses} bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white`}>Close</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showAddUnavailability && !isCreating && (
                <AddUnavailabilityFlyout
                    onClose={() => setShowAddUnavailability(false)}
                    onTodayOnly={handleAddTodayOnly}
                    onSave={handleSaveUnavailability}
                    unavailabilityPeriods={instructor.unavailability || []}
                    onRemove={handleRemoveUnavailability}
                />
            )}
        </>
    );
};
