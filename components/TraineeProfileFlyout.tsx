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
  isClosing?: boolean;
  isOpening?: boolean;
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

const TraineeProfileFlyout: React.FC<TraineeProfileFlyoutProps> = ({
  trainee,
  onClose,
  onUpdateTrainee,
  events,
  school,
  onNavigateToHateSheet,
  onViewIndividualLMP,
  onAddRemedialPackage,
  personnelData,
  courseColors,
  scores,
  syllabusDetails,
  onNavigateToSyllabus,
  onNavigateToCurrency,
  locations,
  units,
  individualLmp,
  onViewLogbook,
  isCreating = false,
  activeCourses = [],
  isClosing = false,
  isOpening = false
}) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const [showAddUnavailability, setShowAddUnavailability] = useState(false);
    const [showPauseConfirm, setShowPauseConfirm] = useState(false);
    const [showScheduleWarning, setShowScheduleWarning] = useState(false);
    const [isAnimatingOpen, setIsAnimatingOpen] = useState(isOpening);
    
    // Editable state
    const [name, setName] = useState(trainee.name);
    const [idNumber, setIdNumber] = useState(trainee.idNumber);
    const [rank, setRank] = useState<TraineeRank>(trainee.rank);
    const [service, setService] = useState(trainee.service || '');
    const [course, setCourse] = useState(trainee.course || activeCourses[0] || '');
    const [lmpType, setLmpType] = useState(trainee.lmpType || 'BPC+IPC');
    const [traineeCallsign, setTraineeCallsign] = useState(trainee.traineeCallsign || '');
    const [secondaryCallsign, setSecondaryCallsign] = useState(trainee.secondaryCallsign || '');
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

    const { 
        lastFlight, 
        lastEvent, 
        daysSinceLastFlight, 
        daysSinceLastEvent 
    } = useMemo(() => {
        const traineeScores = scores.get(trainee.fullName) || [];
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        
        const calculateDays = (dateStr: string | undefined): number | null => {
            if (!dateStr) return null;
            const eventDate = new Date(dateStr + 'T00:00:00Z');
            return Math.round((today.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
        };

        if (traineeScores.length === 0) {
            return { 
                lastFlight: null, 
                lastEvent: null, 
                daysSinceLastFlight: null, 
                daysSinceLastEvent: null 
            };
        }

        const sortedScores = [...traineeScores].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const lastEvt = sortedScores[0] || null;

        const lastFlt = sortedScores.find(score => {
            const syllabusItem = syllabusDetails.find(item => item.id === score.event);
            return syllabusItem?.type === 'Flight';
        }) || null;

        return {
            lastFlight: lastFlt,
            lastEvent: lastEvt,
            daysSinceLastFlight: calculateDays(lastFlt?.date),
            daysSinceLastEvent: calculateDays(lastEvt?.date)
        };
    }, [trainee.fullName, scores, syllabusDetails]);


    const { nextEvent, subsequentEvent, nextEventReason } = useMemo(() => {
        if (isCreating) return { nextEvent: null, subsequentEvent: null, nextEventReason: 'New Trainee' };
        
        const traineeScores = scores.get(trainee.fullName) || [];
        const completedEventIds = new Set(traineeScores.map(s => s.event));

        let nextEvt: SyllabusItemDetail | null = null;
        let subsequentEvt: SyllabusItemDetail | null = null;
        let reason = '';
        let nextEventIndex = -1;

        for (let i = 0; i < individualLmp.length; i++) {
            const item = individualLmp[i];
            if (completedEventIds.has(item.id) || item.code.includes(' MB')) {
                continue;
            }
            const prereqsMet = item.prerequisites.every(prereqId => completedEventIds.has(prereqId));
            if (prereqsMet) {
                nextEvt = item;
                nextEventIndex = i;
                break;
            }
        }

        if (nextEventIndex !== -1) {
            for (let i = nextEventIndex + 1; i < individualLmp.length; i++) {
                const item = individualLmp[i];
                if (!item.code.includes(' MB')) {
                    subsequentEvt = item;
                    break;
                }
            }
        }
        
        if (!nextEvt) {
            const allStandardEvents = individualLmp.filter(item => !item.isRemedial && !item.code.includes(' MB'));
            if (allStandardEvents.every(item => completedEventIds.has(item.id))) {
                reason = 'Syllabus complete.';
            } else {
                reason = 'Prerequisites incomplete.';
            }
        }

        return { nextEvent: nextEvt, subsequentEvent: subsequentEvt, nextEventReason: reason };
    }, [trainee.fullName, scores, individualLmp, isCreating]);


    const resetState = () => {
        setName(trainee.name);
        setIdNumber(trainee.idNumber);
        setRank(trainee.rank);
        setService(trainee.service || '');
        setCourse(trainee.course || activeCourses[0] || '');
        setLmpType(trainee.lmpType || 'BPC+IPC');
        setTraineeCallsign(trainee.traineeCallsign || '');
        setSecondaryCallsign(trainee.secondaryCallsign || '');
        setSeatConfig(trainee.seatConfig);
        setIsPaused(trainee.isPaused);
        setUnavailability(trainee.unavailability || []);
        setLocation(trainee.location || locations[0] || '');
        setUnit(trainee.unit || units[0] || '');
        setFlight(trainee.flight || '');
        setPhoneNumber(trainee.phoneNumber || '');
        setEmail(trainee.email || '');
        setPermissions(trainee.permissions || []);
        setPriorExperience(trainee.priorExperience || initialExperience);
    };

    useEffect(() => {
        resetState();
        setIsEditing(isCreating);
    }, [trainee, isCreating]);

    useEffect(() => {
        if (!isCreating) {
            logAudit({
                action: 'View',
                description: `Viewed trainee profile for ${trainee.rank} ${trainee.name}`,
                changes: `Course: ${trainee.course}, Unit: ${trainee.unit}`,
                page: 'Trainee Roster'
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


    const traineeHasEventsToday = useMemo(() => {
        return events.some(e => e.student === trainee.fullName || e.pilot === trainee.fullName);
    }, [events, trainee.fullName]);
    
    const handlePauseToggle = () => {
        if (!isPaused && traineeHasEventsToday) {
            setShowScheduleWarning(true);
        } else {
            setShowPauseConfirm(true);
        }
    };

    const confirmPause = () => {
        const updatedTrainee: Trainee = {
            ...trainee,
            isPaused: !trainee.isPaused,
        };
        onUpdateTrainee(updatedTrainee);
        setShowPauseConfirm(false);
    };

    const handleNameChange = (newName: string) => {
        const oldName = name;
        setName(newName);
        if (oldName && newName !== oldName) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-name`,
                'Edit',
                `Updated trainee name`,
                `Name: ${oldName} → ${newName}`,
                'Trainee Roster'
            );
        }
    };
    
    const handleRankChange = (newRank: TraineeRank) => {
        const oldRank = rank;
        setRank(newRank);
        if (oldRank !== newRank) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-rank`,
                'Edit',
                `Updated trainee rank`,
                `Rank: ${oldRank} → ${newRank}`,
                'Trainee Roster'
            );
        }
    };
    
    const handleCourseChange = (newCourse: string) => {
        const oldCourse = course;
        setCourse(newCourse);
        if (oldCourse !== newCourse) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-course`,
                'Edit',
                `Updated trainee course`,
                `Course: ${oldCourse} → ${newCourse}`,
                'Trainee Roster'
            );
        }
    };

    const handleLmpTypeChange = (newLmpType: string) => {
        const oldLmpType = lmpType;
        setLmpType(newLmpType);
        if (oldLmpType !== newLmpType) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-lmptype`,
                'Edit',
                `Updated trainee LMP type`,
                `LMP: ${oldLmpType} → ${newLmpType}`,
                'Trainee Roster'
            );
        }
    };

    const handleTraineeCallsignChange = (newTraineeCallsign: string) => {
        const oldTraineeCallsign = traineeCallsign;
        setTraineeCallsign(newTraineeCallsign);
        if (oldTraineeCallsign !== newTraineeCallsign) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-callsign`,
                'Edit',
                `Updated trainee callsign`,
                `Trainee Callsign: ${oldTraineeCallsign} → ${newTraineeCallsign}`,
                'Trainee Roster'
            );
        }
    };

    const handleSecondaryCallsignChange = (newSecondaryCallsign: string) => {
        const oldSecondaryCallsign = secondaryCallsign;
        setSecondaryCallsign(newSecondaryCallsign);
        if (oldSecondaryCallsign !== newSecondaryCallsign) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-secondary-callsign`,
                'Edit',
                `Updated secondary callsign`,
                `Secondary Callsign: ${oldSecondaryCallsign} → ${newSecondaryCallsign}`,
                'Trainee Roster'
            );
        }
    };

    const handleUnitChange = (newUnit: string) => {
        const oldUnit = unit;
        setUnit(newUnit);
        if (oldUnit !== newUnit) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-unit`,
                'Edit',
                `Updated trainee unit`,
                `Unit: ${oldUnit} → ${newUnit}`,
                'Trainee Roster'
            );
        }
    };
    
    const handleLocationChange = (newLocation: string) => {
        const oldLocation = location;
        setLocation(newLocation);
        if (oldLocation !== newLocation) {
            debouncedAuditLog(
                `trainee-${trainee.idNumber}-location`,
                'Edit',
                `Updated trainee location`,
                `Location: ${oldLocation} → ${newLocation}`,
                'Trainee Roster'
            );
        }
    };

    const handleSave = async () => {
        if (!name || !course) {
            alert("Name and Course are required.");
            return;
        }
        const fullName = `${name} – ${course}`;
        const updatedTrainee: Trainee = {
            ...trainee,
            idNumber,
            name,
            fullName,
            course,
            lmpType,
            traineeCallsign,
            secondaryCallsign,
            rank,
            seatConfig,
            isPaused,
            unavailability,
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
                description: `Added new trainee ${rank} ${name}`,
                changes: `Course: ${course}, Unit: ${unit}, Location: ${location}`,
                page: 'Trainee Roster'
            });
        } else {
            const changes: string[] = [];
            if (trainee.name !== name) changes.push(`Name: ${trainee.name} → ${name}`);
            if (trainee.rank !== rank) changes.push(`Rank: ${trainee.rank} → ${rank}`);
            if (trainee.course !== course) changes.push(`Course: ${trainee.course} → ${course}`);
            if (trainee.lmpType !== lmpType) changes.push(`LMP: ${trainee.lmpType || 'BPC+IPC'} → ${lmpType}`);
            if (trainee.traineeCallsign !== traineeCallsign) changes.push(`Trainee Callsign: ${trainee.traineeCallsign || 'N/A'} → ${traineeCallsign}`);
            if (trainee.secondaryCallsign !== secondaryCallsign) changes.push(`Secondary Callsign: ${trainee.secondaryCallsign || 'N/A'} → ${secondaryCallsign}`);
            if (trainee.unit !== unit) changes.push(`Unit: ${trainee.unit} → ${unit}`);
            if (trainee.location !== location) changes.push(`Location: ${trainee.location} → ${location}`);
            if (trainee.seatConfig !== seatConfig) changes.push(`Seat Config: ${trainee.seatConfig} → ${seatConfig}`);
            if (trainee.isPaused !== isPaused) changes.push(`Paused: ${trainee.isPaused} → ${isPaused}`);
            
            if (changes.length > 0) {
                logAudit({
                    action: 'Edit',
                    description: `Updated trainee ${rank} ${name}`,
                    changes: changes.join(', '),
                    page: 'Trainee Roster'
                });
            }
        }
        
        onUpdateTrainee(updatedTrainee);
        
        try {
            const cleanName = name.replace(/,\s/g, '_');
            const fileName = `Logbook_${cleanName}_${idNumber}.json`;
            const fileContent = JSON.stringify(priorExperience, null, 2);
            const file = new File([fileContent], fileName, { type: "application/json" });
            await addFile(file, 'trainee_logbook', fileName);
        } catch (error) {
            console.error("Failed to save logbook data to storage:", error);
        }

        setIsEditing(false);
        if (isCreating) {
            onClose();
        }
    };

    const handleCancel = () => {
        if (isCreating) {
            onClose();
        } else {
            resetState();
            setIsEditing(false);
        }
    };

    const handlePermissionChange = (permission: string, isChecked: boolean) => {
        setPermissions(prev => 
            isChecked ? [...prev, permission] : prev.filter(p => p !== permission)
        );
    };
    
    const handleHateSheetClick = () => {
        onNavigateToHateSheet(trainee);
        onClose();
    };

    const handleIndividualLMPClick = () => {
        onViewIndividualLMP(trainee);
        onClose();
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

    const handleAddTodayOnlyUnavailability = () => {
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
        if (isCreating) {
            setUnavailability(prev => [...prev, newPeriod]);
            setShowAddUnavailability(false);
        } else {
            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `Today Only - ${todayStr}`,
                page: 'Trainee Roster'
            });
            const updatedUnavailability = [...(trainee.unavailability || []), newPeriod];
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
            setShowAddUnavailability(false);
        }
    };

    const handleSaveCustomUnavailability = (periodData: Omit<UnavailabilityPeriod, 'id'>) => {
        const newPeriod = {
            ...periodData,
            id: uuidv4(),
            startTime: periodData.allDay ? undefined : periodData.startTime,
            endTime: periodData.allDay ? undefined : periodData.endTime,
        };
        
        if (isCreating) {
            setUnavailability(prev => [...prev, newPeriod]);
        } else {
            const dateRange = periodData.startDate === periodData.endDate 
                ? periodData.startDate 
                : `${periodData.startDate} to ${periodData.endDate}`;
            const timeRange = periodData.allDay ? 'All Day' : `${periodData.startTime} to ${periodData.endTime}`;
            
            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `${dateRange} @ ${timeRange} - ${periodData.reason}`,
                page: 'Trainee Roster'
            });
            const updatedUnavailability = [...(trainee.unavailability || []), newPeriod];
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
        }
    };

    const handleRemoveUnavailabilityFromFlyout = (idToRemove: string) => {
        if (isCreating) {
            setUnavailability(prev => prev.filter(p => p.id !== idToRemove));
        } else {
            const periodToRemove = trainee.unavailability?.find(p => p.id === idToRemove);
            if (periodToRemove) {
                const dateRange = periodToRemove.startDate === periodToRemove.endDate 
                    ? periodToRemove.startDate 
                    : `${periodToRemove.startDate} to ${periodToRemove.endDate}`;
                
                logAudit({
                    action: 'Delete',
                    description: `Removed unavailability for ${trainee.rank} ${trainee.name}`,
                    changes: `${dateRange} - ${periodToRemove.reason}`,
                    page: 'Trainee Roster'
                });
            }
            const updatedUnavailability = (trainee.unavailability || []).filter(p => p.id !== idToRemove);
            onUpdateTrainee({ ...trainee, unavailability: updatedUnavailability });
        }
    };

    const buttonClasses = "w-[75px] h-[60px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md transition-all duration-200";

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                    isAnimatingOpen ? 'opacity-0' : (isClosing ? 'opacity-0' : 'opacity-100')
                }`}
                onClick={onClose}
            ></div>
            
            {/* Bottom Sheet */}
            <div
                className={`fixed top-[80px] bottom-0 left-[95px] right-[95px] bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
                    isAnimatingOpen ? 'translate-y-full' : (isClosing ? 'translate-y-full' : 'translate-y-0')
                }`}
            >
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                    <div className="w-16 h-1.5 bg-gray-600 rounded-full cursor-pointer hover:bg-gray-500 transition-colors" />
                </div>

                <div className="flex-1 flex flex-row overflow-hidden">
                    {/* LEFT: Content Panel */}
                    <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                        {/* Header Section */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-6">
                                <div className="w-24 h-24 bg-gray-800 rounded-lg flex items-center justify-center text-gray-600">
                                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-white">{isEditing ? name : trainee.name}</h1>
                                    <div className="mt-2">
                                        {(isEditing ? isPaused : trainee.isPaused) ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400">
                                                Paused
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-700/50 text-white hover:text-gray-300 transition-all duration-200"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Identity Block */}
                        <div className="grid grid-cols-4 gap-6">
                            {isEditing ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">ID Number</label>
                                        <input
                                            type="text"
                                            value={idNumber}
                                            onChange={e => setIdNumber(parseInt(e.target.value) || 0)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Course</label>
                                        <select
                                            value={course}
                                            onChange={e => handleCourseChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            {activeCourses.length > 0 ? (
                                                activeCourses.map(c => <option key={c} value={c}>{c}</option>)
                                            ) : (
                                                <option disabled>No courses</option>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">LMP</label>
                                        <select
                                            value={lmpType}
                                            onChange={e => handleLmpTypeChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            {COURSE_MASTER_LMPS.map(lmp => <option key={lmp} value={lmp}>{lmp}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Trainee Callsign</label>
                                        <input
                                            type="text"
                                            value={traineeCallsign}
                                            onChange={e => handleTraineeCallsignChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Rank</label>
                                        <select
                                            value={rank}
                                            onChange={e => handleRankChange(e.target.value as TraineeRank)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="OCDT">OCDT</option>
                                            <option value="MIDN">MIDN</option>
                                            <option value="PLTOFF">PLTOFF</option>
                                            <option value="FLGOFF">FLGOFF</option>
                                            <option value="SBLT">SBLT</option>
                                            <option value="2LT">2LT</option>
                                            <option value="FLTLT">FLTLT</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Service</label>
                                        <select
                                            value={service}
                                            onChange={e => setService(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="">Select...</option>
                                            <option value="RAAF">RAAF</option>
                                            <option value="Navy">Navy</option>
                                            <option value="Army">Army</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Unit</label>
                                        <select
                                            value={unit}
                                            onChange={e => handleUnitChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Seat Config</label>
                                        <select
                                            value={seatConfig}
                                            onChange={e => setSeatConfig(e.target.value as SeatConfig)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="Normal">Normal</option>
                                            <option value="FWD/SHORT">FWD/SHORT</option>
                                            <option value="REAR/SHORT">REAR/SHORT</option>
                                            <option value="FWD/LONG">FWD/LONG</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Location</label>
                                        <select
                                            value={location}
                                            onChange={e => handleLocationChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Phone Number</label>
                                        <input
                                            type="text"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Email</label>
                                        <input
                                            type="text"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Flight</label>
                                        <input
                                            type="text"
                                            value={flight}
                                            onChange={e => setFlight(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Secondary Callsign</label>
                                        <input
                                            type="text"
                                            value={secondaryCallsign}
                                            onChange={e => handleSecondaryCallsignChange(e.target.value)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Permissions</label>
                                        <div className="flex flex-wrap gap-3">
                                            {allPermissions.map(perm => (
                                                <label key={perm} className="flex items-center space-x-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={permissions.includes(perm)} 
                                                        onChange={e => handlePermissionChange(perm, e.target.checked)} 
                                                        className="h-4 w-4 accent-sky-500 bg-gray-600 rounded" 
                                                    />
                                                    <span className="text-white text-sm">{perm}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">ID Number</label>
                                        <div className="text-white font-medium">{trainee.idNumber}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Course</label>
                                        <span className={`inline-block px-3 py-1 rounded-md text-white font-semibold text-sm ${courseColors[trainee.course] || 'bg-gray-500'}`}>
                                            {trainee.course}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">LMP</label>
                                        <span className="inline-block px-3 py-1 rounded-md text-sky-400 font-semibold text-sm bg-sky-900/30">
                                            {trainee.lmpType || 'BPC+IPC'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Trainee Callsign</label>
                                        <span className="inline-block px-3 py-1 rounded-md text-green-400 font-semibold text-sm bg-green-900/30">
                                            {trainee.traineeCallsign || 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Rank</label>
                                        <div className="text-white font-medium">{trainee.rank}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Service</label>
                                        <div className="text-white font-medium">{trainee.service || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Unit</label>
                                        <div className="text-white font-medium">{trainee.unit}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Seat Config</label>
                                        <div className="text-white font-medium">{trainee.seatConfig}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Location</label>
                                        <div className="text-white font-medium">{trainee.location}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Phone Number</label>
                                        <div className="text-white font-medium">{trainee.phoneNumber}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Email</label>
                                        <div className="text-white font-medium">{trainee.email}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Flight</label>
                                        <div className="text-white font-medium">{trainee.flight || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Trainee Callsign</label>
                                        <span className="inline-block px-3 py-1 rounded-md text-green-400 font-semibold text-sm bg-green-900/30">
                                            {trainee.traineeCallsign || 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Secondary Callsign</label>
                                        <div className="text-white font-medium">{trainee.secondaryCallsign || '[None]'}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-2">Permissions</label>
                                        <div className="flex flex-wrap gap-2">
                                            {(trainee.permissions && trainee.permissions.length > 0) ? (
                                                trainee.permissions.map(perm => (
                                                    <span key={perm} className="inline-block px-3 py-1 rounded-md bg-gray-800 text-white text-sm">
                                                        {perm}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-500 italic text-sm">No permissions assigned</span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Instructor Section */}
                        {!isCreating && (
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-3">Primary Instructor</label>
                                    <div className="flex items-center space-x-4 bg-gray-800/30 rounded-lg p-4">
                                        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-gray-600">
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="text-white font-medium">{trainee.primaryInstructor || 'Not Assigned'}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-3">Secondary Instructor</label>
                                    <div className="flex items-center space-x-4 bg-gray-800/30 rounded-lg p-4">
                                        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center text-gray-600">
                                            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="text-white font-medium">{trainee.secondaryInstructor || 'Not Assigned'}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Logbook Section */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-300 mb-4">Logbook - Prior Experience (PC-21 only)</h3>
                            <div className="grid grid-cols-5 gap-6">
                                {/* Day Flying */}
                                <div className="bg-gray-800/30 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-gray-400 mb-3 text-center">Day Flying</div>
                                    <div className="space-y-2">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P1</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.day.p1}
                                                        onChange={e => handleExperienceChange('day', 'p1', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P2</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.day.p2}
                                                        onChange={e => handleExperienceChange('day', 'p2', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Dual</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.day.dual}
                                                        onChange={e => handleExperienceChange('day', 'dual', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P1</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.day.p1.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P2</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.day.p2.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Dual</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.day.dual.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-gray-700">
                                                    <span className="text-xs text-gray-400 font-semibold">Total</span>
                                                    <span className="text-white font-mono text-sm font-semibold">
                                                        {(priorExperience.day.p1 + priorExperience.day.p2 + priorExperience.day.dual).toFixed(1)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Night Flying */}
                                <div className="bg-gray-800/30 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-gray-400 mb-3 text-center">Night Flying</div>
                                    <div className="space-y-2">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P1</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.night.p1}
                                                        onChange={e => handleExperienceChange('night', 'p1', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P2</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.night.p2}
                                                        onChange={e => handleExperienceChange('night', 'p2', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Dual</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.night.dual}
                                                        onChange={e => handleExperienceChange('night', 'dual', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P1</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.night.p1.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P2</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.night.p2.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Dual</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.night.dual.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-gray-700">
                                                    <span className="text-xs text-gray-400 font-semibold">Total</span>
                                                    <span className="text-white font-mono text-sm font-semibold">
                                                        {(priorExperience.night.p1 + priorExperience.night.p2 + priorExperience.night.dual).toFixed(1)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="bg-gray-800/30 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-gray-400 mb-3 text-center">Totals</div>
                                    <div className="space-y-2">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">TOTAL</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.total}
                                                        onChange={e => handleExperienceChange('total', null, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Captain</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.captain}
                                                        onChange={e => handleExperienceChange('captain', null, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Instructor</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.instructor}
                                                        onChange={e => handleExperienceChange('instructor', null, parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">TOTAL</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.total.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Captain</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.captain.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Instructor</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.instructor.toFixed(1)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Instrument */}
                                <div className="bg-gray-800/30 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-gray-400 mb-3 text-center">Instrument</div>
                                    <div className="space-y-2">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Sim</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.instrument.sim}
                                                        onChange={e => handleExperienceChange('instrument', 'sim', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Actual</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.instrument.actual}
                                                        onChange={e => handleExperienceChange('instrument', 'actual', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Sim</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.instrument.sim.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Actual</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.instrument.actual.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-gray-700">
                                                    <span className="text-xs text-gray-400 font-semibold">Total</span>
                                                    <span className="text-white font-mono text-sm font-semibold">
                                                        {(priorExperience.instrument.sim + priorExperience.instrument.actual).toFixed(1)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Simulator */}
                                <div className="bg-gray-800/30 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-gray-400 mb-3 text-center">Simulator</div>
                                    <div className="space-y-2">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P1</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.simulator.p1}
                                                        onChange={e => handleExperienceChange('simulator', 'p1', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">P2</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.simulator.p2}
                                                        onChange={e => handleExperienceChange('simulator', 'p2', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Dual</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.simulator.dual}
                                                        onChange={e => handleExperienceChange('simulator', 'dual', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Total</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        value={priorExperience.simulator.total}
                                                        onChange={e => handleExperienceChange('simulator', 'total', parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm text-center"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P1</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.simulator.p1.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">P2</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.simulator.p2.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Dual</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.simulator.dual.toFixed(1)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-gray-500">Total</span>
                                                    <span className="text-white font-mono text-sm">{priorExperience.simulator.total.toFixed(1)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Events Section */}
                        {!isCreating && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-300 mb-4">Events</h3>
                                <div className="grid grid-cols-4 gap-6">
                                    {/* Next Event */}
                                    <div className="bg-gray-800/30 rounded-lg p-4">
                                        <div className="text-sm font-semibold text-gray-400 mb-3">Next Event</div>
                                        {nextEvent ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Event</span>
                                                    <button 
                                                        onClick={() => { onNavigateToSyllabus(nextEvent.id); onClose(); }}
                                                        className="block text-sky-400 font-semibold hover:underline mt-1"
                                                    >
                                                        {nextEvent.id}
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Type</span>
                                                    <div className="text-white font-medium mt-1">{nextEvent.type}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Duration</span>
                                                    <div className="text-white font-medium mt-1">{nextEvent.duration.toFixed(1)} hrs</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm text-center py-4">
                                                {nextEventReason || 'No event found'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Next Event +1 */}
                                    <div className="bg-gray-800/30 rounded-lg p-4">
                                        <div className="text-sm font-semibold text-gray-400 mb-3">Next Event +1</div>
                                        {subsequentEvent ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Event</span>
                                                    <button 
                                                        onClick={() => { onNavigateToSyllabus(subsequentEvent.id); onClose(); }}
                                                        className="block text-sky-400 font-semibold hover:underline mt-1"
                                                    >
                                                        {subsequentEvent.id}
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Type</span>
                                                    <div className="text-white font-medium mt-1">{subsequentEvent.type}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Duration</span>
                                                    <div className="text-white font-medium mt-1">{subsequentEvent.duration.toFixed(1)} hrs</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm text-center py-4">
                                                {!nextEvent ? 'Requires a valid Next Event' : 'End of syllabus'}
                                            </div>
                                        )}
                                    </div>

                                    {/* Last Flight */}
                                    <div className="bg-gray-800/30 rounded-lg p-4">
                                        <div className="text-sm font-semibold text-gray-400 mb-3">Last Flight</div>
                                        {lastFlight && daysSinceLastFlight !== null ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Event</span>
                                                    <div className="text-white font-semibold mt-1">{lastFlight.event}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Date</span>
                                                    <div className="text-white font-medium mt-1">{formatDate(lastFlight.date)}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Days Since</span>
                                                    <div className="text-white font-bold text-lg mt-1">{daysSinceLastFlight}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm text-center py-4">
                                                No event recorded
                                            </div>
                                        )}
                                    </div>

                                    {/* Last Event */}
                                    <div className="bg-gray-800/30 rounded-lg p-4">
                                        <div className="text-sm font-semibold text-gray-400 mb-3">Last Event</div>
                                        {lastEvent && daysSinceLastEvent !== null ? (
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-xs text-gray-500">Event</span>
                                                    <div className="text-white font-semibold mt-1">{lastEvent.event}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Date</span>
                                                    <div className="text-white font-medium mt-1">{formatDate(lastEvent.date)}</div>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-500">Days Since</span>
                                                    <div className="text-white font-bold text-lg mt-1">{daysSinceLastEvent}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm text-center py-4">
                                                No event recorded
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Unavailability Section */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-300 mb-4">Unavailability</h3>
                            <div className="space-y-3">
                                {unavailability.length > 0 ? (
                                    unavailability.map(p => {
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
                                            <div key={p.id} className="bg-gray-800/30 rounded-lg p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-semibold text-white">{p.reason}</div>
                                                        <div className="text-xs text-gray-400 mt-1 font-mono">{displayString}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="bg-gray-800/30 rounded-lg p-6 text-center">
                                        <p className="text-gray-500 italic">No unavailability periods scheduled</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pause Toggle (Edit Mode Only) */}
                        {isEditing && !isCreating && (
                            <div className="bg-gray-800/30 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-gray-300">Pause Trainee (NTSC)</span>
                                    <button 
                                        onClick={handlePauseToggle} 
                                        className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors ${isPaused ? 'bg-amber-500' : 'bg-gray-600'}`}
                                    >
                                        <span className={`transform transition-transform inline-block w-5 h-5 bg-white rounded-full ${isPaused ? 'translate-x-6' : 'translate-x-1'}`}/>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Button Panel */}
                    <div className="w-32 flex-shrink-0 bg-gray-800/50 p-4 flex flex-col space-y-[1px]">
                        {!isEditing && (
                            <>
                                <button onClick={() => setShowAddUnavailability(true)} className="w-[75px] h-[60px] flex items-center justify-center text-[12px] btn-aluminium-brushed rounded-md transition-all duration-200">Unavailable</button>
                                <button onClick={() => { onNavigateToCurrency(trainee); onClose(); }} className={`${buttonClasses} btn-aluminium-brushed`}>Currency</button>
                                <button onClick={handleHateSheetClick} className={`${buttonClasses} btn-aluminium-brushed`}>PT-051</button>
                                <button onClick={handleIndividualLMPClick} className={`${buttonClasses} btn-aluminium-brushed`}>View Individual LMP</button>
                                <button onClick={() => onAddRemedialPackage(trainee)} className={`${buttonClasses} btn-aluminium-brushed`}>Add Remedial Package</button>
                                <button onClick={() => { if (onViewLogbook) { onViewLogbook(trainee); onClose(); } }} className={`${buttonClasses} btn-aluminium-brushed`}>Logbook</button>
                                <button onClick={() => setIsEditing(true)} className={`${buttonClasses} btn-aluminium-brushed`}>Edit</button>
                                <button onClick={onClose} className={`${buttonClasses} btn-aluminium-brushed`}>Close</button>
                            </>
                        )}
                        {isEditing && (
                            <>
                                <button onClick={handleSave} className={`${buttonClasses} btn-aluminium-brushed`}>Save</button>
                                <button onClick={handleCancel} className={`${buttonClasses} btn-aluminium-brushed`}>Cancel</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {showAddUnavailability && (<AddUnavailabilityFlyout onClose={() => setShowAddUnavailability(false)} onTodayOnly={handleAddTodayOnlyUnavailability} onSave={handleSaveCustomUnavailability} unavailabilityPeriods={trainee.unavailability || []} onRemove={handleRemoveUnavailabilityFromFlyout} />)}
            {showScheduleWarning && <ScheduleWarningFlyout traineeName={trainee.name} onAcknowledge={() => {setShowScheduleWarning(false); setShowPauseConfirm(true); }} />}
            {showPauseConfirm && <PauseConfirmationFlyout onConfirm={confirmPause} onCancel={() => setShowPauseConfirm(false)} />}
        </>
    );
};

export default TraineeProfileFlyout;