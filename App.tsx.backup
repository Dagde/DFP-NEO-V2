
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { initDB, seedDefaultTemplates } from './utils/db';
import LogbookView from './components/LogbookView';
import { AlgoContext } from './components/App';
import CurrencyBuilderView from './components/CurrencyBuilderView';
   import { seedTestAuditLogs } from './utils/seedAuditLogs';
   import { logAudit } from './utils/auditLogger';
   import { debouncedAuditLog } from './utils/auditDebounce';


// Import types
import { 
    ScheduleEvent, 
    Instructor, 
    Trainee, 
    SyllabusItemDetail, 
    Conflict, 
    PersonnelConflict, 
    Score, 
    PersonCurrencyStatus, 
    Pt051Assessment, 
    UnavailabilityPeriod, 
    NeoProblemTile, 
    NeoRemedy, 
    NeoInstructorRemedy, 
    NeoTimeShiftRemedy, 
    Course, 
    EventLimits, 
    PhraseBank,
    SctRequest,
    RemedialRequest,
    MasterCurrency,
    CurrencyRequirement,
    CurrencyDefinition,
    OracleAnalysisResult,
    OracleInstructorAnalysis,
    OracleTraineeAnalysis,
    NeoTraineeRemedy,
    EventSegment
} from './types';
import { NewCourseData } from './components/AddCourseFlyout';

// Import components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ScheduleView from './components/ScheduleView';
import InstructorScheduleView from './components/InstructorScheduleView';
import TraineeScheduleView from './components/TraineeScheduleView';
import CourseRosterView from './components/CourseRosterView';
import HateSheetView from './components/HateSheetView';
import ScoreDetailView from './components/ScoreDetailView';
import { EventDetailModal } from './components/FlightDetailModal';
import ConflictModal from './components/ConflictModal';
import AddGroundEventFlyout from './components/AddGroundEventFlyout';
import CptConflictWarningFlyout from './components/CptConflictWarningFlyout';
import MyDashboard from './components/MyDashboard';
import SupervisorDashboard from './components/SupervisorDashboard';
import { NextDayBuildView } from './components/NextDayBuildView';
import { PrioritiesViewWithMenu } from './components/PrioritiesViewWithMenu';
import ProgramDataView from './components/ProgramDataView';
import BuildDfpLoadingFlyout from './components/BuildDfpLoadingFlyout';
import BuildDateWarningFlyout from './components/BuildDateWarningFlyout';
import UnavailabilityConflictFlyout from './components/UnavailabilityConflictFlyout';
import Magnifier from './components/Magnifier';
import SuccessNotification from './components/SuccessNotification';
import InstructorListView from './components/InstructorListView';
import SyllabusView from './components/SyllabusView';
import { InstructorProfileFlyout } from './components/InstructorProfileFlyout';
import TraineeProfileFlyout from './components/TraineeProfileFlyout';
import PublishConfirmationFlyout from './components/PublishConfirmationFlyout';
import CurrencyView from './components/CurrencyView';
// FIX: Corrected import to be a named import as per module export.
import { CurrencySetupFlyout } from './components/CurrencySetupFlyout';
import UnsavedChangesWarning from './components/UnsavedChangesWarning';
import PT051View from './components/PT051View';
import AuthorisationFlyout from './components/AuthorisationFlyout';
// FIX: Corrected import to be a named import as per module export.
import { SettingsViewWithMenu } from './components/SettingsViewWithMenu';
import AuthorisationView from './components/AuthorisationView';
import LocalityChangeFlyout from './components/LocalityChangeFlyout';
import { PostFlightView } from './components/PostFlightView';
import TraineeLmpView from './components/TraineeLmpView';
import AddRemedialPackageFlyout from './components/AddRemedialPackageFlyout';
import CourseProgressView from './components/CourseProgressView';
import NightFlyingInfoFlyout from './components/NightFlyingInfoFlyout';
import NeoRemedyFlyout from './components/NeoRemedyFlyout';
import UnavailabilityReportModal from './components/UnavailabilityReportModal';
import InfoNotification from './components/InfoNotification';
import DutyWarningFlyout from './components/DutyWarningFlyout';
import SctRequestFlyout from './components/SctRequestFlyout';
import NextDayInstructorScheduleView from './components/NextDayInstructorScheduleView';
import { NextDayTraineeScheduleView } from './components/NextDayTraineeScheduleView';


// --- MOCK DATA ---
import { ESL_DATA, PEA_DATA, INITIAL_SYLLABUS_DETAILS, DEFAULT_PHRASE_BANK } from './mockData';
import { INITIAL_CURRENCY_REQUIREMENTS, INITIAL_MASTER_CURRENCIES } from './data/currencies';

// --- PT-051 STRUCTURE ---
const PT051_STRUCTURE = [
  { category: 'Core Dimensions', elements: ['Airmanship', 'Preparation', 'Technique'] },
  { category: 'Procedural Framework', elements: ['Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks'] },
  { category: 'Takeoff', elements: ['Stationary'] },
  { category: 'Departure', elements: ['Visual'] },
  { category: 'Core Handling Skills', elements: ['Effects of Control', 'Trimming', 'Straight and Level'] },
  { category: 'Turns', elements: ['Level medium Turn', 'Level Steep turn'] },
  { category: 'Recovery', elements: ['Visual - Initial &amp; Pitch'] },
  { category: 'Landing', elements: ['Landing', 'Crosswind'] },
  { category: 'Domestics', elements: ['Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge'] },
];

const ALL_ELEMENTS = PT051_STRUCTURE.flatMap(cat => cat.elements);

// --- UTILITY FUNCTIONS ---
const isOverlapping = (f1: Omit<ScheduleEvent, 'date'>, f2: Omit<ScheduleEvent, 'date'>): boolean => {
    if (!f1 || !f2 || f1.duration <= 0 || f2.duration <= 0) return false;
    const f1_end = f1.startTime + f1.duration;
    const f2_end = f2.startTime + f2.duration;
    return f1.startTime < f2_end && f1_end > f2.startTime;
};

const getPersonnel = (event: Omit<ScheduleEvent, 'date'> | ScheduleEvent): string[] => {
    const personnel = new Set<string>();
    if (event.instructor) personnel.add(event.instructor);
    if (event.flightType === 'Solo') {
        if (event.pilot) personnel.add(event.pilot);
    } else {
        if (event.student) personnel.add(event.student);
    }
    if (event.attendees) event.attendees.forEach(p => personnel.add(p));
    if (event.groupTraineeIds && event.groupTraineeIds.length > 0) {
        // In a real app you'd resolve these IDs to names, but for conflict checks, the presence of people is enough.
        // For now, let's assume if there are group IDs, the main people are already in instructor/student fields for conflict checks.
        // This function is mainly for conflict detection, not display.
    }
    return Array.from(personnel);
};

const getEventBookingWindow = (
    event: ScheduleEvent,
    syllabusDetails: SyllabusItemDetail[]
): { start: number, end: number } => {
    const syllabusItem = syllabusDetails.find(s => s.id === event.flightNumber);
    if (syllabusItem) {
        const start = event.startTime - (syllabusItem.preFlightTime || 0);
        const end = event.startTime + event.duration + (syllabusItem.postFlightTime || 0);
        return { start, end };
    }
    return { start: event.startTime, end: event.startTime + event.duration };
};

const getEventBookingWindowForAlgo = (
    event: Omit<ScheduleEvent, 'date'> | { startTime: number, flightNumber: string, duration: number },
    syllabusDetails: SyllabusItemDetail[]
): { start: number, end: number } => {
    const syllabusItem = syllabusDetails.find(s => s.id === event.flightNumber);
    if (syllabusItem) {
        const start = event.startTime - syllabusItem.preFlightTime;
        const end = event.startTime + event.duration + syllabusItem.postFlightTime;
        return { start, end };
    }
    return { start: event.startTime, end: event.startTime + event.duration };
};

const calculateTotalDutyHoursForPeriod = (instructorName: string, events: ScheduleEvent[], startTime: number, endTime: number, syllabusDetails: SyllabusItemDetail[]): number => {
    const instructorEvents = events.filter(e => 
        getPersonnel(e).includes(instructorName) && 
        // Check if event overlaps with the specified time period (considering booking windows)
        (() => {
            const bookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
            return bookingWindow.start < endTime && bookingWindow.end > startTime;
        })()
    );
    
    if (instructorEvents.length === 0) return 0;

    // Calculate start/end times including pre/post brief for overlapping events
    const overlappingWindows = instructorEvents
        .map(e => getEventBookingWindowForAlgo(e, syllabusDetails))
        .map(window => ({
            start: Math.max(window.start, startTime),
            end: Math.min(window.end, endTime)
        }))
        .filter(window => window.start < window.end)
        .sort((a, b) => a.start - b.start);

    if (overlappingWindows.length === 0) return 0;

    // Merge overlapping windows to get total duty time
    let totalDutyTime = 0;
    let currentStart = overlappingWindows[0].start;
    let currentEnd = overlappingWindows[0].end;

    for (let i = 1; i < overlappingWindows.length; i++) {
        const nextWindow = overlappingWindows[i];
        
        if (nextWindow.start <= currentEnd) {
            // Overlapping or adjacent windows - merge them
            currentEnd = Math.max(currentEnd, nextWindow.end);
        } else {
            // Separate windows - add current window time and start new one
            totalDutyTime += currentEnd - currentStart;
            currentStart = nextWindow.start;
            currentEnd = nextWindow.end;
        }
    }
    
    // Add the final window
    totalDutyTime += currentEnd - currentStart;

    return parseFloat(totalDutyTime.toFixed(1));
};

const timeStringToHours = (timeStr: string | undefined): number | null => {
    if (!timeStr) return null;
    
    let hours: number;
    let minutes: number;

    if (timeStr.includes(':')) { // Supports HH:mm
        const parts = timeStr.split(':').map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
        [hours, minutes] = parts;
    } else if (timeStr.length === 4 && /^\d{4}$/.test(timeStr)) { // Supports HHMM
        hours = parseInt(timeStr.substring(0, 2), 10);
        minutes = parseInt(timeStr.substring(2, 4), 10);
    } else {
        return null;
    }

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours >= 24 || minutes < 0 || minutes >= 60) {
        return null;
    }
    return hours + minutes / 60;
};

