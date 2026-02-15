
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

const InfoRow: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className = '' }) => (
    <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <div className={`mt-1 text-white p-2 bg-gray-700/50 rounded-md min-h-[38px] flex items-center ${className}`}>
            {value}
        </div>
    </div>
);

const InputField: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean }> = ({ label, value, onChange, readOnly }) => (
     <div>
        <label className="block text-sm font-medium text-gray-400">{label}</label>
        <input
            type="text"
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

// Reused Experience Components
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

const EventDetailCard: React.FC<{
  event: SyllabusItemDetail | null;
  title: string;
  onNavigate: (syllabusId: string) => void;
  onCloseFlyout: () => void;
  reason?: string;
}> = ({ event, title, onNavigate, onCloseFlyout, reason }) => {

  const handleNavigate = () => {
    if (event) {
      onNavigate(event.id);
      onCloseFlyout();
    }
  };

  return (
    <fieldset className="p-3 border border-gray-600 rounded-lg">
      <legend className="px-2 text-sm font-semibold text-gray-300">{title}</legend>
      {event ? (
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Event:</span>
            <button onClick={handleNavigate} className="font-semibold text-sky-400 hover:underline focus:outline-none">
              {event.id}
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white font-medium">{event.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-white font-medium">{event.duration.toFixed(1)} hrs</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-center text-center italic text-gray-500 h-[80px]">
            <div>
                <p>No {title.toLowerCase()} found.</p>
                {reason && <p className="text-xs mt-1">{reason}</p>}
            </div>
        </div>
      )}
    </fieldset>
  );
};

const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00Z`);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const LastEventCard: React.FC<{
  title: string;
  date: string | undefined;
  daysSince: number | null;
  eventCode?: string | null;
}> = ({ title, date, daysSince, eventCode }) => (
    <fieldset className="p-3 border border-gray-600 rounded-lg">
      <legend className="px-2 text-sm font-semibold text-gray-300">{title}</legend>
      {date && daysSince !== null ? (
        <div className="mt-2 space-y-2 text-sm">
          {eventCode && (
              <div className="flex justify-between items-center">
                  <span className="text-gray-400">Event:</span>
                  <span className="font-semibold text-white">{eventCode}</span>
              </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Date:</span>
            <span className="font-semibold text-white">{formatDate(date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Days Since:</span>
            <span className="text-white font-bold text-lg">{daysSince}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-center text-center italic text-gray-500 h-[78px]">
            <p>No event recorded.</p>
        </div>
      )}
    </fieldset>
);

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
  activeCourses = []
}) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const [showAddUnavailability, setShowAddUnavailability] = useState(false);
    const [showPauseConfirm, setShowPauseConfirm] = useState(false);
    const [showScheduleWarning, setShowScheduleWarning] = useState(false);
    
    // Editable state
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
    // Log view on component mount (only if not creating)
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

    // Debounced field change handlers
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
        
        // Flush any pending debounced logs before saving
        flushPendingAudits();
        
        // Log the save action
        if (isCreating) {
            logAudit({
                action: 'Add',
                description: `Added new trainee ${rank} ${name}`,
                changes: `Course: ${course}, Unit: ${unit}, Location: ${location}`,
                page: 'Trainee Roster'
            });
        } else {
            // Detect changes for edit
            const changes: string[] = [];
            if (trainee.name !== name) changes.push(`Name: ${trainee.name} → ${name}`);
            if (trainee.rank !== rank) changes.push(`Rank: ${trainee.rank} → ${rank}`);
            if (trainee.course !== course) changes.push(`Course: ${trainee.course} → ${course}`);
            if (trainee.lmpType !== lmpType) changes.push(`LMP: ${trainee.lmpType || 'BPC+IPC'} → ${lmpType}`);
               if (trainee.traineeCallsign !== traineeCallsign) changes.push(`Trainee Callsign: ${trainee.traineeCallsign || 'N/A'} → ${traineeCallsign}`);
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
        
        // Persist Logbook Data to Storage
        try {
            const cleanName = name.replace(/,\s/g, '_');
            const fileName = `Logbook_${cleanName}_${idNumber}.json`;
            const fileContent = JSON.stringify(priorExperience, null, 2);
            const file = new File([fileContent], fileName, { type: "application/json" });
            // 'trainee_logbook' is the ID for the Trainee Data -> Logbook folder
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
        console.log('handleSaveCustomUnavailability called', { periodData, isCreating, traineeName: trainee.name });
        
        const newPeriod = {
            ...periodData,
            id: uuidv4(),
            startTime: periodData.allDay ? undefined : periodData.startTime,
            endTime: periodData.allDay ? undefined : periodData.endTime,
        };
        
        console.log('Created new period', newPeriod);
        
        if (isCreating) {
            console.log('Adding to creating trainee unavailability');
            setUnavailability(prev => [...prev, newPeriod]);
        } else {
            console.log('Updating existing trainee unavailability');
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
            console.log('Calling onUpdateTrainee with updated unavailability', updatedUnavailability);
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

    const formatMilitaryTime = (timeString: string | undefined): string => {
        if (!timeString) return '';
        return timeString.replace(':', '');
    };

    const buttonClasses = "w-[55px] h-[55px] flex items-center justify-center text-[12px] font-semibold btn-aluminium-brushed rounded-md transition-all duration-200";

    const permissionsWindow = (
        <fieldset className="p-3 border border-gray-600 rounded-lg">
            <legend className="px-2 text-sm font-semibold text-gray-300">Permissions</legend>
            <div className="mt-1 min-h-[10rem] p-2">
                {isEditing ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {allPermissions.map(perm => (
                            <label key={perm} className="flex items-center space-x-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={permissions.includes(perm)} 
                                    onChange={e => handlePermissionChange(perm, e.target.checked)} 
                                    className="h-4 w-4 accent-sky-500 bg-gray-600 rounded" 
                                />
                                <span className="text-white">{perm}</span>
                            </label>
                        ))}
                    </div>
                ) : (
                    <ul className="space-y-2 text-white list-disc list-inside">
                        {(trainee.permissions && trainee.permissions.length > 0) ? (
                            trainee.permissions.map(perm => <li key={perm}>{perm}</li>)
                        ) : (
                            <li className="list-none italic text-gray-500">No permissions assigned.</li>
                        )}
                    </ul>
                )}
            </div>
        </fieldset>
    );

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center animate-fade-in" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 flex-shrink-0">
                        <h2 className="text-xl font-bold text-sky-400">{isCreating ? 'New Trainee' : 'Trainee Profile'}</h2>
                        <button onClick={onClose} className="text-white hover:text-gray-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 flex flex-row overflow-hidden">
                        {/* LEFT: Content Panel */}
                        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {isEditing ? (
                                    <>
                                        <InputField label="Name (Surname, Firstname)" value={name} onChange={e => handleNameChange(e.target.value)} />
                                        <InputField label="ID Number" value={idNumber} onChange={e => setIdNumber(parseInt(e.target.value) || 0)} />
                                        <Dropdown label="Course" value={course} onChange={e => handleCourseChange(e.target.value)}>
                                            {activeCourses.length > 0 ? (
                                                activeCourses.map(c => <option key={c} value={c}>{c}</option>)
                                            ) : (
                                                <option disabled>No courses</option>
                                            )}
                                        </Dropdown>
                                        <Dropdown label="LMP" value={lmpType} onChange={e => handleLmpTypeChange(e.target.value)}>
                                            {COURSE_MASTER_LMPS.map(lmp => <option key={lmp} value={lmp}>{lmp}</option>)}
                                        </Dropdown>
                                           <InputField label="Trainee Callsign" value={traineeCallsign} onChange={e => handleTraineeCallsignChange(e.target.value)} />
                                    </>
                                ) : (
                                    <>
                                        <InfoRow label="Name" value={trainee.name} />
                                        <InfoRow label="ID Number" value={trainee.idNumber} />
                                        <InfoRow label="Course" value={<span className={`px-2 py-1 rounded-md text-white font-semibold ${courseColors[trainee.course] || 'bg-gray-500'}`}>{trainee.course}</span>} />
                                        <InfoRow label="LMP" value={<span className="px-2 py-1 rounded-md text-sky-400 font-semibold bg-sky-900/30">{trainee.lmpType || 'BPC+IPC'}</span>} />
                                        <InfoRow label="Trainee Callsign" value={<span className="px-2 py-1 rounded-md text-green-400 font-semibold bg-green-900/30">{trainee.traineeCallsign || 'N/A'}</span>} />
                                    </>
                                )}
                            </div>

                            {isEditing ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Rank" value={rank} onChange={e => handleRankChange(e.target.value as TraineeRank)}>
                                            <option value="OCDT">OCDT</option><option value="MIDN">MIDN</option><option value="PLTOFF">PLTOFF</option><option value="FLGOFF">FLGOFF</option>
                                            <option value="SBLT">SBLT</option><option value="2LT">2LT</option><option value="FLTLT">FLTLT</option>
                                        </Dropdown>
                                        {!isCreating && <InfoRow label="Callsign" value={`${callsignData?.callsignPrefix || ''}${callsignData?.callsignNumber || ''}`}/>}
                                        <Dropdown label="Service" value={service} onChange={e => setService(e.target.value)}><option value="">Select...</option><option value="Air Force">Air Force</option><option value="Navy">Navy</option><option value="Army">Army</option></Dropdown>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Unit" value={unit} onChange={(e) => handleUnitChange(e.target.value)}>{units.map(u => <option key={u} value={u}>{u}</option>)}</Dropdown>
                                        <InputField label="Flight" value={flight} onChange={e => setFlight(e.target.value)} />
                                        <Dropdown label="Seat Config" value={seatConfig} onChange={e => setSeatConfig(e.target.value as SeatConfig)}><option value="Normal">Normal</option><option value="FWD/SHORT">FWD/SHORT</option><option value="REAR/SHORT">REAR/SHORT</option><option value="FWD/LONG">FWD/LONG</option></Dropdown>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Dropdown label="Location" value={location} onChange={(e) => handleLocationChange(e.target.value)}>{locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}</Dropdown>
                                        <InputField label="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                                        <InputField label="Email" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                    {!isCreating && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <fieldset className="p-3 border border-gray-600 rounded-lg"><legend className="px-2 text-sm font-semibold text-gray-300">Primary Instructor</legend><div className="mt-2"><InfoRow label="Name" value={trainee.primaryInstructor || 'Not Assigned'} /></div></fieldset>
                                            <fieldset className="p-3 border border-gray-600 rounded-lg"><legend className="px-2 text-sm font-semibold text-gray-300">Secondary Instructor</legend><div className="mt-2"><InfoRow label="Name" value={trainee.secondaryInstructor || 'Not Assigned'} /></div></fieldset>
                                        </div>
                                    )}
                                    {permissionsWindow}
                                    {!isCreating && (
                                        <div className="p-3 border border-gray-600 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-gray-300">Pause Trainee (NTSC)</span>
                                                <button onClick={handlePauseToggle} className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors ${isPaused ? 'bg-amber-500' : 'bg-gray-600'}`}><span className={`transform transition-transform inline-block w-5 h-5 bg-white rounded-full ${isPaused ? 'translate-x-6' : 'translate-x-1'}`}/></button>
                                            </div>
                                        </div>
                                    )}
                                     <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-sky-400">Logbook - Prior Experience (PC-21 only)</legend>
                                        <div className="space-y-4 mt-2">
                                            {/* Row 1: Day & Night */}
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
                                            {/* Row 2: Totals & Instrument */}
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
                                            {/* Row 3: Simulator */}
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
                                    </fieldset>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><InfoRow label="Rank" value={rank} /><InfoRow label="Trainee Callsign" value={<span className="px-2 py-1 rounded-md text-green-400 font-semibold bg-green-900/30">{trainee.traineeCallsign || 'N/A'}</span>} /><InfoRow label="Service" value={service || 'N/A'} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><InfoRow label="Unit" value={unit} /><InfoRow label="Flight" value={flight || 'N/A'} /><InfoRow label="Seat Config" value={seatConfig} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><InfoRow label="Location" value={location} /><InfoRow label="Phone Number" value={phoneNumber} /><InfoRow label="Email" value={email} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><fieldset className="p-3 border border-gray-600 rounded-lg"><legend className="px-2 text-sm font-semibold text-gray-300">Primary Instructor</legend><div className="mt-2"><InfoRow label="Name" value={trainee.primaryInstructor || 'Not Assigned'} /></div></fieldset><fieldset className="p-3 border border-gray-600 rounded-lg"><legend className="px-2 text-sm font-semibold text-gray-300">Secondary Instructor</legend><div className="mt-2"><InfoRow label="Name" value={trainee.secondaryInstructor || 'Not Assigned'} /></div></fieldset></div>
                                    <InfoRow label="Status" value={trainee.isPaused ? <span className="font-semibold text-amber-400">Paused / NTSC</span> : <span className="font-semibold text-green-400">Active</span>} />
                                    {permissionsWindow}
                                     <fieldset className="p-3 border border-gray-600 rounded-lg">
                                        <legend className="px-2 text-sm font-semibold text-sky-400">Logbook - Prior Experience (PC-21 only)</legend>
                                        <div className="space-y-4 mt-2">
                                            {/* Row 1: Day & Night */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-700 pb-4">
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-400 mb-2 text-center">Day Flying</span>
                                                    <div className="flex justify-center space-x-2">
                                                        <ExperienceDisplay label="P1" value={priorExperience.day.p1} />
                                                        <ExperienceDisplay label="P2" value={priorExperience.day.p2} />
                                                        <ExperienceDisplay label="Dual" value={priorExperience.day.dual} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-400 mb-2 text-center">Night Flying</span>
                                                    <div className="flex justify-center space-x-2">
                                                        <ExperienceDisplay label="P1" value={priorExperience.night.p1} />
                                                        <ExperienceDisplay label="P2" value={priorExperience.night.p2} />
                                                        <ExperienceDisplay label="Dual" value={priorExperience.night.dual} />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Row 2: Totals & Instrument */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-gray-700 pb-4">
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-400 mb-2 text-center">Totals</span>
                                                    <div className="flex justify-center space-x-2">
                                                        <ExperienceDisplay label="TOTAL" value={priorExperience.total} />
                                                        <ExperienceDisplay label="Captain" value={priorExperience.captain} />
                                                        <ExperienceDisplay label="Instructor" value={priorExperience.instructor} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-400 mb-2 text-center">Instrument</span>
                                                    <div className="flex justify-center space-x-2">
                                                        <ExperienceDisplay label="Sim" value={priorExperience.instrument.sim} />
                                                        <ExperienceDisplay label="Actual" value={priorExperience.instrument.actual} />
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Row 3: Simulator */}
                                            <div>
                                                <span className="block text-sm font-bold text-gray-400 mb-2 text-center">Simulator</span>
                                                <div className="flex justify-center space-x-4">
                                                    <ExperienceDisplay label="P1" value={priorExperience.simulator.p1} />
                                                    <ExperienceDisplay label="P2" value={priorExperience.simulator.p2} />
                                                    <ExperienceDisplay label="Dual" value={priorExperience.simulator.dual} />
                                                    <ExperienceDisplay label="Total" value={priorExperience.simulator.total} />
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>
                                </>
                            )}
                            {!isCreating && (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><EventDetailCard event={nextEvent} title="Next Event" onNavigate={onNavigateToSyllabus} onCloseFlyout={onClose} reason={nextEventReason} /><EventDetailCard event={subsequentEvent} title="Next Event +1" onNavigate={onNavigateToSyllabus} onCloseFlyout={onClose} reason={!nextEvent ? 'Requires a valid Next Event.' : 'End of syllabus.'} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <LastEventCard title="Last Flight" date={lastFlight?.date} daysSince={daysSinceLastFlight} eventCode={lastFlight?.event} />
                                        <LastEventCard title="Last Event" date={lastEvent?.date} daysSince={daysSinceLastEvent} eventCode={lastEvent?.event} />
                                    </div>
                                </>
                            )}
                            <fieldset className="p-3 border border-gray-600 rounded-lg">
                                <legend className="px-2 text-sm font-semibold text-gray-300">Unavailability</legend>
                                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto pr-2">
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
                                                <div key={p.id} className="p-2 bg-gray-700/50 rounded-md text-sm">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <span className="font-semibold text-white">{p.reason}</span>
                                                            <div className="text-xs text-gray-300 mt-1 font-mono">{displayString}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-500 text-center italic">No unavailability periods scheduled.</p>
                                    )}
                                </div>
                            </fieldset>
                        </div>

                        {/* RIGHT: Button Panel */}
                        <div className="w-56 flex-shrink-0 border-l border-gray-700 bg-gray-800/50 p-4 flex flex-col space-y-[1px]">
                             {!isEditing && (
                                <>
                                    <button onClick={() => setShowAddUnavailability(true)} className={`${buttonClasses} btn-orange-brushed`}>Unavailability</button>
                                    <button onClick={() => { onNavigateToCurrency(trainee); onClose(); }} className={`${buttonClasses} btn-aluminium-brushed`}>Currency</button>
                                    <button onClick={handleHateSheetClick} className={`${buttonClasses} btn-aluminium-brushed`}>PT-051</button>
                                    <button onClick={handleIndividualLMPClick} className={`${buttonClasses} btn-aluminium-brushed`}>View Individual LMP</button>
                                    <button onClick={() => onAddRemedialPackage(trainee)} className={`${buttonClasses} btn-aluminium-brushed`}>Add Remedial Package</button>
                                    <button onClick={() => { if (onViewLogbook) { onViewLogbook(trainee); onClose(); } }} className={`${buttonClasses} btn-aluminium-brushed`}>Logbook</button>
                                </>
                            )}
                            <div className="flex-grow"></div> {/* Spacer */}
                            {isEditing ? (
                                <>
                                    <button onClick={handleSave} className={`${buttonClasses} btn-aluminium-brushed`}>Save</button>
                                    <button onClick={handleCancel} className={`${buttonClasses} btn-aluminium-brushed`}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setIsEditing(true)} className={`${buttonClasses} btn-aluminium-brushed`}>Edit</button>
                                    <button onClick={onClose} className={`${buttonClasses} bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white`}>Close</button>
                                </>
                            )}
                        </div>
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
