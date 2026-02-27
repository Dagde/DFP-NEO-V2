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
  isOpening?: boolean;
  isCreating?: boolean;
  locations: string[];
  units: string[];
  traineesData: Trainee[];
  onViewLogbook?: (person: Instructor) => void;
  onRequestSct: () => void;
}

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

export const InstructorProfileFlyout: React.FC<InstructorProfileFlyoutProps> = ({
    instructor,
    onClose,
    school,
    personnelData,
    onUpdateInstructor,
    onNavigateToCurrency,
    originRect,
    isClosing,
    isOpening = false,
    isCreating = false,
    locations,
    units,
    traineesData,
    onViewLogbook,
    onRequestSct
}) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const [showAddUnavailability, setShowAddUnavailability] = useState(false);
    const [isAnimatingOpen, setIsAnimatingOpen] = useState(isOpening);
    const panelRef = useRef<HTMLDivElement>(null);

    // State for editable fields
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
    const callsignPrefix = school === 'ESL' ? 'ROLR' : 'VIPR';
    const callsignNumbers = useMemo(() => Array.from({ length: 99 }, (_, i) => i + 1), []);

    const { primaryTrainees, secondaryTrainees } = useMemo(() => {
        if (!traineesData) return { primaryTrainees: [], secondaryTrainees: [] };
        const primary = traineesData.filter(t => t.primaryInstructor === instructor.name).sort((a,b) => a.name.localeCompare(b.name));
        const secondary = traineesData.filter(t => t.secondaryInstructor === instructor.name).sort((a,b) => a.name.localeCompare(b.name));
        return { primaryTrainees: primary, secondaryTrainees: secondary };
    }, [traineesData, instructor.name]);

    // Calculate logbook totals
    const dayTotal = priorExperience.day.p1 + priorExperience.day.p2 + priorExperience.day.dual;
    const nightTotal = priorExperience.night.p1 + priorExperience.night.p2 + priorExperience.night.dual;
    const instrumentTotal = priorExperience.instrument.sim + priorExperience.instrument.actual;
    const simulatorTotal = priorExperience.simulator.p1 + priorExperience.simulator.p2 + priorExperience.simulator.dual;

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
        if (isOpening) {
            const timer = setTimeout(() => {
                setIsAnimatingOpen(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpening]);

    const handleEdit = () => setIsEditing(true);

    const handleCancel = () => {
        if (isCreating) {
            onClose();
        } else {
            resetState();
            setIsEditing(false);
        }
    };

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
            alert('PMKeys/ID and Name are required.');
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
        
        flushPendingAudits();
        
        if (isCreating) {
            logAudit({
                action: 'Add',
                description: `Added new instructor ${rank} ${name}`,
                changes: `Role: ${role}, Category: ${category}, Unit: ${unit}`,
                page: 'Staff'
            });
        } else {
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

        try {
            const fileName = `Logbook_${name.replace(/,\s/g, '_')}_${updatedInstructor.idNumber}.json`;
            const fileContent = JSON.stringify(priorExperience, null, 2);
            const file = new File([fileContent], fileName, { type: "application/json" });
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

    return (
        <>
            {/* Full Screen Overlay */}
            <div 
                className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                    isAnimatingOpen || isClosing ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={onClose}
            />
            
            {/* Main Profile Panel - Scaled Down */}
            <div
                ref={panelRef}
                className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#1e2433] z-50 transition-all duration-300 ease-out flex flex-col shadow-2xl rounded-lg overflow-hidden ${
                    isAnimatingOpen || isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
                }`}
                style={{ width: '85vw', height: '85vh' }}
            >
                {/* Header with Title and Close Button */}
                <div className="flex items-center justify-between px-6 py-3 bg-[#252d3d] border-b border-gray-700 flex-shrink-0">
                    <h1 className="text-xl font-bold text-white">{isCreating ? 'New Staff' : 'Staff Profile'}</h1>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex gap-5">
                        {/* LEFT COLUMN: Profile Info */}
                        <div className="flex-1 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-[#2a3441] rounded-lg p-5">
                                <div className="flex gap-6">
                                    {/* Left Column: Name, Status, Avatar */}
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        {/* Name - AT TOP */}
                                        <h2 className="text-xl font-bold text-white mb-1.5 text-center">
                                            {isEditing ? name : instructor.name}
                                        </h2>

                                        {/* Status Badge - BELOW NAME, ABOVE AVATAR */}
                                        <div className="mb-3.5">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/50">
                                                Active
                                            </span>
                                        </div>

                                        {/* Large Profile Photo - AT BOTTOM */}
                                        <div className="w-28 h-28 bg-gray-700 rounded-full flex items-center justify-center text-gray-500">
                                            <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Right Section: Four Columns of Data */}
                                    <div className="flex-1 grid grid-cols-4 gap-x-2 gap-y-2">
                                        {/* Column 1 */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">ID Number</label>
                                                <div className="text-white font-medium text-sm">{instructor.idNumber}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Rank</label>
                                                <div className="text-white font-medium text-sm">{instructor.rank}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Seat Config</label>
                                                <div className="text-white font-medium text-sm">{instructor.seatConfig}</div>
                                            </div>
                                        </div>

                                        {/* Column 2 */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Role</label>
                                                <div className="text-white font-medium text-sm">{instructor.role}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Service</label>
                                                <div className="text-white font-medium text-sm">{instructor.service || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Location</label>
                                                <div className="text-white font-medium text-sm">{instructor.location || 'N/A'}</div>
                                            </div>
                                        </div>

                                        {/* Column 3 */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Category</label>
                                                <div className="text-white font-medium text-sm">{instructor.category || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Unit</label>
                                                <div className="text-white font-medium text-sm">{instructor.unit || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Phone Number</label>
                                                <div className="text-white font-medium text-sm">{instructor.phoneNumber || 'N/A'}</div>
                                            </div>
                                        </div>

                                        {/* Column 4 */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Callsign</label>
                                                <div className="text-white font-medium text-sm">
                                                    {instructor.callsignNumber > 0 ? `${callsignPrefix} ${String(instructor.callsignNumber).padStart(3, '0')}` : 'N/A'}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Secondary Callsign</label>
                                                <div className="text-white font-medium text-sm">[None]</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Flight</label>
                                                <div className="text-white font-medium text-sm">{instructor.flight || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Email</label>
                                                <div className="text-white font-medium text-xs">{instructor.email || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-0.5">Permissions</label>
                                                <div className="text-white font-medium text-xs">
                                                    {instructor.permissions && instructor.permissions.length > 0 ? (
                                                        <span>• {instructor.permissions.join(' • ')}</span>
                                                    ) : (
                                                        <span className="text-gray-500 italic">No permissions assigned</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trainees Panel (right side of profile card) */}
                                    {!isCreating && (
                                        <div className="w-44 flex-shrink-0 border-l border-gray-600/50 pl-3 space-y-3">
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-1">Primary Trainees</label>
                                                {primaryTrainees.length === 0 ? (
                                                    <div className="text-gray-500 italic text-xs">No trainees assigned</div>
                                                ) : (
                                                    <div className="space-y-1 max-h-[80px] overflow-y-auto" tabIndex={0} aria-label="Primary trainees list">
                                                        {primaryTrainees.map(t => (
                                                            <div key={t.idNumber} className="flex items-center gap-1.5">
                                                                <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <div className="text-white text-xs font-medium truncate">{t.name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 mb-1">Secondary Trainees</label>
                                                {secondaryTrainees.length === 0 ? (
                                                    <div className="text-gray-500 italic text-xs">No trainees assigned</div>
                                                ) : (
                                                    <div className="space-y-1 max-h-[80px] overflow-y-auto" tabIndex={0} aria-label="Secondary trainees list">
                                                        {secondaryTrainees.map(t => (
                                                            <div key={t.idNumber} className="flex items-center gap-1.5">
                                                                <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <div className="text-white text-xs font-medium truncate">{t.name}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Logbook Section with Circular Gauges */}
                            <div className="bg-[#252d3d] rounded-lg p-5">
                                <h3 className="text-sm font-semibold text-white mb-5">Logbook - Prior Experience (PC-21 only)</h3>
                                <div className="grid grid-cols-5 gap-4">
                                    {/* Day Flying Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-3 text-center">Day Flying</h4>
                                        <div className="flex justify-center mb-3">
                                            <CircularGauge value={dayTotal} maxValue={100} size={64} />
                                        </div>
                                        <div className="space-y-0.5 text-[10px]">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.day.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.day.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.day.dual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Night Flying Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-3 text-center">Night Flying</h4>
                                        <div className="flex justify-center mb-3">
                                            <CircularGauge value={nightTotal} maxValue={100} size={64} />
                                        </div>
                                        <div className="space-y-0.5 text-[10px]">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.night.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.night.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.night.dual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Totals Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-3 text-center">Totals</h4>
                                        <div className="flex justify-center mb-3">
                                            <CircularGauge value={priorExperience.total} maxValue={500} size={64} />
                                        </div>
                                        <div className="space-y-0.5 text-[10px]">
                                            <div className="flex justify-between text-gray-400">
                                                <span>TOTAL</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.total.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Captain</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.captain.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Instructor</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.instructor.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Instrument Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-3 text-center">Instrument</h4>
                                        <div className="flex justify-center mb-3">
                                            <CircularGauge value={instrumentTotal} maxValue={100} size={64} />
                                        </div>
                                        <div className="space-y-0.5 text-[10px]">
                                            <div className="flex justify-between text-gray-400">
                                                <span>Sim</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.instrument.sim.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Actual</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.instrument.actual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Simulator Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-3 text-center">Simulator</h4>
                                        <div className="flex justify-center mb-3">
                                            <CircularGauge value={simulatorTotal} maxValue={100} size={64} />
                                        </div>
                                        <div className="space-y-0.5 text-[10px]">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.simulator.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.simulator.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.simulator.dual.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 pt-0.5 border-t border-gray-600">
                                                <span>Total</span>
                                                <span className="text-white font-mono text-[10px]">{priorExperience.simulator.total.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Events Section */}
                            {!isCreating && (
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Next Event */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Next Event</h4>
                                        <div className="text-gray-500 italic text-xs">No event found</div>
                                    </div>

                                    {/* Next Event +1 */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Next Event +1</h4>
                                        <div className="text-gray-500 italic text-xs">No subsequent event</div>
                                    </div>

                                    {/* Last Flight */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Last Flight</h4>
                                        <div className="text-gray-500 italic text-xs">No flights recorded</div>
                                    </div>

                                    {/* Last Event */}
                                    <div className="bg-[#2a3441] rounded-lg p-3">
                                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Last Event</h4>
                                        <div className="text-gray-500 italic text-xs">No events recorded</div>
                                    </div>
                                </div>
                            )}

                            {/* Unavailability Section */}
                            <div className="bg-[#252d3d] rounded-lg p-5">
                                <h3 className="text-sm font-semibold text-white mb-3">Unavailability</h3>
                                {(instructor.unavailability || []).length > 0 ? (
                                    <div className="space-y-2">
                                        {(instructor.unavailability || [])
                                            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                                            .map(period => {
                                                let displayText = '';
                                                const startDateFormatted = formatDate(period.startDate);
                                                
                                                if (period.allDay) {
                                                    const endDate = new Date(`${period.endDate}T00:00:00Z`);
                                                    endDate.setUTCDate(endDate.getUTCDate() - 1);
                                                    const adjustedEndDate = endDate.toISOString().split('T')[0];
                                                    const endDateFormatted = formatDate(adjustedEndDate);
                                                    displayText = `${period.startDate === adjustedEndDate ? startDateFormatted : `${startDateFormatted} to ${endDateFormatted}`} @ All Day`;
                                                } else {
                                                    const endDateFormatted = formatDate(period.endDate);
                                                    const startTime = formatMilitaryTime(period.startTime);
                                                    const endTime = formatMilitaryTime(period.endTime);
                                                    if (period.startDate === period.endDate) {
                                                        displayText = `${startTime} ${startDateFormatted} - ${endTime} ${endDateFormatted}`;
                                                    } else {
                                                        displayText = `${startTime} ${startDateFormatted} to ${endTime} ${endDateFormatted}`;
                                                    }
                                                }

                                                return (
                                                    <div key={period.id} className="flex items-center justify-between p-2.5 bg-[#2a3441] rounded-lg">
                                                        <div>
                                                            <div className="text-white font-medium text-xs">{period.reason}</div>
                                                            <div className="text-gray-400 text-[10px] font-mono mt-0.5">{displayText}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic text-center py-3 text-xs">
                                        No unavailability periods scheduled.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Action Buttons */}
                        <div className="w-[77px] space-y-[1px] flex-shrink-0 flex flex-col items-center">
                            {!isEditing && !isCreating && (
                                <>
                                    <button
                                        onClick={() => setShowAddUnavailability(true)}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Unavailable
                                    </button>
                                    <button
                                        onClick={() => onNavigateToCurrency(instructor)}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Currency
                                    </button>
                                    <button
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        PT-051
                                    </button>
                                    <button
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all text-center leading-tight"
                                    >
                                        View Individual LMP
                                    </button>
                                    <button
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all text-center leading-tight"
                                    >
                                        Add Remedial Package
                                    </button>
                                    <button
                                        onClick={() => { if(onViewLogbook) onViewLogbook(instructor); }}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Logbook
                                    </button>
                                    <button
                                        onClick={handleEdit}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                            {isEditing && (
                                <>
                                    <button
                                        onClick={handleSave}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="w-[69px] h-[47px] flex items-center justify-center text-[11px] font-semibold btn-aluminium-brushed rounded-md transition-all"
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Flyouts */}
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