const formatDecimalHourToString = (decimalHour: number): string => {
    const hours = Math.floor(decimalHour);
    const minutes = Math.round((decimalHour % 1) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// New Helpers for DFP and Neo
const calculateProjectedDuty = (
    instructorName: string, 
    events: (ScheduleEvent | Omit<ScheduleEvent, 'date'>)[], 
    newEvent: (ScheduleEvent | Omit<ScheduleEvent, 'date'>),
    syllabusDetails: SyllabusItemDetail[] = INITIAL_SYLLABUS_DETAILS
): number => {
    // Filter events for the instructor
    const instructorEvents = [...events.filter(e => getPersonnel(e).includes(instructorName)), newEvent];
    if (instructorEvents.length === 0) return 0;

    // Calculate start/end times including pre/post brief
    const sortedWindows = instructorEvents
        .map(e => getEventBookingWindowForAlgo(e, syllabusDetails))
        .sort((a, b) => a.start - b.start);

    const firstEventStart = sortedWindows[0].start;
    
    // Determine last event end time (duty end)
    const lastEvent = instructorEvents.find(e => 
        getEventBookingWindowForAlgo(e, syllabusDetails).end === sortedWindows[sortedWindows.length - 1].end
    );
    
    // If the last event finishes after 1700, duty ends at event finish time.
    // Otherwise, duty assumed to end at event finish time (or could be fixed 1700 if that's business rule, but sticking to simple span here)
    const lastEventEnd = sortedWindows[sortedWindows.length - 1].end;

    const dutyHours = Math.max(0, lastEventEnd - firstEventStart);
    return parseFloat(dutyHours.toFixed(1));
};

const daysSince = (dateStr: string | undefined, relativeTo: string): number => {
    if (!dateStr) return 999; // Treated as very long ago if undefined
    const eventDate = new Date(dateStr + 'T00:00:00Z');
    const baseDate = new Date(relativeTo + 'T00:00:00Z');
    return Math.floor((baseDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
};


// --- DFP GENERATION ALGORITHM ---

interface DfpConfig {
  buildDate: string;
  instructors: Instructor[];
  trainees: Trainee[];
  syllabus: SyllabusItemDetail[];
  scores: Map<string, Score[]>;
  coursePriorities: string[];
  coursePercentages: Map<string, number>;
  availableAircraftCount: number;
  ftdCount: number;
  courseColors: { [key: string]: string };
  school: 'ESL' | 'PEA';
  dayStart: number;
  dayEnd: number;
  allowNightFlying: boolean;
  commenceNightFlying: number;
  ceaseNightFlying: number;
  highestPriorityEvents: ScheduleEvent[];
  programWithPrimaries: boolean;
  traineeLMPs: Map<string, SyllabusItemDetail[]>;
  flightTurnaround: number;
  ftdTurnaround: number;
  cptTurnaround: number;
  preferredDutyPeriod: number;
  maxCrewDutyPeriod: number;
  eventLimits: EventLimits;
  sctFlights: SctRequest[];
  sctFtds: SctRequest[];
  remedialRequests: RemedialRequest[];
}

// --- DFP Algorithm Helpers (moved outside for re-use in debug) ---

const isPersonStaticallyUnavailable = (
    person: Instructor | Trainee,
    periodStart: number,
    periodEnd: number,
    buildDate: string,
    eventType: 'flight' | 'ground' | 'ftd' | 'duty_sup' | 'cpt'
): boolean => {
    if (!person.unavailability) return false;
    for (const period of person.unavailability) {
        // Correct date range check: exclusive for all-day, inclusive for timed.
        const isInDateRange = period.allDay
            ? (buildDate >= period.startDate && buildDate < period.endDate)
            : (buildDate >= period.startDate && buildDate <= period.endDate);

        if (isInDateRange) {
            // Check for 'Ground Duties only' exception
            if (period.reason === 'TMUF - Ground Duties only' && eventType !== 'flight') {
                continue; // Not a conflict
            }
            
            if (period.allDay) {
                return true; // Conflict if it's an all-day event in range
            }

            // It's a timed event, now check for time overlap
            const unavailableStart = timeStringToHours(period.startTime);
            const unavailableEnd = timeStringToHours(period.endTime);

            if (unavailableStart !== null && unavailableEnd !== null) {
                // This logic correctly handles multi-day timed events
                let dayStart = (buildDate === period.startDate) ? unavailableStart : 0;
                let dayEnd = (buildDate === period.endDate) ? unavailableEnd : 24;

                if (periodStart < dayEnd && periodEnd > dayStart) {
                    return true; // Time overlaps
                }
            } else {
                // if times are null/invalid for a timed event, treat as all-day for that date
                return true;
            }
        }
    }
    return false; // Not unavailable
};

const findAvailableArea = (
    startTime: number,
    duration: number,
    existingEvents: Omit<ScheduleEvent, 'date'>[]
): string | null => {
    const primaryAreas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const secondaryAreas = ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    const newEventStart = startTime;
    const newEventEnd = startTime + duration;

    const isAreaOccupied = (area: string): boolean => {
        return existingEvents.some(event => {
            if (event.type !== 'flight' || event.area !== area) {
                return false;
            }
            const existingEventStart = event.startTime;
            const existingEventEnd = event.startTime + event.duration;
            return newEventStart < existingEventEnd && newEventEnd > existingEventStart;
        });
    };

    for (const primaryArea of primaryAreas) {
        if (!isAreaOccupied(primaryArea)) {
            return primaryArea;
        }
    }

    for (const secondaryArea of secondaryAreas) {
        if (!isAreaOccupied(secondaryArea)) {
            return secondaryArea;
        }
    }

    return null; // No available areas
};

// Centralized logic for determining a trainee's next event(s)
const computeNextEventsForTrainee = (
    trainee: Trainee,
    traineeLMPs: Map<string, SyllabusItemDetail[]>,
    scores: Map<string, Score[]>,
    masterSyllabus: SyllabusItemDetail[] // Added fallback
): { next: SyllabusItemDetail | null, plusOne: SyllabusItemDetail | null } => {
    // Check individual LMP first, then fallback to master syllabus
    const individualLMP = traineeLMPs.get(trainee.fullName) || masterSyllabus;

    if (!individualLMP || individualLMP.length === 0) {
        return { next: null, plusOne: null };
    }
    
    const traineeScores = scores.get(trainee.fullName) || [];
    const completedEventIds = new Set(traineeScores.map(s => s.event));

    let nextEvt: SyllabusItemDetail | null = null;
    let plusOneEvt: SyllabusItemDetail | null = null;
    let nextEventIndex = -1;

    // Find Next Event
    for (let i = 0; i < individualLMP.length; i++) {
        const item = individualLMP[i];
        if (completedEventIds.has(item.id) || item.code.includes(' MB')) {
            continue;
        }

        const prereqsMet = item.prerequisites.every(p => completedEventIds.has(p));
        if (prereqsMet) {
            nextEvt = item;
            nextEventIndex = i;
            break;
        }
    }
    
    // Find Next +1 Event (sequentially)
    if (nextEventIndex !== -1) {
        for (let i = nextEventIndex + 1; i < individualLMP.length; i++) {
            const item = individualLMP[i];
            // Skip non-schedulable events
            if (!item.code.includes(' MB')) {
                plusOneEvt = item;
                break;
            }
        }
    }

    return { next: nextEvt, plusOne: plusOneEvt };
};

// Helper for Trainee Priority Scoring
const calculateTraineePriorityScore = (
    trainee: Trainee,
    buildDate: string,
    courseMedian: number,
    traineeProgress: number,
    isRemedial: boolean
): number => {
    const today = new Date(buildDate + 'T00:00:00Z').getTime();
    const lastEvent = trainee.lastEventDate ? new Date(trainee.lastEventDate + 'T00:00:00Z').getTime() : 0;
    const lastFlight = trainee.lastFlightDate ? new Date(trainee.lastFlightDate + 'T00:00:00Z').getTime() : 0;

    const daysSinceEvent = lastEvent === 0 ? 100 : Math.floor((today - lastEvent) / (1000 * 3600 * 24));
    const daysSinceFlight = lastFlight === 0 ? 100 : Math.floor((today - lastFlight) / (1000 * 3600 * 24));
    
    // Lag is positive if they are behind the median
    const lag = courseMedian - traineeProgress; 

    // Weighting Logic
    let score = 0;
    score += daysSinceEvent * 2;
    score += daysSinceFlight * 1;
    score += lag * 5; // High weight for being behind
    
    if (isRemedial) score += 500; // Massive boost for remedial
    
    return score;
};

// Planned Event Interface
interface PlannedEvent {
    id: string;
    type: 'manual' | 'sct' | 'trainee';
    subType: 'flight' | 'ftd' | 'ground' | 'cpt' | 'stby';
    priorityScore: number;
    trainee?: Trainee;
    instructor?: Instructor;
    eventCode: string;
    isRemedial: boolean;
    isSct: boolean;
}


function generateDfpInternal(config: DfpConfig, setProgress: (progress: { message: string, percentage: number }) => void): Omit<ScheduleEvent, 'date'>[] {
    const { 
        instructors: originalInstructors, trainees, syllabus: syllabusDetails, scores, 
        coursePriorities, coursePercentages, availableAircraftCount, ftdCount,
        courseColors, school, dayStart: flyingStartTime, dayEnd: flyingEndTime,
        allowNightFlying, commenceNightFlying, ceaseNightFlying, buildDate,
        highestPriorityEvents, programWithPrimaries, traineeLMPs, flightTurnaround,
        ftdTurnaround, cptTurnaround, preferredDutyPeriod, maxCrewDutyPeriod,
        eventLimits, sctFtds, sctFlights, remedialRequests
    } = config;

    // --- HELPER FUNCTIONS ---
    
    // Calculate total duty hours for an instructor including all assigned events (day and night)
    const calculateInstructorDutyHours = (instructorName: string, includeProposedEvent?: any): number => {
        const eventsToCheck = includeProposedEvent 
            ? [...generatedEvents, includeProposedEvent]
            : generatedEvents;
        
        const instructorEvents = eventsToCheck.filter(e => getPersonnel(e).includes(instructorName));
        
        if (instructorEvents.length === 0) return 0;
        
        const bookingWindows = instructorEvents
            .map(e => getEventBookingWindowForAlgo(e, syllabusDetails))
            .sort((a, b) => a.start - b.start);
        
        // Calculate total duty hours by merging overlapping windows
        // Include both day flying window AND night flying window for soft duty limit
        let totalDutyHours = 0;
        let currentWindow = null;
        
        for (const window of bookingWindows) {
            // Include events from both day and night flying windows
            // Day window: flyingStartTime to flyingEndTime
            // Night window: commenceNightFlying to ceaseNightFlying (if night flying is scheduled)
            let windowStart = window.start;
            let windowEnd = window.end;
            
            // Include day flying window
            const dayStart = Math.max(windowStart, flyingStartTime);
            const dayEnd = Math.min(windowEnd, flyingEndTime);
            
            // Include night flying window (if applicable)
            let nightStart = 0;
            let nightEnd = 0;
            if (nextEventLists.bnf.length >= 2) { // Night flying is scheduled
                nightStart = Math.max(windowStart, commenceNightFlying);
                nightEnd = Math.min(windowEnd, ceaseNightFlying);
            }
            
            // Process day window portion
            if (dayStart < dayEnd) {
                if (!currentWindow) {
                    currentWindow = { start: dayStart, end: dayEnd };
                } else if (dayStart <= currentWindow.end) {
                    currentWindow.end = Math.max(currentWindow.end, dayEnd);
                } else {
                    totalDutyHours += currentWindow.end - currentWindow.start;
                    currentWindow = { start: dayStart, end: dayEnd };
                }
            }
            
            // Process night window portion (if night flying is scheduled)
            if (nightStart < nightEnd && nextEventLists.bnf.length >= 2) {
                if (!currentWindow) {
                    currentWindow = { start: nightStart, end: nightEnd };
                } else if (nightStart <= currentWindow.end) {
                    currentWindow.end = Math.max(currentWindow.end, nightEnd);
                } else {
                    totalDutyHours += currentWindow.end - currentWindow.start;
                    currentWindow = { start: nightStart, end: nightEnd };
                }
            }
        }
        
        // Add the last window
        if (currentWindow) {
            totalDutyHours += currentWindow.end - currentWindow.start;
        }
        
        return totalDutyHours;
    };

    // Check if a person (staff or trainee) is scheduled for ANY night events (flights, FTD, CPT, ground, Duty Sup)
    const isPersonScheduledForNightEvents = (personName: string): boolean => {
        if (nextEventLists.bnf.length < 2) return false; // No night flying scheduled
        
        const personEvents = generatedEvents.filter(e => getPersonnel(e).includes(personName));
        return personEvents.some(e => {
            const bookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
            return bookingWindow.start >= commenceNightFlying && bookingWindow.start < ceaseNightFlying;
        });
    };

    setProgress({ message: 'Initializing DFP build...', percentage: 0 });

    let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [];
    const eventCounts = new Map<string, { flightFtd: number, ground: number, cpt: number, dutySup: number, isStby: boolean }>();
    originalInstructors.forEach(i => eventCounts.set(i.name, { flightFtd: 0, ground: 0, cpt: 0, dutySup: 0, isStby: false }));
    trainees.forEach(t => eventCounts.set(t.fullName, { flightFtd: 0, ground: 0, cpt: 0, dutySup: 0, isStby: false }));
    
    highestPriorityEvents.forEach(event => {
        if(event.date === buildDate && event.isTimeFixed) {
            const { date, ...eventWithoutDate } = event;
            generatedEvents.push(eventWithoutDate);
            getPersonnel(event).forEach(personName => {
                const counts = eventCounts.get(personName);
                if (counts && (event.type === 'flight' || event.type === 'ftd')) { counts.flightFtd++; } 
                else if (counts && event.type === 'ground') { counts.ground++; }
                else if (counts && event.type === 'cpt') { counts.cpt++; }
            });
        }
    });

    setProgress({ message: 'Compiling "Next Event" lists...', percentage: 10 });
    
    const activeTrainees = trainees.filter(t => 
        !t.isPaused && 
        !isPersonStaticallyUnavailable(t, flyingStartTime, ceaseNightFlying, buildDate, 'flight')
    );
    
    const traineeNextEventMap = new Map<string, { next: SyllabusItemDetail | null, plusOne: SyllabusItemDetail | null }>();

    activeTrainees.forEach(trainee => {
        const nextEvents = computeNextEventsForTrainee(trainee, traineeLMPs, scores, syllabusDetails);
        traineeNextEventMap.set(trainee.fullName, nextEvents);
    });

    const nextEventLists = { flight: [] as Trainee[], ftd: [] as Trainee[], cpt: [] as Trainee[], ground: [] as Trainee[], bnf: [] as Trainee[] };
    const nextPlusOneLists = { flight: [] as Trainee[], ftd: [] as Trainee[], cpt: [] as Trainee[], ground: [] as Trainee[] };
    
    activeTrainees.forEach(trainee => {
        const { next, plusOne } = traineeNextEventMap.get(trainee.fullName) || { next: null, plusOne: null };
        if (next) {

            if (next.code.startsWith('BNF') && next.type === 'Flight') {
                nextEventLists.bnf.push(trainee);
            } else if (next.type === 'Flight') {
                nextEventLists.flight.push(trainee);
            } else if (next.type === 'FTD') {
                nextEventLists.ftd.push(trainee);
            } else if (next.type === 'Ground School' && next.methodOfDelivery.includes('CPT')) {
                nextEventLists.cpt.push(trainee);
            } else if (next.type === 'Ground School') {
                   nextEventLists.ground.push(trainee);
               }
               
               // Handle plusOne separately
               if (plusOne) {
                   if (plusOne.type === 'Flight') nextPlusOneLists.flight.push(trainee);
                   else if (plusOne.type === 'FTD') nextPlusOneLists.ftd.push(trainee);
                   else if (plusOne.type === 'Ground School' && plusOne.methodOfDelivery.includes('CPT')) nextPlusOneLists.cpt.push(trainee);
                   else if (plusOne.type === 'Ground School') nextPlusOneLists.ground.push(trainee);
                  }
        }
    });
    
    const nightFlyingTraineeNames = new Set(nextEventLists.bnf.map(t => t.fullName));

    setProgress({ message: 'Ranking trainees...', percentage: 20 });
    const getMedianProgress = (courseName: string): number => {
        const courseTrainees = activeTrainees.filter(t => t.course === courseName);
        if (courseTrainees.length === 0) return 0;
        const progressCounts = courseTrainees.map(t => (scores.get(t.fullName) || []).filter(s => !s.event.includes("-REM-") && !s.event.includes("-RF")).length).sort((a,b) => a-b);
        const mid = Math.floor(progressCounts.length / 2);
        return progressCounts.length % 2 !== 0 ? progressCounts[mid] : (progressCounts[mid - 1] + progressCounts[mid]) / 2;
    };
    const courseMedians = new Map<string, number>();
    coursePriorities.forEach(c => courseMedians.set(c, getMedianProgress(c)));

    const today = new Date(buildDate + 'T00:00:00Z');
    const daysSince = (dateStr?: string): number => {
        if (!dateStr) return 999;
        const eventDate = new Date(dateStr + 'T00:00:00Z');
        return Math.floor((today.getTime() - eventDate.getTime()) / (1000 * 3600 * 24));
    };

    const sortTrainees = (a: Trainee, b: Trainee): number => {
        const daysSinceA = daysSince(a.lastEventDate);
        const daysSinceB = daysSince(b.lastEventDate);
        if (daysSinceA !== daysSinceB) return daysSinceB - daysSinceA;

        const daysSinceFlightA = daysSince(a.lastFlightDate);
        const daysSinceFlightB = daysSince(b.lastFlightDate);
        if (daysSinceFlightA !== daysSinceFlightB) return daysSinceFlightB - daysSinceFlightA;

        const medianA = courseMedians.get(a.course) || 0;
        const medianB = courseMedians.get(b.course) || 0;
        const progressA = (scores.get(a.fullName) || []).filter(s => !s.event.includes("-REM-") && !s.event.includes("-RF")).length;
        const progressB = (scores.get(b.fullName) || []).filter(s => !s.event.includes("-REM-") && !s.event.includes("-RF")).length;
        const behindA = medianA - progressA;
        const behindB = medianB - progressB;
        if (behindA !== behindB) return behindB - behindA;

        return a.name.localeCompare(b.name);
    };

    Object.values(nextEventLists).forEach(list => list.sort(sortTrainees));
    Object.values(nextPlusOneLists).forEach(list => list.sort(sortTrainees));

    setProgress({ message: 'Allocating course slots...', percentage: 30 });
    const applyCoursePriority = (rankedList: Trainee[]): Trainee[] => {
        if (!rankedList.length) return [];
        const listByCourse = new Map<string, Trainee[]>();
        coursePriorities.forEach(c => listByCourse.set(c, []));
        rankedList.forEach(t => listByCourse.get(t.course)?.push(t));

        const finalTrainees: Trainee[] = [];
        let totalTrainees = rankedList.length;

        while(totalTrainees > 0) {
            for(const course of coursePriorities) {
                const courseTrainees = listByCourse.get(course);
                if(courseTrainees && courseTrainees.length > 0) {
                    finalTrainees.push(courseTrainees.shift()!);
                    totalTrainees--;
                }
            }
        }
        return finalTrainees;
    };
    
    // NEW RULE: Filter out BNF trainees from day event lists (complete separation)
    const bnfTraineeNames = new Set(nextEventLists.bnf.map(t => t.fullName));
    const filterOutBnfTrainees = (list: Trainee[]) => 
        nextEventLists.bnf.length >= 2 ? list.filter(t => !bnfTraineeNames.has(t.fullName)) : list;

    const buildOrder: { list: Trainee[]; type: 'flight' | 'ftd' | 'cpt' | 'ground'; isPlusOne: boolean }[] = [
        { list: applyCoursePriority(filterOutBnfTrainees(nextEventLists.flight)), type: 'flight', isPlusOne: false },
        { list: applyCoursePriority(filterOutBnfTrainees(nextPlusOneLists.flight)), type: 'flight', isPlusOne: true },
        { list: applyCoursePriority(filterOutBnfTrainees(nextEventLists.ftd)), type: 'ftd', isPlusOne: false },
        { list: applyCoursePriority(filterOutBnfTrainees(nextPlusOneLists.ftd)), type: 'ftd', isPlusOne: true },
        { list: applyCoursePriority(filterOutBnfTrainees(nextEventLists.cpt)), type: 'cpt', isPlusOne: false },
        { list: applyCoursePriority(filterOutBnfTrainees(nextPlusOneLists.cpt)), type: 'cpt', isPlusOne: true },
        { list: applyCoursePriority(filterOutBnfTrainees(nextEventLists.ground)), type: 'ground', isPlusOne: false },
        { list: applyCoursePriority(filterOutBnfTrainees(nextPlusOneLists.ground)), type: 'ground', isPlusOne: true },
    ];
    
    const nightPairings = new Map<string, string>();
    let instructors = [...originalInstructors.map(i => ({...i, unavailability: [...(i.unavailability || [])]}))]; 

    // NEW LOGIC: If there are 2+ trainees waiting for night flying, then night flying is programmed
    if (nextEventLists.bnf.length >= 2) {
        const bnfTraineeCount = nextEventLists.bnf.length;
        const instructorsNeeded = bnfTraineeCount;

        const nightDutyStartTime = commenceNightFlying;
        const nightDutyEndTime = ceaseNightFlying;
        const nightEligiblePool = originalInstructors.filter(ip => 
            ip.role === 'QFI' && !isPersonStaticallyUnavailable(ip, nightDutyStartTime, nightDutyEndTime, buildDate, 'flight')
        );
        
        const nightFlyingInstructors = [...nightEligiblePool].sort(() => 0.5 - Math.random()).slice(0, instructorsNeeded);
        const bnfTrainees = nextEventLists.bnf;
        
        nightFlyingInstructors.forEach((nfi, index) => {
            const trainee = bnfTrainees[index];
            if (trainee) {
                nightPairings.set(trainee.fullName, nfi.name);

                const instructorToUpdate = instructors.find(i => i.idNumber === nfi.idNumber);
                if (instructorToUpdate) {
                    const reservationPeriod: UnavailabilityPeriod = {
                        id: `night-res-${nfi.idNumber}`,
                        startDate: buildDate,
                        endDate: buildDate,
                        allDay: false,
                        startTime: formatDecimalHourToString(flyingStartTime),
                        endTime: formatDecimalHourToString(flyingEndTime),
                        reason: 'Other',
                        notes: 'Reserved for Night Flying'
                    };
                    instructorToUpdate.unavailability.push(reservationPeriod);
                }
            }
        });
    }


    const scheduleList = (
        list: Trainee[],
        type: 'flight' | 'ftd' | 'cpt' | 'ground',
        isPlusOne: boolean,
        startTimeBoundary: number,
        endTimeBoundary: number,
        standbyPrefix: string | null,
        isNightPass: boolean
    ) => {
        const timeIncrement = type === 'flight' ? 5 / 60 : 15 / 60;
        const listName = `${isNightPass ? 'BNF' : type.toUpperCase()} ${isPlusOne ? 'Next+1' : 'Next'}`;
        setProgress({ message: `Placing ${listName} events...`, percentage: 40 + (['flight', 'ftd', 'cpt', 'ground'].indexOf(type) * 10) });
        
        let unplacedTrainees = [...list];
        let placedThisPass = true;

        const segments: { start: number, end: number, count: number }[] = [];
        if ((type === 'cpt' || type === 'ground') && !isNightPass) {
            const segmentDuration = 2;
            for (let t = startTimeBoundary; t < endTimeBoundary; t += segmentDuration) {
                segments.push({ start: t, end: t + segmentDuration, count: 0 });
            }
        }

        while(placedThisPass && unplacedTrainees.length > 0) {
            placedThisPass = false;
            const remainingForNextPass: Trainee[] = [];

            for (const trainee of unplacedTrainees) {
                const { next, plusOne } = traineeNextEventMap.get(trainee.fullName)!;
                const syllabusItem = isPlusOne ? plusOne : next;
                if (!syllabusItem) { continue; }

                let searchStartTime = startTimeBoundary;
                
                if (isPlusOne) { 
                    const nextEvent = generatedEvents.find(e => getPersonnel(e).includes(trainee.fullName) && e.flightNumber === next!.id);
                    if (!nextEvent) { 
                        remainingForNextPass.push(trainee);
                        continue; 
                    }
                    searchStartTime = Math.max(startTimeBoundary, nextEvent.startTime + nextEvent.duration);
                }

                const segmentSearchOrder = [...segments].sort((a, b) => a.count - b.count || a.start - b.start);
                let placed = false;
                const searchSpaces = (type === 'cpt' || type === 'ground') && !isNightPass && segments.length > 0 
                    ? segmentSearchOrder.map(s => ({ start: Math.max(searchStartTime, s.start), end: s.end }))
                    : [{ start: searchStartTime, end: endTimeBoundary }];

                for (const space of searchSpaces) {
                    if (placed) break;
                    for (let time = space.start; time <= space.end - syllabusItem.duration; time += timeIncrement) {
                        const result = scheduleEvent(trainee, syllabusItem, time, type, isNightPass, isPlusOne);
                        if (result && result !== 'stby') {
                            generatedEvents.push(result);
                            const ipCounts = eventCounts.get(result.instructor!)!;
                            const tCounts = eventCounts.get(trainee.fullName)!;
                            if (type === 'flight' || type === 'ftd') { 
                                tCounts.flightFtd++; 
                                ipCounts.flightFtd++; 
                            } else if (type === 'ground') { 
                                tCounts.ground++; 
                                ipCounts.ground++; // Count ground events for instructors
                            } else if (type === 'cpt') {
                                tCounts.cpt++; 
                                ipCounts.cpt++; // Count CPT events for instructors
                            }
                            
                            if (type === 'cpt' || type === 'ground') {
                                const segment = segments.find(s => time >= s.start && time < s.end);
                                if (segment) segment.count++;
                            }

                            placed = true;
                            placedThisPass = true;
                            break;
                        }
                    }
                }

                if (!placed) { remainingForNextPass.push(trainee); }
            }
            unplacedTrainees = remainingForNextPass;
        }

        if (standbyPrefix && (type === 'flight' || type === 'ftd')) {
            unplacedTrainees.forEach((trainee, index) => {
                const traineeCounts = eventCounts.get(trainee.fullName)!;
                if (traineeCounts.flightFtd > 0 || traineeCounts.isStby) return;

                const { next, plusOne } = traineeNextEventMap.get(trainee.fullName)!;
                const syllabusItem = isPlusOne ? plusOne : next;
                if (!syllabusItem) return;

                const result = scheduleEvent(trainee, syllabusItem, startTimeBoundary, type, isNightPass, isPlusOne);
                if (result === 'stby') {
                    const stbyResourceId = `${standbyPrefix} ${generatedEvents.filter(e=>e.resourceId.startsWith(standbyPrefix)).length + 1}`;
                     generatedEvents.push({
                        id: uuidv4(), type: type, instructor: 'TBD', student: trainee.fullName,
                        flightNumber: syllabusItem.id, duration: syllabusItem.duration, startTime: startTimeBoundary, resourceId: stbyResourceId,
                        color: standbyPrefix === 'STBY' ? 'bg-yellow-500/50' : 'bg-blue-800/70',
                        flightType: 'Dual', locationType: 'Local', origin: school, destination: school,
                        authNotes: `P${index + 1}`
                     });
                     traineeCounts.isStby = true;
                }
            });
        }
    };
    
    const scheduleEvent = (
        trainee: Trainee,
        syllabusItem: SyllabusItemDetail,
        startTime: number,
        type: 'flight' | 'ftd' | 'ground' | 'cpt',
        isNightPass: boolean,
        isPlusOne: boolean
    ): Omit<ScheduleEvent, 'date'> | 'stby' | null => {
        
        const traineeCounts = eventCounts.get(trainee.fullName)!;
        
        // CRITICAL FIX: For night flying BNF events, allow 2 flights per night
        const isBnfEvent = syllabusItem.code.startsWith('BNF') && syllabusItem.type === 'Flight';
        const bnfFlightLimit = isBnfEvent ? 2 : eventLimits.trainee.maxFlightFtd;
        
        if (type === 'flight' || type === 'ftd') {
             if (traineeCounts.flightFtd >= bnfFlightLimit) return null;
        } else {
             if (traineeCounts.ground >= 2) return null;
        }
        
        // Also check total event count for trainees (Flight + FTD + CPT + Ground = max 3 events for staff)
        // For BNF events, allow higher total limit to accommodate 2 night flights
        const bnfTotalLimit = isBnfEvent ? 4 : eventLimits.trainee.maxTotal;
        if ((traineeCounts.flightFtd + traineeCounts.ground + traineeCounts.cpt) >= bnfTotalLimit) return null;
        
        const proposedBookingWindow = getEventBookingWindowForAlgo({ startTime, flightNumber: syllabusItem.id, duration: syllabusItem.duration }, syllabusDetails);
        if (isPersonStaticallyUnavailable(trainee, proposedBookingWindow.start, proposedBookingWindow.end, buildDate, type)) return null;

        const findAvailableInstructor = (
            traineeForCheck: Trainee, 
            syllabusItemForCheck: SyllabusItemDetail,
            isPlusOneCheck: boolean
        ): Instructor | null => {
            const isBnfEvent = syllabusItemForCheck.code.startsWith('BNF');
            
            if (isBnfEvent) {
                const pairedInstructorName = nightPairings.get(traineeForCheck.fullName);
                if (!pairedInstructorName) return null;
                
                const instructor = instructors.find(i => i.name === pairedInstructorName);
                if (!instructor) return null;

                if (isPersonStaticallyUnavailable(instructor, proposedBookingWindow.start, proposedBookingWindow.end, buildDate, 'flight')) return null;

                const ipCounts = eventCounts.get(instructor.name)!;
                const execLimit = eventLimits.exec.maxFlightFtd;
                const flightFtdLimit = eventLimits.instructor.maxFlightFtd;
                const totalEventLimit = eventLimits.instructor.maxTotal;

                // CRITICAL FIX: Check soft duty limit BEFORE any other checks
                const proposedEvent = {
                    ...proposedBookingWindow,
                    instructor: instructor.name,
                    flightNumber: syllabusItemForCheck.id,
                    type: syllabusItemForCheck.type
                };
                const currentDutyHours = calculateInstructorDutyHours(instructor.name, proposedEvent);
                
                if (currentDutyHours > preferredDutyPeriod) {
                    console.log(`SOFT LIMIT VIOLATION: ${instructor.name} would exceed ${preferredDutyPeriod}hrs (current: ${currentDutyHours.toFixed(2)}hrs)`);
                    return null;
                }

                if (instructor.isExecutive) {
                    if (isNightPass) {
                        // For night pass, execs can fly up to the total event limit
                        if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt) >= totalEventLimit) return null;
                    } else {
                        // For day pass, execs have a stricter flight/FTD limit
                        if (ipCounts.flightFtd >= execLimit) return null;
                    }
                } else {
                     // NEW ALGORITHM: Duty Supervisor counts toward total event limits
                     if (ipCounts.flightFtd >= flightFtdLimit) return null;
                     // Check total event limit including Duty Supervisor (Flight + FTD + CPT + Ground + Duty Sup = max 3)
                     if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt + ipCounts.dutySup) >= totalEventLimit) return null;
                     // Check Flying Supervisor duty limit (included in total events)
                     if (instructor.isFlyingSupervisor && ipCounts.dutySup >= eventLimits.instructor.maxDutySup) return null;
                }
                
                const hasOverlap = generatedEvents
                     .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
                     .some(e => {
                         if (!getPersonnel(e).includes(instructor.name)) return false;
                         const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
                         return proposedBookingWindow.start < existingBookingWindow.end && proposedBookingWindow.end > existingBookingWindow.start;
                     });
                if (hasOverlap) return null;

                // Special check for second night flight turnaround for the same crew
                if (isNightPass && isPlusOneCheck) {
                    const { next } = traineeNextEventMap.get(traineeForCheck.fullName)!;
                    const firstNightEvent = generatedEvents.find(e => 
                        e.flightNumber === next?.id && 
                        getPersonnel(e).includes(traineeForCheck.fullName) && 
                        getPersonnel(e).includes(instructor.name)
                    );

                    if (firstNightEvent) {
                        const firstSyllabus = syllabusDetails.find(s => s.id === firstNightEvent.flightNumber);
                        const secondSyllabus = syllabusItemForCheck;
                        
                        // This is the special crew turnaround time
                        const crewTurnaround = (firstSyllabus?.postFlightTime || 0) + (secondSyllabus.preFlightTime || 0);
                        
                        // The earliest the INSTRUCTOR is available is after their first debrief
                        const earliestBriefStartTimeForInstructor = firstNightEvent.startTime + firstNightEvent.duration + (firstSyllabus?.postFlightTime || 0);
                        
                        // The proposed start time is for the flight itself. We need to check the brief starts after the required debrief ends.
                        const proposedBriefStartTime = startTime - (syllabusItemForCheck.preFlightTime || 0);

                        if (proposedBriefStartTime < earliestBriefStartTimeForInstructor) {
                            return null; // Instructor is not available yet due to crew turnaround
                        }
                    }
                }

                return instructor;
            }

            let candidates: Instructor[] = [];

            if (type === 'ftd') {
                // NEW RULE: COMPLETE separation - NO day events for instructors with night events
                const simIps = instructors
                    .filter(i => 
                        i.role === 'SIM IP' && 
                        !(nextEventLists.bnf.length >= 2 && isPersonScheduledForNightEvents(i.name))
                    )
                    .sort((a, b) => (eventCounts.get(a.name)?.flightFtd || 0) - (eventCounts.get(b.name)?.flightFtd || 0));
                
                // NEW RULE: COMPLETE separation - NO day events for instructors with night events
                const availableQfis = instructors.filter(i => 
                    i.role === 'QFI' && 
                    !(nextEventLists.bnf.length >= 2 && isPersonScheduledForNightEvents(i.name))
                );
                let orderedQfis: Instructor[] = [];
                
                if (programWithPrimaries) {
                    const pNames = [traineeForCheck.primaryInstructor, traineeForCheck.secondaryInstructor].filter(Boolean);
                    const primaries = availableQfis.filter(i => pNames.includes(i.name));
                    const others = availableQfis.filter(i => !pNames.includes(i.name));
                    
                    primaries.sort((a, b) => (eventCounts.get(a.name)?.flightFtd || 0) - (eventCounts.get(b.name)?.flightFtd || 0));
                    others.sort((a, b) => (eventCounts.get(a.name)?.flightFtd || 0) - (eventCounts.get(b.name)?.flightFtd || 0));
                    
                    orderedQfis = [...primaries, ...others];
                } else {
                    orderedQfis = availableQfis.sort((a, b) => (eventCounts.get(a.name)?.flightFtd || 0) - (eventCounts.get(b.name)?.flightFtd || 0));
                }
                
                candidates = [...simIps, ...orderedQfis];
            } else {
                const qualified = instructors.filter(ip => {
                    const isQFI = ip.role === 'QFI';
                    if (type === 'flight' && !isQFI) return false;
                    if (type === 'ground' || type === 'cpt') return true; 
                    // NEW RULE: COMPLETE separation - NO day events for instructors with night events
                    if (nextEventLists.bnf.length >= 2 && isPersonScheduledForNightEvents(ip.name)) return false;
                    return true;
                });

                if (programWithPrimaries) {
                     const pNames = [traineeForCheck.primaryInstructor, traineeForCheck.secondaryInstructor].filter(Boolean);
                     const primaries = qualified.filter(i => pNames.includes(i.name));
                     const others = qualified.filter(i => !pNames.includes(i.name));
                     
                     others.sort((a, b) => {
                        const countA = eventCounts.get(a.name)?.flightFtd || 0;
                        const countB = eventCounts.get(b.name)?.flightFtd || 0;
                        if (countA !== countB) return countA - countB;
                        return a.name.localeCompare(b.name);
                     });
                     
                     candidates = [...primaries, ...others];
                } else {
                    candidates = qualified.sort((a, b) => {
                        const countA = eventCounts.get(a.name)?.flightFtd || 0;
                        const countB = eventCounts.get(b.name)?.flightFtd || 0;
                        if (countA !== countB) return countA - countB;
                        return a.name.localeCompare(b.name);
                    });
                }
            }

            for (const ip of candidates) {
                const eventTypeForCheck = type === 'cpt' ? 'ground' : type;
                if (isPersonStaticallyUnavailable(ip, proposedBookingWindow.start, proposedBookingWindow.end, buildDate, eventTypeForCheck)) continue;
                
                const ipCounts = eventCounts.get(ip.name)!;
                
                // CRITICAL FIX: Check soft duty limit for all instructor assignments
                const proposedEvent = {
                    ...proposedBookingWindow,
                    instructor: ip.name,
                    flightNumber: syllabusItemForCheck.id,
                    type: syllabusItemForCheck.type
                };
                const currentDutyHours = calculateInstructorDutyHours(ip.name, proposedEvent);
                
                if (currentDutyHours > preferredDutyPeriod) {
                    console.log(`SOFT LIMIT VIOLATION: ${ip.name} would exceed ${preferredDutyPeriod}hrs (current: ${currentDutyHours.toFixed(2)}hrs)`);
                    continue;
                }
                
                // NEW RULE: Ground event limits based on Flight/FTD activity
                // If instructor has Flight or FTD events: max 1 ground event
                // If instructor has no Flight or FTD events: max 4 ground events
                if (eventTypeForCheck === 'ground') {
                    const maxGroundEvents = ipCounts.flightFtd > 0 ? 1 : 4;
                    if (ipCounts.ground >= maxGroundEvents) continue;
                }
                
                if (ip.isExecutive) {
                    if (isNightPass && (eventTypeForCheck === 'flight' || eventTypeForCheck === 'ftd')) {
                        if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt) >= eventLimits.exec.maxTotal) continue;
                    } else {
                        if ((eventTypeForCheck === 'flight' || eventTypeForCheck === 'ftd') && ipCounts.flightFtd >= eventLimits.exec.maxFlightFtd) continue;
                    }
                    if (ipCounts.flightFtd + ipCounts.dutySup >= eventLimits.exec.maxDutySup) continue;
                    if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt + ipCounts.dutySup) >= eventLimits.exec.maxTotal) continue;
                } else if (ip.role === 'SIM IP') {
                    if ((eventTypeForCheck === 'flight' || eventTypeForCheck === 'ftd') && ipCounts.flightFtd >= eventLimits.simIp.maxFtd) continue;
                    if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt) >= eventLimits.simIp.maxTotal) continue;
                } else {
                    if ((eventTypeForCheck === 'flight' || eventTypeForCheck === 'ftd') && ipCounts.flightFtd >= eventLimits.instructor.maxFlightFtd) continue;
                    if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt + ipCounts.dutySup) >= eventLimits.instructor.maxTotal) continue;
                    // Check duty supervisor limit for Flying Supervisors (included in total events)
                    if (ip.isFlyingSupervisor && ipCounts.dutySup >= eventLimits.instructor.maxDutySup) continue;
                }

                const hasOverlap = generatedEvents
                     .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
                     .some(e => {
                         if (!getPersonnel(e).includes(ip.name)) return false;
                         const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
                         return proposedBookingWindow.start < existingBookingWindow.end && proposedBookingWindow.end > existingBookingWindow.start;
                     });
                if (hasOverlap) continue;

                const proposedEvents = [...generatedEvents, { startTime, duration: syllabusItem.duration, flightNumber: syllabusItem.id, instructor: ip.name, type } as Omit<ScheduleEvent, 'date'>];
                const ipEvents = proposedEvents.filter(e => getPersonnel(e).includes(ip.name) && (e.type === 'flight' || e.type === 'ftd' || e.flightNumber.includes('Duty Sup')));
                if (ipEvents.length > 0) {
                    const sortedIpEvents = ipEvents.sort((a, b) => a.startTime - b.startTime);
                    const firstEvent = sortedIpEvents[0];
                    const lastEvent = sortedIpEvents[sortedIpEvents.length - 1];
                    const firstEventSyllabus = syllabusDetails.find(s => s.id === firstEvent.flightNumber);
                    const lastEventSyllabus = syllabusDetails.find(s => s.id === lastEvent.flightNumber);
                    const dutyStartTime = firstEvent.startTime - (firstEventSyllabus?.preFlightTime || 0);
                    const dutyEndTime = lastEvent.startTime + lastEvent.duration + (lastEventSyllabus?.postFlightTime || 0);
                    if ((dutyEndTime - dutyStartTime) > maxCrewDutyPeriod) continue;
                }

                return ip;
            }
            return null;
        };
        
        const instructor = findAvailableInstructor(trainee, syllabusItem, isPlusOne);
        if (!instructor) return null;
        
        let resourceId: string | null = null;
        const resourcePrefix = type === 'flight' ? 'PC-21 ' : type === 'ftd' ? 'FTD ' : type === 'cpt' ? 'CPT ' : 'Ground ';
        const resourceCount = type === 'flight' ? availableAircraftCount : type === 'ftd' ? ftdCount : type === 'cpt' ? 4 : 6;
        
        for (let i = 1; i <= resourceCount; i++) {
            const id = `${resourcePrefix}${i}`;
            const resourceIsOccupied = generatedEvents.some(e => {
                if (e.resourceId !== id) return false;
                
                let turnaround = 0;
                if (e.type === 'flight') {
                    const isExistingEventNight = e.flightNumber.startsWith('BNF');
                    if (isNightPass && isExistingEventNight) {
                        const currentCrew = [instructor.name, trainee.fullName];
                        const existingCrew = getPersonnel(e);
                        const hasCommonCrew = currentCrew.some(p => p && existingCrew.includes(p));
                        
                        if (hasCommonCrew) {
                            const existingSyllabus = syllabusDetails.find(s => s.id === e.flightNumber);
                            turnaround = (existingSyllabus?.postFlightTime || 0) + (syllabusItem.preFlightTime || 0);
                        } else {
                            turnaround = flightTurnaround;
                        }
                    } else {
                        turnaround = flightTurnaround;
                    }
                } else if (e.type === 'ftd') {
                    turnaround = ftdTurnaround;
                } else if (e.type === 'cpt' || (e.type === 'ground' && e.flightNumber.includes('CPT'))) {
                    turnaround = cptTurnaround;
                }
                
                const existingEventEnd = e.startTime + e.duration + turnaround;
                const newEventStart = startTime;
                return newEventStart < existingEventEnd && (startTime + syllabusItem.duration) > e.startTime;
            });
            if (!resourceIsOccupied) { resourceId = id; break; }
        }
        
        let area: string | undefined = undefined;
        if (type === 'flight') {
            const isBnf = syllabusItem.code.startsWith('BNF');
            const endTimeBoundary = isBnf ? ceaseNightFlying : flyingEndTime;
            if (startTime < (isBnf ? commenceNightFlying : flyingStartTime) || startTime + syllabusItem.duration > endTimeBoundary) return null;
            
            area = findAvailableArea(startTime, syllabusItem.duration, generatedEvents);
            if (!area) return null;

            const nonStbyFlights = generatedEvents.filter(e => 
                !e.resourceId.startsWith('STBY') && 
                !e.resourceId.startsWith('BNF-STBY')
            );
            
            const takeoffsInLastHour = nonStbyFlights.filter(e => e.type === 'flight' && e.startTime > startTime - 1 && e.startTime <= startTime).length;
            if (takeoffsInLastHour >= 8) return null;
            
            const takeoffConflict = nonStbyFlights.some(e => {
                if (e.type !== 'flight') return false;
                const diffHours = Math.abs(e.startTime - startTime);
                const diffMinutes = Math.round(diffHours * 60);
                
                const isNightCheck = isNightPass && e.flightNumber.startsWith('BNF');
                const minSeparation = isNightCheck ? 5 : 5; // Currently 5 for both, can be adjusted.
                
                return diffMinutes < minSeparation;
            });
            if(takeoffConflict) return null;
        }

        if ((type === 'flight' || type === 'ftd') && !resourceId) return 'stby';
        if (!resourceId) return null;
        
        return {
            id: uuidv4(), type: type, instructor: instructor.name, student: trainee.fullName,
            flightNumber: syllabusItem.id, duration: syllabusItem.duration, startTime, resourceId,
            color: courseColors[trainee.course] || 'bg-gray-500',
            flightType: 'Dual', locationType: 'Local', origin: school, destination: school, 
            area, preStart: syllabusItem.preFlightTime, postEnd: syllabusItem.postFlightTime,
        };
    };

    // NEW ALGORITHM: Schedule Duty Supervisors FIRST, before any other events
    setProgress({ message: 'Scheduling Duty Supervisors...', percentage: 40 });
    
    // Duty Supervisor MUST cover entire Day flying window regardless of flight schedule
    const dayFlights = generatedEvents.filter(e => e.type === 'flight' && !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'));
    
    // Duty Supervisor covers entire configured day flying window
    const dutySupStartTime = flyingStartTime;
    const dutySupEndTime = flyingEndTime;
    
    // Always schedule Duty Supervisor for day window, even if no flights
    if (dutySupStartTime >= dutySupEndTime) {
        setProgress({ message: 'Invalid day flying window', percentage: 90 });
        // Continue to night flying setup even if day window is invalid
    }
    
    const lastFlightEndTime = dutySupEndTime;
    
    // NEW RULE: COMPLETE separation - NO day events for instructors with night events
    const dutySupEligible = instructors.filter(i => 
        (i.isFlyingSupervisor || i.unavailability.some(u => u.reason === 'TMUF - Ground Duties only' && buildDate >= u.startDate && buildDate < u.endDate)) &&
        !(nextEventLists.bnf.length >= 2 && isPersonScheduledForNightEvents(i.name))
    );
    const tmuffSupervisors = dutySupEligible.filter(i => i.unavailability.some(u => u.reason === 'TMUF - Ground Duties only' && buildDate >= u.startDate && buildDate < u.endDate));
    const normalSupervisors = dutySupEligible.filter(i => !tmuffSupervisors.find(t => t.idNumber === i.idNumber));
    
    // NEW ALGORITHM: Randomize supervisor selection instead of alphabetical/order-based
    const shuffledNormalSupervisors = [...normalSupervisors].sort(() => 0.5 - Math.random());
    const sortedSupervisors = [...tmuffSupervisors, ...shuffledNormalSupervisors];

    let currentSupTime = dutySupStartTime;
    // CRITICAL FIX: Schedule Duty Supervisors for the ENTIRE day window, not just when flights are active
    console.log(`Duty Supervisor Allocation - Covering entire day window: ${dutySupStartTime} to ${dutySupEndTime}`);
    while (currentSupTime < dutySupEndTime) {
        const isBlockCovered = generatedEvents.some(e => e.resourceId === 'Duty Sup' && currentSupTime >= e.startTime && currentSupTime < e.startTime + e.duration);
        if (isBlockCovered) {
            currentSupTime += 0.5;
            continue;
        }

        let bestSupervisor: Instructor | null = null;
        let maxDuration = 0;

        // NEW RULE: Prefer supervisors with 0 duty sup events, only use those with 1+ if no one else available
        const supervisorsWithNoDutySup = sortedSupervisors.filter(s => eventCounts.get(s.name)!.dutySup === 0);
        const supervisorsWithDutySup = sortedSupervisors.filter(s => eventCounts.get(s.name)!.dutySup > 0);
        const prioritizedSupervisors = [...supervisorsWithNoDutySup, ...supervisorsWithDutySup];

        for (const sup of prioritizedSupervisors) {
            const ipCounts = eventCounts.get(sup.name)!;
            const eventLimit = sup.isExecutive ? eventLimits.exec.maxFlightFtd + eventLimits.exec.maxDutySup : eventLimits.instructor.maxTotal;
            const dutySupEventCount = sup.isExecutive ? eventLimits.exec.maxDutySup : eventLimits.instructor.maxDutySup;
            const totalEventCount = sup.isExecutive ? eventLimits.exec.maxTotal : eventLimits.instructor.maxTotal;

            // NEW ALGORITHM: Duty Supervisor counts toward total event limits (max 3)
            if (ipCounts.dutySup >= dutySupEventCount) continue;
            if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt + ipCounts.dutySup) >= totalEventCount) continue;
            
            if (isPersonStaticallyUnavailable(sup, currentSupTime, currentSupTime + 0.1, buildDate, 'duty_sup')) continue;

            // CRITICAL FIX: Use the new helper function to calculate duty hours
            // Check soft duty limit before assigning any duty supervisor time
            const proposedDutySupEvent = {
                startTime: currentSupTime,
                duration: 2.0, // Standard 2-hour duty supervisor assignment
                flightNumber: 'Duty Sup',
                type: 'ground' as const
            };
            
            const totalDutyHours = calculateInstructorDutyHours(sup.name, proposedDutySupEvent);
            
            console.log(`Duty Sup Check - ${sup.name}: Total Duty = ${totalDutyHours.toFixed(2)}hrs, Soft Limit = ${preferredDutyPeriod}hrs`);
            
            if (totalDutyHours > preferredDutyPeriod) {
                console.log(`Skipping ${sup.name} - would exceed soft limit of ${preferredDutyPeriod}hrs`);
                continue;
            }
            
            const hasOverlapAtStart = generatedEvents
                .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
                .some(e => {
                    if (!getPersonnel(e).includes(sup.name)) return false;
                    const bookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
                    return currentSupTime < bookingWindow.end && (currentSupTime + 0.1) > bookingWindow.start;
                });
            if (hasOverlapAtStart) continue;

            let potentialDuration = 0;
            const targetDuration = 2.0;

            // CRITICAL FIX: Don't extend duty supervisor beyond day window end or soft duty limit
            for (let t = currentSupTime; t < dutySupEndTime; t += 0.25) {
                if (potentialDuration >= targetDuration) break;
                
                const proposedEnd = t + 0.25;
                if (isPersonStaticallyUnavailable(sup, t, proposedEnd, buildDate, 'duty_sup')) break;
                
                // Check if adding this additional duty time would exceed the soft limit
                const proposedDutySupEvent = {
                    startTime: currentSupTime,
                    duration: proposedEnd - currentSupTime,
                    flightNumber: 'Duty Sup',
                    type: 'ground' as const
                };
                const proposedEvents = [...generatedEvents, proposedDutySupEvent];
                
                // Calculate total duty hours for the entire day
                const instructorEventsForDay = proposedEvents.filter(e => getPersonnel(e).includes(sup.name));
                if (instructorEventsForDay.length > 0) {
                    const bookingWindows = instructorEventsForDay
                        .map(e => getEventBookingWindowForAlgo(e, syllabusDetails))
                        .sort((a, b) => a.start - b.start);
                    
                    const dayStart = bookingWindows[0].start;
                    const dayEnd = bookingWindows[bookingWindows.length - 1].end;
                    const totalDutyHours = dayEnd - dayStart;
                    
                    if (totalDutyHours > preferredDutyPeriod) {
                        // Adding more time would exceed soft limit, stop extending
                        break;
                    }
                }
                
                const hasFutureOverlap = generatedEvents
                     .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
                     .some(e => {
                         if (!getPersonnel(e).includes(sup.name)) return false;
                         const bookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
                         return t < bookingWindow.end && proposedEnd > bookingWindow.start;
                     });
                if (hasFutureOverlap) break;

                potentialDuration += 0.25;
            }

            if (potentialDuration > maxDuration) {
                maxDuration = Math.min(potentialDuration, targetDuration);
                bestSupervisor = sup;
            }
        }
        
        if (bestSupervisor && maxDuration > 0) {
            generatedEvents.push({
                id: uuidv4(), type: 'ground', instructor: bestSupervisor.name,
                flightNumber: 'Duty Sup', duration: maxDuration, startTime: currentSupTime, resourceId: 'Duty Sup',
                color: 'bg-amber-500/50', flightType: 'Dual', locationType: 'Local', origin: school, destination: school
            });
            eventCounts.get(bestSupervisor.name)!.dutySup++;
            console.log(`Duty Sup assigned: ${bestSupervisor.name} from ${currentSupTime} to ${currentSupTime + maxDuration}`);
            currentSupTime += maxDuration;
        } else {
            // CRITICAL FIX: If no supervisor available, we MUST still fill the gap
            // This prevents gaps in duty supervisor coverage
            console.log(`WARNING: No Duty Supervisor available for ${currentSupTime} to ${currentSupTime + 0.5} - GAP in coverage!`);
            currentSupTime += 0.5;
        }
    }

    // NEW ALGORITHM: After Duty Supervisors are allocated, now schedule other events
    setProgress({ message: 'Scheduling Flight Events...', percentage: 50 });
    buildOrder.forEach(item => {
        scheduleList(item.list, item.type, item.isPlusOne, flyingStartTime, flyingEndTime, 'STBY', false);
    });
    
    setProgress({ message: 'Scheduling Ground and CPT Events...', percentage: 60 });
    // Schedule CPT and Ground events (these are in buildOrder but might need separate handling)
    // Note: buildOrder already includes CPT and Ground events
    
    // NEW LOGIC: If there are 2+ trainees waiting for night flying, then night flying is programmed
    setProgress({ message: 'Scheduling Night Flying...', percentage: 80 });
    if(nextEventLists.bnf.length >= 2) {
         const bnfWaveOneList = applyCoursePriority(nextEventLists.bnf);
         
         scheduleList(bnfWaveOneList, 'flight', false, commenceNightFlying, ceaseNightFlying, 'BNF-STBY', true);
         
         const bnfWaveTwoList = bnfWaveOneList.filter(trainee => {
            const { plusOne } = traineeNextEventMap.get(trainee.fullName) || { plusOne: null };
            return plusOne && plusOne.code.startsWith('BNF') && plusOne.type === 'Flight';
         });
         scheduleList(bnfWaveTwoList, 'flight', true, commenceNightFlying, ceaseNightFlying, 'BNF-STBY', true);
    }

    // Duty Supervisor MUST cover entire Night flying window ONLY when night flying is programmed (2+ BNF trainees)
    if (nextEventLists.bnf.length >= 2) {
        const nightFlyingInstructorNames = new Set(Array.from(nightPairings.values()));
        const nightSupPool = dutySupEligible.filter(s => !nightFlyingInstructorNames.has(s.name));
        
        // NEW ALGORITHM: Randomize night supervisor selection
        const availableNightSupervisors = nightSupPool.filter(sup => {
            return !isPersonStaticallyUnavailable(sup, commenceNightFlying, ceaseNightFlying, buildDate, 'duty_sup');
        }).sort(() => 0.5 - Math.random()); // Random selection instead of fewest assignments

        // Try to find a dedicated night supervisor first
        let nightDutySup = availableNightSupervisors.length > 0 ? availableNightSupervisors[0] : null;
        
        // If no dedicated night supervisor available, try anyone from eligible pool
        if (!nightDutySup) {
            nightDutySup = dutySupEligible.find(sup => {
                return !isPersonStaticallyUnavailable(sup, commenceNightFlying, ceaseNightFlying, buildDate, 'duty_sup');
            });
        }

        // Schedule Night Duty Sup only when night flying is programmed (2+ BNF trainees) and a supervisor is available
        if (nightDutySup) {
             generatedEvents.push({
                id: uuidv4(), type: 'ground', instructor: nightDutySup.name,
                flightNumber: 'Night Duty Sup', duration: ceaseNightFlying - commenceNightFlying, startTime: commenceNightFlying, resourceId: 'Duty Sup',
                color: 'bg-amber-700/50', flightType: 'Dual', locationType: 'Local', origin: school, destination: school
            });
            eventCounts.get(nightDutySup.name)!.dutySup++;
        }
    }
    
    setProgress({ message: 'Build complete!', percentage: 100 });
    return generatedEvents;
}


