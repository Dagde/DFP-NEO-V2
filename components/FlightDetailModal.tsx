
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScheduleEvent, SyllabusItemDetail, Trainee, Instructor, OracleTraineeAnalysis, SctRequest, FormationCallsign, CancellationCode } from '../types';
import { v4 as uuidv4 } from 'uuid';
import CancelEventFlyout from './CancelEventFlyout';
import MassBriefCompleteFlyout, { MassBriefConfirmationFlyout } from './MassBriefCompleteFlyout';
import { VisualAdjustModal } from './VisualAdjustModal';

interface EventDetailModalProps {
  event: ScheduleEvent;
  onClose: () => void;
  onSave: (events: ScheduleEvent[]) => void;
  onDeleteRequest: () => void;
  isEditingDefault?: boolean;
  instructors: string[];
  trainees: string[];
  syllabus: string[];
  syllabusDetails: SyllabusItemDetail[];
  highlightedField?: 'startTime' | 'instructor' | 'student' | null;
  onScoresCreated?: (scores: any[]) => void; // New callback for creating scores
  school: 'ESL' | 'PEA';
  traineesData: Trainee[];
  instructorsData: Instructor[];
  courseColors: { [key: string]: string };
  onNavigateToHateSheet: (trainee: Trainee) => void;
  onNavigateToSyllabus: (flightNumber: string) => void;
  onOpenPt051: (trainee: Trainee) => void;
  onOpenAuth: (event: ScheduleEvent) => void;
  onOpenPostFlight: (event: ScheduleEvent) => void;
  isConflict: boolean;
  onNeoClick: (event: ScheduleEvent) => void;
  traineeLMPs?: Map<string, SyllabusItemDetail[]>;
  oracleContextForModal?: {
      availableInstructors: string[];
      availableTraineesAnalysis: OracleTraineeAnalysis[];
  } | null;
  sctRequests?: SctRequest[];
  sctEvents?: string[];
     eventsForDate?: ScheduleEvent[];
  // New props for deployment functionality
  publishedSchedules?: Record<string, ScheduleEvent[]>;
  nextDayBuildEvents?: ScheduleEvent[];
  activeView?: string;
  isAddingTile?: boolean;
    formationCallsigns?: FormationCallsign[];
    currentLocation?: string;
    onVisualAdjustStart?: (event: ScheduleEvent) => void;
    onVisualAdjustEnd?: (event: ScheduleEvent) => void;
    onSavePT051Assessment?: (assessment: any) => void;
    cancellationCodes?: CancellationCode[];
    onCancelEvent?: (eventId: string, cancellationCode: string, manualCodeEntry?: string) => void;
}

interface CrewMember {
    flightType: 'Dual' | 'Solo';
    instructor: string;
    student: string;
    pilot: string;
    group: string;
    groupTraineeIds: number[]; // Added to track selected IDs
}

const getEventTypeFromSyllabus = (syllabusId: string, syllabusDetails: SyllabusItemDetail[]): 'flight' | 'ftd' | 'ground' => {
    const detail = syllabusDetails.find(d => d.id === syllabusId);
    if (!detail) { // Fallback for items not in syllabus like 'SCT FORM' or if data is missing
        if (syllabusId.includes('FTD')) return 'ftd';
        if (syllabusId.includes('CPT') || syllabusId.includes('MB') || syllabusId.includes('TUT') || syllabusId.includes('QUIZ')) return 'ground';
        return 'flight';
    }
    if (detail.type === 'FTD') return 'ftd';
    if (detail.type === 'Ground School') return 'ground';
    return 'flight';
};


