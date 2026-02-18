import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Trainee, TraineeRank, SeatConfig, UnavailabilityPeriod, ScheduleEvent, Score, SyllabusItemDetail, UnavailabilityReason, Instructor, LogbookExperience } from '../types';
import AddUnavailabilityFlyout from './AddUnavailabilityFlyout';
import PauseConfirmationFlyout from './PauseConfirmationFlyout';
import ScheduleWarningFlyout from './ScheduleWarningFlyout';
import CircularGauge from './CircularGauge';
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
    const [showUnavailabilityFlyout, setShowUnavailabilityFlyout] = useState(false);
    const [showPauseConfirmation, setShowPauseConfirmation] = useState(false);
    const [showScheduleWarning, setShowScheduleWarning] = useState(false);
    const [isAnimatingOpen, setIsAnimatingOpen] = useState(isOpening);

    // Form state
    const [name, setName] = useState(trainee.name);
    const [idNumber, setIdNumber] = useState(trainee.idNumber);
    const [rank, setRank] = useState(trainee.rank);
    const [service, setService] = useState(trainee.service || '');
    const [course, setCourse] = useState(trainee.course || activeCourses[0] || '');
    const [lmpType, setLmpType] = useState(trainee.lmpType || 'BPC+IPC');
    const [traineeCallsign, setTraineeCallsign] = useState(trainee.traineeCallsign || '');
    const [secondaryCallsign, setSecondaryCallsign] = useState(trainee.secondaryCallsign || '');
    const [seatConfig, setSeatConfig] = useState(trainee.seatConfig);
    const [isPaused, setIsPaused] = useState(trainee.isPaused);
    const [unavailability, setUnavailability] = useState<UnavailabilityPeriod[]>(trainee.unavailability || []);
    const [location, setLocation] = useState(trainee.location || locations[0] || '');
    const [unit, setUnit] = useState(trainee.unit || units[0] || '');
    const [flight, setFlight] = useState(trainee.flight || '');
    const [phoneNumber, setPhoneNumber] = useState(trainee.phoneNumber || '');
    const [email, setEmail] = useState(trainee.email || '');
    const [permissions, setPermissions] = useState<string[]>(trainee.permissions || []);
    const [priorExperience, setPriorExperience] = useState<LogbookExperience>(trainee.priorExperience || initialExperience);

    const permissionOptions = useMemo(() => ['Trainee', 'Staff', 'Ops', 'Course Supervisor', 'Admin', 'Super Admin'], []);

    // Calculate last flight and event
    const { lastFlight, lastEvent, daysSinceLastFlight, daysSinceLastEvent } = useMemo(() => {
        const traineeScores = scores.get(trainee.fullName) || [];
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const calculateDaysSince = (dateStr: string | undefined): number | null => {
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

        const sortedScores = [...traineeScores].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const lastEventScore = sortedScores[0] || null;
        const lastFlightScore = sortedScores.find(score => {
            const syllabusItem = syllabusDetails.find(item => item.id === score.event);
            return syllabusItem?.type === 'Flight';
        }) || null;

        return {
            lastFlight: lastFlightScore,
            lastEvent: lastEventScore,
            daysSinceLastFlight: calculateDaysSince(lastFlightScore?.date),
            daysSinceLastEvent: calculateDaysSince(lastEventScore?.date)
        };
    }, [trainee.fullName, scores, syllabusDetails]);

    // Calculate next events
    const { nextEvent, subsequentEvent, nextEventReason } = useMemo(() => {
        if (isCreating) return { nextEvent: null, subsequentEvent: null, nextEventReason: 'New Trainee' };

        const traineeScores = scores.get(trainee.fullName) || [];
        const completedEvents = new Set(traineeScores.map(score => score.event));

        let nextEventItem: SyllabusItemDetail | null = null;
        let subsequentEventItem: SyllabusItemDetail | null = null;
        let reason = '';
        let nextEventIndex = -1;

        for (let i = 0; i < individualLmp.length; i++) {
            const item = individualLmp[i];
            if (completedEvents.has(item.id) || item.code.includes(' MB')) continue;

            const prerequisitesMet = item.prerequisites.every(prereq => completedEvents.has(prereq));
            if (prerequisitesMet) {
                nextEventItem = item;
                nextEventIndex = i;
                break;
            }
        }

        if (nextEventIndex !== -1) {
            for (let i = nextEventIndex + 1; i < individualLmp.length; i++) {
                const item = individualLmp[i];
                if (!item.code.includes(' MB')) {
                    subsequentEventItem = item;
                    break;
                }
            }
        }

        if (!nextEventItem) {
            const allNonRemedialEvents = individualLmp.filter(item => !item.isRemedial && !item.code.includes(' MB'));
            if (allNonRemedialEvents.every(item => completedEvents.has(item.id))) {
                reason = 'Syllabus complete.';
            } else {
                reason = 'Prerequisites incomplete.';
            }
        }

        return { nextEvent: nextEventItem, subsequentEvent: subsequentEventItem, nextEventReason: reason };
    }, [trainee.fullName, scores, individualLmp, isCreating]);

    // Reset form when trainee changes
    const resetForm = () => {
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
        resetForm();
        setIsEditing(isCreating);
    }, [trainee, isCreating]);

    useEffect(() => {
        console.log('🎯 NEW TRAINEE PROFILE LOADED - Full Width with Circular Gauges');
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

    const hasScheduledEvents = useMemo(() => 
        events.some(event => event.student === trainee.fullName || event.pilot === trainee.fullName),
        [events, trainee.fullName]
    );

    const handlePauseClick = () => {
        if (!isPaused && hasScheduledEvents) {
            setShowScheduleWarning(true);
        } else {
            setShowPauseConfirmation(true);
        }
    };

    const handlePauseConfirm = () => {
        const updatedTrainee = { ...trainee, isPaused: !trainee.isPaused };
        onUpdateTrainee(updatedTrainee);
        setShowPauseConfirmation(false);
    };

    const handleSave = async () => {
        if (!name || !course) {
            alert('Name and Course are required.');
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
            const filename = `Logbook_${name.replace(/,\s/g, '_')}_${idNumber}.json`;
            const content = JSON.stringify(priorExperience, null, 2);
            const file = new File([content], filename, { type: 'application/json' });
            await addFile(file, 'trainee_logbook', filename);
        } catch (error) {
            console.error('Failed to save logbook data to storage:', error);
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
            resetForm();
            setIsEditing(false);
        }
    };

    const handlePermissionToggle = (permission: string, checked: boolean) => {
        setPermissions(prev => checked ? [...prev, permission] : prev.filter(p => p !== permission));
    };

    const handleNavigateToHateSheet = () => {
        onNavigateToHateSheet(trainee);
        onClose();
    };

    const handleViewIndividualLMP = () => {
        onViewIndividualLMP(trainee);
        onClose();
    };

    const updateExperience = (category: keyof LogbookExperience, field: string | null, value: number) => {
        setPriorExperience(prev => {
            if (field) {
                return {
                    ...prev,
                    [category]: {
                        ...(prev[category] as any),
                        [field]: value
                    }
                };
            } else {
                return {
                    ...prev,
                    [category]: value
                };
            }
        });
    };

    const handleAddTodayUnavailability = () => {
        const today = new Date().toISOString().split('T')[0];
        const newPeriod: UnavailabilityPeriod = {
            id: uuidv4(),
            startDate: today,
            endDate: today,
            allDay: false,
            startTime: '0001',
            endTime: '2359',
            reason: 'Other',
            notes: 'Today Only'
        };

        if (isCreating) {
            setUnavailability(prev => [...prev, newPeriod]);
            setShowUnavailabilityFlyout(false);
        } else {
            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `Today Only - ${today}`,
                page: 'Trainee Roster'
            });
            const updated = [...trainee.unavailability || [], newPeriod];
            onUpdateTrainee({ ...trainee, unavailability: updated });
            setShowUnavailabilityFlyout(false);
        }
    };

    const handleAddCustomUnavailability = (period: Omit<UnavailabilityPeriod, 'id'>) => {
        const newPeriod: UnavailabilityPeriod = {
            ...period,
            id: uuidv4(),
            startTime: period.allDay ? undefined : period.startTime,
            endTime: period.allDay ? undefined : period.endTime
        };

        if (isCreating) {
            setUnavailability(prev => [...prev, newPeriod]);
        } else {
            const dateRange = period.startDate === period.endDate 
                ? period.startDate 
                : `${period.startDate} to ${period.endDate}`;
            const timeRange = period.allDay ? 'All Day' : `${period.startTime} to ${period.endTime}`;
            
            logAudit({
                action: 'Add',
                description: `Added unavailability for ${trainee.rank} ${trainee.name}`,
                changes: `${dateRange} @ ${timeRange} - ${period.reason}`,
                page: 'Trainee Roster'
            });
            const updated = [...trainee.unavailability || [], newPeriod];
            onUpdateTrainee({ ...trainee, unavailability: updated });
        }
    };

    const handleRemoveUnavailability = (id: string) => {
        if (isCreating) {
            setUnavailability(prev => prev.filter(p => p.id !== id));
        } else {
            const period = trainee.unavailability?.find(p => p.id === id);
            if (period) {
                const dateRange = period.startDate === period.endDate 
                    ? period.startDate 
                    : `${period.startDate} to ${period.endDate}`;
                
                logAudit({
                    action: 'Delete',
                    description: `Removed unavailability for ${trainee.rank} ${trainee.name}`,
                    changes: `${dateRange} - ${period.reason}`,
                    page: 'Trainee Roster'
                });
            }
            const updated = (trainee.unavailability || []).filter(p => p.id !== id);
            onUpdateTrainee({ ...trainee, unavailability: updated });
        }
    };

    // Calculate logbook totals
    const dayTotal = priorExperience.day.p1 + priorExperience.day.p2 + priorExperience.day.dual;
    const nightTotal = priorExperience.night.p1 + priorExperience.night.p2 + priorExperience.night.dual;
    const instrumentTotal = priorExperience.instrument.sim + priorExperience.instrument.actual;
    const simulatorTotal = priorExperience.simulator.p1 + priorExperience.simulator.p2 + priorExperience.simulator.dual;

    return (
        <>
            {/* Full Screen Overlay */}
            <div 
                className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
                    isAnimatingOpen || isClosing ? 'opacity-0' : 'opacity-100'
                }`}
                onClick={onClose}
            />
            
            {/* Main Profile Panel - Full Width */}
            <div
                className={`fixed inset-0 bg-[#1e2433] z-50 transform transition-transform duration-300 ease-out flex flex-col ${
                    isAnimatingOpen || isClosing ? 'translate-y-full' : 'translate-y-0'
                }`}
            >
                {/* Header with Title and Close Button */}
                <div className="flex items-center justify-between px-8 py-4 bg-[#252d3d] border-b border-gray-700">
                    <h1 className="text-2xl font-bold text-white">Trainee Profile</h1>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-700/50 text-gray-400 hover:text-white transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="flex gap-6">
                        {/* LEFT COLUMN: Profile Info */}
                        <div className="flex-1 space-y-6">
                            {/* Profile Card */}
                            <div className="bg-[#2a3441] rounded-lg p-6">
                                <div className="flex items-start gap-6 mb-6">
                                    {/* Profile Photo */}
                                    <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                    </div>

                                    {/* Name and Status */}
                                    <div className="flex-1">
                                        <h2 className="text-3xl font-bold text-white mb-2">
                                            {isEditing ? name : trainee.name}
                                        </h2>
                                        <div>
                                            {(isEditing ? isPaused : trainee.isPaused) ? (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/50">
                                                    Paused
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/50">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Identity Grid */}
                                <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">ID Number</label>
                                        <div className="text-white text-sm">{trainee.idNumber}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Course</label>
                                        <div className="text-white text-sm">{trainee.course}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">LMP</label>
                                        <div className="text-white text-sm">{trainee.lmpType || 'BPC+IPC'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Callsign</label>
                                        <div className="text-white text-sm">{trainee.traineeCallsign || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Secondary Callsign</label>
                                        <div className="text-white text-sm">{trainee.secondaryCallsign || '[None]'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Rank</label>
                                        <div className="text-white text-sm">{trainee.rank}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Service</label>
                                        <div className="text-white text-sm">{trainee.service || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Unit</label>
                                        <div className="text-white text-sm">{trainee.unit}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Flight</label>
                                        <div className="text-white text-sm">{trainee.flight || 'D'}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Seat Config</label>
                                        <div className="text-white text-sm">{trainee.seatConfig}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Location</label>
                                        <div className="text-white text-sm">{trainee.location}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
                                        <div className="text-white text-sm">{trainee.phoneNumber}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs text-gray-400 mb-1">Email</label>
                                        <div className="text-white text-sm">{trainee.email}</div>
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-xs text-gray-400 mb-1">Permissions</label>
                                        <div className="text-white text-sm">
                                            {trainee.permissions && trainee.permissions.length > 0 ? (
                                                <span>• {trainee.permissions.join(' • ')}</span>
                                            ) : (
                                                <span className="text-gray-500 italic">No permissions assigned</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Instructors Section */}
                            {!isCreating && (
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <label className="block text-sm text-gray-400 mb-3">Primary Instructor</label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="text-white text-sm font-medium">
                                                {trainee.primaryInstructor || 'Not Assigned'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <label className="block text-sm text-gray-400 mb-3">Secondary Instructor</label>
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="text-white text-sm font-medium">
                                                {trainee.secondaryInstructor || 'Not Assigned'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Logbook Section with Circular Gauges */}
                            <div className="bg-[#252d3d] rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-white mb-6">Logbook - Prior Experience (PC-21 only)</h3>
                                <div className="grid grid-cols-5 gap-6">
                                    {/* Day Flying Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center">Day Flying</h4>
                                        <div className="flex justify-center mb-4">
                                            <CircularGauge value={dayTotal} maxValue={100} size={80} />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono">{priorExperience.day.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono">{priorExperience.day.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono">{priorExperience.day.dual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Night Flying Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center">Night Flying</h4>
                                        <div className="flex justify-center mb-4">
                                            <CircularGauge value={nightTotal} maxValue={100} size={80} />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono">{priorExperience.night.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono">{priorExperience.night.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono">{priorExperience.night.dual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Totals Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center">Totals</h4>
                                        <div className="flex justify-center mb-4">
                                            <CircularGauge value={priorExperience.total} maxValue={500} size={80} />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-400">
                                                <span>TOTAL</span>
                                                <span className="text-white font-mono">{priorExperience.total.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Captain</span>
                                                <span className="text-white font-mono">{priorExperience.captain.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Instructor</span>
                                                <span className="text-white font-mono">{priorExperience.instructor.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Instrument Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center">Instrument</h4>
                                        <div className="flex justify-center mb-4">
                                            <CircularGauge value={instrumentTotal} maxValue={100} size={80} />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-400">
                                                <span>Sim</span>
                                                <span className="text-white font-mono">{priorExperience.instrument.sim.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Actual</span>
                                                <span className="text-white font-mono">{priorExperience.instrument.actual.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Simulator Gauge */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center">Simulator</h4>
                                        <div className="flex justify-center mb-4">
                                            <CircularGauge value={simulatorTotal} maxValue={100} size={80} />
                                        </div>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-400">
                                                <span>P1</span>
                                                <span className="text-white font-mono">{priorExperience.simulator.p1.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>P2</span>
                                                <span className="text-white font-mono">{priorExperience.simulator.p2.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Dual</span>
                                                <span className="text-white font-mono">{priorExperience.simulator.dual.toFixed(1)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 pt-1 border-t border-gray-600">
                                                <span>Total</span>
                                                <span className="text-white font-mono">{priorExperience.simulator.total.toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Events Section */}
                            {!isCreating && (
                                <div className="grid grid-cols-4 gap-4">
                                    {/* Next Event */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Next Event</h4>
                                        {nextEvent ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => { onNavigateToSyllabus(nextEvent.id); onClose(); }}
                                                    className="text-sky-400 font-bold text-lg hover:underline"
                                                >
                                                    {nextEvent.id}
                                                </button>
                                                <div className="text-white text-sm">{nextEvent.type}</div>
                                                <div className="text-gray-400 text-sm">{nextEvent.duration.toFixed(1)} hrs</div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm">{nextEventReason || 'No event found'}</div>
                                        )}
                                    </div>

                                    {/* Next Event +1 */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Next Event +1</h4>
                                        {subsequentEvent ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => { onNavigateToSyllabus(subsequentEvent.id); onClose(); }}
                                                    className="text-sky-400 font-bold text-lg hover:underline"
                                                >
                                                    {subsequentEvent.id}
                                                </button>
                                                <div className="text-white text-sm">{subsequentEvent.type}</div>
                                                <div className="text-gray-400 text-sm">{subsequentEvent.duration.toFixed(1)} hrs</div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm">No subsequent event</div>
                                        )}
                                    </div>

                                    {/* Last Flight */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Last Flight</h4>
                                        {lastFlight ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => { onNavigateToSyllabus(lastFlight.event); onClose(); }}
                                                    className="text-sky-400 font-bold text-lg hover:underline"
                                                >
                                                    {lastFlight.event}
                                                </button>
                                                <div className="text-white text-sm">{formatDate(lastFlight.date)}</div>
                                                <div className="text-gray-400 text-sm">{daysSinceLastFlight} days since</div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm">No flights recorded</div>
                                        )}
                                    </div>

                                    {/* Last Event */}
                                    <div className="bg-[#2a3441] rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-gray-400 mb-3">Last Event</h4>
                                        {lastEvent ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => { onNavigateToSyllabus(lastEvent.event); onClose(); }}
                                                    className="text-sky-400 font-bold text-lg hover:underline"
                                                >
                                                    {lastEvent.event}
                                                </button>
                                                <div className="text-white text-sm">{formatDate(lastEvent.date)}</div>
                                                <div className="text-gray-400 text-sm">{daysSinceLastEvent} days since</div>
                                            </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm">No events recorded</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Unavailability Section */}
                            <div className="bg-[#252d3d] rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Unavailability</h3>
                                {(isEditing ? unavailability : trainee.unavailability || []).length > 0 ? (
                                    <div className="space-y-2">
                                        {(isEditing ? unavailability : trainee.unavailability || [])
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
                                                    <div key={period.id} className="flex items-center justify-between p-3 bg-[#2a3441] rounded-lg">
                                                        <div>
                                                            <div className="text-white font-medium">{period.reason}</div>
                                                            <div className="text-gray-400 text-xs font-mono mt-1">{displayText}</div>
                                                        </div>
                                                        {isEditing && (
                                                            <button
                                                                onClick={() => handleRemoveUnavailability(period.id)}
                                                                className="text-gray-400 hover:text-red-400 transition-colors"
                                                            >
                                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic text-center py-4">
                                        No unavailability periods scheduled.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Action Buttons */}
                        <div className="w-48 space-y-2 flex-shrink-0">
                            <button
                                onClick={() => setShowUnavailabilityFlyout(true)}
                                className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                            >
                                Unavailable
                            </button>
                            <button
                                onClick={() => { onNavigateToCurrency(trainee); onClose(); }}
                                className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                            >
                                Currency
                            </button>
                            <div className="bg-[#2a3441] rounded-lg p-2 text-center">
                                <div className="text-gray-400 text-xs">PT-051</div>
                            </div>
                            <button
                                onClick={handleViewIndividualLMP}
                                className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                            >
                                View Individual LMP
                            </button>
                            <button
                                onClick={() => { onAddRemedialPackage(trainee); onClose(); }}
                                className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                            >
                                Add Remedial Package
                            </button>
                            <button
                                onClick={() => { if (onViewLogbook) onViewLogbook(trainee); onClose(); }}
                                className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                            >
                                Logbook
                            </button>

                            {/* Bottom Buttons */}
                            <div className="pt-4 space-y-2">
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                                >
                                    {isEditing ? 'Cancel' : 'Edit'}
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full h-12 flex items-center justify-center text-sm font-semibold btn-aluminium-brushed rounded-md transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flyouts */}
            {showUnavailabilityFlyout && (
                <AddUnavailabilityFlyout
                    onClose={() => setShowUnavailabilityFlyout(false)}
                    onAddTodayOnly={handleAddTodayUnavailability}
                    onAddCustom={handleAddCustomUnavailability}
                    onRemove={handleRemoveUnavailability}
                    unavailabilityPeriods={isEditing ? unavailability : trainee.unavailability || []}
                />
            )}
            {showPauseConfirmation && (
                <PauseConfirmationFlyout
                    onConfirm={handlePauseConfirm}
                    onCancel={() => setShowPauseConfirmation(false)}
                />
            )}
            {showScheduleWarning && (
                <ScheduleWarningFlyout
                    traineeName={trainee.name}
                    onAcknowledge={() => setShowScheduleWarning(false)}
                />
            )}
        </>
    );
};

export default TraineeProfileFlyout;