const App: React.FC = () => {
       // Default zoom level (fixed at 1 since zoom functionality was removed)
       const zoomLevel = 1;

    // Helper function to convert decimal hours to HHMM format for audit logs
    const formatTimeForAudit = (hours: number): string => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h.toString().padStart(2, '0')}${m.toString().padStart(2, '0')}`;
    };

    // Timezone offset state (in hours, e.g., +11 for AEDT)
    const [timezoneOffset, setTimezoneOffset] = useState<number>(() => {
        const saved = localStorage.getItem('timezoneOffset');
        return saved ? parseFloat(saved) : 0;
    });

    // Helper function to get local date string with timezone offset
    const getLocalDateString = (date: Date = new Date()): string => {
        // Apply timezone offset
        const offsetMs = timezoneOffset * 60 * 60 * 1000;
        const adjustedDate = new Date(date.getTime() + offsetMs);
        
        const year = adjustedDate.getUTCFullYear();
        const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [activeView, setActiveView] = useState<string>('Program Schedule');
    const [previousView, setPreviousView] = useState<string>('Program Schedule');
    const [date, setDate] = useState<string>(() => getLocalDateString());
    const [events, setEvents] = useState<ScheduleEvent[]>(ESL_DATA.events);
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
    const [isEditingDefault, setIsEditingDefault] = useState(false);
    const [highlightedField, setHighlightedField] = useState<'startTime' | 'instructor' | 'student' | null>(null);
    const [conflict, setConflict] = useState<Conflict | null>(null);
    const [showValidation, setShowValidation] = useState(true);
    const [showPrePost, setShowPrePost] = useState(true);
    const [isMagnifierEnabled, setIsMagnifierEnabled] = useState(false);
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

    // Data state
    const [school, setSchool] = useState<'ESL' | 'PEA'>('ESL');
    const [instructorsData, setInstructorsData] = useState<Instructor[]>(ESL_DATA.instructors);
    const [archivedInstructorsData, setArchivedInstructorsData] = useState<Instructor[]>([]);
    const [traineesData, setTraineesData] = useState<Trainee[]>(ESL_DATA.trainees);
    
    // Current User State (for permission checking)
    // Default to Joe Bloggs (Super Admin) - in production this would come from authentication
    const [currentUserName, setCurrentUserName] = useState<string>('Bloggs, Joe');
    const currentUser = instructorsData.find(inst => inst.name === currentUserName) || instructorsData[0];
    const [currentUserId, setCurrentUserId] = useState<number>(currentUser?.idNumber || 1);
    
    // User change handler
    const handleUserChange = (userName: string) => {
        setCurrentUserName(userName);
        const newUser = instructorsData.find(inst => inst.name === userName);
        if (newUser) {
            setCurrentUserId(newUser.idNumber);
        }
    };
    // Find the highest permission level - prioritize Super Admin, then Admin, etc.
    const getHighestPermission = (permissions?: string[]): 'Super Admin' | 'Admin' | 'Staff' | 'Trainee' | 'Ops' | 'Scheduler' | 'Course Supervisor' => {
        if (!permissions || permissions.length === 0) return 'Staff';
        if (permissions.includes('Super Admin')) return 'Super Admin';
        if (permissions.includes('Admin')) return 'Admin';
        if (permissions.includes('Scheduler')) return 'Scheduler';
        if (permissions.includes('Course Supervisor')) return 'Course Supervisor';
        if (permissions.includes('Ops')) return 'Ops';
        if (permissions.includes('Staff')) return 'Staff';
        return 'Trainee';
    };
    const currentUserPermission = getHighestPermission(currentUser?.permissions);
    const [scores, setScores] = useState<Map<string, Score[]>>(ESL_DATA.scores);
    const [pt051Assessments, setPt051Assessments] = useState<Map<string, Pt051Assessment>>(ESL_DATA.pt051Assessments);
    const [courses, setCourses] = useState<Course[]>(ESL_DATA.courses);
    const [courseColors, setCourseColors] = useState<{ [key: string]: string }>(ESL_DATA.courseColors);
    const [archivedCourses, setArchivedCourses] = useState<{ [key: string]: string }>(ESL_DATA.archivedCourses);
    const [coursePriorities, setCoursePriorities] = useState<string[]>(ESL_DATA.coursePriorities);
    const [coursePercentages, setCoursePercentages] = useState<Map<string, number>>(ESL_DATA.coursePercentages);
    const [syllabusDetails, setSyllabusDetails] = useState<SyllabusItemDetail[]>(INITIAL_SYLLABUS_DETAILS);
    const [traineeLMPs, setTraineeLMPs] = useState<Map<string, SyllabusItemDetail[]>>(ESL_DATA.traineeLMPs);
    
    // Event Limits State (Lifted from SettingsView)
    const [eventLimits, setEventLimits] = useState<EventLimits>({
        exec: { maxFlightFtd: 1, maxDutySup: 2, maxTotal: 2 },
        instructor: { maxFlightFtd: 2, maxDutySup: 31, maxTotal: 3 },
        trainee: { maxFlightFtd: 1, maxTotal: 2 },
        simIp: { maxFtd: 2, maxTotal: 2 }
    });

    // Phrase Bank State
    const [phraseBank, setPhraseBank] = useState<PhraseBank>(DEFAULT_PHRASE_BANK);

    // Published Schedules State (must be declared before buildResources)
    const [publishedSchedules, setPublishedSchedules] = useState<Record<string, ScheduleEvent[]>>({});
    
    // NDB state
    const [nextDayBuildEvents, setNextDayBuildEvents] = useState<Omit<ScheduleEvent, 'date'>[]>([]);
    const [buildDfpDate, setBuildDfpDate] = useState<string>(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return getLocalDateString(tomorrow);
    });
    const [availableAircraftCount, setAvailableAircraftCount] = useState(24);
    const [availableFtdCount, setAvailableFtdCount] = useState(school === 'ESL' ? 5 : 4);
    const [availableCptCount, setAvailableCptCount] = useState(4);
    const [flyingStartTime, setFlyingStartTime] = useState(8.0); // 08:00
    const [flyingEndTime, setFlyingEndTime] = useState(17.0); // 17:00
    const [ftdStartTime, setFtdStartTime] = useState(8.0); // 08:00
    const [ftdEndTime, setFtdEndTime] = useState(17.0); // 17:00
    const [allowNightFlying, setAllowNightFlying] = useState(false);
    const [commenceNightFlying, setCommenceNightFlying] = useState(18.5); // 18:30
    const [ceaseNightFlying, setCeaseNightFlying] = useState(23.5); // 23:30
    const [preferredDutyPeriod, setPreferredDutyPeriod] = useState(8);
    const [maxCrewDutyPeriod, setMaxCrewDutyPeriod] = useState(10);
    const [maxDispatchPerHour, setMaxDispatchPerHour] = useState(8);
    const [flightTurnaround, setFlightTurnaround] = useState(1.2);
    const [ftdTurnaround, setFtdTurnaround] = useState(0.5);
    const [cptTurnaround, setCptTurnaround] = useState(0.5);
    const [isBuildingDfp, setIsBuildingDfp] = useState(false);
    const [dfpBuildProgress, setDfpBuildProgress] = useState({ message: '', percentage: 0 });
    const [showDateWarning, setShowDateWarning] = useState(false);
    const [unavailabilityNotifications, setUnavailabilityNotifications] = useState<string[]>([]);
    const [isPriorityEventCreation, setIsPriorityEventCreation] = useState(false);
    const [highestPriorityEvents, setHighestPriorityEvents] = useState<ScheduleEvent[]>([]);
    const [programWithPrimaries, setProgramWithPrimaries] = useState(true);
    const [showNightFlyingInfo, setShowNightFlyingInfo] = useState(false);
    const [nightFlyingTraineeCount, setNightFlyingTraineeCount] = useState(0);
    const [showUnavailabilityReport, setShowUnavailabilityReport] = useState(false);

    // Oracle State
    const [isOracleMode, setIsOracleMode] = useState(false);
    const [oracleAnalysis, setOracleAnalysis] = useState<OracleAnalysisResult | null>(null);
    const [oraclePreviewEvent, setOraclePreviewEvent] = useState<ScheduleEvent | null>(null);
    const [oracleContextForModal, setOracleContextForModal] = useState<{
        availableInstructors: string[];
        availableTraineesAnalysis: OracleTraineeAnalysis[];
    } | null>(null);
    const [oracleContext, setOracleContext] = useState<'program' | 'nextDayBuild'>('program');


    // SCT & Remedial State
    const [sctFlights, setSctFlights] = useState<SctRequest[]>([]);
    const [sctFtds, setSctFtds] = useState<SctRequest[]>([]);
    const [showSctRequest, setShowSctRequest] = useState(false);
    const [instructorForSct, setInstructorForSct] = useState<Instructor | null>(null);
    const [remedialRequests, setRemedialRequests] = useState<RemedialRequest[]>([]);


    // NEO State
    const [neoProblemTileForFlyout, setNeoProblemTileForFlyout] = useState<NeoProblemTile | null>(null);
    const [neoRemediesForFlyout, setNeoRemediesForFlyout] = useState<NeoRemedy[]>([]);
    const [showInfoNotification, setShowInfoNotification] = useState<string | null>(null);
    const [dutyWarningRemedy, setDutyWarningRemedy] = useState<NeoRemedy | null>(null);
    const [showDutyWarning, setShowDutyWarning] = useState(false);
    const [timeOnlyRemedyForConfirmation, setTimeOnlyRemedyForConfirmation] = useState<NeoTimeShiftRemedy | null>(null);
    const [showTimeOnlyRemedyConfirm, setShowTimeOnlyRemedyConfirm] = useState(false);
    const [showNeoChoiceModal, setShowNeoChoiceModal] = useState(false);
    const [timeShiftRemediesForChoice, setTimeShiftRemediesForChoice] = useState<NeoTimeShiftRemedy[]>([]);
    const [instructorRemediesForChoice, setInstructorRemediesForChoice] = useState<NeoInstructorRemedy[]>([]);

    // Navigation and Modals state
    const [selectedPersonForProfile, setSelectedPersonForProfile] = useState<Instructor | Trainee | null>(null);
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [showAddGroundEvent, setShowAddGroundEvent] = useState(false);
    const [cptConflict, setCptConflict] = useState<Conflict | null>(null);
    const [isLocalityChangeVisible, setIsLocalityChangeVisible] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [initialSyllabusId, setInitialSyllabusId] = useState<string | null>(null);
    const [syllabusBackTarget, setSyllabusBackTarget] = useState('Program Schedule');
    const [selectedTraineeForLMP, setSelectedTraineeForLMP] = useState<Trainee | null>(null);
    const [showAddRemedialPackage, setShowAddRemedialPackage] = useState(false);
    const [selectedTraineeForRemedial, setSelectedTraineeForRemedial] = useState<Trainee | null>(null);
    const [isAddingTile, setIsAddingTile] = useState(false);

    const [selectedTraineeForHateSheet, setSelectedTraineeForHateSheet] = useState<Trainee | null>(null);
    const [selectedScoreForDetail, setSelectedScoreForDetail] = useState<Score | null>(null);
    const [eventForPt051, setEventForPt051] = useState<ScheduleEvent | null>(null);
    const [selectedPersonForCurrency, setSelectedPersonForCurrency] = useState<Instructor | Trainee | null>(null);
    const [showAuthFlyout, setShowAuthFlyout] = useState(false);
    const [eventForAuth, setEventForAuth] = useState<ScheduleEvent | null>(null);
    const [showPostFlightView, setShowPostFlightView] = useState(false);
    const [eventForPostFlight, setEventForPostFlight] = useState<ScheduleEvent | null>(null);

    // Currency setup state
    const [masterCurrencies, setMasterCurrencies] = useState<MasterCurrency[]>(INITIAL_MASTER_CURRENCIES);
    const [currencyRequirements, setCurrencyRequirements] = useState<CurrencyRequirement[]>(INITIAL_CURRENCY_REQUIREMENTS);
    const [showCurrencySetup, setShowCurrencySetup] = useState(false);
    
    // Unsaved changes state
    const [dirtyCheck, setDirtyCheck] = useState<{ isDirty: () => boolean; onSave: () => void; onDiscard: () => void } | null>(null);
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    // Logbook Navigation
    const [selectedPersonForLogbook, setSelectedPersonForLogbook] = useState<Instructor | Trainee | null>(null);

    // Settings state
    const [locations, setLocations] = useState<string[]>(['East Sale', 'Pearce', 'Williamtown', 'Amberley', 'Tindal', 'Edinburgh']);
    const [sctEvents, setSctEvents] = useState<string[]>(['SCT GF', 'SCT IF', 'SCT Form', 'SCT Nav']);
    const [units, setUnits] = useState<string[]>(['1FTS', 'CFS', '2FTS', '76SQN', '77SQN', '1SQN', '6SQN', '2SQN', '10SQN']);
    const [unitLocations, setUnitLocations] = useState<Record<string, string>>({
        '1FTS': 'East Sale', 'CFS': 'East Sale', '2FTS': 'Pearce', '76SQN': 'Williamtown', '77SQN': 'Williamtown',
        '1SQN': 'Amberley', '6SQN': 'Amberley', '2SQN': 'Williamtown', '10SQN': 'Edinburgh'
    });

    // Baseline schedule state
    const [baselineSchedules, setBaselineSchedules] = useState<Record<string, ScheduleEvent[]>>({});

    const isDirtyRef = useRef<() => boolean>(() => false);
    const onSaveRef = useRef<() => void>(() => {});
    const onDiscardRef = useRef<() => void>(() => {});
    
    const ftdCount = school === 'ESL' ? 5 : 4;
    const buildResources = useMemo(() => {
        // PC-21 count is fixed at 24
        const pc21Count = 24;
        
        // Check for deployment events that overlap with the current date
        let deploymentCount = 0;
        
        console.log('buildResources - Current view:', activeView, 'Current date:', date);
        
        if (activeView === 'Program Schedule' || activeView === 'DailyFlyingProgram' || activeView === 'InstructorSchedule' || activeView === 'TraineeSchedule') {
            // Check all events across all dates for deployments that overlap with current date
            const todayStart = new Date(`${date}T00:00:00Z`).getTime();
            const todayEnd = new Date(todayStart);
            todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
            const todayEndTime = todayEnd.getTime();
            
            const allEvents: ScheduleEvent[] = Object.values(publishedSchedules).flat();
            const overlappingDeployments = allEvents.filter(event => {
                if (event.type !== 'deployment') return false;
                
                const eventStartMs = new Date(`${event.date}T00:00:00Z`).getTime() + (event.startTime * 60 * 60 * 1000);
                const eventEndMs = eventStartMs + (event.duration * 60 * 60 * 1000);
                
                return eventStartMs < todayEndTime && eventEndMs > todayStart;
            });
            
            deploymentCount = overlappingDeployments.length;
            console.log(`Deployments overlapping with ${date}:`, overlappingDeployments);
        } else if (['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView)) {
            // For next day build, check if any deployment exists in nextDayBuildEvents
            const deploymentEvents = nextDayBuildEvents.filter(event => event.type === 'deployment');
            deploymentCount = deploymentEvents.length;
            console.log('Next day build deployment events:', deploymentEvents);
        }
        
        console.log('deploymentCount:', deploymentCount);
        
        // Build PC-21 resources, replacing the last N with "Deployed X" if needed
        const pc21Resources = Array.from({ length: pc21Count }, (_, i) => {
            const deploymentIndex = pc21Count - i;
            if (deploymentIndex <= deploymentCount) {
                const deployNum = deploymentCount - deploymentIndex + 1;
                console.log(`Transforming PC-21 ${i + 1} to Deployed ${deployNum}`);
                return `Deployed ${deployNum}`;
            }
            return `PC-21 ${i + 1}`;
        });
        
        const resources = [
            ...pc21Resources,
            ...Array.from({ length: 4 }, (_, i) => `STBY ${i + 1}`),
            'Duty Sup',
            ...Array.from({ length: ftdCount }, (_, i) => `FTD ${i + 1}`),
            ...Array.from({ length: 4 }, (_, i) => `CPT ${i + 1}`),
            ...Array.from({ length: 6 }, (_, i) => `Ground ${i + 1}`),
        ];
        
        console.log('Built resources:', resources);
        return resources;
    }, [ftdCount, availableAircraftCount, date, activeView, publishedSchedules, nextDayBuildEvents]);
    
    useEffect(() => {
        const init = async () => {
            await initDB();
            await seedDefaultTemplates();
            // Seed test audit logs (only if none exist)
            const existingLogs = localStorage.getItem('dfp_audit_logs');
            if (!existingLogs) {
                seedTestAuditLogs();
            }
        };
        init();
    }, []);
    
    // Sync PT-051s when navigating to MyDashboard (ensures dashboard is up to date)
    useEffect(() => {
        if (activeView === 'MyDashboard') {
            syncPt051WithActiveDfp(publishedSchedules, pt051Assessments);
        }
    }, [activeView, publishedSchedules, pt051Assessments]);

    // Sync priority events when SCT requests change
    useEffect(() => {
        if (activeView === 'Priorities' || activeView === 'ProgramData') {
            syncPriorityEventsWithSctAndRemedial();
        }
    }, [sctFlights, sctFtds, activeView]);

    // Sync priority events when remedial requests change
    useEffect(() => {
        if (activeView === 'Priorities' || activeView === 'ProgramData') {
            syncPriorityEventsWithSctAndRemedial();
        }
    }, [remedialRequests, activeView]);

    // Save timezone offset to localStorage
    useEffect(() => {
        localStorage.setItem('timezoneOffset', timezoneOffset.toString());
    }, [timezoneOffset]);

    // Update FTD available count based on school location
    useEffect(() => {
        setAvailableFtdCount(school === 'ESL' ? 5 : 4);
    }, [school]);

    // Auto-update buildDfpDate to tomorrow's date on mount and daily
    useEffect(() => {
        const updateBuildDate = () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = getLocalDateString(tomorrow);
            
            // Only update if the date has actually changed
            if (buildDfpDate !== tomorrowStr) {
                console.log('📅 Updating build DFP date from', buildDfpDate, 'to', tomorrowStr);
                setBuildDfpDate(tomorrowStr);
            }
        };

        // Update immediately on mount
        updateBuildDate();

        // Set up interval to check and update at midnight
        const checkInterval = setInterval(() => {
            updateBuildDate();
        }, 60000); // Check every minute

        return () => clearInterval(checkInterval);
    }, [timezoneOffset]); // Re-run when timezone changes

    const eventsForDate = useMemo(() => {
        // This is used for LOGIC (like conflict checks), not rendering.
        return publishedSchedules[date] || [];
    }, [date, publishedSchedules]);

    const eventSegmentsForDate = useMemo(() => {
        const segments: EventSegment[] = [];
        const todayStart = new Date(`${date}T00:00:00Z`).getTime();
        const todayEnd = new Date(todayStart);
        todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
        const todayEndTime = todayEnd.getTime();
    
        // FIX: Explicitly type allEvents to aid TypeScript's inference.
        const allEvents: ScheduleEvent[] = Object.values(publishedSchedules).flat();
    
        for (const event of allEvents) {
            let eventStartMs: number, eventEndMs: number;
    
            eventStartMs = new Date(`${event.date}T00:00:00Z`).getTime() + (event.startTime * 60 * 60 * 1000);
            eventEndMs = eventStartMs + (event.duration * 60 * 60 * 1000);
    
            if (eventStartMs < todayEndTime && eventEndMs > todayStart) {
                const segmentStartMs = Math.max(eventStartMs, todayStart);
                const segmentEndMs = Math.min(eventEndMs, todayEndTime);
    
                const segmentStartTimeInHours = (segmentStartMs - todayStart) / (1000 * 60 * 60);
                const segmentDurationInHours = (segmentEndMs - segmentStartMs) / (1000 * 60 * 60);
                
                if (segmentDurationInHours <= 0) continue;
    
                let segmentType: 'full' | 'start' | 'end' | 'middle' = 'full';
                const startsBeforeToday = eventStartMs < todayStart;
                const endsAfterToday = eventEndMs > todayEndTime;
    
                if (startsBeforeToday && endsAfterToday) segmentType = 'middle';
                else if (startsBeforeToday) segmentType = 'end';
                else if (endsAfterToday) segmentType = 'start';
                
                segments.push({
                    ...event,
                    segmentStartTime: segmentStartTimeInHours,
                    segmentDuration: segmentDurationInHours,
                    segmentType
                });
            }
        }
        return segments;
    }, [date, publishedSchedules]);

    const nextDayEventSegments = useMemo(() => {
        const segments: EventSegment[] = [];
        const todayStart = new Date(`${buildDfpDate}T00:00:00Z`).getTime();
        const todayEnd = new Date(todayStart);
        todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
        const todayEndTime = todayEnd.getTime();

        const buildEventsWithDate: ScheduleEvent[] = nextDayBuildEvents.map(e => ({...e, date: buildDfpDate}));
        
        const dayBeforeBuild = new Date(todayStart);
        dayBeforeBuild.setUTCDate(dayBeforeBuild.getUTCDate() - 1);
        const dayBeforeBuildStr = dayBeforeBuild.toISOString().split('T')[0];

        const allEvents = [...(publishedSchedules[dayBeforeBuildStr] || []), ...buildEventsWithDate];

        for (const event of allEvents) {
            const eventStartMs = new Date(`${event.date}T00:00:00Z`).getTime() + (event.startTime * 60 * 60 * 1000);
            const eventEndMs = eventStartMs + (event.duration * 60 * 60 * 1000);

            if (eventStartMs < todayEndTime && eventEndMs > todayStart) {
                const segmentStartMs = Math.max(eventStartMs, todayStart);
                const segmentEndMs = Math.min(eventEndMs, todayEndTime);

                const segmentStartTimeInHours = (segmentStartMs - todayStart) / (1000 * 60 * 60);
                const segmentDurationInHours = (segmentEndMs - segmentStartMs) / (1000 * 60 * 60);
                
                if (segmentDurationInHours <= 0) continue;

                let segmentType: 'full' | 'start' | 'end' | 'middle' = 'full';
                const startsBeforeToday = eventStartMs < todayStart;
                const endsAfterToday = eventEndMs > todayEndTime;

                if (startsBeforeToday && endsAfterToday) segmentType = 'middle';
                else if (startsBeforeToday) segmentType = 'end';
                else if (endsAfterToday) segmentType = 'start';
                
                segments.push({
                    ...event,
                    segmentStartTime: segmentStartTimeInHours,
                    segmentDuration: segmentDurationInHours,
                    segmentType
                });
            }
        }
        return segments;
    }, [buildDfpDate, nextDayBuildEvents, publishedSchedules]);

    useEffect(() => {
        const todayStr = getLocalDateString();
        const initialEvents = events.filter(e => e.date === todayStr);
        if (Object.keys(baselineSchedules).length === 0 && initialEvents.length > 0) {
             setBaselineSchedules({ [todayStr]: JSON.parse(JSON.stringify(initialEvents)) });
        }
    }, [events, baselineSchedules]);

    const personnelData = useMemo(() => {
        const data = new Map<string, { callsignPrefix: string; callsignNumber: number }>();
        const callsignPrefix = school === 'ESL' ? 'ROLR' : 'VIPR';
        
        instructorsData.forEach(instructor => {
            if (instructor.name && instructor.role === 'QFI' && instructor.callsignNumber > 0) {
                data.set(instructor.name, {
                    callsignPrefix,
                    callsignNumber: instructor.callsignNumber
                });
            }
        });
        return data;
    }, [instructorsData, school]);

    // ============================================================================
    // CONFLICT DETECTION SYSTEM
    // ============================================================================
    // Detects three types of conflicts:
    // 1. Turnaround Conflicts - Insufficient gap between consecutive events on same resource
    // 2. Resource Conflicts - Two events overlapping on the same resource line
    // 3. Personnel Conflicts - Same instructor/supervisor double-booked
    // ============================================================================

    /**
     * Checks if two events overlap in time
     */
    const checkTimeOverlap = useCallback((event1: ScheduleEvent | Omit<ScheduleEvent, 'date'>, event2: ScheduleEvent | Omit<ScheduleEvent, 'date'>): boolean => {
        const start1 = event1.startTime;
        const end1 = event1.startTime + event1.duration;
        const start2 = event2.startTime;
        const end2 = event2.startTime + event2.duration;
        return start1 < end2 && end1 > start2;
    }, []);

    /**
     * Detects conflicts for a specific event against all other events
     * Returns: { hasConflict: boolean, conflictingEventId: string | null, conflictType: string | null, conflictedPersonnel: string | null }
     */
    const detectConflictsForEvent = useCallback((
        targetEvent: ScheduleEvent | Omit<ScheduleEvent, 'date'>,
        allEvents: (ScheduleEvent | Omit<ScheduleEvent, 'date'>)[],
        checkDate?: string
    ): { hasConflict: boolean; conflictingEventId: string | null; conflictType: 'turnaround' | 'resource' | 'personnel' | null; conflictedPersonnel: string | null } => {
        
        // Skip conflict detection for STBY and deployment events
        if (targetEvent.resourceId.startsWith('STBY') || 
            targetEvent.resourceId.startsWith('BNF-STBY') || 
            targetEvent.type === 'deployment') {
            return { hasConflict: false, conflictingEventId: null, conflictType: null, conflictedPersonnel: null };
        }

        // Filter out STBY and deployment events from comparison
        const validEvents = allEvents.filter(e => 
            e.id !== targetEvent.id &&
            !e.resourceId.startsWith('STBY') && 
            !e.resourceId.startsWith('BNF-STBY') && 
            e.type !== 'deployment'
        );

        // Get turnaround time for target event
        let requiredTurnaround = 0;
        if (targetEvent.type === 'flight') requiredTurnaround = flightTurnaround;
        else if (targetEvent.type === 'ftd') requiredTurnaround = ftdTurnaround;
        else if (targetEvent.type === 'cpt' || (targetEvent.type === 'ground' && targetEvent.flightNumber.includes('CPT'))) requiredTurnaround = cptTurnaround;

        // Check turnaround conflicts - only with events on same resource
        const sameResourceEvents = validEvents.filter(e => e.resourceId === targetEvent.resourceId);
        sameResourceEvents.sort((a, b) => a.startTime - b.startTime);

        for (let i = 0; i < sameResourceEvents.length; i++) {
            const event = sameResourceEvents[i];
            
            // Check if targetEvent comes after this event
            if (targetEvent.startTime > event.startTime) {
                const gap = targetEvent.startTime - (event.startTime + event.duration);
                if (gap < requiredTurnaround) {
                    return { 
                        hasConflict: true, 
                        conflictingEventId: event.id, 
                        conflictType: 'turnaround',
                        conflictedPersonnel: null 
                    };
                }
            }
            
            // Check if targetEvent comes before this event
            if (targetEvent.startTime < event.startTime) {
                let eventTurnaround = 0;
                if (event.type === 'flight') eventTurnaround = flightTurnaround;
                else if (event.type === 'ftd') eventTurnaround = ftdTurnaround;
                else if (event.type === 'cpt' || (event.type === 'ground' && event.flightNumber.includes('CPT'))) eventTurnaround = cptTurnaround;
                
                const gap = event.startTime - (targetEvent.startTime + targetEvent.duration);
                if (gap < eventTurnaround) {
                    return { 
                        hasConflict: true, 
                        conflictingEventId: event.id, 
                        conflictType: 'turnaround',
                        conflictedPersonnel: null 
                    };
                }
            }
        }

        // Check resource conflicts - overlapping time on same resource
        for (const event of validEvents) {
            if (event.resourceId === targetEvent.resourceId && checkTimeOverlap(targetEvent, event)) {
                return { 
                    hasConflict: true, 
                    conflictingEventId: event.id, 
                    conflictType: 'resource',
                    conflictedPersonnel: null 
                };
            }
        }

        // Check personnel conflicts - same instructor/supervisor with overlapping booking windows
        const targetPersonnel = getPersonnel(targetEvent);
        const targetEventWithDate = 'date' in targetEvent ? targetEvent : { ...targetEvent, date: checkDate || buildDfpDate };
        const targetWindow = getEventBookingWindow(targetEventWithDate as ScheduleEvent, syllabusDetails);

        for (const event of validEvents) {
            const eventPersonnel = getPersonnel(event);
            const commonPersonnel = targetPersonnel.filter(p => eventPersonnel.includes(p));

            if (commonPersonnel.length > 0) {
                const eventWithDate = 'date' in event ? event : { ...event, date: checkDate || buildDfpDate };
                const eventWindow = getEventBookingWindow(eventWithDate as ScheduleEvent, syllabusDetails);

                if (targetWindow.start < eventWindow.end && targetWindow.end > eventWindow.start) {
                    return { 
                        hasConflict: true, 
                        conflictingEventId: event.id, 
                        conflictType: 'personnel',
                        conflictedPersonnel: commonPersonnel[0] 
                    };
                }
            }
        }

        return { hasConflict: false, conflictingEventId: null, conflictType: null, conflictedPersonnel: null };
    }, [flightTurnaround, ftdTurnaround, cptTurnaround, syllabusDetails, buildDfpDate, checkTimeOverlap]);

    /**
     * Calculate all conflicts for current day events (used when Validate is checked)
     */
    const personnelAndResourceConflictIds = useMemo(() => {
        const conflictingEventIds = new Set<string>();
        
        if (!eventsForDate || eventsForDate.length === 0) {
            return conflictingEventIds;
        }

        for (const event of eventsForDate) {
            const result = detectConflictsForEvent(event, eventsForDate);
            if (result.hasConflict) {
                conflictingEventIds.add(event.id);
            }
        }

        return conflictingEventIds;
    }, [eventsForDate, detectConflictsForEvent]);

    /**
     * Calculate all conflicts for next day build events (used when Validate is checked)
     */
    const nextDayPersonnelAndResourceConflictIds = useMemo(() => {
        const conflictingEventIds = new Set<string>();
        
        if (!nextDayBuildEvents || nextDayBuildEvents.length === 0) {
            return conflictingEventIds;
        }

        for (const event of nextDayBuildEvents) {
            const result = detectConflictsForEvent(event, nextDayBuildEvents, buildDfpDate);
            if (result.hasConflict) {
                conflictingEventIds.add(event.id);
            }
        }

        return conflictingEventIds;
    }, [nextDayBuildEvents, detectConflictsForEvent, buildDfpDate]);

    /**
     * Unavailability conflicts - personnel assigned during their unavailability periods
     */
    const unavailabilityConflicts = useMemo(() => {
        const newConflicts = new Map<string, string[]>();
        const allPersonnel: (Instructor | Trainee)[] = [...instructorsData, ...traineesData];
        const personMap = new Map<string, Instructor | Trainee>();
        
        allPersonnel.forEach(p => {
            personMap.set('fullName' in p ? p.fullName : p.name, p);
        });

        const eventsToCheck = eventsForDate || [];

        for (const event of eventsToCheck) {
            // Skip deployment events
            if (event.type === 'deployment') {
                continue;
            }
            
            const personnelNames = getPersonnel(event);
            const conflictedNamesForEvent: string[] = [];

            const eventWindow = getEventBookingWindow(event, syllabusDetails);
            const [eventYear, eventMonth, eventDay] = event.date.split('-').map(Number);
            const eventStartUTC = new Date(Date.UTC(eventYear, eventMonth - 1, eventDay, 0, eventWindow.start * 60));
            const eventEndUTC = new Date(Date.UTC(eventYear, eventMonth - 1, eventDay, 0, eventWindow.end * 60));

            for (const name of personnelNames) {
                const person = personMap.get(name);
                if (!person || !person.unavailability || person.unavailability.length === 0) continue;

                for (const period of person.unavailability) {
                    const [startYear, startMonth, startDay] = period.startDate.split('-').map(Number);
                    const unavailStartUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay));

                    const [endYear, endMonth, endDay] = period.endDate.split('-').map(Number);
                    const unavailEndUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay));

                    let effectiveUnavailStartUTC = new Date(unavailStartUTC);
                    let effectiveUnavailEndUTC = new Date(unavailEndUTC);

                    if (!period.allDay) {
                        const startTime = timeStringToHours(period.startTime);
                        const endTime = timeStringToHours(period.endTime);
                        if (startTime !== null) {
                            effectiveUnavailStartUTC.setUTCHours(0, startTime * 60);
                        }
                        if (endTime !== null) {
                            effectiveUnavailEndUTC.setUTCHours(0, endTime * 60);
                        }
                    }

                    if (eventStartUTC < effectiveUnavailEndUTC && eventEndUTC > effectiveUnavailStartUTC) {
                        let isActuallyUnavailable = true;
                        if (period.reason === 'TMUF - Ground Duties only' && event.type !== 'flight') {
                            isActuallyUnavailable = false;
                        }
                        
                        if (isActuallyUnavailable) {
                            conflictedNamesForEvent.push(name);
                            break;
                        }
                    }
                }
            }
            
            if (conflictedNamesForEvent.length > 0) {
                newConflicts.set(event.id, [...new Set(conflictedNamesForEvent)]);
            }
        }
        
        return newConflicts;
    }, [eventsForDate, instructorsData, traineesData, syllabusDetails]);



    const registerDirtyCheck = useCallback((isDirty: () => boolean, onSave: () => void, onDiscard: () => void) => {
        isDirtyRef.current = isDirty;
        onSaveRef.current = onSave;
        onDiscardRef.current = onDiscard;
    }, []);

    const navigateToView = (view: string) => {
        const today = getLocalDateString();
        const isDashboard = view === 'MyDashboard' || view === 'SupervisorDashboard';
        if (isDashboard && date !== today) {
            setDate(today);
        }
        setPreviousView(activeView);
        setActiveView(view);
    };

    const handleNavigation = (view: string) => {
        if (view === 'Syllabus') {
            setInitialSyllabusId(null);
            setSyllabusBackTarget('Program Schedule');
        }
        if (isDirtyRef.current()) {
            setPendingNavigation(view);
            setShowUnsavedWarning(true);
        } else {
            navigateToView(view);
        }
    };
    
    const onNavigateToSyllabus = (id: string) => {
        setInitialSyllabusId(id);
        setSyllabusBackTarget(activeView);
        handleNavigation('Syllabus');
    };

    const handleViewTraineeLMP = (trainee: Trainee) => {
        setSelectedTraineeForLMP(trainee);
        handleNavigation('TraineeLMP');
    };
    
    const handleViewLogbook = (person: Instructor | Trainee) => {
        setSelectedPersonForLogbook(person);
        handleNavigation('Logbook');
    };

    const handleOpenAddRemedialPackage = (trainee: Trainee) => {
        setSelectedTraineeForRemedial(trainee);
        setShowAddRemedialPackage(true);
    };

    const handleBuildDateChange = (direction: 'prev' | 'next') => {
        const currentDate = new Date(buildDfpDate + 'T00:00:00Z');
        if (direction === 'prev') {
            currentDate.setUTCDate(currentDate.getUTCDate() - 1);
        } else {
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        setBuildDfpDate(getLocalDateString(currentDate));
    };
    
    const handleAddTrainee = useCallback((newTrainee: Trainee) => {
        setTraineesData(prev => [...prev, newTrainee]);
        setSuccessMessage('New Trainee Added!');
    }, []);

    const handleSaveRemedialPackage = (
        trainee: Trainee,
        eventToRemediate: SyllabusItemDetail,
        newEvents: { type: 'TUT' | 'FTD' | 'Flight', duration: number, instructor: string }[]
    ) => {
        setTraineeLMPs(prevLMPs => {
            const newLMPs = new Map(prevLMPs);
            const originalTraineeLMP = newLMPs.get(trainee.fullName);
            if (!originalTraineeLMP) {
                console.error("LMP not found for trainee:", trainee.fullName);
                return prevLMPs;
            }
    
            // Req 3.2, 3.3.1-3.3.3: Create all new remedial items and the re-fly event.
            let lastNewEventId = eventToRemediate.id;
            const remedialPackageItems: SyllabusItemDetail[] = [];
    
            newEvents.forEach((remEvent, index) => {
                let codeSuffix = '';
                let type: SyllabusItemDetail['type'] = 'Flight';
                if (remEvent.type === 'TUT') { codeSuffix = `REM-T${index+1}`; type = 'Ground School'; }
                else if (remEvent.type === 'FTD') { codeSuffix = `REM-FTD${index+1}`; type = 'FTD'; }
                else if (remEvent.type === 'Flight') { codeSuffix = `REM-F${index+1}`; type = 'Flight'; }
    
                const newItem: SyllabusItemDetail = {
                    ...eventToRemediate,
                    id: `${eventToRemediate.code}-${codeSuffix}`, code: `${eventToRemediate.code}-${codeSuffix}`,
                    isRemedial: true, // Req 2.3.3
                    eventDescription: `Remedial ${remEvent.type} for ${eventToRemediate.code}`,
                    module: 'Remedial', prerequisites: [lastNewEventId],
                    duration: remEvent.duration, flightOrSimHours: remEvent.duration,
                    totalEventHours: remEvent.duration + (type === 'Ground School' ? 0.25 : 1.0), type,
                    prerequisitesGround: [], prerequisitesFlying: [],
                    preFlightTime: type === 'Ground School' ? 0.25 : (type === 'FTD' ? 0.5 : 1.0),
                    postFlightTime: type === 'Ground School' ? 0 : (type === 'FTD' ? 0.5 : 0.5),
                    location: '', methodOfDelivery: [], methodOfAssessment: [], resourcesPhysical: [], resourcesHuman: [remEvent.instructor], eventDetailsCommon: [], eventDetailsSortie: [],
                };
                remedialPackageItems.push(newItem);
                lastNewEventId = newItem.id;
            });
            
            const reFlyEvent: SyllabusItemDetail = {
                ...eventToRemediate, id: `${eventToRemediate.code}-RF`, code: `${eventToRemediate.code}-RF`,
                isRemedial: true,
                eventDescription: `Re-Fly: ${eventToRemediate.eventDescription}`, module: 'Remedial',
                prerequisites: [lastNewEventId], prerequisitesGround: [], prerequisitesFlying: [],
            };
            remedialPackageItems.push(reFlyEvent);

            const newRemedialIds = new Set(remedialPackageItems.map(item => item.id));

            let cleanedLmp: SyllabusItemDetail[] = (originalTraineeLMP as SyllabusItemDetail[]).filter(item => !newRemedialIds.has(item.id));
    
            const insertionIndex = cleanedLmp.findIndex(item => item.id === eventToRemediate.id);

            if (insertionIndex === -1) {
                console.error("Critical error: Failed to find insertion point. LMP not modified.");
                return prevLMPs;
            }
    
            cleanedLmp.splice(insertionIndex + 1, 0, ...remedialPackageItems);
    
            const subsequentEvent = cleanedLmp.find(item => item.prerequisites.includes(eventToRemediate.id));
            
            if (subsequentEvent) {
                const prereqIndex = subsequentEvent.prerequisites.indexOf(eventToRemediate.id);
                if (prereqIndex !== -1) {
                    subsequentEvent.prerequisites[prereqIndex] = reFlyEvent.id;
                }
            }
        
            newLMPs.set(trainee.fullName, cleanedLmp);
            return newLMPs;
        });
    
        setShowAddRemedialPackage(false);
        setSuccessMessage('Remedial package added to trainee LMP.');
    };

    const handleUnsavedConfirm = (action: 'save' | 'discard') => {
        if (action === 'save') {
            onSaveRef.current();
        } else {
            onDiscardRef.current();
        }
        if (pendingNavigation) {
            navigateToView(pendingNavigation);
        }
        setShowUnsavedWarning(false);
        setPendingNavigation(null);
    };


    const handleUnsavedCancel = () => {
        setShowUnsavedWarning(false);
        setPendingNavigation(null);
    };


    const changeSchool = (newSchool: 'ESL' | 'PEA') => {
        setSchool(newSchool);
        setIsLocalityChangeVisible(true);
        setTimeout(() => setIsLocalityChangeVisible(false), 2000);

        const data = newSchool === 'ESL' ? ESL_DATA : PEA_DATA;
        setInstructorsData(data.instructors);
        setTraineesData(data.trainees);
        setEvents(data.events);
        setCourses(data.courses);
        setScores(data.scores);
        setPt051Assessments(data.pt051Assessments);
        setCourseColors(data.courseColors);
        setArchivedCourses(data.archivedCourses);
        setCoursePriorities(data.coursePriorities);
        setCoursePercentages(data.coursePercentages);
        setTraineeLMPs(data.traineeLMPs); // Load the correct LMPs for the new school
        setNextDayBuildEvents([]); // Clear the build when changing schools
        setPublishedSchedules({}); // Clear published schedules on school change
        
        // Reset baseline on school change to avoid stale comparisons
        const todayStr = getLocalDateString();
        setBaselineSchedules({ [todayStr]: JSON.parse(JSON.stringify(data.events.filter(e => e.date === todayStr))) });
    };
    
    useEffect(() => {
        const initialData = school === 'ESL' ? ESL_DATA : PEA_DATA;
        setEvents(initialData.events);
        setCourses(initialData.courses);
        const todayStr = getLocalDateString();
        setPublishedSchedules({ [todayStr]: initialData.events.filter(e => e.date === todayStr) });
    }, [school]);


    const handleDateChange = (increment: number) => {
        const currentDate = new Date(`${date}T00:00:00Z`);
        currentDate.setUTCDate(currentDate.getUTCDate() + increment);
        const newDateStr = currentDate.toISOString().split('T')[0];
        setDate(newDateStr);
    };
    
    const findAvailableResourceId = (eventToPlace: ScheduleEvent, existingEvents: ScheduleEvent[]): string => {
        // Handle deployment events - find an available Deployed resource
        if (eventToPlace.type === 'deployment') {
            // Count existing deployments to determine how many Deployed resources we need
            const existingDeploymentCount = existingEvents.filter(e => e.type === 'deployment').length;
            const totalDeploymentCount = existingDeploymentCount + 1; // +1 for the new one being placed
            
            // Generate the correct number of Deployed resources
            const deployedResources = Array.from({ length: totalDeploymentCount }, (_, i) => `Deployed ${i + 1}`);
            
            console.log('Available Deployed resources:', deployedResources);
            console.log('Checking deployment event:', eventToPlace);
            console.log('Against existing events:', existingEvents.filter(e => e.type === 'deployment'));
            
            // Find the first available Deployed resource
            for (const resourceId of deployedResources) {
                const conflictingEvents = existingEvents.filter(e => 
                    e.resourceId === resourceId && isOverlapping(e, eventToPlace)
                );
                console.log(`Checking ${resourceId}:`, conflictingEvents.length > 0 ? 'OCCUPIED' : 'AVAILABLE', conflictingEvents);
                
                if (conflictingEvents.length === 0) {
                    console.log(`Assigning deployment to ${resourceId}`);
                    return resourceId;
                }
            }
            
            // If all are occupied, return the next available number
            console.log('All Deployed resources occupied, creating new one');
            return `Deployed ${totalDeploymentCount}`;
        }
        
        let resourcePrefix: string;
    
        const syllabusItem = syllabusDetails.find(s => s.id === eventToPlace.flightNumber);
    
        if (syllabusItem) {
            // Primary logic: Use the syllabus item as the single source of truth.
            switch (syllabusItem.type) {
                case 'Flight':
                    resourcePrefix = 'PC-21 ';
                    break;
                case 'FTD':
                    resourcePrefix = 'FTD ';
                    break;
                case 'Ground School':
                    if (syllabusItem.methodOfDelivery.includes('CPT')) {
                        resourcePrefix = 'CPT ';
                    } else {
                        // This explicitly handles MB, TUT, QUIZ, and any other Ground School event.
                        resourcePrefix = 'Ground ';
                    }
                    break;
                default:
                    // This case should be unreachable due to TypeScript types,
                    // but as a fallback, we'll assume Ground to be safer than Flight.
                    console.warn(`Unexpected syllabus type for ${syllabusItem.code}: ${(syllabusItem as any).type}`);
                    resourcePrefix = 'Ground ';
                    break;
            }
        } else {
            // Fallback logic for events not found in the syllabus (e.g., 'Duty Sup', 'SCT FORM')
            switch (eventToPlace.type) {
                case 'flight':
                    resourcePrefix = 'PC-21 ';
                    break;
                case 'ftd':
                    resourcePrefix = 'FTD ';
                    break;
                case 'cpt':
                    resourcePrefix = 'CPT ';
                    break;
                case 'ground':
                    if (eventToPlace.flightNumber.toUpperCase().includes('CPT')) {
                        resourcePrefix = 'CPT ';
                    } else {
                        resourcePrefix = 'Ground ';
                    }
                    break;
                default:
                    // Default fallback if event type is unknown
                    resourcePrefix = 'Ground '; // Safer default than PC-21
            }
        }
        
        const relevantResources = buildResources.filter(r => r.startsWith(resourcePrefix));
        
        for (const resourceId of relevantResources) {
            const isOccupied = existingEvents.some(e => 
                e.resourceId === resourceId && isOverlapping(e, eventToPlace)
            );
            if (!isOccupied) {
                return resourceId;
            }
        }
        return relevantResources[0] || `${resourcePrefix}1`; // Fallback
    };

    const handleOpenModal = (event: ScheduleEvent | null, options: { type?: 'flight' | 'ftd' | 'ground', isPriority?: boolean, oracleContext?: typeof oracleContextForModal } = {}) => {
        if (!event) { // Creating a new event
            const newEvent: ScheduleEvent = {
                id: uuidv4(),
                date: oracleContext === 'nextDayBuild' || activeView === 'NextDayBuild' || activeView === 'Priorities' || activeView === 'ProgramData' ? buildDfpDate : date,
                type: options.type || 'flight',
                flightNumber: '',
                duration: 1.5,
                startTime: 8.0,
                resourceId: '', // Will be assigned on save
                color: 'bg-gray-400/50',
                flightType: 'Dual',
                locationType: 'Local',
                origin: school,
                destination: school,
                isTimeFixed: true,
            };
            setSelectedEvent(newEvent);
            setIsEditingDefault(true);
            setHighlightedField(null);
            setIsPriorityEventCreation(!!options.isPriority);
            setOracleContextForModal(options.oracleContext || null);
        } else {
            setSelectedEvent(event);
            setIsEditingDefault(false);
            setHighlightedField(null);
            const isHighPriority = highestPriorityEvents.some(p => p.id === event.id);
            setIsPriorityEventCreation(isHighPriority);
            setOracleContextForModal(null);
        }
    };
    
    // Helper function to add currency event to trainee's Individual LMP
    const addCurrencyEventToTraineeLMP = (traineeFullName: string, currencyEventId: string) => {
        setTraineeLMPs(prev => {
            const newLMPs = new Map(prev);
            const traineeLMP: SyllabusItemDetail[] | undefined = newLMPs.get(traineeFullName);
            
            if (!traineeLMP) {
                console.warn(`No Individual LMP found for trainee: ${traineeFullName}`);
                return prev;
            }
            
            // Find the base event in the syllabus
            const baseEvent = syllabusDetails.find(item => item.id === currencyEventId);
            if (!baseEvent) {
                console.warn(`Currency event ${currencyEventId} not found in syllabus`);
                return prev;
            }
            
            // Create currency version with -CUR suffix
            const currencyEvent: SyllabusItemDetail = {
                ...baseEvent,
                id: `${baseEvent.id}-CUR`,
                code: `${baseEvent.code}-CUR`,
                eventDescription: `${baseEvent.eventDescription} (Currency)`,
            };
            
            // Find the index of the base event in the trainee's LMP
            const baseEventIndex = traineeLMP.findIndex(item => item.id === currencyEventId);
            
            if (baseEventIndex === -1) {
                console.warn(`Base event ${currencyEventId} not found in trainee's LMP`);
                return prev;
            }
            
            // Check if currency event already exists
            const currencyEventExists = traineeLMP.some(item => item.id === `${currencyEventId}-CUR`);
            if (currencyEventExists) {
                console.log(`Currency event ${currencyEventId}-CUR already exists in trainee's LMP`);
                return prev;
            }
            
            // Insert currency event right after the base event
            const updatedLMP = [
                ...traineeLMP.slice(0, baseEventIndex + 1),
                currencyEvent,
                ...traineeLMP.slice(baseEventIndex + 1)
            ];
            
            newLMPs.set(traineeFullName, updatedLMP);
            console.log(`Added currency event ${currencyEvent.id} to ${traineeFullName}'s Individual LMP`);
            
            return newLMPs;
        });
    };

    const handleSaveEvents = (eventsToSave: ScheduleEvent[], isPriority?: boolean) => {
        console.log('handleSaveEvents called with:', eventsToSave);
        if (!eventsToSave || eventsToSave.length === 0) return;
    
        const mainEvent = eventsToSave[0];
        const isNewEvent = !mainEvent.resourceId;
        const wasOracleEvent = !!oracleContextForModal;
    
        if (isPriority) {
            const priorityEvent = { ...mainEvent, isTimeFixed: mainEvent.isTimeFixed ?? true };
            
            setHighestPriorityEvents(prev => {
                const existingIndex = prev.findIndex(p => p.id === priorityEvent.id);
                if (existingIndex > -1) {
                    const newEvents = [...prev];
                    newEvents[existingIndex] = priorityEvent;
                    return newEvents;
                }
                return [...prev, priorityEvent];
            });
        } else {
            let saveToNextDayBuild = false;

            if (wasOracleEvent) {
                // If the save comes from Oracle, the context is king.
                saveToNextDayBuild = oracleContext === 'nextDayBuild';
            } else {
                // If it's a normal save/edit, check the view and date.
                const isNextDayView = ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
                saveToNextDayBuild = mainEvent.date === buildDfpDate && isNextDayView;
            }

            if (saveToNextDayBuild) {
                if (isNewEvent) {
                    // Track already assigned events in this batch
                    const alreadyAssigned: ScheduleEvent[] = [];
                    
                    eventsToSave.forEach(e => {
                        // Assign resourceId based on event type
                        if (!e.resourceId || e.type === 'deployment') {
                            const allEventsForCheck = nextDayBuildEvents.map(ev => ({ ...ev, date: buildDfpDate }));
                            // Include already assigned events from this batch
                            const eventsToCheck = [...allEventsForCheck, ...alreadyAssigned];
                            e.resourceId = findAvailableResourceId(e, eventsToCheck);
                            // Add to already assigned list
                            alreadyAssigned.push(e);
                        }
                    });
                }
                const existingEventIds = new Set(eventsToSave.map(e => e.id));
                const otherEvents = nextDayBuildEvents.filter(e => !existingEventIds.has(e.id));
                const eventsForBuild = eventsToSave.map(({ date, ...rest }) => rest);
                setNextDayBuildEvents([...otherEvents, ...eventsForBuild]);
            } else {
                if (isNewEvent) {
                    // Track already assigned events in this batch
                    const alreadyAssigned: ScheduleEvent[] = [];
                    
                    eventsToSave.forEach(e => {
                        // Assign resourceId based on event type
                        // For deployments, always reassign to get correct numbered resource
                        if (!e.resourceId || e.type === 'deployment') {
                            const allEventsForDate = publishedSchedules[mainEvent.date] || [];
                            // Include already assigned events from this batch
                            const eventsToCheck = [...allEventsForDate, ...alreadyAssigned];
                            const assignedResourceId = findAvailableResourceId(e, eventsToCheck);
                            console.log(`Assigning resourceId to ${e.type} event:`, assignedResourceId);
                            e.resourceId = assignedResourceId;
                            // Add to already assigned list
                            alreadyAssigned.push(e);
                        }
                    });
                }
                setPublishedSchedules((prev) => {
                    const newSchedules = { ...prev };
                    
                    // Group events by their date (deployment tiles may have different dates)
                    const eventsByDate = new Map<string, ScheduleEvent[]>();
                    eventsToSave.forEach(event => {
                        const eventDate = event.date;
                        if (!eventsByDate.has(eventDate)) {
                            eventsByDate.set(eventDate, []);
                        }
                        eventsByDate.get(eventDate)!.push(event);
                    });
                    
                    console.log('Events grouped by date:', Array.from(eventsByDate.entries()));
                    
                    // Save each group of events to their respective dates
                    eventsByDate.forEach((events, eventDate) => {
                        const currentScheduleForDate = newSchedules[eventDate] || [];
                        const existingEventIds = new Set(events.map(e => e.id));
                        const otherEvents = currentScheduleForDate.filter(e => !existingEventIds.has(e.id));
                        newSchedules[eventDate] = [...otherEvents, ...events] as ScheduleEvent[];
                        console.log(`Saved ${events.length} events to date ${eventDate}`);
                    });
                    
                    console.log('Updated publishedSchedules:', newSchedules);
                    
                    return newSchedules;
                });
                
                // NEW APPROACH: Trigger PT-051 sync after any Active DFP change
                // Use functional setState to access the latest state
                console.log('📋 Triggering PT-051 sync after Active DFP change...');
                setTimeout(() => {
                    console.log('⏰ Executing delayed PT-051 sync...');
                    setPublishedSchedules(currentSchedules => {
                        setPt051Assessments(currentAssessments => {
                            syncPt051WithActiveDfp(currentSchedules, currentAssessments);
                            return currentAssessments;
                        });
                        return currentSchedules;
                    });
                }, 500);
            }
        }
    
        // Handle LMP Currency events - add to trainee's Individual LMP
        eventsToSave.forEach(event => {
            if (event.eventCategory === 'lmp_currency' && event.flightNumber) {
                // Get trainee name from the event
                const traineeName = event.flightType === 'Dual' ? event.student : event.pilot;
                
                if (traineeName) {
                    addCurrencyEventToTraineeLMP(traineeName, event.flightNumber);
                } else if (event.groupTraineeIds && event.groupTraineeIds.length > 0) {
                    // Handle group events - add currency to all trainees in the group
                    event.groupTraineeIds.forEach(traineeId => {
                        const trainee = traineesData.find(t => t.idNumber === traineeId);
                        if (trainee) {
                            addCurrencyEventToTraineeLMP(trainee.fullName, event.flightNumber);
                        }
                    });
                }
            }
        });

           
           // Log the action to audit trail with detailed field-level changes
           const saveToNextDayBuild = mainEvent.date === buildDfpDate && ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
           eventsToSave.forEach(event => {
               const pageName = saveToNextDayBuild ? 'Next Day Build' : 'Program Schedule';
               const eventType = event.type || 'event';
               const personName = event.student || event.pilot || event.instructor || 'Unknown';
               
               if (isNewEvent) {
                   // Log new event creation
                   const description = `Added ${eventType} event for ${personName}`;
                   const changes = `Event: ${event.syllabusItem || event.flightNumber || eventType}, Time: ${event.startTime}, Duration: ${event.duration}hrs, Resource: ${event.resourceId}`;
                   logAudit(pageName, 'Add', description, changes);
               } else {
                   // Find the original event to compare changes
                   const originalEvent = publishedSchedules[event.date]?.find(e => e.id === event.id) || 
                                       nextDayBuildEvents.find(e => e.id === event.id);
                   
                   if (originalEvent) {
                       const changesList: string[] = [];
                       
                       // Check for pilot/instructor changes
                       if (event.instructor !== originalEvent.instructor) {
                           changesList.push(`Instructor: ${originalEvent.instructor || 'None'} → ${event.instructor || 'None'}`);
                       }
                       if (event.pilot !== originalEvent.pilot) {
                           changesList.push(`Pilot: ${originalEvent.pilot || 'None'} → ${event.pilot || 'None'}`);
                       }
                       if (event.student !== originalEvent.student) {
                           changesList.push(`Student: ${originalEvent.student || 'None'} → ${event.student || 'None'}`);
                       }
                       
                       // Check for LMP event/syllabus item changes
                       if (event.syllabusItem !== originalEvent.syllabusItem) {
                           changesList.push(`LMP Event: ${originalEvent.syllabusItem || 'None'} → ${event.syllabusItem || 'None'}`);
                       }
                       if (event.flightNumber !== originalEvent.flightNumber) {
                           changesList.push(`Flight Number: ${originalEvent.flightNumber || 'None'} → ${event.flightNumber || 'None'}`);
                       }
                       
                       // Check for area changes
                       if (event.area !== originalEvent.area) {
                           changesList.push(`Area: ${originalEvent.area || 'None'} → ${event.area || 'None'}`);
                       }
                       
                       // Check for time changes
                       if (event.startTime !== originalEvent.startTime) {
                           changesList.push(`Start time: ${formatTimeForAudit(originalEvent.startTime)} → ${formatTimeForAudit(event.startTime)}`);
                       }
                       
                       // Check for duration changes
                       if (event.duration !== originalEvent.duration) {
                           changesList.push(`Duration: ${originalEvent.duration}hrs → ${event.duration}hrs`);
                       }
                       
                       // Check for resource changes
                       if (event.resourceId !== originalEvent.resourceId) {
                           changesList.push(`Resource: ${originalEvent.resourceId} → ${event.resourceId}`);
                       }
                       
                       // Check for type changes
                       if (event.type !== originalEvent.type) {
                           changesList.push(`Type: ${originalEvent.type} → ${event.type}`);
                       }
                       
                       // Only log if there are actual changes
                       if (changesList.length > 0) {
                           const description = `Modified ${eventType} event for ${personName}`;
                           logAudit(pageName, 'Edit', description, changesList.join(', '));
                       }
                   } else {
                       // Fallback if original event not found
                       const description = `Modified ${eventType} event for ${personName}`;
                       const changes = `Event: ${event.syllabusItem || event.flightNumber || eventType}, Time: ${event.startTime}, Duration: ${event.duration}hrs, Resource: ${event.resourceId}`;
                       logAudit(pageName, 'Edit', description, changes);
                   }
               }
           });
        setSelectedEvent(null);
        setOracleContextForModal(null);
    
        // If the event came from Oracle, deactivate Oracle mode now.
        if (wasOracleEvent) {
            setIsOracleMode(false);
            setOracleAnalysis(null);
            setOraclePreviewEvent(null);
        }
    };

    const handleDeleteEvent = () => {
        if (!selectedEvent) return;
        const eventDate = selectedEvent.date;

        setHighestPriorityEvents(prev => prev.filter(e => e.id !== selectedEvent.id));

        const isNextDay = eventDate === buildDfpDate && (activeView === 'NextDayBuild' || activeView === 'Priorities' || activeView === 'ProgramData');

        if (isNextDay) {
            setNextDayBuildEvents(prev => prev.filter(e => e.id !== selectedEvent.id));
        } else {
            setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => {
                const newScheduleForDate = (prev[eventDate] || []).filter(e => e.id !== selectedEvent.id);
                return { ...prev, [eventDate]: newScheduleForDate };
            });
        }
        
        // NEW APPROACH: Trigger PT-051 sync after deletion (only for Active DFP)
        if (!isNextDay) {
            console.log('📋 Triggering PT-051 sync after event deletion...');
            setTimeout(() => {
                console.log('⏰ Executing delayed PT-051 sync after deletion...');
                setPublishedSchedules(currentSchedules => {
                    setPt051Assessments(currentAssessments => {
                        syncPt051WithActiveDfp(currentSchedules, currentAssessments);
                        return currentAssessments;
                    });
                    return currentSchedules;
                });
            }, 500);
        }
           
           // Log the deletion to audit trail
           const pageName = isNextDay ? 'Next Day Build' : 'Program Schedule';
           const eventType = selectedEvent.type || 'event';
           const personName = selectedEvent.student || selectedEvent.pilot || selectedEvent.instructor || 'Unknown';
           const description = `Deleted ${eventType} event for ${personName}`;
           const changes = `Event: ${selectedEvent.syllabusItem || selectedEvent.flightNumber || eventType}, Time: ${selectedEvent.startTime}, Duration: ${selectedEvent.duration}hrs`;
           
           logAudit(pageName, "Delete", description, changes);
        setSelectedEvent(null);
    };
    
    // SCT & REMEDIAL AUTO-ADD SYSTEM
    // Auto-adds HIGH priority SCT and Force Schedule remedial events to highest priority list
    const syncPriorityEventsWithSctAndRemedial = () => {
        console.log('\ud83d\udccb Starting sync of priority events with SCT and remedial requests...');
        
        let added = 0;
        const newPriorityEvents = [...highestPriorityEvents];
        
        // 1. Auto-add HIGH priority SCT requests
        const highPrioritySctFlights = sctFlights.filter(req => 
            req.priority === 'High' && req.name.trim() !== '' && req.currency.trim() !== ''
        );
        const highPrioritySctFtds = sctFtds.filter(req => 
            req.priority === 'High' && req.name.trim() !== '' && req.currency.trim() !== ''
        );
        
        // Process SCT Flights
        highPrioritySctFlights.forEach(sctReq => {
            const existingEvent = newPriorityEvents.find(e => 
                e.flightNumber === sctReq.event && 
                (e.student === sctReq.name || e.pilot === sctReq.name)
            );
            
            if (!existingEvent) {
                const syllabusItem = syllabusDetails.find(s => s.code === sctReq.event);
                const trainee = traineesData.find(t => t.fullName === sctReq.name);
                const duration = syllabusItem?.duration || 1.5;
                
                const newEvent: ScheduleEvent = {
                    id: `sct-flight-${sctReq.id}`,
                    date: buildDfpDate,
                    type: 'flight',
                    instructor: '', // Will be assigned during scheduling
                    student: sctReq.flightType === 'Dual' ? sctReq.name : '',
                    pilot: sctReq.flightType === 'Solo' ? sctReq.name : '',
                    flightNumber: sctReq.event,
                    duration: duration,
                    startTime: 8.0, // Default start time
                    resourceId: '', // Will be assigned during scheduling
                    color: 'bg-red-500/50', // Highlight as high priority SCT
                    flightType: sctReq.flightType,
                    locationType: 'Local',
                    origin: school,
                    destination: school,
                    isTimeFixed: true,
                    isSct: true
                };
                
                newPriorityEvents.push(newEvent);
                added++;
                console.log('\u2705 Added HIGH priority SCT flight:', sctReq.event, 'for', sctReq.name);
            }
        });
        
        // Process SCT FTDs
        highPrioritySctFtds.forEach(sctReq => {
            const existingEvent = newPriorityEvents.find(e => 
                e.flightNumber === sctReq.event && 
                (e.student === sctReq.name || e.pilot === sctReq.name)
            );
            
            if (!existingEvent) {
                const syllabusItem = syllabusDetails.find(s => s.code === sctReq.event);
                const trainee = traineesData.find(t => t.fullName === sctReq.name);
                const duration = syllabusItem?.duration || 1.5;
                
                const newEvent: ScheduleEvent = {
                    id: `sct-ftd-${sctReq.id}`,
                    date: buildDfpDate,
                    type: 'ftd',
                    instructor: '', // Will be assigned during scheduling
                    student: sctReq.name,
                    flightNumber: sctReq.event,
                    duration: duration,
                    startTime: 8.0, // Default start time
                    resourceId: '', // Will be assigned during scheduling
                    color: 'bg-red-500/50', // Highlight as high priority SCT
                    flightType: 'Dual',
                    locationType: 'Local',
                    origin: school,
                    destination: school,
                    isTimeFixed: true,
                    isSct: true
                };
                
                newPriorityEvents.push(newEvent);
                added++;
                console.log('\u2705 Added HIGH priority SCT FTD:', sctReq.event, 'for', sctReq.name);
            }
        });
        
        // 2. Auto-add Force Schedule remedial events
        remedialRequests.forEach(remedialReq => {
            if (remedialReq.forceSchedule) {
                const existingEvent = newPriorityEvents.find(e => 
                    e.flightNumber === remedialReq.eventCode && 
                    e.isRemedial
                );
                
                if (!existingEvent) {
                    const syllabusItem = syllabusDetails.find(s => s.id === remedialReq.eventCode || s.code === remedialReq.eventCode);
                    const trainee = traineesData.find(t => t.idNumber === remedialReq.traineeId);
                    const duration = syllabus?.duration || 1.5;
                    
                    if (trainee && syllabusItem) {
                        const newEvent: ScheduleEvent = {
                            id: `remedial-${remedialReq.traineeId}-${remedialReq.eventCode}`,
                            date: buildDfpDate,
                            type: syllabusItem.type === 'FTD' ? 'ftd' : 
                                  syllabusItem.type === 'Ground School' ? 'ground' : 
                                  syllabusItem.type === 'Flight' ? 'flight' : 'flight',
                            instructor: '', // Will be assigned during scheduling
                            student: trainee.fullName,
                            flightNumber: syllabusItem.code,
                            duration: duration,
                            startTime: 8.0, // Default start time
                            resourceId: '', // Will be assigned during scheduling
                            color: 'bg-orange-500/50', // Highlight as remedial
                            flightType: syllabusItem.sortieType === 'Solo' ? 'Solo' : 'Dual',
                            locationType: 'Local',
                            origin: school,
                            destination: school,
                            isTimeFixed: true,
                            isRemedial: true
                        };
                        
                        newPriorityEvents.push(newEvent);
                        added++;
                        console.log('\u2705 Added Force Schedule remedial:', syllabusItem.code, 'for', trainee.fullName);
                    }
                }
            }
        });
        
        // Update state if changes were made
        if (added > 0) {
            setHighestPriorityEvents(newPriorityEvents);
            console.log(`\ud83d\udcca Priority Events Sync Complete: Added ${added} auto-generated events`);
        } else {
            console.log('\u2705 No new priority events to add');
        }
    };

    // NEW PT-051 SYNC SYSTEM
    // Syncs PT-051 assessments with Active DFP events
    const syncPt051WithActiveDfp = (currentPublishedSchedules?: Record<string, ScheduleEvent[]>, currentPt051Assessments?: Map<string, Pt051Assessment>) => {
        // Use provided parameters or fall back to current state
        const schedules = currentPublishedSchedules || publishedSchedules;
        const assessments = currentPt051Assessments || pt051Assessments;
        
        console.log('🔄 Starting PT-051 sync with Active DFP...');
        console.log('Published schedules keys:', Object.keys(schedules));
        
        // Get all events from Active DFP (published schedules only)
        const activeDfpEvents: ScheduleEvent[] = [];
        Object.values(schedules).forEach(scheduleEvents => {
            activeDfpEvents.push(...scheduleEvents);
        });
        
        console.log('Total events on Active DFP:', activeDfpEvents.length);
        console.log('Current PT-051 count:', assessments.size);
        console.log('Sample events:', activeDfpEvents.slice(0, 3).map(e => ({
            id: e.id,
            flightNumber: e.flightNumber,
            date: e.date,
            student: e.student,
            pilot: e.pilot,
            instructor: e.instructor
        })));
        
        const newAssessments = new Map(assessments);
        let created = 0;
        let deleted = 0;
        
        // FORWARD CHECK: Create PT-051s for events that don't have them
        activeDfpEvents.forEach(event => {
            // Skip DUTY SUP events
            const isDutySup = event?.flightNumber?.includes('Duty Sup');
            
            // Skip events on STBY line (both by flight number and resource allocation)
            const isStbyFlightNumber = event?.flightNumber?.toUpperCase().includes('STBY');
            const isStbyResource = event?.resourceId?.startsWith('STBY') || 
                                   event?.resourceId?.startsWith('BNF-STBY');
            
            // Skip deployment events
            const isDeployment = event?.type === 'deployment';
            
            // Include flight, FTD, ground, and CPT events for PT-051 creation
            const isValidEventType = event?.type === 'flight' || 
                                    event?.type === 'ftd' || 
                                    event?.type === 'ground' || 
                                    event?.type === 'cpt';
            
            if (isDutySup || isStbyFlightNumber || isStbyResource || isDeployment || !isValidEventType) {
                console.log('⏭️ Skipping event:', {
                    flightNumber: event?.flightNumber,
                    type: event?.type,
                    resourceId: event?.resourceId,
                    date: event?.date,
                    reason: isDutySup ? 'DUTY SUP' : 
                           isStbyFlightNumber || isStbyResource ? 'STBY allocation' : 
                           isDeployment ? 'Deployment' : 'Invalid event type'
                });
                return;
            }
            
            // Get trainees on this event
            const trainees: string[] = [];
            if (event.student) trainees.push(event.student);
            if (event.pilot && event.flightType === 'Solo') trainees.push(event.pilot);
            if (event.attendees && Array.isArray(event.attendees)) {
                trainees.push(...event.attendees);
            }
            
            // Log event types being processed for PT-051 creation
            if (trainees.length > 0) {
                console.log(`📋 Processing ${event.type} event for PT-051:`, {
                    flightNumber: event.flightNumber,
                    type: event.type,
                    date: event.date,
                    trainees: trainees
                });
            }
            
            // For each trainee, check if PT-051 exists
            trainees.forEach(traineeFullName => {
                const assessmentKey = `${event.id}-${traineeFullName}`;
                
                // Check if PT-051 already exists for this event-trainee combination
                const existingAssessment = Array.from(newAssessments.values()).find(
                    a => a.eventId === event.id && a.traineeFullName === traineeFullName
                );
                
                if (!existingAssessment) {
                    // Create new PT-051
                    const newAssessment: Pt051Assessment = {
                        id: `pt051-${assessmentKey}`,
                        traineeFullName: traineeFullName,
                        eventId: event.id,
                        flightNumber: event.flightNumber,
                        date: event.date,
                        instructorName: event.instructor || '',
                        overallGrade: null,
                        overallResult: null,
                        dcoResult: null,
                        overallComments: '',
                        isCompleted: false,
                        scores: ALL_ELEMENTS.map(element => ({
                            element,
                            grade: null,
                            comment: ''
                        }))
                    };
                    
                    newAssessments.set(newAssessment.id, newAssessment);
                    created++;
                    console.log('✅ Created PT-051 for', traineeFullName, 'on', event.flightNumber, event.date);
                }
            });
        });
        
        // UPDATE CHECK: Update existing PT-051s when event details change
        let updated = 0;
        newAssessments.forEach((assessment, assessmentId) => {
            // Find the corresponding event for this assessment
            const correspondingEvent = activeDfpEvents.find(e => e.id === assessment.eventId);
            
            if (correspondingEvent) {
                // Check if any fields need updating
                let needsUpdate = false;
                const updates: Partial<Pt051Assessment> = {};
                
                if (assessment.instructorName !== (correspondingEvent.instructor || '')) {
                    updates.instructorName = correspondingEvent.instructor || '';
                    needsUpdate = true;
                    console.log('📝 Instructor changed:', assessment.instructorName, '→', correspondingEvent.instructor);
                }
                
                if (assessment.flightNumber !== correspondingEvent.flightNumber) {
                    updates.flightNumber = correspondingEvent.flightNumber;
                    needsUpdate = true;
                    console.log('📝 Flight number changed:', assessment.flightNumber, '→', correspondingEvent.flightNumber);
                }
                
                if (assessment.date !== correspondingEvent.date) {
                    updates.date = correspondingEvent.date;
                    needsUpdate = true;
                    console.log('📝 Date changed:', assessment.date, '→', correspondingEvent.date);
                }
                
                if (needsUpdate) {
                    newAssessments.set(assessmentId, { ...assessment, ...updates });
                    updated++;
                    console.log('✏️ Updated PT-051 for', assessment.traineeFullName, 'on', assessment.flightNumber);
                }
            }
        });
        
        // REVERSE CHECK: Delete PT-051s whose events no longer exist on Active DFP
        const activeDfpEventIds = new Set(activeDfpEvents.map(e => e.id));
        const assessmentsToDelete: string[] = [];
        
        newAssessments.forEach((assessment, assessmentId) => {
            if (!activeDfpEventIds.has(assessment.eventId)) {
                assessmentsToDelete.push(assessmentId);
                console.log('🗑️ Deleting PT-051 for', assessment.traineeFullName, 'on', assessment.flightNumber, assessment.date, '(event no longer on Active DFP)');
            }
        });
        
        assessmentsToDelete.forEach(id => {
            newAssessments.delete(id);
            deleted++;
        });
        
        // Update state if changes were made
        if (created > 0 || deleted > 0 || updated > 0) {
            setPt051Assessments(newAssessments);
            console.log(`📊 PT-051 Sync Complete: Created ${created}, Updated ${updated}, Deleted ${deleted}`);
        } else {
            console.log('✅ PT-051s already in sync with Active DFP');
        }
    };
    
    const handleUpdatePriorityEvent = (eventId: string, updates: Partial<ScheduleEvent>) => {
        setHighestPriorityEvents(prevEvents => 
            prevEvents.map(event => 
                event.id === eventId ? { ...event, ...updates } : event
            )
        );
    };

    const handleSelectInstructorFromSchedule = (instructorName: string) => {
        const instructor = instructorsData.find(i => i.name === instructorName);
        if (instructor) {
            setSelectedPersonForProfile(instructor);
            handleNavigation('Instructors');
        }
    };

    const handleSelectTraineeFromSchedule = (traineeFullName: string) => {
        const trainee = traineesData.find(t => t.fullName === traineeFullName);
        if (trainee) {
            setSelectedPersonForProfile(trainee);
            handleNavigation('CourseRoster');
        }
    };
    
    const startBuildProcess = () => {
        const activeTrainees = traineesData.filter(t => !t.isPaused && !isPersonStaticallyUnavailable(t, flyingStartTime, ceaseNightFlying, buildDfpDate, 'flight'));
        let bnfTraineeCount = 0;

        activeTrainees.forEach(trainee => {
            const { next } = computeNextEventsForTrainee(trainee, traineeLMPs, scores, syllabusDetails);
            if (next && next.code.startsWith('BNF') && next.type === 'Flight') {
                bnfTraineeCount++;
            }
        });

        setNightFlyingTraineeCount(bnfTraineeCount);
        setShowNightFlyingInfo(true);

        setTimeout(() => {
            setShowNightFlyingInfo(false);
            runBuildAlgorithm();
        }, 3000);
    };

    const handleBuildDfp = () => {
        // Use robust string comparison to avoid timezone issues between Local and UTC dates
        const todayStr = getLocalDateString();
        
        // If the build date is today or in the past, show the warning
        if (buildDfpDate <= todayStr) {
            setShowDateWarning(true);
            return;
        }
        
        startBuildProcess();
    };

    const handleConfirmDateAndBuild = () => {
        setShowDateWarning(false);
        startBuildProcess();
    };

    const runBuildAlgorithm = () => {
        setIsBuildingDfp(true);
        setNextDayBuildEvents([]); // Clear previous build
        
        const ftdCount = school === 'ESL' ? 5 : 4;

        const config: DfpConfig = {
            instructors: instructorsData,
            trainees: traineesData,
            syllabus: syllabusDetails,
            scores,
            coursePriorities,
            coursePercentages,
            availableAircraftCount,
            ftdCount,
            courseColors,
            school,
            dayStart: flyingStartTime,
            dayEnd: flyingEndTime,
            allowNightFlying,
            commenceNightFlying,
            ceaseNightFlying,
            buildDate: buildDfpDate,
            highestPriorityEvents,
            programWithPrimaries,
            traineeLMPs,
            flightTurnaround,
            ftdTurnaround,
            cptTurnaround,
            preferredDutyPeriod,
            maxCrewDutyPeriod,
            eventLimits,
            sctFtds: [], // Pass empty arrays for now
            sctFlights: [],
            remedialRequests: [],
        };

        setTimeout(() => {
            try {
                console.log('Starting DFP build process for', buildDfpDate);
                const generated = generateDfpInternal(config, setDfpBuildProgress);
                console.log('DFP build completed, generated', generated.length, 'events');
                setNextDayBuildEvents(generated);

                const notifications: string[] = [];
                const allPersonnel = [...instructorsData, ...traineesData];
                generated.forEach(event => {
                    getPersonnel(event).forEach(personName => {
                        const person = allPersonnel.find(p => p.name === personName || ('fullName' in p && p.fullName === personName));
                        if(person && isPersonStaticallyUnavailable(person, event.startTime, event.startTime + event.duration, buildDfpDate, event.type)) {
                            notifications.push(`${personName} in event ${event.flightNumber} at ${event.startTime.toFixed(2)} conflicts with a static unavailability period.`);
                   
                   // Log the build action to audit trail
                   logAudit(
                       "Next Day Build",
                       "Add",
                       `NEO-Build completed for ${buildDfpDate}`,
                       `Generated ${generated.length} events, Flight: ${generated.filter(e => e.type === flight).length}, FTD: ${generated.filter(e => e.type === ftd).length}, Ground: ${generated.filter(e => e.type === ground).length}`
                   );
                        }
                    });
                });
                
                if (notifications.length > 0) {
                    setUnavailabilityNotifications(notifications);
                }

            } catch (error) {
                console.error("DFP Build Failed:", error);
                setDfpBuildProgress({ message: 'Error during build!', percentage: 100 });
            } finally {
                setTimeout(() => {
                    setIsBuildingDfp(false);
                    handleNavigation('NextDayBuild');
                }, 1000);
            }
        }, 500);
    };

    const handlePublish = () => {
        if(nextDayBuildEvents.length > 0) {
            setShowPublishConfirm(true);
        } else {
            alert("No DFP has been built to publish. Please run 'Build DFP' first.");
        }
    };

    const handleConfirmPublish = () => {
        // Close the confirmation flyout immediately
        setShowPublishConfirm(false);
        
        const newEventsForDate = nextDayBuildEvents.map(e => ({ ...e, date: buildDfpDate }));
        
        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => ({
            ...prev,
            [buildDfpDate]: newEventsForDate
        }));
        
        // NEW APPROACH: Sync PT-051s with Active DFP after publish
        console.log('📋 Triggering PT-051 sync after publish...');
        setTimeout(() => {
            console.log('⏰ Executing delayed PT-051 sync after publish...');
            setPublishedSchedules(currentSchedules => {
                setPt051Assessments(currentAssessments => {
                    syncPt051WithActiveDfp(currentSchedules, currentAssessments);
                    return currentAssessments;
                });
                return currentSchedules;
            });
        }, 500);
        
        // Snapshot the schedule as the baseline for change detection
        setBaselineSchedules((prev) => ({
            ...prev,
           
            [buildDfpDate]: JSON.parse(JSON.stringify(newEventsForDate))
        }));
           
           // Log the publish action to audit trail
           logAudit(
               "Next Day Build",
               "Edit",
               `Published schedule for ${buildDfpDate}`,
               `Total events: ${newEventsForDate.length}, Flight: ${newEventsForDate.filter(e => e.type === "flight").length}, FTD: ${newEventsForDate.filter(e => e.type === "ftd").length}, Ground: ${newEventsForDate.filter(e => e.type === "ground").length}`
           );

        setDate(buildDfpDate);
        setNextDayBuildEvents([]);
        setActiveView('Program Schedule');
        setSuccessMessage('DFP Successfully Published!');
    };


    const handleScheduleUpdate = (updates: { eventId: string; newStartTime?: number; newResourceId?: string; }[]) => {
        if (!updates || updates.length === 0) return;
    
        // Get current schedule before updating
        const currentScheduleForDate = publishedSchedules[date] || [];
        
        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => {
            const scheduleForDate = prev[date] || [];
            const updatesMap = new Map(updates.map(u => [u.eventId, u]));
    
            const newScheduleForDate = scheduleForDate.map(event => {
                if (updatesMap.has(event.id)) {
                    const update = updatesMap.get(event.id)!;
                    return {
                        ...event,
                        startTime: update.newStartTime ?? event.startTime,
                        resourceId: update.newResourceId ?? event.resourceId,
                    };
                }
                return event;
            });
            return { ...prev, [date]: newScheduleForDate };
        });
           
        // Log the updates to audit trail