const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.round((time % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const convertTimeToDecimal = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours + (minutes / 60);
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose, onSave, onDeleteRequest, isEditingDefault = false, instructors, trainees, syllabus, syllabusDetails, highlightedField, school, traineesData, instructorsData, courseColors, onNavigateToHateSheet, onNavigateToSyllabus, onOpenPt051, onOpenAuth, onOpenPostFlight, isConflict, onNeoClick, traineeLMPs, oracleContextForModal, sctRequests = [], sctEvents = [], eventsForDate = [], onScoresCreated, publishedSchedules = {}, nextDayBuildEvents = [], activeView = '', isAddingTile = false, formationCallsigns = [], currentLocation = '', onVisualAdjustStart, onVisualAdjustEnd, onSavePT051Assessment, cancellationCodes = [], onCancelEvent }) => {
    
    console.log('EventDetailModal opened - isAddingTile:', isAddingTile);
    console.log('Event data:', {
        eventCategory: event.eventCategory,
        flightType: event.flightType,
        instructor: event.instructor,
        student: event.student,
        pilot: event.pilot,
        isSct: event.isSct
    });

    const [isEditing, setIsEditing] = useState(isEditingDefault);
    const [localHighlight, setLocalHighlight] = useState(highlightedField);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showMassBriefComplete, setShowMassBriefComplete] = useState(false);
    const [showMassBriefConfirmation, setShowMassBriefConfirmation] = useState(false);
    const [completedTrainees, setCompletedTrainees] = useState<Trainee[]>([]);

    // Event Category State (New)
    const [eventCategory, setEventCategory] = useState<'lmp_event' | 'lmp_currency' | 'sct' | 'staff_cat' | 'twr_di'>(event.eventCategory || 'lmp_event');

    const [flightNumber, setFlightNumber] = useState(event.flightNumber);
    const [duration, setDuration] = useState<number | ''>(event.duration);
    const [eventType, setEventType] = useState(event.type);
    const [startTime, setStartTime] = useState(typeof event.startTime === 'string' ? event.startTime : formatTime(event.startTime));
    const [area, setArea] = useState(event.area || 'A');
    const [aircraftNumber, setAircraftNumber] = useState(event.aircraftNumber || '001');
    const [aircraftCount, setAircraftCount] = useState(1);
    const [isVisualAdjustMode, setIsVisualAdjustMode] = useState(false);
    const [visualAdjustStartTime, setVisualAdjustStartTime] = useState(event.startTime);
    const [visualAdjustEndTime, setVisualAdjustEndTime] = useState(event.startTime + event.duration);
    
    // Sync visual adjust times when event changes (from parent drag updates)
    useEffect(() => {
        if (isVisualAdjustMode) {
            setVisualAdjustStartTime(event.startTime);
            setVisualAdjustEndTime(event.startTime + event.duration);
        }
    }, [event.startTime, event.duration, isVisualAdjustMode]);
    const [crew, setCrew] = useState<CrewMember[]>([{
        flightType: event.flightType,
        instructor: event.instructor || '',
        student: event.student || '',
        pilot: event.pilot || '',
        group: event.group || '',
        groupTraineeIds: event.groupTraineeIds || [],
    }]);
    
    console.log('Initial crew state:', crew);

    // Helper function to get Dual/Solo status from Individual LMP
    // Helper function to get Dual/Solo status from Individual LMP
    const getDualSoloFromIndividualLMP = (flightNumber: string, traineeName: string): 'Dual' | 'Solo' => {
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Called with flightNumber: ${flightNumber}, traineeName: ${traineeName}`);
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] traineeLMPs available: ${!!traineeLMPs}, traineeLMPs size: ${traineeLMPs?.size || 0}`);
        
        if (!traineeLMPs || !traineeName) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - missing traineeLMPs or traineeName`);
            return 'Dual'; // Default to Dual if no data available
        }

        const individualLMP = traineeLMPs.get(traineeName);
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] individualLMP found for ${traineeName}:`, !!individualLMP, individualLMP ? individualLMP.length : 0, 'items');
        
        if (!individualLMP) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - no Individual LMP found for ${traineeName}`);
            return 'Dual'; // Default to Dual if no Individual LMP found
        }

        const syllabusItem = individualLMP.find(item => 
            item.id === flightNumber || item.code === flightNumber
        );
        
        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Searching for flightNumber: ${flightNumber}, found item:`, !!syllabusItem);
        if (syllabusItem) {
            console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Found syllabus item:`, {
                id: syllabusItem.id,
                code: syllabusItem.code,
                sortieType: syllabusItem.sortieType
            });
        }

        if (syllabusItem && syllabusItem.sortieType) {
            console.log(`ud83cudfaf [Dual/Solo] Found ${syllabusItem.sortieType} for ${traineeName} - ${flightNumber}`);
            return syllabusItem.sortieType;
        }

        console.log(`ud83dudcdd [getDualSoloFromIndividualLMP] Returning 'Dual' - no sortieType found for ${flightNumber}`);
        return 'Dual'; // Default to Dual if not specified
    };

    // Apply Solo logic (trainee as PIC, clear crew) when flightType changes to Solo
    const applySoloLogic = () => {
        // Check the first crew member's flightType
        if (crew[0]?.flightType === 'Solo') {
            // For Solo events, set trainee as PIC
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            if (traineeName) {
                // Update the first crew member: set trainee as pilot and clear instructor
                setCrew(prevCrew => {
                    const newCrew = [...prevCrew];
                    if (newCrew.length > 0) {
                        newCrew[0] = { 
                            ...newCrew[0], 
                            pilot: traineeName, 
                            instructor: '' // Clear instructor for solo flights
                        };
                    }
                    return newCrew;
                });
                console.log(`✈️ [Solo Logic] Applied: ${traineeName} as PIC, flightType set to Solo`);
            }
        }
    };

    const [locationType, setLocationType] = useState(event.locationType || 'Local');
    const [origin, setOrigin] = useState(event.origin || school);
    const [destination, setDestination] = useState(event.destination || school);
    const [formationType, setFormationType] = useState(event.formationType || '');
    const [isDeploy, setIsDeploy] = useState(event.isDeploy || false);
    
    // Deployment Selection State
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string>('');
    
    // Deployment Period State (Explicit)
    const [deploymentStartDate, setDeploymentStartDate] = useState(event.deploymentStartDate || event.date);
    const [deploymentStartTime, setDeploymentStartTime] = useState(event.deploymentStartTime || '');
    const [deploymentEndDate, setDeploymentEndDate] = useState(event.deploymentEndDate || event.date);
    const [deploymentEndTime, setDeploymentEndTime] = useState(event.deploymentEndTime || '');
    const [deploymentAircraftCount, setDeploymentAircraftCount] = useState(event.deploymentAircraftCount || 1);
    
    // Group Selection State
    const [activeGroupInput, setActiveGroupInput] = useState<number | null>(null);
    const groupInputRef = useRef<HTMLDivElement>(null);
    
    // Oracle state
    const [syllabusSelectionError, setSyllabusSelectionError] = useState(false);
    const isOracleContext = !!oracleContextForModal;
    const instructorList = oracleContextForModal?.availableInstructors || instructors;
    const traineeList = oracleContextForModal ? oracleContextForModal.availableTraineesAnalysis.map(t => t.trainee.fullName) : trainees;
    const [dynamicSyllabusOptions, setDynamicSyllabusOptions] = useState<string[]>(isOracleContext ? [] : syllabus);

    // Filtered syllabus options based on event category
    const filteredSyllabusOptions = useMemo(() => {
        let options: string[] = [];
        
        if (eventCategory === 'sct') {
            options = sctEvents;
        } else if (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency') {
            // Filter for Master LMP events only
            options = syllabusDetails
                .filter(item => item.lmpType === 'Master LMP' || !item.lmpType) // Include items without lmpType for backward compatibility
                .map(item => item.id);
        } else if (eventCategory === 'staff_cat') {
            // Filter for Staff CAT LMP events only
            options = syllabusDetails
                .filter(item => item.lmpType === 'Staff CAT')
                .map(item => item.id);
        } else if (eventCategory === 'twr_di') {
            // TWR DI can use any syllabus items (no filtering)
            options = syllabusDetails.map(item => item.id);
        } else {
            options = dynamicSyllabusOptions;
        }
        
        // Always ensure SCT FORM is available when adding a tile
        if (isAddingTile && !options.includes('SCT FORM')) {
            options = [...options, 'SCT FORM'];
        }
        
        
        
        return options;
    }, [eventCategory, sctEvents, syllabusDetails, dynamicSyllabusOptions, isAddingTile]);

    // Get staff-only instructors (exclude trainees) grouped by unit
    const staffInstructorsByUnit = useMemo(() => {
        const traineeNames = new Set(traineesData.map(t => t.fullName));
        
        // Filter out trainees to get staff only
        const staffOnly = instructorList.filter(name => !traineeNames.has(name));
        
        // Get instructor details to access unit and rank
        const staffWithDetails = staffOnly.map(name => {
            const instructor = instructorsData.find(i => i.name === name);
            return {
                name,
                unit: instructor?.unit || 'Unknown',
                rank: instructor?.rank || 'FLGOFF'
            };
        });
        
        // Group by unit
        const grouped = staffWithDetails.reduce((acc, instructor) => {
            if (!acc[instructor.unit]) {
                acc[instructor.unit] = [];
            }
            acc[instructor.unit].push(instructor);
            return acc;
        }, {} as Record<string, typeof staffWithDetails>);
        
        // Sort units by rank hierarchy
        const rankOrder = ['WGCDR', 'SQNLDR', 'FLTLT', 'FLGOFF', 'PLTOFF'];
        const sortedUnits = Object.keys(grouped).sort((a, b) => {
            const aHighestRank = Math.min(...grouped[a].map(i => rankOrder.indexOf(i.rank)));
            const bHighestRank = Math.min(...grouped[b].map(i => rankOrder.indexOf(i.rank)));
            return aHighestRank - bHighestRank;
        });
        
        return { grouped, sortedUnits };
    }, [instructorList, traineesData, instructorsData]);

    // Group trainees by course for dropdown
    const traineesByCourse = useMemo(() => {
        // Get trainee details with course information
        const traineesWithCourse = traineeList.map(name => {
            const trainee = traineesData.find(t => t.name === name || t.fullName === name);
            return {
                name,
                course: trainee?.course || 'Unknown'
            };
        });
        
        // Group by course
        const grouped = traineesWithCourse.reduce((acc, trainee) => {
            if (!acc[trainee.course]) {
                acc[trainee.course] = [];
            }
            acc[trainee.course].push(trainee);
            return acc;
        }, {} as Record<string, typeof traineesWithCourse>);
        
        // Sort courses alphabetically
        const sortedCourses = Object.keys(grouped).sort();
        
        return { grouped, sortedCourses };
    }, [traineeList, traineesData]);

    // Calculate event statistics for each person
    interface PersonStats {
        name: string;
        rank: string;
        flightCount: number;
        ftdCount: number;
        cptCount: number;
        groundCount: number;
        startTime: string; // HHMM format
    }

    const personStats = useMemo(() => {
        const stats: Record<string, PersonStats> = {};
        
        // Initialize stats for all instructors and trainees
        [...instructorList, ...traineeList].forEach(name => {
            const instructor = instructorsData.find(i => i.name === name);
            const trainee = traineesData.find(t => t.name === name || t.fullName === name);
            
            stats[name] = {
                name,
                rank: instructor?.rank || trainee?.rank || '',
                flightCount: 0,
                ftdCount: 0,
                cptCount: 0,
                groundCount: 0,
                startTime: ''
            };
        });
        
        // Calculate statistics from events
        eventsForDate.forEach(evt => {
            // Skip STBY and deployment events
            if (evt.resourceId?.startsWith('STBY') || evt.resourceId?.startsWith('BNF-STBY') || evt.type === 'deployment') {
                return;
            }
            
            const people = new Set<string>();
            
            // Add instructor
            if (evt.instructor) people.add(evt.instructor);
            
            // Add student/trainee
            if (evt.student) people.add(evt.student);
            
            // Add group trainees
            if (evt.groupTraineeIds && evt.groupTraineeIds.length > 0) {
                evt.groupTraineeIds.forEach(id => {
                    const trainee = traineesData.find(t => t.idNumber === id);
                    if (trainee) people.add(trainee.name);
                });
            }
            
            // Update counts for each person involved
            people.forEach(person => {
                if (stats[person]) {
                    // Count by event type
                    if (evt.type === 'flight') stats[person].flightCount++;
                    else if (evt.type === 'ftd') stats[person].ftdCount++;
                    else if (evt.type === 'cpt') stats[person].cptCount++;
                    else if (evt.type === 'ground') stats[person].groundCount++;
                    
                    // Calculate start time (event start - pre-flight time)
                    const syllabusItem = syllabusDetails.find(s => s.id === evt.flightNumber);
                    const preFlightHours = syllabusItem?.preFlightTime || 0;
                    const eventStartTime = evt.startTime - preFlightHours;
                    
                    // Update earliest start time
                    if (!stats[person].startTime || eventStartTime < parseFloat(stats[person].startTime.replace(':', '.'))) {
                        const hours = Math.floor(eventStartTime);
                        const minutes = Math.round((eventStartTime % 1) * 60);
                        stats[person].startTime = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
                    }
                }
            });
        });
        
        return stats;
    }, [eventsForDate, instructorList, traineeList, instructorsData, traineesData, syllabusDetails]);

// Helper to render staff instructor dropdown with unit grouping and statistics
    const renderStaffInstructorDropdown = (value: string, onChange: (value: string) => void, label: string = 'Instructor', disabled: boolean = false, includePax: boolean = false) => {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-400">{label}</label>
                <select 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed appearance-none cursor-pointer z-10 "
                >
                    <option value="" disabled>Select {label.toLowerCase()}</option>
                    {staffInstructorsByUnit.sortedUnits.map(unit => (
                        <optgroup key={unit} label={`─── ${unit} ───`}>
                            {staffInstructorsByUnit.grouped[unit].map(instructor => {
                                const stats = personStats[instructor.name] || { rank: '' };
                                   const displayText = `${stats.rank} ${instructor.name}`;
                                return (
                                    <option key={instructor.name} value={instructor.name}>
                                        {displayText}
                                    </option>
                                );
                            })}
                        </optgroup>
                    ))}
                    {includePax && (
                        <optgroup label="─── Other ───">
                            <option value="PAX">PAX</option>
                        </optgroup>
                    )}
                </select>
            </div>
        );
    };
// Helper to render trainee dropdown with course grouping and statistics
    const renderTraineeDropdown = (value: string, onChange: (value: string) => void, disabled: boolean = false, highlight: boolean = false) => {
        return (
            <div>
                <label className="block text-sm font-medium text-gray-400">Trainee</label>
                <select 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    disabled={disabled}
                    className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200 disabled:bg-gray-700/50 disabled:cursor-not-allowed ${highlight ? 'ring-2 ring-red-500' : ''}`}
                    
                >
                    <option value="" disabled>Select a trainee</option>
                    {traineesByCourse.sortedCourses.map(course => (
                        <optgroup key={course} label={`─── ${course} ───`}>
                            {traineesByCourse.grouped[course].map(trainee => {
                                   // Get trainee details to access just the name without course
                                   const traineeData = traineesData.find(t => t.name === trainee.name || t.fullName === trainee.name);
                                   const stats = personStats[trainee.name] || { rank: '' };
                                   const displayText = `${stats.rank} ${traineeData?.name || trainee.name}`;
                                return (
                                    <option key={trainee.name} value={trainee.name}>
                                        {displayText}
                                    </option>
                                );
                            })}
                        </optgroup>
                    ))}
                </select>
            </div>
        );
    };    const formatDecimalHourToString = (decimalHour: number): string => {
        const hours = Math.floor(decimalHour);
        const minutes = Math.round((decimalHour % 1) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    // Auto-set Dual/Solo from Individual LMP when adding new events
    useEffect(() => {
        if (isAddingTile && flightNumber && crew[0]) {
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            if (traineeName && traineeLMPs) {
                const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                // Only update if the flightType is different to avoid infinite loop
                if (crew[0].flightType !== individualLMPFlightType) {
                    setCrew(prevCrew => {
                        const newCrew = [...prevCrew];
                        if (newCrew.length > 0) {
                            newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                        }
                        return newCrew;
                    });
                    console.log(`🎯 [Auto Dual/Solo] Set to ${individualLMPFlightType} from Individual LMP for ${traineeName}`);
                }
            }
        }
    }, [isAddingTile, flightNumber, traineeLMPs]);

    // Auto-set Dual/Solo from Individual LMP when creating new events (not just tiles)
    useEffect(() => {
        if (crew[0]?.flightType === 'Solo') {
            const traineeName = crew[0]?.student || crew[0]?.pilot;
            // Only apply if pilot is not already set correctly
            if (traineeName && crew[0].pilot !== traineeName) {
                applySoloLogic();
            }
        }
    }, [crew[0]?.flightType, crew[0]?.student, crew[0]?.pilot]);

    // Effect to set default values based on event category
    useEffect(() => {
        if (eventCategory === 'sct') {
            // SCT defaults to Solo
            setCrew(prev => prev.map(c => ({ ...c, flightType: 'Solo' })));
            // Set default duration to 1.2
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency') {
            // Set default duration to 1.2 for LMP events
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'staff_cat') {
            // Set default duration to 1.2 for Staff CAT
            if (!duration) setDuration(1.2);
        } else if (eventCategory === 'twr_di') {
            // TWR DI defaults to Solo
            setCrew(prev => prev.map(c => ({ ...c, flightType: 'Solo' })));
            // Set default duration to 1.2 for TWR DI
            if (!duration) setDuration(1.2);
            // Set default start time to 0800 only for new events
            if (isAddingTile || !event.startTime || event.startTime === 0) {
                setStartTime('08:00');
            }
        }
    }, [eventCategory]);

    // Effect to pull Type (Dual/Solo) from syllabus when flight number changes
    useEffect(() => {
        if (flightNumber && (eventCategory === 'lmp_event' || eventCategory === 'lmp_currency' || eventCategory === 'staff_cat' || eventCategory === 'twr_di')) {
            const syllabusItem = syllabusDetails.find(item => item.id === flightNumber);
            if (syllabusItem && syllabusItem.flightType) {
                setCrew(prev => prev.map(c => ({ ...c, flightType: syllabusItem.flightType as 'Dual' | 'Solo' })));
            }
        }
    }, [flightNumber, eventCategory, syllabusDetails]);

    // Effect to set Dual/Solo from Individual LMP when flight number changes (before pilot selection)
    useEffect(() => {
        if (isAddingTile || (isEditingDefault && (!event.id || event.id.startsWith('2d1b6a22')))) {
            // This is a new event or tile (check for generated IDs that start with our prefix)
            console.log(`\ud83d\udcdd [Flight Number Change] isAddingTile: ${isAddingTile}, isEditingDefault: ${isEditingDefault}, event.id: ${event.id}, flightNumber: ${flightNumber}`);
            
            if (flightNumber && crew[0] && traineeLMPs) {
                const traineeName = crew[0]?.student || crew[0]?.pilot;
                
                if (traineeName) {
                    // If pilot is selected, use their Individual LMP
                    console.log(`\ud83d\udcdd [Flight Number Change] Using selected trainee: ${traineeName}`);
                    const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                    
                    if (crew[0].flightType !== individualLMPFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Auto Dual/Solo] Set to ${individualLMPFlightType} from Individual LMP for selected trainee ${traineeName}`);
                    }
                } else {
                    // No pilot selected yet - find first trainee with this LMP and use their Individual LMP as default
                    console.log(`\ud83d\udcdd [Flight Number Change] No pilot selected - searching for default from any trainee with LMP ${flightNumber}`);
                    
                    let defaultFlightType: 'Dual' | 'Solo' = 'Dual'; // Default to Dual if nothing found
                    let foundTrainee = '';
                    
                    // Search through all trainees to find someone who has this LMP in their Individual LMP
                    for (const [traineeName, individualLMP] of traineeLMPs.entries()) {
                        const syllabusItem = individualLMP.find(item => 
                            item.id === flightNumber || item.code === flightNumber
                        );
                        
                        if (syllabusItem && syllabusItem.sortieType) {
                            defaultFlightType = syllabusItem.sortieType;
                            foundTrainee = traineeName;
                            console.log(`\ud83d\udcdd [Flight Number Change] Found default ${defaultFlightType} from ${foundTrainee}'s Individual LMP`);
                            break; // Use the first one found
                        }
                    }
                    
                    if (crew[0].flightType !== defaultFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: defaultFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Auto Dual/Solo] Set to ${defaultFlightType} as default from ${foundTrainee || 'system'} for LMP ${flightNumber}`);
                    }
                }
            }
        }
    }, [flightNumber, traineeLMPs, isAddingTile, isEditingDefault, event.id]);

    // Effect to update Dual/Solo from Individual LMP when trainee changes (after initial flight number selection)
    useEffect(() => {
        if (isAddingTile || (isEditingDefault && (!event.id || event.id.startsWith('2d1b6a22')))) {
            if (flightNumber && crew[0] && traineeLMPs) {
                const traineeName = crew[0]?.student || crew[0]?.pilot;
                
                if (traineeName) {
                    // Update when specific trainee is selected (may override the default)
                    const individualLMPFlightType = getDualSoloFromIndividualLMP(flightNumber, traineeName);
                    
                    if (crew[0].flightType !== individualLMPFlightType) {
                        setCrew(prevCrew => {
                            const newCrew = [...prevCrew];
                            if (newCrew.length > 0) {
                                newCrew[0] = { ...newCrew[0], flightType: individualLMPFlightType };
                            }
                            return newCrew;
                        });
                        console.log(`\ud83c\udfaf [Trainee Change] Updated to ${individualLMPFlightType} from Individual LMP for selected trainee ${traineeName}`);
                    }
                }
            }
        }
    }, [crew[0]?.student, crew[0]?.pilot, flightNumber, traineeLMPs, isAddingTile, isEditingDefault, event.id]);

    // Filter formation callsigns by current location
    const filteredCallsigns = useMemo(() => {
        if (formationCallsigns && formationCallsigns.length > 0 && currentLocation) {
            const filtered = formationCallsigns.filter(cs => cs.location === currentLocation);
            return filtered.length > 0 ? filtered : null;
        }
        return null;
    }, [formationCallsigns, currentLocation]);

    // Backwards compatible formationTypes (just codes)
    const formationTypes = useMemo(() => {
        if (filteredCallsigns) {
            return filteredCallsigns.map(cs => cs.code);
        }
        return school === 'ESL' ? ['MERL', 'VANG'] : ['COBR', 'HAWK'];
    }, [filteredCallsigns, school]);
    const areas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    const courses = useMemo(() => Object.keys(courseColors).sort(), [courseColors]);
    
    // Group trainees data by course for the flyout
    const coursesStruct = useMemo(() => {
        return courses.map(courseName => ({
            name: courseName,
            trainees: traineesData.filter(t => t.course === courseName).sort((a,b) => a.name.localeCompare(b.name))
        }));
    }, [courses, traineesData]);

    const modalTitle = useMemo(() => {
        if (eventType === 'flight') return 'Flight Details';
        if (eventType === 'ftd') return 'FTD Session Details';
        return 'Ground Event Details';
    }, [eventType]);

    useEffect(() => {
        setFlightNumber(event.flightNumber);
        
        // Initialize duration as empty if creating a new event (and no pre-filled flight number), otherwise use event's duration
        if (isEditingDefault && !event.flightNumber) {
            setDuration('');
        } else {
            setDuration(event.duration);
        }

        setEventType(event.type);
        setStartTime(typeof event.startTime === 'string' ? event.startTime : formatTime(event.startTime));
        setArea(event.area || 'A');
        setAircraftNumber(event.aircraftNumber || '001');
        setAircraftCount(1);
        setCrew([{ 
            flightType: event.flightType, 
            instructor: event.instructor || '', 
            student: event.student || '', 
            pilot: event.pilot || '',
            group: event.group || '',
            groupTraineeIds: event.groupTraineeIds || []
        }]);
        setIsEditing(isEditingDefault);
        setLocalHighlight(highlightedField);
        setLocationType(event.locationType || 'Local');
        setOrigin(event.origin || school);
        setDestination(event.destination || school);
        setFormationType(event.formationType || formationTypes[0]);
        setIsDeploy(event.isDeploy || false);
        
        setDeploymentStartDate(event.deploymentStartDate || event.date);
        setDeploymentStartTime(event.deploymentStartTime || '');
        // Default end date/time logic handled in effect below or initialized here if event exists
        setDeploymentEndDate(event.deploymentEndDate || event.date); 
        setDeploymentEndTime(event.deploymentEndTime || '');

    }, [event, isEditingDefault, highlightedField, school]);
    
    useEffect(() => {
        if (locationType === 'Local') {
            setOrigin(school);
            setDestination(school);
        }
    }, [locationType, school]);

    useEffect(() => {
        const isFormation = flightNumber === 'SCT FORM';
        const newSize = isFormation ? aircraftCount : 1;
        if (crew.length !== newSize) {
             const newCrew = Array.from({ length: newSize }, (_, i) => {
                // For SCT FORM with SCT category, default to Solo
                const defaultFlightType = (isFormation && eventCategory === 'sct') ? 'Solo' : 'Dual';
                return crew[i] || { flightType: defaultFlightType as 'Dual' | 'Solo', instructor: '', student: '', pilot: '', group: '', groupTraineeIds: [] };
            });
            setCrew(newCrew);
        }
    }, [aircraftCount, flightNumber, crew, eventCategory]);

    useEffect(() => {
      setEventType(getEventTypeFromSyllabus(flightNumber, syllabusDetails));
    }, [flightNumber, syllabusDetails]);

    // Helper function to get current deployments
    const getCurrentDeployments = (): ScheduleEvent[] => {
        const deployments: ScheduleEvent[] = [];
        
        // Get deployments from published schedules for Program Schedule view
        if (['Program Schedule', 'DailyFlyingProgram', 'InstructorSchedule', 'TraineeSchedule'].includes(activeView)) {
            Object.values(publishedSchedules).forEach(scheduleEvents => {
                const todayDeployments = scheduleEvents.filter(e => e.type === 'deployment');
                deployments.push(...todayDeployments);
            });
        } 
        // Get deployments from next day build for Next Day Build view
        else if (['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView)) {
            const buildDeployments = nextDayBuildEvents.filter(e => e.type === 'deployment');
            deployments.push(...buildDeployments);
        }
        
        // Filter deployments to show only those that could accommodate this event type
        const compatibleDeployments = deployments.filter(deployment => {
            if (eventType === 'flight') {
                return deployment.resourceId?.startsWith('PC-21') || deployment.resourceId?.startsWith('Deployed');
            } else if (eventType === 'ftd') {
                return deployment.resourceId?.startsWith('FTD');
            } else if (eventType === 'cpt') {
                return deployment.resourceId?.startsWith('CPT');
            }
            return false;
        });
        
        return compatibleDeployments;
    };

    // Helper function to format deployment title
    const formatDeploymentTitle = (deployment: ScheduleEvent): string => {
        const formatTime = (time: number): string => {
            const hours = Math.floor(time);
            const minutes = Math.round((time - hours) * 60);
            return `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
        };
        
        // Get start date and format it
        const startDate = deployment.date || '';
        const endDate = deployment.deploymentEndDate || startDate;
        
        // Format dates as DDMMMYY (e.g., 12May25)
        const formatDate = (dateStr: string): string => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const day = date.getDate().toString().padStart(2, '0');
            const month = date.toLocaleDateString('en-US', { month: 'short' });
            const year = date.getFullYear().toString().slice(-2);
            return `${day}${month}${year}`;
        };
        
        const startTime = formatTime(deployment.startTime || 0);
        const endTime = formatTime((deployment.startTime || 0) + (deployment.duration || 0));
        
        return `${startTime}${formatDate(startDate)}–${endTime}${formatDate(endDate)}`;
    };

    
    
    


    // Oracle Logic for SCT and Trainee next event
    useEffect(() => {
        const selectedTrainee = crew[0]?.student;
        const selectedInstructor = crew[0]?.instructor;

        // Trainee selection always takes priority
        if (selectedTrainee) {
            if (isOracleContext && oracleContextForModal?.availableTraineesAnalysis) {
                const analysis = oracleContextForModal.availableTraineesAnalysis.find(t => t.trainee.fullName === selectedTrainee);
                if (analysis && analysis.nextSyllabusEvent) {
                    const nextEventId = analysis.nextSyllabusEvent.id;
                    setDynamicSyllabusOptions([nextEventId]);
                    setFlightNumber(nextEventId);
                    setDuration(analysis.nextSyllabusEvent.duration);
                    return;
                }
            }
            // Fallback for non-oracle or if analysis fails. Just show all syllabus items.
            setDynamicSyllabusOptions(syllabus);
            return;
        }

        // No trainee selected, check for instructor (only in Oracle context)
        if (isOracleContext && selectedInstructor) {
            const instructorScts = sctRequests.filter(req => req.name === selectedInstructor);
            if (instructorScts.length > 0) {
                const sctOptions = instructorScts.map(req => req.event);
                setDynamicSyllabusOptions(sctOptions);
                setFlightNumber(sctOptions[0]); // Auto-select the first one
                const detail = syllabusDetails.find(d => d.id === sctOptions[0]);
                if (detail) {
                    setDuration(detail.duration);
                }
            } else {
                // Instructor selected, but no SCT requests. So, no options.
                setDynamicSyllabusOptions([]);
                setFlightNumber('');
            }
            return;
        }
        
        // Fallback for all other cases (e.g., non-oracle, or oracle with no selections)
        setDynamicSyllabusOptions(isOracleContext ? [] : syllabus);
        if (!event.flightNumber && isOracleContext) {
            setFlightNumber('');
        }

    }, [crew, isOracleContext, oracleContextForModal, sctRequests, syllabus, syllabusDetails, event.flightNumber]);

    // Close group flyout when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (groupInputRef.current && !groupInputRef.current.contains(e.target as Node)) {
                setActiveGroupInput(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside as any);
        return () => document.removeEventListener("mousedown", handleClickOutside as any);
    }, []);
    
    const personnel = useMemo(() => [...instructors, ...trainees].sort(), [instructors, trainees]);
    
    const handleCrewChange = (index: number, field: keyof CrewMember, value: any) => {
        const newCrew = [...crew];
        const memberToUpdate = { ...newCrew[index] };

        if (field === 'flightType') {
            const flightTypeValue = value as 'Dual' | 'Solo';
            memberToUpdate.flightType = flightTypeValue;

            if (flightTypeValue === 'Solo') {
                memberToUpdate.instructor = '';
                memberToUpdate.student = '';
                memberToUpdate.group = '';
                memberToUpdate.groupTraineeIds = [];
            } else {
                memberToUpdate.pilot = '';
            }
        } else {
            // @ts-ignore - dynamic assignment
            memberToUpdate[field] = value;
        }

        newCrew[index] = memberToUpdate;
        setCrew(newCrew);
        setLocalHighlight(null);
    };
    
    const handleToggleTrainee = (index: number, traineeId: number) => {
        const member = crew[index];
        const currentIds = new Set(member.groupTraineeIds || []);
        
        if (currentIds.has(traineeId)) {
            currentIds.delete(traineeId);
        } else {
            currentIds.add(traineeId);
        }
        
        const newIds = Array.from(currentIds);
        
        // Update display string based on count
        const displayString = newIds.length > 0 
            ? `${newIds.length} Trainees Selected` 
            : '';

        const newCrew = [...crew];
        newCrew[index] = { ...member, groupTraineeIds: newIds, group: displayString };
        setCrew(newCrew);
    };

    const handleToggleCourse = (index: number, courseTrainees: Trainee[]) => {
        const member = crew[index];
        const currentIds = new Set(member.groupTraineeIds || []);
        const courseIds = courseTrainees.map(t => t.idNumber);
        
        const allSelected = courseIds.every(id => currentIds.has(id));
        
        if (allSelected) {
            courseIds.forEach(id => currentIds.delete(id));
        } else {
            courseIds.forEach(id => currentIds.add(id));
        }
        
        const newIds = Array.from(currentIds);
        const displayString = newIds.length > 0 
            ? `${newIds.length} Trainees Selected` 
            : '';

        const newCrew = [...crew];
        newCrew[index] = { ...member, groupTraineeIds: newIds, group: displayString };
        setCrew(newCrew);
    };

    const handleFlightNumberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newFlightNumber = e.target.value;
        const oldFlightNumber = flightNumber;
        setFlightNumber(newFlightNumber);

        const detail = syllabusDetails.find(d => d.id === newFlightNumber);
        if (detail) {
            setDuration(detail.duration);
        }

        console.log('Flight number changed to:', newFlightNumber);
        if (newFlightNumber === 'SCT FORM' && !formationType) {
            setFormationType(formationTypes[0]);
        }
        
           
           if (newFlightNumber === 'SCT FORM' && eventCategory === 'sct') {
               // Set defaults for SCT FORM
               setAircraftCount(2);
               // Update crew to Solo
               setCrew(crew.map(member => ({
                   ...member,
                   flightType: 'Solo'
               })));
           } else if (newFlightNumber !== 'SCT FORM') {
               setAircraftCount(1);
           }
    };
    const handleAircraftCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCount = parseInt(e.target.value);
        setAircraftCount(newCount);
        // When changing aircraft count for SCT FORM, ensure all existing crew are Solo
        if (flightNumber === 'SCT FORM' && eventCategory === 'sct') {
            setTimeout(() => {
                setCrew(prevCrew => prevCrew.map(member => ({
                    ...member,
                    flightType: 'Solo' as 'Dual' | 'Solo'
                })));
            }, 100);
        }
    };

    // Helper function to convert time string (HH:MM) to decimal hours
    const parseTimeStringToHours = (timeString: string): number => {
        if (!timeString) return 0;
        
        // Handle both formats: "HH:MM" and "HHMM"
        if (timeString.includes(':')) {
            const [hours, minutes] = timeString.split(':').map(Number);
            return (hours || 0) + ((minutes || 0) / 60);
        } else {
            // Handle 4-digit format without colon (e.g., "0800", "1330")
            const hours = parseInt(timeString.substring(0, 2)) || 0;
            const minutes = parseInt(timeString.substring(2, 4)) || 0;
            return hours + (minutes / 60);
        }
    };

    const handleVisualAdjust = () => {
        console.log("Visual Adjust clicked");
        // Call parent callback FIRST before changing local state
        if (onVisualAdjustStart) {
            onVisualAdjustStart(event);
        }
        // Then set local state
        setIsVisualAdjustMode(true);
    };

    const handleVisualAdjustContinue = () => {
        setIsVisualAdjustMode(false);
        const updatedEvent = {
            ...event,
            startTime: visualAdjustStartTime,
            duration: visualAdjustEndTime - visualAdjustStartTime
        };
        if (onVisualAdjustEnd) {
            onVisualAdjustEnd(updatedEvent);
        }
        setStartTime(formatTime(visualAdjustStartTime));
        setDuration(visualAdjustEndTime - visualAdjustStartTime);
    };
    const handleSave = () => {
        const eventsToSave: ScheduleEvent[] = crew.map((c, index) => {
            let eventColor = event.color;
            
            const traineeName = c.student || c.pilot;
            if (traineeName) {
                const traineeDetails = traineesData.find(t => t.fullName === traineeName);
                if (traineeDetails && courseColors[traineeDetails.course]) {
                    eventColor = courseColors[traineeDetails.course];
                }
            }
            
            // Handle deployment assignment
            let resourceId = event.resourceId;
            if (selectedDeploymentId) {
                // Find the selected deployment and assign its resourceId
                const selectedDeployment = getCurrentDeployments().find(d => d.id === selectedDeploymentId);
                if (selectedDeployment) {
                    resourceId = selectedDeployment.resourceId;
                    console.log(`Assigning event to deployment: ${selectedDeployment.id} (${resourceId})`);
                }
            }
            
            // For SCT FORM events with multiple aircraft, generate unique IDs for each event
            const eventId = (flightNumber === 'SCT FORM' && crew.length > 1) 
                ? `${event.id}-${index}-${Date.now()}` 
                : event.id;
            
            // For SCT FORM events with multiple aircraft, clear resourceId so findAvailableResourceId assigns them to different lines
            if (flightNumber === 'SCT FORM' && crew.length > 1) {
                resourceId = '';
            }
            
            const savedEvent = {
                ...event,
                id: eventId,
                type: eventType,
                flightNumber,
                startTime: typeof startTime === 'string' ? convertTimeToDecimal(startTime) : startTime,
                resourceId,
                duration: typeof duration === 'number' ? duration : 0, // Ensure duration is a number
                area: eventType === 'flight' ? area : undefined,
                aircraftNumber: eventType === 'flight' ? aircraftNumber : undefined,
                color: eventColor,
                flightType: c.flightType,
                instructor: c.instructor,
                student: c.student,
                pilot: c.pilot,
                group: c.group,
                groupTraineeIds: c.groupTraineeIds,
                locationType,
                origin: locationType === 'Local' ? school : origin,
                destination: locationType === 'Local' ? school : destination,
                formationType: flightNumber === 'SCT FORM' ? formationType : undefined,
                formationPosition: flightNumber === 'SCT FORM' ? index + 1 : undefined,
                callsign: flightNumber === 'SCT FORM' ? `${formationType}${index + 1}` : undefined,
                formationId: undefined,
                isDeploy: eventType === 'flight' && locationType === 'Land Away' ? isDeploy : undefined,
                
                // Explicit Deployment Period
                deploymentStartDate: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentStartDate : undefined,
                deploymentStartTime: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentStartTime : undefined,
                deploymentEndDate: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentEndDate : undefined,
                deploymentEndTime: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentEndTime : undefined,
                deploymentAircraftCount: (eventType === 'flight' && locationType === 'Land Away' && isDeploy) ? deploymentAircraftCount : undefined,
                
                // Save event category for LMP Currency handling
                eventCategory: eventCategory,
            };
            
            // Debug logging for SCT events
            if (eventCategory === 'sct') {
                console.log('💾 Saving SCT event:', {
                    id: savedEvent.id,
                    flightType: savedEvent.flightType,
                    pilot: savedEvent.pilot,
                    student: savedEvent.student,
                    instructor: savedEvent.instructor,
                    eventCategory: savedEvent.eventCategory,
                    crewData: c,
                    allCrew: crew
                });
            }
            
            return savedEvent;
        });
        
        // Create Deployment Tile if deployment period is populated and isDeploy is true
        console.log('Deployment Check:', {
            eventType,
            locationType,
            isDeploy,
            deploymentStartDate,
            deploymentStartTime,
            deploymentEndDate,
            deploymentEndTime
        });
        
        if (eventType === 'flight' && locationType === 'Land Away' && isDeploy && 
            deploymentStartDate && deploymentStartTime && deploymentEndDate && deploymentEndTime) {
            
            console.log('Creating deployment tile...');
            
            // Convert deployment time strings to hours
            const deployStartHour = parseTimeStringToHours(deploymentStartTime);
            const deployEndHour = parseTimeStringToHours(deploymentEndTime);
            
            // Calculate deployment duration in hours, accounting for multi-day deployments
            const startDate = new Date(deploymentStartDate);
            const endDate = new Date(deploymentEndDate);
            
            // Calculate the number of days between start and end dates
            const daysDifference = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Calculate total duration including multiple days
            let deployDuration = (daysDifference * 24) + (deployEndHour - deployStartHour);
            
            // If duration is negative or zero, something is wrong with the dates/times
            if (deployDuration <= 0) {
                deployDuration = 1; // Default to 1 hour minimum
            }
            
            // Create multiple deployment tiles based on aircraft count
            console.log(`Creating ${deploymentAircraftCount} deployment tiles...`);
            
            for (let i = 0; i < deploymentAircraftCount; i++) {
                const deploymentTile: ScheduleEvent = {
                    id: `deployment-${event.id}-${i}-${Date.now()}`,
                    date: deploymentStartDate,
                    type: 'deployment',
                    startTime: deployStartHour,
                    duration: deployDuration,
                    resourceId: 'Deployed', // Will be reassigned by findAvailableResourceId
                    color: 'bg-gray-600/30', // Base color, styling handled in FlightTile
                    flightNumber: 'DEPLOYMENT',
                    flightType: 'Dual',
                    locationType: 'Land Away',
                    origin: 'DEPLOY',
                    destination: 'DEPLOY',
                    instructor: '',
                    student: '',
                    pilot: '',
                    isDeploy: true,
                    deploymentStartDate: deploymentStartDate,
                    deploymentStartTime: deploymentStartTime,
                    deploymentEndDate: deploymentEndDate,
                    deploymentEndTime: deploymentEndTime,
                    deploymentAircraftCount: deploymentAircraftCount,
                };
                
                console.log(`Deployment tile ${i + 1} created:`, deploymentTile);
                eventsToSave.push(deploymentTile);
            }
        }
        
        console.log('Events to save:', eventsToSave);
        onSave(eventsToSave);
    }

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const totalHours = h + m / 60;
                const label = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`; // 24-hour format without colon
                options.push({ label, value: totalHours });
            }
        }
        return options;
    }, []);

    const traineeObject = useMemo(() => {
        const traineeFullName = event.flightType === 'Dual' ? event.student : event.pilot;
        if (!traineeFullName) return null;
        return traineesData.find(t => t.fullName === traineeFullName) || null;
    }, [event.flightType, event.student, event.pilot, traineesData]);

    const handleSyllabusFocus = () => {
        if (isOracleContext && !crew[0]?.student && !crew[0]?.instructor) {
            setSyllabusSelectionError(true);
            setTimeout(() => setSyllabusSelectionError(false), 2000);
        }
    };
    
    const handleTraineeScoresClick = () => {
        if (traineeObject) {
            onNavigateToHateSheet(traineeObject);
            onClose();
        }
    };

    const handleLmpClick = () => {
        onNavigateToSyllabus(event.flightNumber);
        onClose();
    };

    const handlePt051Click = () => {
        if (traineeObject) {
            onOpenPt051(traineeObject);
            onClose();
        }
    };
    
    const handleAuthClick = () => {
        onOpenAuth(event);
    };

    const handlePostFlightClick = () => {
        onOpenPostFlight(event);
    };

    const handleCompleteClick = () => {
        // Check if this is a Mass Brief event
        if (event.flightNumber.includes('MB') || event.flightNumber.includes(' MB')) {
            setShowMassBriefComplete(true);
        } else {
            // For regular ground events, mark as complete and close
            // This would typically update the event status in the system
            if (traineeObject) {
                alert(`Ground event "${event.flightNumber}" marked as complete for ${traineeObject.rank} ${traineeObject.name}`);
            } else {
                alert(`Ground event "${event.flightNumber}" marked as complete`);
            }
            onClose();
        }
    };

    const handleMassBriefComplete = (confirmedTrainees: Trainee[]) => {
        console.log('Mass Brief completed for trainees:', confirmedTrainees.map(t => t.fullName));
        
        const currentDate = new Date().toISOString().split('T')[0];
        const instructor = event.instructor || 'System';
        
        // Create PT051 assessments for each trainee
        if (onSavePT051Assessment) {
            confirmedTrainees.forEach(trainee => {
                const assessment = {
                    id: `${trainee.idNumber}_${event.id}_${currentDate}`,
                    traineeName: trainee.name,
                    traineeFullName: trainee.fullName || `${trainee.rank} ${trainee.name}`,
                    eventId: event.id,
                    flightNumber: event.flightNumber,
                    date: currentDate,
                    instructorName: instructor,
                    dcoResult: 'DCO', // Check DCO box
                    overallGrade: 'No Grade', // Set to "No Grade"
                    overallResult: null, // null for ground events
                    overallComments: `Ground event completed via Mass Brief completion on ${currentDate}`, // String format for compatibility
                    scores: [], // Empty scores array for ground events
                    isCompleted: true,
                    groundSchoolAssessment: {
                        isAssessment: false,
                        result: 0
                    }
                };
                
                console.log('Saving PT051 assessment for:', trainee.fullName, assessment);
                onSavePT051Assessment(assessment);
            });
            console.log('PT051 assessments saved successfully');
        } else {
            console.warn('onSavePT051Assessment callback is not defined!');
        }
        
        // Show styled confirmation
        setCompletedTrainees(confirmedTrainees);
        setShowMassBriefConfirmation(true);
    };

    

const renderCrewFields = (crewMember: CrewMember, index: number) => {
    const isSctForm = flightNumber === 'SCT FORM';
    const isSctGeneric = flightNumber.startsWith('SCT');
    
    const formationCallsign = isSctForm && formationType
        ? `${formationType}${index + 1}` 
        : `Aircraft ${index + 1}`;
    
    // Determine if we should use staff-only instructors
    const useStaffOnly = eventCategory === 'lmp_currency' || eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di';
    
    // Determine if we should show Trainee/Group fields (only for LMP Event and LMP Currency)
    const showTraineeFields = eventCategory === 'lmp_event' || eventCategory === 'lmp_currency';
    
    // Determine if we should show Crew field (only for SCT and Staff CAT when Dual)
    const showCrewField = (eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di') && crewMember.flightType === 'Dual';
    
    return (
        <div key={index} className={`space-y-4 ${crew.length > 1 ? 'p-3 bg-gray-700/50 rounded-lg' : ''}`}>
            {crew.length > 1 && <h4 className="text-sm font-bold text-sky-400">{formationCallsign}</h4>}

            <div>
                <label className="block text-sm font-medium text-gray-400">Dual/Solo</label>
                <select value={crewMember.flightType} onChange={e => handleCrewChange(index, 'flightType', e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                    <option value="Dual">Dual</option>
                    <option value="Solo">Solo</option>
                </select>
            </div>

            {crewMember.flightType === 'Dual' ? (
                <>
                    {/* Instructor/Pilot Field - Staff only for certain categories */}
                    {useStaffOnly ? (
                        renderStaffInstructorDropdown(
                            // For SCT, use pilot field; for others, use instructor field
                            eventCategory === 'sct' ? crewMember.pilot : crewMember.instructor,
                            (value) => handleCrewChange(index, eventCategory === 'sct' ? 'pilot' : 'instructor', value),
                            (eventCategory === 'sct' || eventCategory === 'staff_cat' || eventCategory === 'twr_di') ? 'Pilot' : 'Instructor',
                            isDeploy
                        )
                       ) : (
                           renderStaffInstructorDropdown(
                               crewMember.instructor,
                               (value) => handleCrewChange(index, 'instructor', value),
                               'Instructor',
                               isDeploy
                           )
                       )}
                    
                    {/* Trainee/Group Fields - Only for LMP Event and LMP Currency */}
                    {showTraineeFields && (
                        <>
                            {renderTraineeDropdown(
                                crewMember.student,
                                (value) => handleCrewChange(index, 'student', value),
                                isDeploy,
                                localHighlight === 'student'
                            )}

                            <div className="flex items-center justify-center my-3">
                                <span className="text-base font-bold text-gray-500">- OR -</span>
                            </div>

                            <div className="p-4 border border-gray-600 rounded bg-gray-700/30 relative" ref={groupInputRef}>
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium text-gray-300">Group</h4>
                                    {crewMember.groupTraineeIds?.length > 0 && (
                                        <span className="text-xs text-sky-400 font-mono bg-gray-800 px-2 py-0.5 rounded-full border border-gray-600">
                                            {crewMember.groupTraineeIds.length} Selected
                                        </span>
                                    )}
                                </div>
                                
                                <button
                                    type="button"
                                    onClick={() => setActiveGroupInput(activeGroupInput === index ? null : index)}
                                    disabled={isDeploy}
                                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center shadow-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                                    </svg>
                                    Add Names
                                </button>
                                
                                {/* Group Selection Flyout */}
                                {activeGroupInput === index && (
                                    <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded-md shadow-xl max-h-60 overflow-y-auto left-0">
                                        {coursesStruct.map(course => {
                                            const courseTraineeIds = course.trainees.map(t => t.idNumber);
                                            const currentIds = new Set(crewMember.groupTraineeIds || []);
                                            const isAllSelected = courseTraineeIds.length > 0 && courseTraineeIds.every(id => currentIds.has(id));

                                            return (
                                                <div key={course.name}>
                                                    <div className="flex items-center px-3 py-2 bg-gray-900/80 font-bold text-gray-300 sticky top-0 z-10 border-b border-gray-700">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isAllSelected}
                                                            onChange={() => handleToggleCourse(index, course.trainees)}
                                                            className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded mr-2 cursor-pointer"
                                                        />
                                                        <span className="uppercase text-xs">{course.name}</span>
                                                    </div>
                                                    <div className="bg-gray-800">
                                                        {course.trainees.map(trainee => {
                                                            const isSelected = currentIds.has(trainee.idNumber);
                                                            return (
                                                                <div 
                                                                    key={trainee.idNumber}
                                                                    className="flex items-center px-3 py-2 pl-8 hover:bg-gray-700 cursor-pointer transition-colors border-b border-gray-700/50 last:border-0"
                                                                    onClick={() => handleToggleTrainee(index, trainee.idNumber)}
                                                                >
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={isSelected} 
                                                                        readOnly 
                                                                        className="h-4 w-4 accent-sky-500 bg-gray-600 border-gray-500 rounded mr-3 pointer-events-none"
                                                                    />
                                                                    <span className="text-sm text-gray-300">{trainee.name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    
                    {/* Crew Field - Only for SCT and Staff CAT when Dual */}
                    {showCrewField && (
                        renderStaffInstructorDropdown(
                            crewMember.student,
                            (value) => handleCrewChange(index, 'student', value),
                            'Crew',
                            isDeploy,
                            eventCategory === 'sct' // Include PAX option for SCT events
                        )
                    )}
                </>
               ) : (
                   // Solo - Use staff dropdown for SCT and Staff CAT
                   useStaffOnly ? (
                       <div>
                           <label className="block text-sm font-medium text-gray-400">Pilot</label>
                           <select 
                               value={crewMember.pilot} 
                               onChange={e => handleCrewChange(index, 'pilot', e.target.value)} 
                               disabled={isDeploy}
                               className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed appearance-none cursor-pointer z-10"
                           >
                               <option value="" disabled>Select pilot</option>
                               {staffInstructorsByUnit.sortedUnits.map(unit => (
                                   <optgroup key={unit} label={`─── ${unit} ───`}>
                                       {staffInstructorsByUnit.grouped[unit]
                                           .filter(instructor => {
                                               // For formations, filter out pilots already assigned to other aircraft
                                               if (crew.length > 1) {
                                                   const alreadyAssignedPilots = crew
                                                       .filter((c, i) => i !== index) // Exclude current aircraft
                                                       .map(c => c.pilot)
                                                       .filter(p => p); // Remove empty values
                                                   return !alreadyAssignedPilots.includes(instructor.name);
                                               }
                                               return true;
                                           })
                                           .map(instructor => {
                                               const stats = personStats[instructor.name] || { rank: '' };
                                               const displayText = `${stats.rank} ${instructor.name}`;
                                               return (
                                                   <option key={instructor.name} value={instructor.name}>
                                                       {displayText}
                                                   </option>
                                               );
                                           })}
                                   </optgroup>
                               ))}
                           </select>
                       </div>
                   ) : (
                       <div>
                           <label className="block text-sm font-medium text-gray-400">Pilot</label>
                           <select value={crewMember.pilot} onChange={e => handleCrewChange(index, 'pilot', e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                               <option value="" disabled>Select pilot</option>
                               {traineeList
                                   .filter(name => {
                                       // For formations, filter out pilots already assigned to other aircraft
                                       if (crew.length > 1) {
                                           const alreadyAssignedPilots = crew
                                               .filter((c, i) => i !== index) // Exclude current aircraft
                                               .map(c => c.pilot)
                                               .filter(p => p); // Remove empty values
                                           return !alreadyAssignedPilots.includes(name);
                                       }
                                       return true;
                                   })
                                   .map(name => <option key={name} value={name}>{name}</option>)}
                           </select>
                       </div>
                   )
               )}
        </div>
    );
};    
    if (isVisualAdjustMode) {
        return (
            <VisualAdjustModal
                event={event}
                startTime={visualAdjustStartTime}
                endTime={visualAdjustEndTime}
                onContinue={handleVisualAdjustContinue}
                onClose={() => setIsVisualAdjustMode(false)}
            />
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
                <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl border border-gray-700 transform transition-all animate-fade-in flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className={`p-4 border-b border-gray-700 flex justify-between items-center ${event.color} flex-shrink-0`}>
                        <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
                        <div className="flex items-center space-x-4">
                            {isEditing && eventType === 'flight' && (
                                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-black/20">
                                    <input
                                        type="checkbox"
                                        checked={isDeploy}
                                        onChange={e => {
                                            const checked = e.target.checked;
                                            setIsDeploy(checked);
                                            if (checked) {
                                                setLocationType('Land Away');
                                            }
                                        }}
                                        className="h-5 w-5 accent-sky-500 bg-gray-600 rounded border-gray-500 focus:ring-sky-500"
                                    />
                                    <span className="text-sm font-semibold text-white">Add Deployment</span>
                                </label>
                            )}
                            <button onClick={() => setShowCancelConfirm(true)} className="px-4 py-1 text-sm font-semibold rounded-md btn-red-brushed" aria-label="Delete Event">
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-row overflow-hidden">
                        {/* Main Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {isEditing ? (
                                <div className="space-y-4">
                                       {/* Event Category Selector */}
                                       <div className="mb-6">
                                           <label className="block text-sm font-medium text-gray-400 mb-3">Event Category</label>
                                           <div className="grid grid-cols-5 gap-3">
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('lmp_event')}
                                                   className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                                       eventCategory === 'lmp_event'
                                                           ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   LMP Event
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('lmp_currency')}
                                                   className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                                       eventCategory === 'lmp_currency'
                                                           ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   LMP Currency
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('sct')}
                                                   className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                                       eventCategory === 'sct'
                                                           ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   SCT
                                               </button>
                                               <button
                                                   type="button"
                                                   onClick={() => setEventCategory('staff_cat')}
                                                   className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                                       eventCategory === 'staff_cat'
                                                           ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                                                           : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                   }`}
                                               >
                                                   Staff CAT
                                               </button>
<button
                                                      type="button"
                                                      onClick={() => setEventCategory('twr_di')}
                                                      className={`px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                                                          eventCategory === 'twr_di'
                                                              ? 'bg-sky-600 text-white shadow-lg ring-2 ring-sky-400'
                                                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                      }`}
                                                  >
                                                      TWR DI
                                                  </button>                                           </div>
                                       </div>

                                    <div className={`grid grid-cols-1 ${eventType === 'flight' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                        <div className="relative">
                                            <label className="block text-sm font-medium text-gray-400">Syllabus Item</label>
                                            <select 
                                                value={flightNumber} 
                                                onChange={handleFlightNumberChange} 
                                                onFocus={handleSyllabusFocus}
                                                disabled={isDeploy || (isOracleContext && filteredSyllabusOptions.length === 0)}
                                                className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed`}
                                            >
                                                <option value="" disabled>
                                                    {isOracleContext ? 'Select a crew member first' : 'Select an item'}
                                                </option>
                                                {isAddingTile && <option value="SCT FORM">SCT FORM</option>}
                                                {filteredSyllabusOptions.filter(item => item !== 'SCT FORM').map(item => <option key={item} value={item}>{item}</option>)}
                                            </select>
                                            {syllabusSelectionError && (
                                                <div className="absolute -bottom-6 left-0 text-xs text-red-400 animate-fade-in">Select a crew member first.</div>
                                            )}
                                        </div>
                                        {eventType === 'flight' && (
                                        <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Area</label>
                                            <select value={area} onChange={e => setArea(e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                {areas.map(a => <option key={a} value={a}>{a}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Aircraft Number</label>
                                            <select value={aircraftNumber} onChange={e => setAircraftNumber(e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                {Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(3, '0')).map(num => <option key={num} value={num}>{num}</option>)}
                                            </select>
                                        </div>
                                        </>
                                        )}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Start Time</label>
                                            <select 
                                                value={startTime} 
                                                onChange={e => {
                                                    setStartTime(parseFloat(e.target.value));
                                                    setLocalHighlight(null);
                                                }} 
                                                disabled={isDeploy}
                                                className={`mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm transition-all duration-200 disabled:bg-gray-700/50 disabled:cursor-not-allowed ${localHighlight === 'startTime' ? 'ring-2 ring-red-500' : ''}`}
                                            >
                                                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Duration</label>
                                            <input 
                                                type="number" 
                                                step="0.1" 
                                                min="0.1"
                                                value={duration} 
                                                onChange={e => setDuration(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                disabled={isDeploy}
                                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
        
                                    {eventType === 'flight' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400">Location</label>
                                            <select
                                                value={locationType}
                                                onChange={e => setLocationType(e.target.value as 'Local' | 'Land Away')}
                                                disabled={isDeploy}
                                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                                            >
                                                <option value="Local">Local</option>
                                                <option value="Land Away">Land Away</option>
                                            </select>
                                        </div>
                                    )}
                                    {eventType === 'flight' && locationType === 'Land Away' && !isDeploy && (
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-400">Origin</label>
                                                <input
                                                    type="text"
                                                    value={origin}
                                                    onChange={e => setOrigin(e.target.value.toUpperCase())}
                                                    maxLength={3}
                                                    placeholder="e.g. ESL"
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-gray-400">Destination</label>
                                                <input
                                                    type="text"
                                                    value={destination}
                                                    onChange={e => setDestination(e.target.value.toUpperCase())}
                                                    maxLength={3}
                                                    placeholder="e.g. PEA"
                                                    className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {eventType === 'flight' && locationType === 'Land Away' && (
                                        <>
                                            <fieldset className="p-4 border border-gray-600 rounded-lg mb-4">
                                                <legend className="px-2 text-sm font-semibold text-gray-300">Deployment Period</legend>
                                                <div className="mt-2 grid grid-cols-4 gap-2 bg-gray-700/30 p-3 rounded-lg">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">Start Time</label>
                                                        <input type="text" value={deploymentStartTime} onChange={e => {
                                                            // Remove colon and ensure 24-hour format
                                                            const value = e.target.value.replace(/:/g, '').replace(/\D/g, '').slice(0, 4);
                                                            setDeploymentStartTime(value);
                                                        }} placeholder="0800" className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">Start Date</label>
                                                        <input type="date" value={deploymentStartDate} onChange={e => setDeploymentStartDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">End Time</label>
                                                        <input type="text" value={deploymentEndTime} onChange={e => {
                                                            // Remove colon and ensure 24-hour format
                                                            const value = e.target.value.replace(/:/g, '').replace(/\D/g, '').slice(0, 4);
                                                            setDeploymentEndTime(value);
                                                        }} placeholder="1700" className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"/>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-400">End Date</label>
                                                        <input type="date" value={deploymentEndDate} onChange={e => setDeploymentEndDate(e.target.value)} style={{colorScheme: 'dark'}} className="mt-1 w-full bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm"/>
                                                    </div>
                                                </div>
                                                   <div className="mt-2 bg-gray-700/30 p-3 rounded-lg">
                                                       <label className="block text-xs font-medium text-gray-400 mb-1">Number of Aircraft</label>
                                                       <input 
                                                           type="number" 
                                                           min="1" 
                                                           max="20" 
                                                           value={deploymentAircraftCount} 
                                                           onChange={e => setDeploymentAircraftCount(parseInt(e.target.value) || 1)} 
                                                           className="w-24 bg-gray-800 border-gray-600 rounded py-1 px-2 text-sm text-center"
                                                       />
                                                       <span className="ml-2 text-xs text-gray-500">aircraft deploying</span>
                                                   </div>
                                            </fieldset>

                                        </>
                                    )}
        
                                    {flightNumber === 'SCT FORM' && (
                                        <div className="p-3 bg-gray-900/50 rounded-lg space-y-4">
                                            <h3 className="font-semibold text-gray-300">Formation Details</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400">Formation Callsign</label>
                                                    <select value={formationType} onChange={e => setFormationType(e.target.value)} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                           {filteredCallsigns ? (
                                                               filteredCallsigns.map(cs => (
                                                                   <option key={cs.code} value={cs.code}>
                                                                       {cs.name} ({cs.code}) - {cs.unit}
                                                                   </option>
                                                               ))
                                                           ) : (
                                                               formationTypes.map(type => <option key={type} value={type}>{type}</option>)
                                                           )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-400">Aircraft Count</label>
                                                    <select value={aircraftCount} onChange={e => setAircraftCount(parseInt(e.target.value))} disabled={isDeploy} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm disabled:bg-gray-700/50 disabled:cursor-not-allowed">
                                                        {Array.from({length: 7}, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-4">{crew.map(renderCrewFields)}</div>
                                    
                                    {/* Add to Deployment Section */}
                                    {(eventType === 'flight' || eventType === 'ftd' || eventType === 'cpt') && (
                                        <div className="border-t border-gray-600 pt-6 mt-6">
                                            <h3 className="text-lg font-semibold text-white mb-4">Add to Deployment</h3>
                                            <div className="space-y-3">
                                                {getCurrentDeployments().length > 0 ? (
                                                    getCurrentDeployments().map(deployment => (
                                                        <label key={deployment.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-700 p-2 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedDeploymentId === deployment.id}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedDeploymentId(deployment.id);
                                                                    } else {
                                                                        setSelectedDeploymentId('');
                                                                    }
                                                                }}
                                                                className="h-4 w-4 text-sky-600 bg-gray-700 border-gray-600 rounded focus:ring-sky-500"
                                                            />
                                                            <span className="text-sm text-gray-300">
                                                                {formatDeploymentTitle(deployment)}
                                                            </span>
                                                            <span className="text-xs text-gray-500 ml-2">
                                                                ({deployment.resourceId})
                                                            </span>
                                                        </label>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">
                                                        No deployments available for this event type
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-300 space-y-2">
                                    <p><strong>Syllabus Item:</strong> {event.flightNumber}</p>
                                    {event.type === 'flight' && <p><strong>Route:</strong> {event.origin}-{event.destination}</p>}
                                    {event.type === 'flight' && event.area && <p><strong>Area:</strong> {event.area}</p>}
                                    <p><strong>Dual/Solo:</strong> <span className="font-semibold">{event.flightType}</span></p>
                                    {event.flightType === 'Dual' ? (
                                        <>
                                            {event.eventCategory === 'sct' ? (
                                                <p><strong>Instructor:</strong> {event.instructor || event.pilot}</p>
                                            ) : (
                                                <p><strong>Instructor:</strong> {event.instructor}</p>
                                            )}
                                            {(event.type === 'ground' && event.attendees && event.attendees.length > 0) ? (
                                                <div>
                                                    <p><strong>Attendees ({event.attendees.length}):</strong></p>
                                                    <div className="mt-1 bg-gray-700/50 p-2 rounded-md max-h-32 overflow-y-auto">
                                                        <ul className="space-y-1">
                                                            {event.attendees.map(attendee => (
                                                                <li key={attendee} className="text-sm text-gray-300">{attendee.split(' – ')[0]}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            ) : event.eventCategory === 'sct' ? null : (
                                                <p><strong>Student:</strong> {event.student || event.group}</p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <p><strong>PIC:</strong> {event.pilot}</p>
                                            <p className="flex items-center gap-2">
                                                <strong>Second Position:</strong>
                                                <span className="inline-block px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 rounded text-sm font-semibold">
                                                    SOLO
                                                </span>
                                            </p>
                                        </>
                                    )}
                                    <p><strong>Duration:</strong> {event.duration.toFixed(1)} hours</p>
                                    <p><strong>Start Time:</strong> {Math.floor(event.startTime)}:{String(Math.round((event.startTime % 1) * 60)).padStart(2, '0')}</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Button Panel */}
                        <div className="w-56 flex-shrink-0 border-l border-gray-700 bg-gray-800/50 p-4 flex flex-col space-y-3">
                            {!isEditing && (
                                <>
                                    <div className="p-3 border border-gray-600 rounded-lg text-center">
                                        <label className="block text-sm font-semibold text-gray-400">Conflict?</label>
                                        {isConflict ? (
                                            <p className="text-2xl font-bold text-red-500">YES</p>
                                        ) : (
                                            <p className="text-2xl font-bold text-green-500">NO</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => onNeoClick(event)}
                                        className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-orange-brushed"
                                    >
                                        NEO
                                    </button>
                                    <button
                                        onClick={handleTraineeScoresClick}
                                        disabled={!traineeObject}
                                        className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-aluminium-brushed disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Trainee Scores
                                    </button>
                                    <button
                                        onClick={handleLmpClick}
                                        className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-aluminium-brushed"
                                    >
                                        LMP
                                    </button>
                                    {event.type === 'flight' && (
                                        <button onClick={handleAuthClick} className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-aluminium-brushed">
                                            Auth
                                        </button>
                                    )}
                                    {((traineeObject && event.type === 'ground') || (event.flightNumber.includes('MB') || event.flightNumber.includes(' MB'))) && (
                                        <button
                                            onClick={handleCompleteClick}
                                            className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-aluminium-brushed"
                                        >
                                            Complete
                                        </button>
                                    )}
                                    {traineeObject && (
                                        <button
                                            onClick={handlePt051Click}
                                            className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-aluminium-brushed"
                                        >
                                            PT-051
                                        </button>
                                    )}
                                    {event.type === 'flight' && (
                                        <button onClick={handlePostFlightClick} className="w-full px-4 py-2 rounded-md text-sm font-semibold shadow-md text-center btn-shape-fill">
                                            Post Flight
                                        </button>
                                    )}
                                </>
                            )}
                            <div className="flex-grow" /> {/* Spacer */}
                            {isEditing ? (
                                   <>
                                <button onClick={handleSave} className="w-full px-4 py-2 text-white rounded-md transition-colors text-sm font-semibold shadow-md text-center bg-sky-600 hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed">Save</button>
                                       <button onClick={handleVisualAdjust} className="w-full px-4 py-2 text-white rounded-md transition-colors text-sm font-semibold shadow-md text-center bg-purple-600 hover:bg-purple-700">Visual Adjust</button>
                                   </>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="w-full px-4 py-2 text-white rounded-md transition-colors text-sm font-semibold shadow-md text-center bg-gray-600 hover:bg-gray-700">Edit</button>
                            )}
                        </div>
                    </div>
                    
                    <div className="px-6 py-4 bg-gray-800/50 border-t border-gray-700 flex justify-end flex-shrink-0">
                        <button onClick={onClose} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 hover:text-white transition-colors text-sm">Close</button>
                    </div>
                </div>
            </div>
            {showCancelConfirm && (
                <CancelEventFlyout 
                    eventId={event.id}
                    eventType={event.type === 'ftd' ? 'ftd' : 'flight'}
                    onConfirm={(eventId, cancellationCode, manualCodeEntry) => {
                        if (onCancelEvent) {
                            onCancelEvent(eventId, cancellationCode, manualCodeEntry);
                        } else {
                            // Fallback to old delete behavior if onCancelEvent not provided
                            onDeleteRequest();
                        }
                        setShowCancelConfirm(false);
                    }}
                    onClose={() => setShowCancelConfirm(false)}
                    cancellationCodes={cancellationCodes}
                />
            )}
            {showMassBriefComplete && (
                <MassBriefCompleteFlyout
                    isOpen={showMassBriefComplete}
                    onClose={() => setShowMassBriefComplete(false)}
                    event={event}
                    trainees={
                        (() => {
                            console.log('🔍 Processing trainees for MassBriefCompleteFlyout');
                            console.log('🔍 Event:', event);
                            console.log('🔍 Event.attendees:', event.attendees);
                            console.log('🔍 Event.group:', event.group);
                            console.log('🔍 Event.selectedTrainees:', event.selectedTrainees);
                            console.log('🔍 Event.trainees:', event.trainees);
                            console.log('🔍 Event keys:', Object.keys(event));
                            console.log('🔍 Available trainees (strings):', trainees);
                            console.log('🔍 Available traineesData (objects):', traineesData);
                            
                            // First try attendees array
                            if (event.attendees) {
                                console.log('🔍 Processing attendees array');
                                const processedAttendees = event.attendees.map((attendeeName, index) => {
                                    console.log(`🔍 Processing attendee ${index}: "${attendeeName}"`);
                                    
                                    // Find the trainee object from the traineesData list
                                    const trainee = traineesData.find(t => {
                                        const fullName = `${t.rank} ${t.name}`;
                                        console.log(`🔍 Comparing "${fullName}" with "${attendeeName.split(' – ')[0]}"`);
                                        return fullName === attendeeName.split(' – ')[0];
                                    });
                                    
                                    if (trainee) {
                                        console.log('🔍 Found matching trainee:', trainee);
                                        return trainee;
                                    } else {
                                        console.log('🔍 Creating fallback trainee object');
                                        const nameParts = attendeeName.split(' – ');
                                        const fullName = nameParts[0];
                                        const course = nameParts[1] || '';
                                        
                                        // Parse "Last, First" format
                                        let rank = '';
                                        let name = fullName;
                                        const commaIndex = fullName.indexOf(',');
                                        if (commaIndex !== -1) {
                                            const lastName = fullName.substring(0, commaIndex).trim();
                                            const firstName = fullName.substring(commaIndex + 1).trim();
                                            name = `${firstName} ${lastName}`;
                                        } else {
                                            // Try "Rank Last First" format
                                            const parts = fullName.trim().split(' ');
                                            if (parts.length >= 2) {
                                                rank = parts[0];
                                                name = parts.slice(1).join(' ');
                                            }
                                        }
                                        
                                        const fallbackTrainee = {
                                            idNumber: 0,
                                            fullName: fullName,
                                            name: name,
                                            rank: rank,
                                            course: course,
                                            isPaused: false,
                                            unit: '',
                                            seatConfig: 'Pilot' as any,
                                            id: fullName
                                        };
                                        console.log('🔍 Fallback trainee:', fallbackTrainee);
                                        return fallbackTrainee;
                                    }
                                });
                                console.log('🔍 Final processed attendees:', processedAttendees);
                                return processedAttendees;
                            }
                            
                            // If no attendees, try to get trainees from the course (for mass events)
                            if (event.group && event.group.includes('Trainees Selected')) {
                                console.log('🔍 Mass event detected, filtering trainees by course');
                                
                                // Extract course from event if available
                                let eventCourse = '';
                                if (event.course) {
                                    eventCourse = event.course;
                                    console.log('🔍 Event course:', eventCourse);
                                } else if (trainees.length > 0 && typeof trainees[0] === 'string') {
                                    // Try to extract course from first trainee string
                                    const firstTrainee = trainees[0];
                                    const parts = firstTrainee.split(' – ');
                                    if (parts.length > 1) {
                                        eventCourse = parts[1];
                                        console.log('🔍 Extracted course from trainees:', eventCourse);
                                    }
                                }
                                
                                // Filter traineesData by course
                                const filteredTrainees = eventCourse 
                                    ? traineesData.filter(t => t.course === eventCourse)
                                    : traineesData;
                                
                                console.log('🔍 Filtered trainees count:', filteredTrainees.length);
                                console.log('🔍 Filtered trainees:', filteredTrainees);
                                
                                return filteredTrainees;
                            }
                            
                            console.log('🔍 No attendees or mass event, returning empty array');
                            return [];
                        })()
                    }
                    onConfirm={handleMassBriefComplete}
                />
            )}
            {showMassBriefConfirmation && (
                <MassBriefConfirmationFlyout
                    isOpen={showMassBriefConfirmation}
                    onClose={() => {
                        setShowMassBriefConfirmation(false);
                        onClose();
                    }}
                    event={event}
                    confirmedTrainees={completedTrainees}
                />
            )}
        </>
    );
};