updates.forEach(update => {
               const event = currentScheduleForDate.find(e => e.id === update.eventId);
               if (event) {
                      // Capture original values BEFORE they change
                      const originalStartTime = event.startTime;
                      const originalResourceId = event.resourceId;
                      const eventType = event.type || 'event';
                      const personName = event.student || event.pilot || event.instructor || 'Unknown';
                      
                      // Use debounced logging - waits 3 seconds after last move
                      // Pass original and new values separately so debouncer can track them
                      debouncedAuditLog(
                          `schedule-move-${update.eventId}`,
                          {
                              page: "Program Schedule",
                              action: "Edit",
                              description: `Moved ${eventType} event for ${personName}`,
                              originalValues: {
                                  startTime: originalStartTime,
                                  resourceId: originalResourceId
                              },
                              newValues: {
                                  startTime: update.newStartTime,
                                  resourceId: update.newResourceId
                              }
                          },
                          logAudit
                      );
               }
           });
       };    
    const handleNextDayScheduleUpdate = (updates: { eventId: string; newStartTime?: number; newResourceId?: string; }[]) => {
        if (!updates || updates.length === 0) return;
    
        // Get current events before updating
        const currentEvents = nextDayBuildEvents;
        
        setNextDayBuildEvents(prev => {
            const updatesMap = new Map(updates.map(u => [u.eventId, u]));
            return prev.map(event => {
                if (updatesMap.has(event.id)) {
                    const update = updatesMap.get(event.id)!;
                    return {
                        ...event,
                        startTime: update.newStartTime ?? event.startTime,
                        resourceId: update.newResourceId ?? event.resourceId,
                    };
                }
                return event;
            });
        });
        
// Log the updates to audit trail
           updates.forEach(update => {
               const event = currentEvents.find(e => e.id === update.eventId);
               if (event) {
                      // Capture original values BEFORE they change
                      const originalStartTime = event.startTime;
                      const originalResourceId = event.resourceId;
                      const eventType = event.type || 'event';
                      const personName = event.student || event.pilot || event.instructor || 'Unknown';
                      
                      // Use debounced logging - waits 3 seconds after last move
                      // Pass original and new values separately so debouncer can track them
                      debouncedAuditLog(
                          `ndb-move-${update.eventId}`,
                          {
                              page: "Next Day Build",
                              action: "Edit",
                              description: `Moved ${eventType} event for ${personName}`,
                              originalValues: {
                                  startTime: originalStartTime,
                                  resourceId: originalResourceId
                              },
                              newValues: {
                                  startTime: update.newStartTime,
                                  resourceId: update.newResourceId
                              }
                          },
                          logAudit
                      );
               }
           });    };

    const syllabusForModal = useMemo(() => {
        return syllabusDetails.map(item => item.id);
    }, [syllabusDetails]);

    const addTileSyllabusOptions = useMemo(() => {
        return syllabusDetails.filter(item => 
            item.type === 'Flight' || 
            item.type === 'FTD' ||
            (item.type === 'Ground School' && item.code.includes('CPT'))
        ).map(item => item.id);
    }, [syllabusDetails]);
    
    const handleAuthorise = (eventId: string, notes: string, role: 'autho' | 'captain', isVerbal: boolean) => {
        const now = new Date().toISOString();
        const authoSigner = currentUserName; // Current logged in user
        
        let wasFullyAuthed = false;
        let eventThatWasUpdated: ScheduleEvent | null = null;
        
        const updateEventsInState = (eventsList: ScheduleEvent[]) => {
            return eventsList.map(e => {
                if (e.id === eventId) {
                    const updatedEvent = { ...e, authNotes: notes };
                    
                    if (role === 'autho') {
                        updatedEvent.authoSignedBy = authoSigner;
                        updatedEvent.authoSignedAt = now;
                    } else if (role === 'captain') {
                        updatedEvent.captainSignedBy = updatedEvent.instructor || updatedEvent.pilot;
                        updatedEvent.captainSignedAt = now;
                        updatedEvent.isVerbalAuth = isVerbal;
                    }
                    
                    const isNowFullyAuthorized = !!(updatedEvent.authoSignedBy && updatedEvent.captainSignedBy);
                    if (isNowFullyAuthorized) {
                        wasFullyAuthed = true;
                    }
                    
                    eventThatWasUpdated = updatedEvent;
                    return updatedEvent;
                }
                return e;
            });
        };
    
        setEvents(prev => updateEventsInState(prev));
        setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => Object.fromEntries(
            Object.entries(prev).map(([key, eventsList]) => [key, updateEventsInState(eventsList)])
        ));
        
        if (eventThatWasUpdated) {
            setEventForAuth(eventThatWasUpdated);
        }
        
        if (role === 'captain') {
            setShowAuthFlyout(false);
            setEventForAuth(null);
        }
    
        if (wasFullyAuthed) {
            setSuccessMessage('Flight Authorised!');
        }
    };

    const handleBulkUpdateInstructors = useCallback((updatedInstructors: Instructor[]) => {
        const updatedMap = new Map(updatedInstructors.map(i => [i.idNumber, i]));
        
        setInstructorsData(prevInstructors => {
            const existingIds = new Set(prevInstructors.map(i => i.idNumber));
            const updatedExisting = prevInstructors.map(i => updatedMap.get(i.idNumber) || i);
            const newToAdd = updatedInstructors.filter(ui => !existingIds.has(ui.idNumber));
            return [...updatedExisting, ...newToAdd];
        });
    }, []);

    const handleReplaceInstructors = useCallback((newInstructors: Instructor[]) => {
        setInstructorsData(newInstructors);
        setSuccessMessage('Instructors successfully replaced!');
    }, []);

    const handleBulkUpdateTrainees = useCallback((updatedTrainees: Trainee[]) => {
        const updatedMap = new Map(updatedTrainees.map(t => [t.idNumber, t]));
        
        setTraineesData(prevTrainees => {
            const existingIds = new Set(prevTrainees.map(t => t.idNumber));
            const updatedExisting = prevTrainees.map(t => updatedMap.get(t.idNumber) || t);
            const newToAdd = updatedTrainees.filter(ut => !existingIds.has(ut.idNumber));
            return [...updatedExisting, ...newToAdd];
        });
    }, []);

    const handleReplaceTrainees = useCallback((newTrainees: Trainee[]) => {
        setTraineesData(newTrainees);
        setSuccessMessage('Trainees successfully replaced!');
    }, []);
    
    const handleUpdateSyllabus = useCallback((newSyllabus: SyllabusItemDetail[]) => {
        const updatedMap = new Map(newSyllabus.map(s => [s.code.trim().replace(/\s/g, '').toLowerCase(), s]));
        setSyllabusDetails(prevSyllabus => {
            const finalSyllabus = prevSyllabus.map(s => {
                const key = s.code.trim().replace(/\s/g, '').toLowerCase();
                return updatedMap.get(key) || s;
            });
            const existingCodes = new Set(prevSyllabus.map(s => s.code.trim().replace(/\s/g, '').toLowerCase()));
            const newToAdd = newSyllabus.filter(s => !existingCodes.has(s.code.trim().replace(/\s/g, '').toLowerCase()));
            return [...finalSyllabus, ...newToAdd];
        });
    }, []);

    // New handler for single item updates
    const handleUpdateSyllabusItem = (updatedItem: SyllabusItemDetail) => {
        setSyllabusDetails(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    };

    const handleUpdateGradDate = (courseName: string, newGradDate: string) => {
        setCourses(prevCourses => 
            prevCourses.map(course => 
                course.name === courseName ? { ...course, gradDate: newGradDate } : course
            )
        );
    };

    const handleUpdateStartDate = (courseName: string, newStartDate: string) => {
        setCourses(prevCourses => 
            prevCourses.map(course => 
                course.name === courseName ? { ...course, startDate: newStartDate } : course
            )
        );
    };

    const handleSetIsMultiSelectMode = (enabled: boolean) => {
        setIsMultiSelectMode(enabled);
        if (!enabled) {
            setSelectedEventIds(new Set());
        }
    };

    const allTraineesByCourse = useMemo(() => {
        const groups: { [course: string]: Trainee[] } = {};
        traineesData.forEach(trainee => {
            if (!groups[trainee.course]) {
                groups[trainee.course] = [];
            }
            groups[trainee.course].push(trainee);
        });
        return groups;
    }, [traineesData]);

    const handleSaveGroundEvent = (data: any) => {
        const syllabusItem = syllabusDetails.find(s => s.code === data.flightNumber);
        if (!syllabusItem) return;

        const newEvent: Omit<ScheduleEvent, 'date'> = {
            id: uuidv4(),
            type: 'ground',
            flightNumber: data.flightNumber,
            startTime: data.startTime,
            duration: syllabusItem.duration,
            instructor: data.instructor,
            attendees: data.attendees,
            resourceId: data.resourceId,
            color: 'bg-teal-400/50',
            flightType: 'Dual',
            locationType: 'Local',
            origin: school,
            destination: school,
            authNotes: data.location // Using notes field as location for CPTs
        };

        setNextDayBuildEvents(prev => [...prev, newEvent]);
        setShowAddGroundEvent(false);
        setSuccessMessage('Ground event added to the build.');
    };


    // --- NEO ALGORITHM IMPLEMENTATION ---
    const generateTraineeRemedies = useCallback((conflictedEvent: ScheduleEvent, allEvents: ScheduleEvent[]): NeoTraineeRemedy[] => {
        const suggestions: NeoTraineeRemedy[] = [];
        const eventWindow = getEventBookingWindow(conflictedEvent, syllabusDetails);
        const conflictedSyllabusId = conflictedEvent.flightNumber;
    
        const otherTrainees = traineesData.filter(t => t.fullName !== conflictedEvent.student && !t.isPaused);
    
        for (const trainee of otherTrainees) {
            // 1. Check if their next event matches
            const nextEvents = computeNextEventsForTrainee(trainee, traineeLMPs, scores, syllabusDetails);
            if (nextEvents.next?.id !== conflictedSyllabusId) {
                continue;
            }
    
            // 2. Check availability
            if (isPersonStaticallyUnavailable(trainee, eventWindow.start, eventWindow.end, conflictedEvent.date, conflictedEvent.type as any)) {
                continue;
            }
    
            const hasOverlap = allEvents.some(e => {
                if (e.id === conflictedEvent.id) return false;
                if (!getPersonnel(e).includes(trainee.fullName)) return false;
                const otherEventWindow = getEventBookingWindow(e, syllabusDetails);
                return eventWindow.start < otherEventWindow.end && eventWindow.end > otherEventWindow.start;
            });
    
            if (hasOverlap) {
                continue;
            }
            
            // All checks passed
            const daysSinceLastFlight = daysSince(trainee.lastFlightDate, conflictedEvent.date);
            const traineeEventsToday = allEvents.filter(e => getPersonnel(e).includes(trainee.fullName));
            const flightsToday = traineeEventsToday.filter(e => e.type === 'flight').length;
            const ftdsToday = traineeEventsToday.filter(e => e.type === 'ftd').length;
            const cptsToday = traineeEventsToday.filter(e => e.type === 'cpt' || (e.type === 'ground' && e.flightNumber.includes('CPT'))).length;
            const groundToday = traineeEventsToday.filter(e => e.type === 'ground' && !(e.type === 'cpt' || e.flightNumber.includes('CPT'))).length;
            
            suggestions.push({
                type: 'trainee',
                trainee: {
                    name: trainee.fullName,
                    rank: trainee.rank,
                    course: trainee.course,
                    daysSinceLastFlight,
                    flightsToday,
                    ftdsToday,
                    cptsToday,
                    groundToday
                }
            });
        }
    
        // Sort by most needy (longest since last flight)
        return suggestions.sort((a, b) => b.trainee.daysSinceLastFlight - a.trainee.daysSinceLastFlight);
    }, [traineesData, syllabusDetails, traineeLMPs, scores]);
    
    const generateInstructorRemediesAtTime = useCallback((conflictedEvent: ScheduleEvent, allEvents: ScheduleEvent[], atTime: number): NeoInstructorRemedy[] => {
        const suggestions: NeoInstructorRemedy[] = [];
        const eventAtNewTime = { ...conflictedEvent, startTime: atTime };
        const eventWindow = getEventBookingWindow(eventAtNewTime, syllabusDetails);

        for (const instructor of instructorsData) {
            // Check qualification
            const isQFI = instructor.role === 'QFI';
            const isSimIp = instructor.role === 'SIM IP';
            const isQualified = (conflictedEvent.type === 'flight' && isQFI) || 
                                (conflictedEvent.type === 'ftd' && (isQFI || isSimIp)) || 
                                (conflictedEvent.type === 'ground');
            if (!isQualified) continue;
    
            // Check static unavailability
            if (isPersonStaticallyUnavailable(instructor, eventWindow.start, eventWindow.end, conflictedEvent.date, conflictedEvent.type as any)) continue;
            
            // Check for overlaps with other events for this instructor
            const hasOverlap = allEvents.some(e => {
                if (e.id === conflictedEvent.id) return false;
                if (!getPersonnel(e).includes(instructor.name)) return false;
                const otherEventWindow = getEventBookingWindow(e, syllabusDetails);
                return eventWindow.start < otherEventWindow.end && eventWindow.end > otherEventWindow.start;
            });
            if (hasOverlap) continue;

            // All checks passed, add as a remedy
            const instructorEventsToday = allEvents.filter(e => e.id !== conflictedEvent.id && getPersonnel(e).includes(instructor.name));
            const flightsToday = instructorEventsToday.filter(e => e.type === 'flight').length;
            const ftdsToday = instructorEventsToday.filter(e => e.type === 'ftd').length;
            const cptsToday = instructorEventsToday.filter(e => e.type === 'cpt' || (e.type === 'ground' && e.flightNumber.includes('CPT'))).length;
            const groundToday = instructorEventsToday.filter(e => e.type === 'ground' && !(e.type === 'cpt' || e.flightNumber.includes('CPT'))).length;

            const dutyHours = calculateProjectedDuty(instructor.name, allEvents.filter(e => e.id !== conflictedEvent.id), eventAtNewTime, syllabusDetails);
            
            suggestions.push({
                type: 'instructor',
                instructor: {
                    name: instructor.name,
                    rank: instructor.rank,
                    dutyHours,
                    flightsToday,
                    ftdsToday,
                    cptsToday,
                    groundToday,
                }
            });
        }

        return suggestions.sort((a, b) => {
            const eventCountA = a.instructor.flightsToday + a.instructor.ftdsToday + a.instructor.cptsToday + a.instructor.groundToday;
            const eventCountB = b.instructor.flightsToday + b.instructor.ftdsToday + b.instructor.cptsToday + b.instructor.groundToday;
            if (eventCountA !== eventCountB) return eventCountA - eventCountB;
            return a.instructor.dutyHours - b.instructor.dutyHours;
        });
    }, [instructorsData, syllabusDetails]);
    
    // --- New Iterative Turnaround Fix ---
    const findClosestTurnaroundFix = (
        problemEvent: ScheduleEvent,
        allEvents: ScheduleEvent[],
        context: AlgoContext,
        flyingWindow: { start: number; end: number }
    ): NeoTimeShiftRemedy | null => {
        const { flightTurnaround, ftdTurnaround, syllabusDetails, instructorsData, traineesData, getPersonnel, getEventBookingWindow, isPersonStaticallyUnavailable, maxCrewDutyPeriod } = context;

        const eventsOnResource = allEvents
            .filter(e => e.resourceId === problemEvent.resourceId && e.id !== problemEvent.id)
            .sort((a, b) => a.startTime - b.startTime);

        const prevEvent = eventsOnResource.filter(e => e.startTime < problemEvent.startTime).pop();
        const nextEvent = eventsOnResource.find(e => e.startTime > problemEvent.startTime);

        let waveType: 'first' | 'middle' | 'last' = 'middle';
        if (!prevEvent) waveType = 'first';
        if (!nextEvent) waveType = 'last';

        let baseTurnaround = 0;
        if (problemEvent.type === 'flight') baseTurnaround = flightTurnaround;
        else if (problemEvent.type === 'ftd') baseTurnaround = ftdTurnaround;

        const testTime = (newStartTime: number): boolean => {
            const tempEvent = { ...problemEvent, startTime: newStartTime };
            const eventWindow = getEventBookingWindow(tempEvent, syllabusDetails);

            if (eventWindow.start < flyingWindow.start || eventWindow.end > flyingWindow.end) return false;

            const nowInHours = new Date().getHours() + new Date().getMinutes() / 60;
            if (newStartTime < problemEvent.startTime && eventWindow.start < nowInHours) return false;

            if (prevEvent) {
                let effectiveTurnaround = baseTurnaround;
                const prevCrew = getPersonnel(prevEvent);
                const currentCrew = getPersonnel(problemEvent);
                const hasCommonCrew = prevCrew.some(p => currentCrew.includes(p));
                if (hasCommonCrew) {
                    const prevSyllabus = syllabusDetails.find(s => s.id === prevEvent.flightNumber);
                    const currentSyllabus = syllabusDetails.find(s => s.id === problemEvent.flightNumber);
                    const crewGap = (prevSyllabus?.postFlightTime || 0) + (currentSyllabus?.preFlightTime || 0);
                    effectiveTurnaround = Math.max(baseTurnaround, crewGap);
                }
                if (newStartTime < prevEvent.startTime + prevEvent.duration + effectiveTurnaround) return false;
            }

            if (nextEvent) {
                 let effectiveTurnaround = baseTurnaround;
                 const nextCrew = getPersonnel(nextEvent);
                 const currentCrew = getPersonnel(problemEvent);
                 const hasCommonCrew = nextCrew.some(p => currentCrew.includes(p));
                 if (hasCommonCrew) {
                    const currentSyllabus = syllabusDetails.find(s => s.id === problemEvent.flightNumber);
                    const nextSyllabus = syllabusDetails.find(s => s.id === nextEvent.flightNumber);
                    const crewGap = (currentSyllabus?.postFlightTime || 0) + (nextSyllabus?.preFlightTime || 0);
                    effectiveTurnaround = Math.max(baseTurnaround, crewGap);
                 }
                if (newStartTime + problemEvent.duration + effectiveTurnaround > nextEvent.startTime) return false;
            }

            const originalCrew = getPersonnel(problemEvent);
            for (const personName of originalCrew) {
                const person = [...instructorsData, ...traineesData].find(p => ('fullName' in p ? p.fullName : p.name) === personName);
                if (!person) continue;

                if (isPersonStaticallyUnavailable(person, eventWindow.start, eventWindow.end, problemEvent.date, problemEvent.type as any)) return false;
                
                const hasOverlap = allEvents.some(e => {
                    if (e.id === problemEvent.id) return false;
                    if (!getPersonnel(e).includes(personName)) return false;
                    const otherEventWindow = getEventBookingWindow(e, syllabusDetails);
                    return eventWindow.start < otherEventWindow.end && eventWindow.end > otherEventWindow.start;
                });
                if (hasOverlap) return false;
                
                const otherEventsForPerson = allEvents.filter(e => e.id !== problemEvent.id && getPersonnel(e).includes(personName));
                const projectedDuty = calculateProjectedDuty(personName, otherEventsForPerson, tempEvent, syllabusDetails);
                if (projectedDuty > maxCrewDutyPeriod) return false;
            }

            return true;
        };

        const offset = 5 / 60;
        const maxSearchSteps = Math.floor((flyingWindow.end - flyingWindow.start) / offset);

        for (let i = 1; i <= maxSearchSteps; i++) {
            const laterCandidate = problemEvent.startTime + i * offset;
            const earlierCandidate = problemEvent.startTime - i * offset;

            if (waveType === 'first' || (waveType === 'last' && !nextEvent)) {
                if (testTime(laterCandidate)) {
                    return { type: 'timeshift', newStartTime: laterCandidate, instructor: { name: problemEvent.instructor || '' } as any };
                }
            } else { // middle wave or last wave with next event
                if (testTime(laterCandidate)) {
                    return { type: 'timeshift', newStartTime: laterCandidate, instructor: { name: problemEvent.instructor || '' } as any };
                }
                if (testTime(earlierCandidate)) {
                    return { type: 'timeshift', newStartTime: earlierCandidate, instructor: { name: problemEvent.instructor || '' } as any };
                }
            }
        }
        return null;
    };
    
    const handleNeoClick = (event: ScheduleEvent) => {
        const isNextDayContext = ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
        const allEvents = isNextDayContext ? nextDayBuildEvents.map(e => ({...e, date: buildDfpDate})) : eventsForDate;
        
        const errors = findHardErrors(event, allEvents);

        if (errors.length === 0) {
            setShowInfoNotification('NEO found no hard errors for this event.');
            return;
        }
        
        setNeoProblemTileForFlyout({ event, errors });
        
        const isTurnaroundViolationOnly = errors.every(e => e.toLowerCase().includes('turnaround')) && errors.length > 0;
        const instructorIsConflicted = errors.some(e => event.instructor && e.includes(event.instructor.split(',')[0]));

        if (isTurnaroundViolationOnly || !instructorIsConflicted) {
            const context: AlgoContext = { flightTurnaround, ftdTurnaround, syllabusDetails, instructorsData, traineesData, getPersonnel, getEventBookingWindow, isPersonStaticallyUnavailable, generateInstructorRemediesAtTime, maxCrewDutyPeriod };
            const timeRemedy = findClosestTurnaroundFix(event, allEvents, context, { start: flyingStartTime, end: flyingEndTime });

            if (timeRemedy) {
                setTimeOnlyRemedyForConfirmation(timeRemedy);
                setShowTimeOnlyRemedyConfirm(true);
                setNeoRemediesForFlyout([]);
                return;
            } else if (isTurnaroundViolationOnly) {
                setShowInfoNotification("No resolution found for the turnaround violation. Changing crew will not fix this resource conflict.");
                setNeoProblemTileForFlyout(null);
                setNeoRemediesForFlyout([]);
                return;
            }
        }

        const traineeErrors = errors.filter(e => (event.student && e.includes(event.student.split(',')[0])));
        
        if (!instructorIsConflicted && traineeErrors.length > 0) {
            const remedies = generateTraineeRemedies(event, allEvents);
            if (remedies.length > 0) {
                setNeoRemediesForFlyout(remedies);
                return;
            }
        }

        const remedies = generateInstructorRemediesAtTime(event, allEvents, event.startTime);
        if (remedies.length > 0) {
            setNeoRemediesForFlyout(remedies);
        } else {
            setShowInfoNotification("No resolution found.");
            setNeoRemediesForFlyout([]);
        }
    };

    const handleApplyNeoRemedy = (remedy: NeoRemedy) => {
        if (!neoProblemTileForFlyout) return;

        if (remedy.type !== 'trainee' && remedy.instructor.dutyHours > preferredDutyPeriod) {
            setDutyWarningRemedy(remedy);
            setShowDutyWarning(true);
        } else {
            executeNeoRemedy(remedy, neoProblemTileForFlyout.event);
        }
    };

    const handleConfirmDutyWarning = () => {
        if (dutyWarningRemedy && neoProblemTileForFlyout) {
            executeNeoRemedy(dutyWarningRemedy, neoProblemTileForFlyout.event);
        }
        setShowDutyWarning(false);
        setDutyWarningRemedy(null);
    };

    const handleChooseTimeShift = () => {
        setShowNeoChoiceModal(false);
        setNeoRemediesForFlyout(timeShiftRemediesForChoice);
    };

    const handleChooseCrewChange = () => {
        setShowNeoChoiceModal(false);
        setNeoRemediesForFlyout(instructorRemediesForChoice);
    };

    const handleCancelTimeOnlyRemedy = () => {
        setShowTimeOnlyRemedyConfirm(false);
        setTimeOnlyRemedyForConfirmation(null);
        setNeoProblemTileForFlyout(null);
    };

    const handleSwitchToCrewChange = () => {
        setShowTimeOnlyRemedyConfirm(false);
        setTimeOnlyRemedyForConfirmation(null);
        
        if (neoProblemTileForFlyout) {
            const isNextDayContext = ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
            const allEvents = isNextDayContext ? nextDayBuildEvents.map(e => ({...e, date: buildDfpDate})) : eventsForDate;
            const remedies = generateInstructorRemediesAtTime(neoProblemTileForFlyout.event, allEvents, neoProblemTileForFlyout.event.startTime);
            setNeoRemediesForFlyout(remedies);
        }
    };

    const handleConfirmTimeOnlyRemedy = () => {
        if (timeOnlyRemedyForConfirmation && neoProblemTileForFlyout) {
            executeNeoRemedy(timeOnlyRemedyForConfirmation, neoProblemTileForFlyout.event);
        }
    };

    const findHardErrors = (event: ScheduleEvent, allEventsForDate: ScheduleEvent[]): string[] => {
        const errors: string[] = [];
        const eventWindow = getEventBookingWindow(event, syllabusDetails);

        // Check for missing instructor on Dual events
        if (event.flightType === 'Dual' && (!event.instructor || event.instructor.trim() === '' || event.instructor === 'TBD')) {
            errors.push('No instructor assigned.');
        }

        // Check for static unavailability for all personnel
        const personnel = getPersonnel(event);
        const allPersonnelData = [...instructorsData, ...traineesData];
        personnel.forEach(name => {
            const person = allPersonnelData.find(p => ('fullName' in p ? p.fullName : p.name) === name);
            if (person && isPersonStaticallyUnavailable(person, eventWindow.start, eventWindow.end, event.date, event.type as any)) {
                errors.push(`${name.split(',')[0]} is unavailable.`);
            }
        });
        
        // Check for resource double-booking and turnaround conflicts
        const eventsOnResource = allEventsForDate
            .filter(e => e.resourceId === event.resourceId && e.id !== event.id)
            .sort((a,b) => a.startTime - b.startTime);

        for(const otherEvent of eventsOnResource) {
            if (isOverlapping(event, otherEvent)) {
                 errors.push(`Resource conflict with ${otherEvent.flightNumber}.`);
            }
        }
        
        const prevEvent = eventsOnResource.filter(e => e.startTime < event.startTime).pop();
        const nextEvent = eventsOnResource.find(e => e.startTime > event.startTime);

        let turnaround = 0;
        if(event.type === 'flight') turnaround = flightTurnaround;
        else if (event.type === 'ftd') turnaround = ftdTurnaround;
        else if (event.type === 'ground' && event.flightNumber.includes('CPT')) turnaround = cptTurnaround;

        if (turnaround > 0) {
            if(prevEvent) {
                const gap = event.startTime - (prevEvent.startTime + prevEvent.duration);
                if (gap < turnaround) {
                    errors.push(`Turnaround violation with previous event (${prevEvent.flightNumber}).`);
                }
            }
            if(nextEvent) {
                const gap = nextEvent.startTime - (event.startTime + event.duration);
                if (gap < turnaround) {
                    errors.push(`Turnaround violation with next event (${nextEvent.flightNumber}).`);
                }
            }
        }


        // Check for personnel double-booking
        personnel.forEach(name => {
            const personEvents = allEventsForDate.filter(e => e.id !== event.id && getPersonnel(e).includes(name));
            for (const otherEvent of personEvents) {
                const otherEventWindow = getEventBookingWindow(otherEvent, syllabusDetails);
                if (eventWindow.start < otherEventWindow.end && eventWindow.end > otherEventWindow.start) {
                    errors.push(`${name.split(',')[0]} has an overlapping event (${otherEvent.flightNumber}).`);
                    break; 
                }
            }
        });

        return [...new Set(errors)];
    };
    
    
    const applyRemedyToEvents = (
        eventsList: Readonly<(ScheduleEvent | Omit<ScheduleEvent, 'date'>)[]>,
        remedy: NeoRemedy,
        problemTile: ScheduleEvent
    ): (ScheduleEvent | Omit<ScheduleEvent, 'date'>)[] => {
        return eventsList.map(event => {
            if (event.id === problemTile.id) {
                const updatedEvent = { ...event };
    
                if (remedy.type === 'timeshift') {
                    updatedEvent.startTime = remedy.newStartTime;
                    if (remedy.instructor.name) {
                        updatedEvent.instructor = remedy.instructor.name;
                    }
                } else if (remedy.type === 'instructor') {
                    updatedEvent.instructor = remedy.instructor.name;
                } else if (remedy.type === 'trainee') {
                    updatedEvent.student = remedy.trainee.name;
                }
    
                return updatedEvent;
            }
            return event;
        });
    };
    
    const executeNeoRemedy = (remedy: NeoRemedy, problemTile: ScheduleEvent): void => {
        const isNextDayContext = ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
        const targetDate = isNextDayContext ? buildDfpDate : date;
    
        if (isNextDayContext) {
            setNextDayBuildEvents(currentEvents => applyRemedyToEvents(currentEvents, remedy, problemTile) as Omit<ScheduleEvent, 'date'>[]);
        } else {
            setPublishedSchedules(prevSchedules => {
                const currentEventsForDate = prevSchedules[targetDate] || [];
                const newScheduleForDate = applyRemedyToEvents(currentEventsForDate, remedy, problemTile);
                return {
                    ...prevSchedules,
                    [targetDate]: newScheduleForDate as unknown as ScheduleEvent[],
                };
            });
        }
    };
    
    // This effect creates the reactive loop for Neo.
    useEffect(() => {
        // Only run if the NEO flyout is currently open.
        if (!neoProblemTileForFlyout) {
            return;
        }

        const isNextDayContext = ['NextDayBuild', 'Priorities', 'ProgramData', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule'].includes(activeView);
        const currentEvents = isNextDayContext ? nextDayBuildEvents.map(e => ({ ...e, date: buildDfpDate })) : eventsForDate;

        // Find the LATEST version of the problem tile from the current state.
        const updatedProblemTile = currentEvents.find(e => e.id === neoProblemTileForFlyout.event.id);

        if (!updatedProblemTile) {
            // The event was deleted or somehow disappeared. Clean up and close.
            setNeoProblemTileForFlyout(null);
            setNeoRemediesForFlyout([]);
            return;
        }

        // Re-run the error analysis on the updated tile and schedule.
        const newErrors = findHardErrors(updatedProblemTile, currentEvents);

        if (newErrors.length === 0) {
            // All problems are solved! Close the flyout and show success.
            setSuccessMessage(`All conflicts for ${updatedProblemTile.flightNumber} resolved.`);
            setNeoProblemTileForFlyout(null);
            setNeoRemediesForFlyout([]);
            setDutyWarningRemedy(null);
            setShowDutyWarning(false);
            setTimeOnlyRemedyForConfirmation(null);
            setShowTimeOnlyRemedyConfirm(false);
        } else {
            // Conflicts still exist. Generate new remedies and update the flyout's state.
            // This logic is simplified; a full implementation would call the same remedy generation
            // logic as handleNeoClick, but for brevity we'll just update the errors for now.
            // In a full re-analysis, you'd call generate...Remedies functions here.
            
            // Re-generate remedies based on the new state of errors
            const instructorErrors = newErrors.filter(e => e.toLowerCase().includes('instructor') || (updatedProblemTile.instructor && e.includes(updatedProblemTile.instructor.split(',')[0])));
            const traineeErrors = newErrors.filter(e => (updatedProblemTile.student && e.includes(updatedProblemTile.student.split(',')[0])));
            
            let newRemedies: NeoRemedy[] = [];
            
            if (instructorErrors.length === 0 && traineeErrors.length > 0) {
                newRemedies = generateTraineeRemedies(updatedProblemTile, currentEvents);
            } else {
                newRemedies = generateInstructorRemediesAtTime(updatedProblemTile, currentEvents, updatedProblemTile.startTime);
            }

            setNeoProblemTileForFlyout({ event: updatedProblemTile, errors: newErrors });
            setNeoRemediesForFlyout(newRemedies);
        }

    // We depend on the schedules and the flyout's open state.
    }, [publishedSchedules, nextDayBuildEvents, neoProblemTileForFlyout?.event.id]); // Re-run when schedules change if flyout is open


    const handleCancelNeo = () => {
        setNeoProblemTileForFlyout(null);
        setNeoRemediesForFlyout([]);
    };
    
    const handleSaveCurrencies = (allCurrencies: CurrencyDefinition[]) => {
        const newMasters = allCurrencies.filter(c => c.type === 'composite') as MasterCurrency[];
        const newReqs = allCurrencies.filter(c => c.type === 'primitive') as CurrencyRequirement[];
        setMasterCurrencies(newMasters);
        setCurrencyRequirements(newReqs);
        setSuccessMessage('Currency rules saved!');
    };
    
    const handleDeleteCurrency = (id: string) => {
        setMasterCurrencies(prev => prev.filter(c => c.id !== id));
        setCurrencyRequirements(prev => prev.filter(c => c.id !== id));
        setSuccessMessage('Currency deleted.');
    };

    const currencyNames = useMemo(() => {
        return [...masterCurrencies.map(c => c.name), ...currencyRequirements.map(c => c.name)].sort();
    }, [masterCurrencies, currencyRequirements]);

    // --- ORACLE HANDLERS ---
    const runOracleAnalysis = useCallback(() => {
        const isNextDayContext = oracleContext === 'nextDayBuild';
        const currentEvents = isNextDayContext ? nextDayBuildEvents.map(e => ({...e, date: buildDfpDate})) : eventsForDate;
        const analysisDate = isNextDayContext ? buildDfpDate : date;

        const instructorsAnalysis: OracleInstructorAnalysis[] = instructorsData.map(instructor => {
            const events = currentEvents.filter(e => getPersonnel(e).includes(instructor.name));
            return { instructor, availableWindows: [] }; // Placeholder
        });

        const traineesAnalysis: OracleTraineeAnalysis[] = traineesData.map(trainee => {
            const events = currentEvents.filter(e => getPersonnel(e).includes(trainee.fullName));
            const hasFtd = events.some(e => e.type === 'ftd');
            const hasFlight = events.some(e => e.type === 'flight');
            const nextSyllabusEvent = computeNextEventsForTrainee(trainee, traineeLMPs, scores, syllabusDetails).next;
            
            const isEligible = !(hasFtd && hasFlight) && nextSyllabusEvent?.type === 'Flight';

            return { trainee, availableWindows: [], nextSyllabusEvent, isEligible };
        });

        setOracleAnalysis({ instructors: instructorsAnalysis, trainees: traineesAnalysis });
    }, [instructorsData, traineesData, eventsForDate, date, nextDayBuildEvents, buildDfpDate, oracleContext, traineeLMPs, scores, syllabusDetails]);

    const handleToggleOracleMode = useCallback(() => {
        const isNextDay = ['NextDayBuild', 'NextDayInstructorSchedule', 'NextDayTraineeSchedule', 'Priorities', 'ProgramData'].includes(activeView);
        setOracleContext(isNextDay ? 'nextDayBuild' : 'program');
        
        if (!isOracleMode) {
            // runOracleAnalysis will now be called inside this effect, after context is set
        } else {
            setOracleAnalysis(null);
            setOraclePreviewEvent(null);
        }
        setIsOracleMode(prev => !prev);
    }, [isOracleMode, activeView]);

    useEffect(() => {
        if (isOracleMode) {
            runOracleAnalysis();
        }
    }, [isOracleMode, oracleContext, runOracleAnalysis]);


    const handleOracleMouseDown = useCallback((startTime: number, resourceId: string) => {
        const mockEvent: ScheduleEvent = {
            id: 'oracle-preview',
            date: oracleContext === 'nextDayBuild' ? buildDfpDate : date,
            startTime,
            duration: 1.2,
            resourceId,
            type: 'flight',
            flightNumber: 'Next Event',
            instructor: 'Checking...',
            student: 'Checking...',
            color: 'bg-sky-500/50',
            flightType: 'Dual',
            locationType: 'Local',
            origin: school,
            destination: school
        };
        setOraclePreviewEvent(mockEvent);
    }, [date, buildDfpDate, oracleContext, school]);

    const handleOracleMouseMove = useCallback((newStartTime: number, newResourceId: string) => {
        if (!oraclePreviewEvent || !oracleAnalysis) return;
        
        const currentEvents = oracleContext === 'nextDayBuild' ? nextDayBuildEvents.map(e => ({...e, date: buildDfpDate})) : eventsForDate;
        const analysisDate = oracleContext === 'nextDayBuild' ? buildDfpDate : date;

        const preFlightTime = 1.0;
        const postFlightTime = 0.5;
        const duration = 1.2;
        const bookingWindow = {
            start: newStartTime - preFlightTime,
            end: newStartTime + duration + postFlightTime
        };

        const instructorAvailable = oracleAnalysis.instructors.some(inst => {
            const personEvents = currentEvents.filter(e => getPersonnel(e).includes(inst.instructor.name));
            const hasOverlap = personEvents.some(e => {
                const existingWindow = getEventBookingWindow(e, syllabusDetails);
                return bookingWindow.start < existingWindow.end && bookingWindow.end > existingWindow.start;
            });
            return !isPersonStaticallyUnavailable(inst.instructor, bookingWindow.start, bookingWindow.end, analysisDate, 'flight') && !hasOverlap;
        });

        const traineeAvailable = oracleAnalysis.trainees.some(tr => {
            if (!tr.isEligible) return false;
            const personEvents = currentEvents.filter(e => getPersonnel(e).includes(tr.trainee.fullName));
            const hasOverlap = personEvents.some(e => {
                const existingWindow = getEventBookingWindow(e, syllabusDetails);
                return bookingWindow.start < existingWindow.end && bookingWindow.end > existingWindow.start;
            });
            return !isPersonStaticallyUnavailable(tr.trainee, bookingWindow.start, bookingWindow.end, analysisDate, 'flight') && !hasOverlap;
        });
        
        setOraclePreviewEvent({
            ...oraclePreviewEvent,
            startTime: newStartTime,
            resourceId: newResourceId,
            instructor: instructorAvailable ? 'Instructor ✓' : 'NO INSTRUCTOR ✕',
            student: traineeAvailable ? 'Trainee ✓' : 'NO TRAINEE ✕',
        });
    }, [oraclePreviewEvent, oracleAnalysis, eventsForDate, date, nextDayBuildEvents, buildDfpDate, oracleContext, syllabusDetails]);

    const handleOracleMouseUp = useCallback(() => {
        if (!oraclePreviewEvent || !oracleAnalysis) return;

        const currentEvents = oracleContext === 'nextDayBuild' ? nextDayBuildEvents.map(e => ({...e, date: buildDfpDate})) : eventsForDate;
        const analysisDate = oracleContext === 'nextDayBuild' ? buildDfpDate : date;

        const { startTime, duration } = oraclePreviewEvent;
        const preFlightTime = 1.0;
        const postFlightTime = 0.5;
        const bookingWindow = { start: startTime - preFlightTime, end: startTime + duration + postFlightTime };

        const availableInstructors = oracleAnalysis.instructors.filter(inst => {
             const personEvents = currentEvents.filter(e => getPersonnel(e).includes(inst.instructor.name));
             const hasOverlap = personEvents.some(e => {
                 const existingWindow = getEventBookingWindow(e, syllabusDetails);
                 return bookingWindow.start < existingWindow.end && bookingWindow.end > existingWindow.start;
             });
            return !isPersonStaticallyUnavailable(inst.instructor, bookingWindow.start, bookingWindow.end, analysisDate, 'flight') && !hasOverlap;
        }).map(i => i.instructor.name);
        
        const availableTraineesAnalysis = oracleAnalysis.trainees.filter(tr => {
            if (!tr.isEligible) return false;
             const personEvents = currentEvents.filter(e => getPersonnel(e).includes(tr.trainee.fullName));
             const hasOverlap = personEvents.some(e => {
                const existingWindow = getEventBookingWindow(e, syllabusDetails);
                return bookingWindow.start < existingWindow.end && bookingWindow.end > existingWindow.start;
            });
            return !isPersonStaticallyUnavailable(tr.trainee, bookingWindow.start, bookingWindow.end, analysisDate, 'flight') && !hasOverlap;
        });

        setOracleContextForModal({
            availableInstructors,
            availableTraineesAnalysis
        });
        
        const newEvent: ScheduleEvent = {
            id: uuidv4(),
            date: analysisDate,
            type: 'flight',
            flightNumber: '',
            duration: oraclePreviewEvent.duration,
            startTime: oraclePreviewEvent.startTime,
            resourceId: oraclePreviewEvent.resourceId,
            color: 'bg-sky-400/50',
            flightType: 'Dual',
            locationType: 'Local',
            origin: school,
            destination: school,
        };

        setSelectedEvent(newEvent);
        setIsEditingDefault(true);
        setOraclePreviewEvent(null);

    }, [oraclePreviewEvent, oracleAnalysis, date, school, eventsForDate, nextDayBuildEvents, buildDfpDate, oracleContext, syllabusDetails]);

    const handleSelectMyProfile = () => {
        const user = instructorsData.find(i => i.name === currentUserName);
        if (user) {
            setSelectedPersonForProfile(user);
            handleNavigation('Instructors');
        }
    };

    const handleNavigateToCurrency = (person: Instructor | Trainee) => {
        setSelectedPersonForCurrency(person);
        handleNavigation('Currency');
    };

    const handleSelectMyCurrency = () => {
        const user = instructorsData.find(i => i.name === currentUserName);
        if (user) {
            handleNavigateToCurrency(user);
        }
    };

    const handleSelectMySct = () => {
        const user = instructorsData.find(i => i.name === currentUserName); // Current logged in user
        if (user) {
            setInstructorForSct(user);
            setShowSctRequest(true);
        }
    };

    const handleCurrencyBack = () => {
        handleNavigation(previousView);
    };


    const renderActiveView = () => {
        switch (activeView) {
            case 'Program Schedule':
                return <ScheduleView 
                           date={date}
                           onDateChange={handleDateChange}
                           events={eventSegmentsForDate}
                           resources={buildResources}
                           instructors={instructorsData.map(i => i.name)}
                           traineesData={traineesData}
                           airframeCount={24}
                           standbyCount={4}
                           ftdCount={ftdCount}
                           cptCount={4}
                           onUpdateEvent={handleScheduleUpdate}
                           onSelectEvent={handleOpenModal}
                           onReorderResources={() => {}}
                           zoomLevel={zoomLevel}
                           showValidation={showValidation}
                           showPrePost={showPrePost}
                           syllabusDetails={syllabusDetails}
                           personnelData={personnelData}
                           seatConfigs={new Map()}
                           daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                           personnelConflicts={[]}
                           personnelConflictIds={personnelAndResourceConflictIds}
                           unavailabilityConflicts={unavailabilityConflicts}
                           onCptConflict={setCptConflict}
                           isMultiSelectMode={isMultiSelectMode}
                           selectedEventIds={selectedEventIds}
                           setSelectedEventIds={setSelectedEventIds}
                           detectConflictsForEvent={detectConflictsForEvent}
                           baselineEvents={baselineSchedules[date]}
                           isOracleMode={isOracleMode}
                           oraclePreviewEvent={oraclePreviewEvent}
                           onOracleMouseDown={handleOracleMouseDown}
                           onOracleMouseMove={handleOracleMouseMove}
                           onOracleMouseUp={handleOracleMouseUp}
                        />;
            case 'InstructorSchedule':
                return <InstructorScheduleView 
                            date={date}
                            onDateChange={handleDateChange}
                            events={eventsForDate}
                            instructors={instructorsData.map(i => ({ name: i.name, rank: i.rank }))}
                            traineesData={traineesData}
                            onSelectEvent={handleOpenModal}
                            onUpdateEvent={handleScheduleUpdate}
                            zoomLevel={zoomLevel}
                            daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                            personnelData={personnelData}
                            seatConfigs={new Map()}
                            syllabusDetails={syllabusDetails}
                            conflictingEventIds={personnelAndResourceConflictIds}
                            showValidation={showValidation}
                            unavailabilityConflicts={unavailabilityConflicts}
                            onSelectInstructor={handleSelectInstructorFromSchedule}
                        />;
            case 'TraineeSchedule':
                return <TraineeScheduleView
                            date={date}
                            onDateChange={handleDateChange}
                            events={eventsForDate}
                            trainees={traineesData.map(t => t.fullName)}
                            traineesData={traineesData}
                            onSelectEvent={handleOpenModal}
                            onUpdateEvent={handleScheduleUpdate}
                            zoomLevel={zoomLevel}
                            daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                            personnelData={personnelData}
                            seatConfigs={new Map()}
                            syllabusDetails={syllabusDetails}
                            conflictingEventIds={personnelAndResourceConflictIds}
                            showValidation={showValidation}
                            unavailabilityConflicts={unavailabilityConflicts}
                            onSelectTrainee={handleSelectTraineeFromSchedule}
                       />;
            case 'NextDayInstructorSchedule':
                return <NextDayInstructorScheduleView
                    events={nextDayBuildEvents.map(e => ({...e, date: buildDfpDate}))}
                    instructors={instructorsData.map(i => ({ name: i.name, rank: i.rank }))}
                    traineesData={traineesData}
                    onSelectEvent={(e) => handleOpenModal({...e, date: buildDfpDate}, {})}
                    onUpdateEvent={handleNextDayScheduleUpdate}
                    zoomLevel={zoomLevel}
                    daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                    personnelData={personnelData}
                    seatConfigs={new Map()}
                    syllabusDetails={syllabusDetails}
                    conflictingEventIds={nextDayPersonnelAndResourceConflictIds}
                    showValidation={showValidation}
                    onSelectInstructor={handleSelectInstructorFromSchedule}
                    buildDfpDate={buildDfpDate}
                    onDateChange={handleBuildDateChange}
                />;
            case 'NextDayTraineeSchedule':
                return <NextDayTraineeScheduleView
                    events={nextDayBuildEvents.map(e => ({...e, date: buildDfpDate}))}
                    trainees={traineesData.map(t => t.fullName)}
                    traineesData={traineesData}
                    onSelectEvent={(e) => handleOpenModal({...e, date: buildDfpDate}, {})}
                    onUpdateEvent={handleNextDayScheduleUpdate}
                    zoomLevel={zoomLevel}
                    daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                    personnelData={personnelData}
                    seatConfigs={new Map()}
                    syllabusDetails={syllabusDetails}
                    conflictingEventIds={nextDayPersonnelAndResourceConflictIds}
                    showValidation={showValidation}
                    onSelectTrainee={handleSelectTraineeFromSchedule}
                    buildDfpDate={buildDfpDate}
                    onDateChange={handleBuildDateChange}
                />;
            case 'CourseRoster':
                return <CourseRosterView 
                            events={events}
                            traineesData={traineesData}
                            courseColors={courseColors}
                            archivedCourses={archivedCourses}
                            personnelData={personnelData}
                            onNavigateToHateSheet={(trainee) => {
                                setSelectedTraineeForHateSheet(trainee);
                                handleNavigation('HateSheet');
                            }}
                            onRestoreCourse={() => {}}
                            onUpdateTrainee={(data) => setTraineesData(prev => prev.map(t => t.idNumber === data.idNumber ? data : t))}
                            onAddTrainee={handleAddTrainee}
                            school={school}
                            scores={scores}
                            syllabusDetails={syllabusDetails}
                            onNavigateToSyllabus={onNavigateToSyllabus}
                            onNavigateToCurrency={handleNavigateToCurrency}
                            onViewIndividualLMP={handleViewTraineeLMP}
                            onAddRemedialPackage={handleOpenAddRemedialPackage}
                            locations={locations}
                            units={units}
                            selectedPersonForProfile={selectedPersonForProfile as Trainee | null}
                            onProfileOpened={() => setSelectedPersonForProfile(null)}
                            traineeLMPs={traineeLMPs}
                            onViewLogbook={handleViewLogbook}
                        />;
            case 'HateSheet':
                if (selectedTraineeForHateSheet) {
                    const traineeAssessments = Array.from(pt051Assessments.values()).filter(
                        // FIX: Add explicit type annotation for `a` as TypeScript was failing to infer it.
                        (a: Pt051Assessment) => a.traineeFullName === selectedTraineeForHateSheet.fullName
                    );
                    const eventFromSchedules = [...eventsForDate, ...highestPriorityEvents];
                    return <HateSheetView
                                trainee={selectedTraineeForHateSheet}
                                lmpScores={scores.get(selectedTraineeForHateSheet.fullName) || []}
                                assessments={traineeAssessments}
                                onSelectLmpScore={(score) => {
                                    setSelectedScoreForDetail(score);
                                    handleNavigation('ScoreDetail');
                                }}
                                onSelectPt051={(assessment: Pt051Assessment) => {
                                    console.log('onSelectPt051 called with assessment:', assessment);
                                    
                                    // Log PT-051 view to audit trail
                                    logAudit('Performance History', 'View', `Viewed PT-051 for ${assessment.traineeFullName} - Event: ${assessment.flightNumber} (${assessment.date})`);
                                    
                                    // FIX: Add explicit type annotation for `a` as TypeScript was failing to infer it.
                                    const event = eventFromSchedules.find((a: ScheduleEvent) => a.id === assessment.eventId);
                                    if(event) {
                                        console.log('Found event in schedules:', event);
                                        setEventForPt051(event);
                                        handleNavigation('PT051');
                                    } else {
                                        const eventFromBuild = nextDayBuildEvents.find(e => e.id === assessment.eventId);
                                        if (eventFromBuild) {
                                            console.log('Found event in build:', eventFromBuild);
                                            setEventForPt051({ ...eventFromBuild, date: buildDfpDate });
                                            handleNavigation('PT051');
                                        } else {
                                            console.log('Event not found, creating mock event for assessment');
                                            // Create a mock event for the assessment
                                            // Determine event type based on flight number
                                            let eventType: 'flight' | 'ground' | 'cpt' = 'flight';
                                            const flightNum = assessment.flightNumber || '';
                                            
                                            if (flightNum.includes('CPT') || flightNum.includes('Cpt')) {
                                                eventType = 'cpt';
                                            } else if (flightNum.includes('MB') || flightNum.includes('GS') || 
                                                       flightNum.includes('Ground') || flightNum.includes('GROUND')) {
                                                eventType = 'ground';
                                            }
                                            
                                            const mockEvent: ScheduleEvent = {
                                                id: assessment.eventId,
                                                flightNumber: assessment.flightNumber,
                                                date: assessment.date,
                                                startTime: '08:00',
                                                endTime: '09:00',
                                                instructor: assessment.instructorName || 'Unknown',
                                                student: assessment.traineeFullName,
                                                syllabus: assessment.flightNumber,
                                                aircraft: '',
                                                type: eventType,
                                                status: 'Scheduled',
                                                notes: '',
                                                crew: []
                                            };
                                            console.log('Created mock event:', mockEvent);
                                            setEventForPt051(mockEvent);
                                            handleNavigation('PT051');
                                        }
                                    }
                                }}
                                onBackToRoster={() => {
                                    setSelectedPersonForProfile(selectedTraineeForHateSheet);
                                    handleNavigation('CourseRoster');
                                }}
                            />;
                }
                return null;
            case 'ScoreDetail':
                if (selectedTraineeForHateSheet && selectedScoreForDetail) {
                    return <ScoreDetailView 
                                trainee={selectedTraineeForHateSheet}
                                scoreData={selectedScoreForDetail}
                                onBack={() => handleNavigation('HateSheet')}
                           />;
                }
                return null;
            case 'NextDayBuild':
                return <NextDayBuildView
                            events={nextDayEventSegments}
                            resources={buildResources}
                            instructors={instructorsData.map(i => i.name)}
                            traineesData={traineesData}
                            airframeCount={24}
                            standbyCount={4}
                            ftdCount={ftdCount}
                            cptCount={4}
                            onUpdateEvent={handleNextDayScheduleUpdate}
                            onSelectEvent={(e) => handleOpenModal({...e, date: buildDfpDate}, {})}
                            onReorderResources={() => {}}
                            zoomLevel={zoomLevel}
                            showValidation={showValidation}
                            showPrePost={showPrePost}
                            syllabusDetails={syllabusDetails}
                            personnelData={personnelData}
                            seatConfigs={new Map()}
                            daylightTimes={{ firstLight: '06:30', lastLight: '18:30' }}
                            personnelConflicts={[]}
                            personnelConflictIds={nextDayPersonnelAndResourceConflictIds}
                            onCptConflict={setCptConflict}
                            date={buildDfpDate}
                            onDateChange={setBuildDfpDate}
                            isMultiSelectMode={isMultiSelectMode}
                            selectedEventIds={selectedEventIds}
                            setSelectedEventIds={setSelectedEventIds}
                            isOracleMode={isOracleMode}
                            oraclePreviewEvent={oraclePreviewEvent}
                            onOracleMouseDown={handleOracleMouseDown}
                            onOracleMouseMove={handleOracleMouseMove}
                            onOracleMouseUp={handleOracleMouseUp}
                       />;
            case 'Priorities':
                return <PrioritiesViewWithMenu 
                    coursePriorities={coursePriorities}
                    onUpdatePriorities={setCoursePriorities}
                    coursePercentages={coursePercentages}
                    onUpdatePercentages={setCoursePercentages}
                    availableAircraftCount={availableAircraftCount}
                    onUpdateAircraftCount={setAvailableAircraftCount}
                    availableFtdCount={availableFtdCount}
                    onUpdateFtdCount={setAvailableFtdCount}
                    availableCptCount={availableCptCount}
                    onUpdateCptCount={setAvailableCptCount}
                    flyingStartTime={flyingStartTime}
                    onUpdateFlyingStartTime={setFlyingStartTime}
                    flyingEndTime={flyingEndTime}
                    onUpdateFlyingEndTime={setFlyingEndTime}
                    ftdStartTime={ftdStartTime}
                    onUpdateFtdStartTime={setFtdStartTime}
                    ftdEndTime={ftdEndTime}
                    onUpdateFtdEndTime={setFtdEndTime}
                    allowNightFlying={allowNightFlying}
                    onUpdateAllowNightFlying={setAllowNightFlying}
                    commenceNightFlying={commenceNightFlying}
                    onUpdateCommenceNightFlying={setCommenceNightFlying}
                    ceaseNightFlying={ceaseNightFlying}
                    onUpdateCeaseNightFlying={setCeaseNightFlying}
                    instructorsData={instructorsData}
                    traineesData={traineesData}
                    buildDfpDate={buildDfpDate}
                    highestPriorityEvents={highestPriorityEvents}
                    onSelectEvent={(e) => handleOpenModal(e, { isPriority: true })}
                    onUpdatePriorityEvent={handleUpdatePriorityEvent}
                    programWithPrimaries={programWithPrimaries}
                    onUpdateProgramWithPrimaries={setProgramWithPrimaries}
                    sctFlights={sctFlights}
                    sctFtds={sctFtds}
                    onAddSctRequest={(type) => {
                      const newReq = { 
                          id: uuidv4(), 
                          name: '', 
                          event: 'SCT GF', 
                          currency: '', 
                          currencyExpire: '', 
                          priority: 'Medium' as 'Medium',
                          dateRequested: getLocalDateString()
                      };
                      if (type === 'flight') setSctFlights(prev => [...prev, newReq]);
                      else setSctFtds(prev => [...prev, newReq]);
                    }}
                    onRemoveSctRequest={(id, type) => {
                      if (type === 'flight') setSctFlights(prev => prev.filter(r => r.id !== id));
                      else setSctFtds(prev => prev.filter(r => r.id !== id));
                    }}
                    onUpdateSctRequest={(id, field, value, type) => {
                      const updater = (prev: SctRequest[]) => prev.map(r => r.id === id ? { ...r, [field]: value } : r);
                      if (type === 'flight') setSctFlights(updater);
                      else setSctFtds(updater);
                      
                      // Trigger priority sync after a short delay to ensure state is updated
                      setTimeout(() => {
                        if (field === 'priority' && value === 'High') {
                          syncPriorityEventsWithSctAndRemedial();
                        }
                      }, 100);
                    }}
                    syllabusDetails={syllabusDetails}
                    scores={scores}
                    traineeLMPs={traineeLMPs}
                    remedialRequests={remedialRequests}
                    onToggleRemedialRequest={(traineeId, eventCode) => {
                        setRemedialRequests(prev => {
                            const existing = prev.find(r => r.traineeId === traineeId && r.eventCode === eventCode);
                            let newRequests;
                            if (existing) {
                                // Toggle the forceSchedule property
                                newRequests = prev.map(r => 
                                    r.traineeId === traineeId && r.eventCode === eventCode 
                                        ? { ...r, forceSchedule: !r.forceSchedule }
                                        : r
                                );
                            } else {
                                // Create new request with forceSchedule set to true
                                newRequests = [...prev, { traineeId, eventCode, forceSchedule: true }];
                            }
                            
                            // Trigger priority sync after a short delay to ensure state is updated
                            setTimeout(() => {
                                syncPriorityEventsWithSctAndRemedial();
                            }, 100);
                            
                            return newRequests;
                        });
                    }}
                    currencyNames={currencyNames}
                />;
            case 'CourseProgress':
                return <CourseProgressView
                            courses={courses}
                            traineesData={traineesData}
                            courseColors={courseColors}
                            scores={scores}
                            traineeLMPs={traineeLMPs}
                            onUpdateGradDate={handleUpdateGradDate}
                            onUpdateStartDate={handleUpdateStartDate}
                        />;
            case 'ProgramData':
                 return <ProgramDataView
                            date={buildDfpDate}
                            events={nextDayBuildEvents.map(e => ({...e, date: buildDfpDate}))}
                            instructorsData={instructorsData}
                            traineesData={traineesData}
                            activeCourses={coursePriorities}
                            onNavigateAndSelectPerson={(name) => {
                                const person = [...instructorsData, ...traineesData].find(p => p.name === name || ('fullName' in p && p.fullName === name));
                                if (person) {
                                    if ('role' in person) handleSelectInstructorFromSchedule(name);
                                    else handleSelectTraineeFromSchedule(name);
                                }
                            }}
                            scores={scores}
                            syllabusDetails={syllabusDetails}
                            traineeLMPs={traineeLMPs}
                        />;
            case 'MyDashboard':
                // Get all events from published schedules for PT-051 lookup
                const allPublishedEvents: ScheduleEvent[] = [];
                Object.values(publishedSchedules).forEach(scheduleEvents => {
                    allPublishedEvents.push(...scheduleEvents);
                });
                
                return <MyDashboard 
                            userName={currentUser?.name ? currentUser.name.split(', ').reverse().join(' ') : 'Joe Bloggs'}
                            userRank={currentUser?.rank || 'FLTLT'}
                            events={eventsForDate.filter(e => e.instructor === currentUserName)}
                            onSelectEvent={handleOpenModal}
                            onNavigate={handleNavigation}
                            onSelectMyProfile={handleSelectMyProfile}
                            onSelectMyCurrency={handleSelectMyCurrency}
                            onSelectMySct={handleSelectMySct}
                            sctRequests={[...sctFlights, ...sctFtds]}
                            pt051Assessments={pt051Assessments}
                            onSelectPt051={(assessment) => {
                                console.log('🔍 Dashboard PT-051 clicked:', assessment);
                                console.log('Looking for event ID:', assessment.eventId);
                                console.log('Total events available:', allPublishedEvents.length);
                                
                                // Find the event associated with this PT-051
                                const event = allPublishedEvents.find(e => e.id === assessment.eventId);
                                console.log('Found event:', event);
                                
                                // Find the trainee
                                const trainee = traineesData.find(t => t.fullName === assessment.traineeFullName);
                                console.log('Found trainee:', trainee);
                                
                                if (event && trainee) {
                                    console.log('✅ Setting event and trainee, navigating to PT051');
                                    // Set state synchronously
                                    setEventForPt051(event);
                                    setSelectedTraineeForHateSheet(trainee);
                                    // Use setTimeout to ensure state is set before navigation
                                    setTimeout(() => {
                                        console.log('🚀 Navigating to PT051 view');
                                        handleNavigation('PT051');
                                    }, 0);
                                } else {
                                    console.error('❌ Could not find event or trainee for PT-051:', {
                                        assessment,
                                        eventFound: !!event,
                                        traineeFound: !!trainee,
                                        searchingForEventId: assessment.eventId,
                                        availableEventIds: allPublishedEvents.map(e => e.id).slice(0, 10),
                                        availableTrainees: traineesData.map(t => t.fullName).slice(0, 10),
                                        eventsForSameFlightNumber: allPublishedEvents.filter(e => e.flightNumber === assessment.flightNumber).map(e => ({id: e.id, date: e.date, instructor: e.instructor}))
                                    });
                                    
                                    // Try to find event by flight number and date as fallback
                                    console.log('🔄 Attempting fallback search...');
                                    console.log('Searching for:', {
                                        flightNumber: assessment.flightNumber,
                                        date: assessment.date,
                                        instructor: assessment.instructorName
                                    });
                                    
                                    const fallbackEvent = allPublishedEvents.find(e => 
                                        e.flightNumber === assessment.flightNumber && 
                                        e.date === assessment.date &&
                                        e.instructor === assessment.instructorName
                                    );
                                    
                                    console.log('Fallback result:', fallbackEvent);
                                    
                                    if (fallbackEvent && trainee) {
                                        console.log('✅ Found event using fallback (flight number + date + instructor):', fallbackEvent);
                                        setEventForPt051(fallbackEvent);
                                        setSelectedTraineeForHateSheet(trainee);
                                        setTimeout(() => {
                                            console.log('🚀 Navigating to PT051 view (fallback)');
                                            handleNavigation('PT051');
                                        }, 0);
                                    } else {
                                        console.error('❌ Primary fallback failed', {
                                            fallbackEventFound: !!fallbackEvent,
                                            traineeFound: !!trainee,
                                            matchingFlightNumbers: allPublishedEvents.filter(e => e.flightNumber === assessment.flightNumber).length,
                                            matchingDates: allPublishedEvents.filter(e => e.date === assessment.date).length,
                                            matchingInstructors: allPublishedEvents.filter(e => e.instructor === assessment.instructorName).length
                                        });
                                        
                                        // Try secondary fallback: just flight number and instructor (ignore date)
                                        console.log('🔄 Attempting secondary fallback (flight number + instructor only)...');
                                        const secondaryFallbackEvent = allPublishedEvents.find(e => 
                                            e.flightNumber === assessment.flightNumber && 
                                            e.instructor === assessment.instructorName
                                        );
                                        
                                        if (secondaryFallbackEvent && trainee) {
                                            console.log('✅ Found event using secondary fallback:', secondaryFallbackEvent);
                                            console.warn('⚠️ Note: Event date may differ from PT-051 date');
                                            setEventForPt051(secondaryFallbackEvent);
                                            setSelectedTraineeForHateSheet(trainee);
                                            setTimeout(() => {
                                                console.log('🚀 Navigating to PT051 view (secondary fallback)');
                                                handleNavigation('PT051');
                                            }, 0);
                                        } else {
                                            console.error('❌ All fallback attempts failed - cannot open PT-051');
                                            // Create mock event as last resort
                                            console.log('🔧 Creating mock event as last resort...');
                                            
                                            // Determine event type based on flight number
                                            let eventType: 'flight' | 'ground' | 'cpt' = 'flight';
                                            const flightNum = assessment.flightNumber || '';
                                            
                                            if (flightNum.includes('CPT') || flightNum.includes('Cpt')) {
                                                eventType = 'cpt';
                                            } else if (flightNum.includes('MB') || flightNum.includes('GS') || 
                                                       flightNum.includes('Ground') || flightNum.includes('GROUND')) {
                                                eventType = 'ground';
                                            }
                                            
                                            const mockEvent: ScheduleEvent = {
                                                id: assessment.eventId,
                                                flightNumber: assessment.flightNumber,
                                                date: assessment.date,
                                                startTime: '08:00',
                                                endTime: '09:00',
                                                instructor: assessment.instructorName || 'Unknown',
                                                student: assessment.traineeFullName,
                                                syllabus: assessment.flightNumber,
                                                aircraft: '',
                                                type: eventType,
                                                status: 'Scheduled',
                                                notes: '',
                                                crew: []
                                            };
                                            
                                            if (trainee) {
                                                console.log('✅ Created mock event:', mockEvent);
                                                setEventForPt051(mockEvent);
                                                setSelectedTraineeForHateSheet(trainee);
                                                setTimeout(() => {
                                                    console.log('🚀 Navigating to PT051 view (mock event)');
                                                    handleNavigation('PT051');
                                                }, 0);
                                            }
                                        }
                                    }
                                }
                            }}
                        />;
            case 'SupervisorDashboard':
                return <SupervisorDashboard
                            instructorsData={instructorsData}
                            traineesData={traineesData}
                            date={date}
                            events={eventsForDate}
                            onNavigate={handleNavigation}
                            onOpenAuth={(e) => { setEventForAuth(e); setShowAuthFlyout(true); }}
                        />;
            case 'Instructors':
                return <InstructorListView 
                            onClose={() => handleNavigation('Program Schedule')}
                            events={events}
                            traineesData={traineesData}
                            instructorsData={instructorsData}
                            archivedInstructorsData={archivedInstructorsData}
                            school={school}
                            personnelData={personnelData}
                            onUpdateInstructor={(data) => {
                                setInstructorsData(prev => {
                                    const exists = prev.some(i => i.idNumber === data.idNumber);
                                    if (exists) {
                                        return prev.map(i => i.idNumber === data.idNumber ? data : i);
                                    }
                                    return [...prev, data];
                                });
                            }}
                            onNavigateToCurrency={handleNavigateToCurrency}
                            onBulkUpdateInstructors={handleBulkUpdateInstructors}
                            onArchiveInstructor={(id) => {
                                const instructorToArchive = instructorsData.find(i => i.idNumber === id);
                                if (instructorToArchive) {
                                    setInstructorsData(prev => prev.filter(i => i.idNumber !== id));
                                    setArchivedInstructorsData(prev => [...prev, instructorToArchive]);
                                }
                            }}
                             onRestoreInstructor={(id) => {
                                const instructorToRestore = archivedInstructorsData.find(i => i.idNumber === id);
                                if (instructorToRestore) {
                                    setArchivedInstructorsData(prev => prev.filter(i => i.idNumber !== id));
                                    setInstructorsData(prev => [...prev, instructorToRestore]);
                                }
                            }}
                            locations={locations}
                            units={units}
                            selectedPersonForProfile={selectedPersonForProfile as Instructor | null}
                            onProfileOpened={() => setSelectedPersonForProfile(null)}
                            onViewLogbook={handleViewLogbook}
                            onRequestSct={(instructor) => {
                                setInstructorForSct(instructor);
                                setShowSctRequest(true);
                            }}
                        />;
             case 'Syllabus':
                return <SyllabusView
                           syllabusDetails={syllabusDetails}
                           onBack={() => {
                               handleNavigation(syllabusBackTarget);
                               setInitialSyllabusId(null); 
                           }}
                           initialSelectedId={initialSyllabusId || undefined}
                           onUpdateItem={handleUpdateSyllabusItem} // Pass the handler
                       />;
            case 'TraineeLMP':
                if (selectedTraineeForLMP) {
                    const traineeScores = scores.get(selectedTraineeForLMP.fullName) || [];
                    const individualLMP = traineeLMPs.get(selectedTraineeForLMP.fullName);
                    if (individualLMP) {
                        return <TraineeLmpView
                            trainee={selectedTraineeForLMP}
                            traineeLmp={individualLMP}
                            scores={traineeScores}
                            onBack={() => {
                                setSelectedPersonForProfile(selectedTraineeForLMP);
                                handleNavigation('CourseRoster');
                            }}
                        />;
                    }
                }
                return <div>Error: Could not load trainee LMP.</div>;
             case 'Currency':
                if (selectedPersonForCurrency) {
                    return <CurrencyView
                                person={selectedPersonForCurrency}
                                masterCurrencies={masterCurrencies}
                                currencyRequirements={currencyRequirements}
                                allEvents={events}
                                syllabusDetails={syllabusDetails}
                                onClose={handleCurrencyBack}
                                onUpdateCurrencyStatus={(personId, newStatus) => {
                                    const isInstructor = 'role' in selectedPersonForCurrency;
                                    if (isInstructor) {
                                        setInstructorsData(prev => prev.map(p => p.idNumber === personId ? {...p, currencyStatus: newStatus} : p));
                                    } else {
                                        setTraineesData(prev => prev.map(p => p.idNumber === personId ? {...p, currencyStatus: newStatus} : p));
                                    }
                                }}
                                registerDirtyCheck={registerDirtyCheck}
                           />;
                }
                return null;
            case 'Settings':
                return <SettingsViewWithMenu 
                    locations={locations}
                    onUpdateLocations={setLocations}
                    units={units}
                    onUpdateUnits={setUnits}
                    unitLocations={unitLocations}
                    onUpdateUnitLocations={setUnitLocations}
                    instructorsData={instructorsData}
                    traineesData={traineesData}
                    syllabusDetails={syllabusDetails}
                    onBulkUpdateInstructors={handleBulkUpdateInstructors}
                    onReplaceInstructors={handleReplaceInstructors}
                    onBulkUpdateTrainees={handleBulkUpdateTrainees}
                    onReplaceTrainees={handleReplaceTrainees}
                    // FIX: Cannot find name 'onUpdateSyllabus'. Did you mean 'handleUpdateSyllabus'?
                    onUpdateSyllabus={handleUpdateSyllabus}
                    onShowSuccess={setSuccessMessage}
                    eventLimits={eventLimits}
                    onUpdateEventLimits={setEventLimits}
                    phraseBank={phraseBank} // Pass phraseBank state
                    onUpdatePhraseBank={setPhraseBank} // Pass update handler
                    onNavigate={handleNavigation}
                    masterCurrencies={masterCurrencies}
                    currencyRequirements={currencyRequirements}
                    sctEvents={sctEvents}
                    onUpdateSctEvents={setSctEvents}
                    preferredDutyPeriod={preferredDutyPeriod}
                    onUpdatePreferredDutyPeriod={setPreferredDutyPeriod}
                    maxCrewDutyPeriod={maxCrewDutyPeriod}
                    onUpdateMaxCrewDutyPeriod={setMaxCrewDutyPeriod}
                    flightTurnaround={flightTurnaround}
                    onUpdateFlightTurnaround={setFlightTurnaround}
                    ftdTurnaround={ftdTurnaround}
                    onUpdateFtdTurnaround={setFtdTurnaround}
                    cptTurnaround={cptTurnaround}
                    onUpdateCptTurnaround={setCptTurnaround}
                    currentUserPermission={currentUserPermission}
                    maxDispatchPerHour={maxDispatchPerHour}
                    onUpdateMaxDispatchPerHour={setMaxDispatchPerHour}
                    timezoneOffset={timezoneOffset}
                    onUpdateTimezoneOffset={setTimezoneOffset}
                />;
            case 'CurrencyBuilder':
                return <CurrencyBuilderView 
                            onBack={() => handleNavigation('Settings')} 
                            masterCurrencies={masterCurrencies}
                            currencyRequirements={currencyRequirements}
                            onSave={handleSaveCurrencies}
                            onDelete={handleDeleteCurrency}
                        />;
            case 'PT051':
                console.log('🎯 PT051 case triggered');
                console.log('eventForPt051:', eventForPt051);
                console.log('selectedTraineeForHateSheet:', selectedTraineeForHateSheet);
                
                if (eventForPt051 && selectedTraineeForHateSheet) {
                    // Find the PT-051 for this event and trainee combination
                    const assessmentKey = `pt051-${eventForPt051.id}-${selectedTraineeForHateSheet.fullName}`;
                    console.log('Looking for assessment with key:', assessmentKey);
                    console.log('Available assessment keys:', Array.from(pt051Assessments.keys()));
                    
                    let existingAssessment = pt051Assessments.get(assessmentKey);
                    console.log('Direct lookup result:', existingAssessment);
                    
                    // Fallback: search by eventId and traineeFullName if key lookup fails
                    if (!existingAssessment) {
                        console.log('Direct lookup failed, trying fallback search...');
                        existingAssessment = Array.from(pt051Assessments.values()).find(
                            a => a.eventId === eventForPt051.id && a.traineeFullName === selectedTraineeForHateSheet.fullName
                        );
                        console.log('Fallback search result:', existingAssessment);
                    }
                    return <PT051View 
                        trainee={selectedTraineeForHateSheet}
                        event={eventForPt051}
                        initialAssessment={existingAssessment}
                        onBack={() => {
                            handleNavigation('HateSheet');
                        }}
                        onSave={(assessment, isAutoSave) => {
                            // Mark assessment as completed when saved (not auto-save)
                            const updatedAssessment = {
                                ...assessment,
                                isCompleted: !isAutoSave ? true : assessment.isCompleted
                            };
                            
                            // Save using the correct key format: pt051-${eventId}-${traineeFullName}
                            const saveKey = `pt051-${eventForPt051.id}-${selectedTraineeForHateSheet.fullName}`;
                            setPt051Assessments(prev => new Map(prev).set(saveKey, updatedAssessment));
                            
                            if (!isAutoSave) {
                                setSuccessMessage('PT-051 Assessment Saved!');
                                
                                // Log PT-051 modification to audit trail
                                const changes = [
                                    assessment.overallGrade ? `Overall Grade: ${assessment.overallGrade}` : null,
                                    assessment.overallResult ? `Overall Result: ${assessment.overallResult}` : null,
                                    assessment.dcoResult ? `DCO Result: ${assessment.dcoResult}` : null,
                                    assessment.overallComments ? `Comments: ${assessment.overallComments.substring(0, 50)}...` : null
                                ].filter(Boolean).join(', ');
                                
                                logAudit('Performance History', 'Edit', `Modified PT-051 for ${assessment.traineeFullName} - Event: ${assessment.flightNumber} (${assessment.date})`, changes);
                            }
                        }}
                        instructors={instructorsData}
                        pt051Assessments={pt051Assessments}
                        events={events}
                        lmpScores={scores.get(selectedTraineeForHateSheet.fullName) || []}
                        syllabusDetails={syllabusDetails}
                        registerDirtyCheck={registerDirtyCheck}
                        phraseBank={phraseBank} // Pass phraseBank prop
                    />;
                }
                console.error('❌ PT051 View Error - Missing context:', {
                    eventForPt051,
                    selectedTraineeForHateSheet,
                    view
                });
                return <div className="p-8 bg-gray-900 text-white">
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Error: PT-051 View Context Missing</h2>
                    <p className="mb-2">Trainee: {selectedTraineeForHateSheet ? '✅ Set' : '❌ Not Set'}</p>
                    <p className="mb-2">Event: {eventForPt051 ? '✅ Set' : '❌ Not Set'}</p>
                    <button 
                        onClick={() => handleNavigation('MyDashboard')}
                        className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700"
                    >
                        Back to Dashboard
                    </button>
                </div>;
            case 'PostFlight':
                if (eventForPostFlight) {
                    return <PostFlightView 
                                event={eventForPostFlight}
                                onReturn={() => {
                                    setEventForPostFlight(null);
                                    handleNavigation('Program Schedule');
                                }}
                                onSave={(data) => {
                                    console.log('Post flight data saved:', data);
                                    setEventForPostFlight(null);
                                    handleNavigation('Program Schedule');
                                    setSuccessMessage('Post-flight data saved!');
                                }}
                                school={school}
                                traineesData={traineesData}
                                instructorsData={instructorsData}
                           />;
                }
                return null;
            case 'Logbook':
                if (selectedPersonForLogbook) {
                    return <LogbookView 
                        person={selectedPersonForLogbook}
                        events={events}
                        onBack={() => {
                            // Navigate back to the profile view
                            if ('role' in selectedPersonForLogbook) {
                                setSelectedPersonForProfile(selectedPersonForLogbook);
                                handleNavigation('Instructors');
                            } else {
                                setSelectedPersonForProfile(selectedPersonForLogbook as Trainee);
                                handleNavigation('CourseRoster');
                            }
                        }}
                    />;
                }
                return null;
            default:
                return <div>View not found</div>;
        }
    };

    return (
        <div id="app-content" className="flex h-screen bg-gray-900 text-white">
            <Sidebar
                activeView={activeView}
                onNavigate={handleNavigation}
                courseColors={courseColors}
                onAddCourse={(data) => setCourseColors(prev => ({ ...prev, [data.number]: data.color }))}
                onArchiveCourse={(courseNumber) => {
                    const color = courseColors[courseNumber];
                    if (color) {
                        const newActive = { ...courseColors };
                        delete newActive[courseNumber];
                        setCourseColors(newActive);
                        setArchivedCourses(prev => ({ ...prev, [courseNumber]: color }));
                    }
                }}
                onNextDayBuildClick={() => {
                    handleNavigation('NextDayBuild');
                }}
                onBuildDfpClick={handleBuildDfp}
                isSupervisor={true}
                onPublish={handlePublish}
                currentUserName={currentUserName}
                currentUserRank={currentUser?.rank || 'FLTLT'}
                instructorsList={instructorsData.map(inst => ({
                    name: inst.name,
                    rank: inst.rank,
                    unit: inst.unit,
                    pin: inst.pin || '1111'
                }))}
                onUserChange={handleUserChange}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {activeView !== 'PostFlight' && <Header
                    onAddTile={() => {
                        setIsAddingTile(true);
                        handleOpenModal(null, { type: 'flight' });
                    }}
                    onAddGroundEvent={() => setShowAddGroundEvent(true)}
                    showValidation={showValidation}
                    setShowValidation={setShowValidation}
                    locations={['ESL', 'PEA']}
                    activeLocation={school}
                    onLocationChange={(loc) => changeSchool(loc as 'ESL' | 'PEA')}
                    isMagnifierEnabled={isMagnifierEnabled}
                    setIsMagnifierEnabled={setIsMagnifierEnabled}
                    isMultiSelectMode={isMultiSelectMode}
                    setIsMultiSelectMode={handleSetIsMultiSelectMode}
                    isOracleMode={isOracleMode}
                    onToggleOracleMode={handleToggleOracleMode}
                    
                />}
                {renderActiveView()}
            </div>
            {isMagnifierEnabled && <Magnifier isEnabled={isMagnifierEnabled} />}

            {selectedEvent && (
                <EventDetailModal
                    event={selectedEvent}
                    onClose={() => {
                        setSelectedEvent(null);
                        setOracleContextForModal(null);
                        setIsAddingTile(false);
                    }}
                    onSave={(events) => handleSaveEvents(events, isPriorityEventCreation)}
                    onDeleteRequest={handleDeleteEvent}
                    isEditingDefault={isEditingDefault}
                    instructors={instructorsData.map(i => i.name)}
                    trainees={traineesData.map(t => t.fullName)}
                    syllabus={isAddingTile ? addTileSyllabusOptions : syllabusForModal}
                    syllabusDetails={syllabusDetails}
                    highlightedField={highlightedField}
                    school={school}
                    traineesData={traineesData}
                    instructorsData={instructorsData}
                    courseColors={courseColors}
                    eventsForDate={eventsForDate}
                    onNavigateToHateSheet={(trainee) => {
                        setSelectedTraineeForHateSheet(trainee);
                        handleNavigation('HateSheet');
                    }}
                    onNavigateToSyllabus={(id) => {
                        onNavigateToSyllabus(id);
                    }}
                    onOpenPt051={(trainee) => {
                        setEventForPt051(selectedEvent);
                        setSelectedTraineeForHateSheet(trainee);
                        
                        // Log PT-051 view to audit trail from Flight Detail
                        logAudit('Flight Detail', 'View', `Viewed PT-051 for ${trainee.fullName} - Event: ${selectedEvent.flightNumber} (${selectedEvent.date})`);
                        
                        handleNavigation('PT051');
                    }}
                    onOpenAuth={(e) => { setEventForAuth(e); setShowAuthFlyout(true); }}
                    onOpenPostFlight={(e) => {
                        setEventForPostFlight(e);
                        handleNavigation('PostFlight');
                        setSelectedEvent(null);
                    }}
                    onScoresCreated={(newScores) => {
                        console.log('App.tsx: onScoresCreated called with:', newScores);
                        // Add the new scores to the existing scores map
                        const updatedScores = new Map(scores);
                        newScores.forEach(score => {
                            console.log('Adding score for trainee:', score.traineeName);
                            const traineeScores = updatedScores.get(score.traineeName) || [];
                            traineeScores.push(score);
                            updatedScores.set(score.traineeName, traineeScores);
                        });
                        console.log('Updated scores map:', updatedScores);
                        setScores(updatedScores);
                        console.log('Scores state updated successfully');
                    }}
                    isConflict={unavailabilityConflicts.has(selectedEvent.id) || (['NextDayBuild', 'Priorities', 'ProgramData'].includes(activeView) ? nextDayPersonnelAndResourceConflictIds : personnelAndResourceConflictIds).has(selectedEvent.id)}
                    onNeoClick={handleNeoClick}
                    oracleContextForModal={oracleContextForModal}
                    sctRequests={[...sctFlights, ...sctFtds]}
                    sctEvents={sctEvents}
                    publishedSchedules={publishedSchedules}
                    nextDayBuildEvents={nextDayBuildEvents}
                    activeView={activeView}
                />
            )}
            
            {conflict && <ConflictModal conflict={conflict} onResolve={() => {}} onCancel={() => setConflict(null)} />}
            {neoProblemTileForFlyout && !showTimeOnlyRemedyConfirm && !showNeoChoiceModal && (
                <NeoRemedyFlyout
                    problemTile={neoProblemTileForFlyout}
                    remedies={neoRemediesForFlyout}
                    onApplyRemedy={handleApplyNeoRemedy}
                    onCancel={handleCancelNeo}
                />
            )}
            {showNeoChoiceModal && (
                <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={() => setShowNeoChoiceModal(false)}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg border border-sky-500/50" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 bg-sky-900/20">
                            <h2 className="text-xl font-bold text-sky-400">Resolution Options</h2>
                        </div>
                        <div className="p-6 space-y-4 text-center">
                            <p className="text-gray-300">NEO has found multiple ways to resolve the conflict for <span className="font-bold text-white">{neoProblemTileForFlyout?.event.flightNumber}</span>. Please choose an option:</p>
                            <div className="flex justify-center space-x-4 pt-4">
                                <button
                                    onClick={handleChooseTimeShift}
                                    className="px-6 py-3 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors font-semibold shadow-lg w-1/2"
                                >
                                    <span className="text-lg">Time Shift</span>
                                    <span className="block text-xs text-sky-200">Keep crew, change time</span>
                                </button>
                                <button
                                    onClick={handleChooseCrewChange}
                                    className="px-6 py-3 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-semibold shadow-lg w-1/2"
                                >
                                    <span className="text-lg">Change Crew</span>
                                    <span className="block text-xs text-amber-200">Keep time, change instructor</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showTimeOnlyRemedyConfirm && timeOnlyRemedyForConfirmation && neoProblemTileForFlyout && (
                 <div className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center animate-fade-in" onClick={handleCancelTimeOnlyRemedy}>
                    <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-sky-500/50" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 bg-sky-900/20">
                            <h2 className="text-xl font-bold text-sky-400">Confirm Time Change</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Current Start Time:</span>
                                    <span className="text-white font-mono font-bold">{formatDecimalHourToString(neoProblemTileForFlyout.event.startTime)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Conflict Cause:</span>
                                    <span className="text-amber-400 text-sm font-medium text-right">
                                        {neoProblemTileForFlyout.errors.some(e => e.toLowerCase().includes('previous')) 
                                            ? "Prior event turnaround" 
                                            : neoProblemTileForFlyout.errors.some(e => e.toLowerCase().includes('next'))
                                                ? "Next event turnaround"
                                                : "Scheduling conflict"}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="text-center pt-2">
                                <p className="text-gray-300 mb-2 text-sm">Proposed New Start Time</p>
                                <div className="text-4xl font-bold text-green-400 font-mono tracking-wider">
                                    {formatDecimalHourToString(timeOnlyRemedyForConfirmation.newStartTime)}
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-900/50 border-t border-gray-700 flex justify-end space-x-3">
                            <button onClick={handleCancelTimeOnlyRemedy} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold">Cancel</button>
                            <button onClick={handleSwitchToCrewChange} className="px-4 py-2 bg-transparent border border-gray-500 text-gray-300 hover:bg-gray-700 hover:text-white rounded-md transition-colors text-sm font-semibold">Change Crew Instead</button>
                            <button onClick={handleConfirmTimeOnlyRemedy} className="px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors text-sm font-semibold">Accept Time Change</button>
                        </div>
                    </div>
                </div>
            )}
            {showDutyWarning && dutyWarningRemedy && (
                <DutyWarningFlyout
                    onConfirm={handleConfirmDutyWarning}
                    onCancel={() => setShowDutyWarning(false)}
                    // FIX: Replaced 'remedy' with 'dutyWarningRemedy' to access component props from the correct state variable.
                    instructorName={dutyWarningRemedy.type !== 'trainee' ? dutyWarningRemedy.instructor.name : ''}
                    // FIX: Replaced 'remedy' with 'dutyWarningRemedy' to access component props from the correct state variable.
                    dutyHours={dutyWarningRemedy.type !== 'trainee' ? dutyWarningRemedy.instructor.dutyHours : 0}
                />
            )}
            {showInfoNotification && <InfoNotification message={showInfoNotification} onClose={() => setShowInfoNotification(null)} />}
            {showNightFlyingInfo && <NightFlyingInfoFlyout traineeCount={nightFlyingTraineeCount} />}
            {isBuildingDfp && <BuildDfpLoadingFlyout progress={dfpBuildProgress} />}
            {showDateWarning && <BuildDateWarningFlyout onConfirm={handleConfirmDateAndBuild} onCancel={() => setShowDateWarning(false)} date={buildDfpDate} />}
            {unavailabilityNotifications.length > 0 && <UnavailabilityConflictFlyout notifications={unavailabilityNotifications} onDismiss={() => setUnavailabilityNotifications([])} />}
            {showPublishConfirm && <PublishConfirmationFlyout date={buildDfpDate} onConfirm={handleConfirmPublish} onCancel={() => setShowPublishConfirm(false)} />}
            {isLocalityChangeVisible && <LocalityChangeFlyout locality={school} />}
            {successMessage && <SuccessNotification message={successMessage} onClose={() => setSuccessMessage(null)} />}
            {showCurrencySetup && selectedPersonForCurrency && 
                <CurrencySetupFlyout 
                    onClose={() => setShowCurrencySetup(false)}
                    allCurrencies={[...masterCurrencies, ...currencyRequirements]}
                    visibleCurrencies={new Set(
                        [...masterCurrencies, ...currencyRequirements]
                            .filter(c => c.isVisible)
                            .map(c => c.name)
                    )}
                    onVisibilityChange={(newSet) => {
                        setMasterCurrencies(prev => prev.map(c => ({...c, isVisible: newSet.has(c.name)})));
                        setCurrencyRequirements(prev => prev.map(c => ({...c, isVisible: newSet.has(c.name)})));
                    }}
                    personName={selectedPersonForCurrency.name}
                />
            }
            {showUnsavedWarning && 
                <UnsavedChangesWarning 
                    onSaveAndExit={() => handleUnsavedConfirm('save')}
                    onExitWithoutSaving={() => handleUnsavedConfirm('discard')}
                    onCancel={handleUnsavedCancel}
                />
            }
             {showAddGroundEvent && (
                <AddGroundEventFlyout
                    onClose={() => setShowAddGroundEvent(false)}
                    onSave={handleSaveGroundEvent}
                    groundSyllabus={syllabusDetails.filter(s => s.type === 'Ground School')}
                    activeCourses={courseColors}
                    allTraineesByCourse={allTraineesByCourse}
                    instructors={instructorsData.map(i => i.name)}
                    traineesData={traineesData}
                />
            )}
            {showAuthFlyout && eventForAuth && 
                <AuthorisationFlyout
                    event={eventForAuth}
                    onClose={() => setShowAuthFlyout(false)}
                    onAuthorise={handleAuthorise}
                    onClearAuth={(eventId) => {
                         setEvents((prev) => prev.map(e => {
                            if (e.id === eventId) {
                                const { authoSignedBy, authoSignedAt, captainSignedBy, captainSignedAt, isVerbalAuth, ...rest } = e;
                                return { ...rest, authNotes: '' };
                            }
                            return e;
                        }));
                         setPublishedSchedules((prev: Record<string, ScheduleEvent[]>) => Object.fromEntries(
                            Object.entries(prev).map(([key, eventsList]) => [
                                key,
                                (eventsList as ScheduleEvent[]).map(e => {
                                    if (e.id === eventId) {
                                        const { authoSignedBy, authoSignedAt, captainSignedBy, captainSignedAt, isVerbalAuth, ...rest } = e;
                                        return { ...rest, authNotes: '' };
                                    }
                                    return e;
                                })
                            ])
                         ));
                        setEventForAuth(null);
                        setShowAuthFlyout(false);
                    }}
                />
            }
            {showAddRemedialPackage && selectedTraineeForRemedial && (
                <AddRemedialPackageFlyout
                    trainee={selectedTraineeForRemedial}
                    instructors={instructorsData}
                    scores={scores.get(selectedTraineeForRemedial.fullName) || []}
                    traineeLmp={traineeLMPs.get(selectedTraineeForRemedial.fullName) || []}
                    onClose={() => setShowAddRemedialPackage(false)}
                    onSave={handleSaveRemedialPackage}
                />
            )}
            {showUnavailabilityReport && (
                <UnavailabilityReportModal
                    isOpen={showUnavailabilityReport}
                    onClose={() => setShowUnavailabilityReport(false)}
                    date={date}
                    instructors={instructorsData}
                    trainees={traineesData}
                    events={eventsForDate}
                />
            )}
            {showSctRequest && instructorForSct && (
                <SctRequestFlyout
                    instructor={instructorForSct}
                    onClose={() => setShowSctRequest(false)}
                    onSave={(request) => {
                        // Add the SCT request to the appropriate list
                        if (request.event.includes('FTD')) {
                            setSctFtds(prev => [...prev, request]);
                        } else {
                            setSctFlights(prev => [...prev, request]);
                        }
                        setShowSctRequest(false);
                        // Show success message
                        setSuccessMessage(`SCT request submitted for ${instructorForSct.name}`);
                    }}
                    currencyNames={['Instrument', 'Night', 'Multi-Engine', 'Formation']}
                />
            )}
        </div>
    );
};

export default App;
