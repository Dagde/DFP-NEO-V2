// DFP Build Algorithm V2 - Comprehensive Implementation
// Based on DFP Build Rules Summary with all clarifications

import { v4 as uuidv4 } from 'uuid';

// This file contains the new comprehensive build algorithm
// It will be integrated into App.tsx to replace the current generateDfpInternal function

/**
 * ELCE (Effective Last Completed Event) Logic
 * 
 * Simple Example: A trainee flew BGF2 today and finished the flight at 1100.
 * The paperwork (PT-051) has not been entered yet, so the system still shows
 * their last completed event as BGF1. When building tomorrow's program, the
 * scheduler looks at today's DFP and sees that the trainee had a scheduled
 * event (BGF2) that:
 * - has already finished
 * - was not cancelled
 * - was not marked unsuccessful
 * 
 * Therefore, the system treats BGF2 as the trainee's "Effective Last Completed
 * Event" (ELCE). This ensures the Next Event for tomorrow is correctly set to
 * BGF3, even though paperwork for BGF2 has not been entered yet.
 */

interface ELCEResult {
    eventCode: string;
    eventDate: string;
    eventTime: number;
}

/**
 * Get Effective Last Completed Event from today's DFP
 * Checks if trainee has scheduled events that have finished but not yet recorded in PT-051
 */
export const getEffectiveLastCompletedEvent = (
    traineeName: string,
    todaysDfp: ScheduleEvent[],
    buildDate: string,
    currentTime: number // Current time in decimal hours
): ELCEResult | null => {
    // Calculate yesterday's date (the day we're checking for completed events)
    const buildDateObj = new Date(buildDate + 'T00:00:00Z');
    buildDateObj.setDate(buildDateObj.getDate() - 1);
    const yesterdayStr = buildDateObj.toISOString().split('T')[0];
    
    // Find all events for this trainee from yesterday's DFP
    const traineeEvents = todaysDfp.filter(e => 
        e.date === yesterdayStr &&
        (e.student === traineeName || e.attendees?.includes(traineeName))
    );
    
    if (traineeEvents.length === 0) {
        return null;
    }
    
    // Filter for events that have finished (end time < current time)
    // and were not cancelled or marked unsuccessful
    const completedEvents = traineeEvents.filter(e => {
        const eventEndTime = e.startTime + e.duration;
        const hasFinished = eventEndTime < currentTime;
        const notCancelled = !e.isCancelled;
        const notUnsuccessful = !e.isUnsuccessful;
        
        return hasFinished && notCancelled && notUnsuccessful;
    });
    
    if (completedEvents.length === 0) {
        return null;
    }
    
    // Return the last completed event (latest by start time)
    const lastEvent = completedEvents.sort((a, b) => b.startTime - a.startTime)[0];
    
    return {
        eventCode: lastEvent.flightNumber,
        eventDate: lastEvent.date,
        eventTime: lastEvent.startTime
    };
};

/**
 * Compute Next Events for Trainee with ELCE consideration
 * This enhances the existing computeNextEventsForTrainee function
 */
export const computeNextEventsWithELCE = (
    trainee: Trainee,
    traineeLMPs: Map<string, SyllabusItemDetail[]>,
    scores: Map<string, Score[]>,
    masterSyllabus: SyllabusItemDetail[],
    todaysDfp: ScheduleEvent[],
    buildDate: string,
    currentTime: number
): { next: SyllabusItemDetail | null, plusOne: SyllabusItemDetail | null } => {
    // Check individual LMP first, then fallback to master syllabus
    const individualLMP = traineeLMPs.get(trainee.fullName) || masterSyllabus;

    if (!individualLMP || individualLMP.length === 0) {
        return { next: null, plusOne: null };
    }
    
    const traineeScores = scores.get(trainee.fullName) || [];
    const completedEventIds = new Set(traineeScores.map(s => s.event));
    
    // Check for ELCE - events completed today but not yet in PT-051
    const elce = getEffectiveLastCompletedEvent(traineeName, todaysDfp, buildDate, currentTime);
    if (elce) {
        // Add ELCE to completed events set
        completedEventIds.add(elce.eventCode);
        console.log(`ELCE for ${trainee.fullName}: ${elce.eventCode} (completed ${elce.eventDate} at ${elce.eventTime})`);
    }

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

/**
 * NEW SCHEDULING ORDER (Lines 105-126 from DFP Build Rules)
 * 
 * 1. Schedule DUTY SUP for Day Flying window
 * 2. Schedule DUTY SUP for Night Flying window (if 2+ BNF trainees)
 * 3. Schedule Day Flight Events:
 *    a. Highest Priority Events
 *    b. Trainee LMP events from Course Day Next Event List
 * 4. Schedule Night Flight Events (if 2+ BNF trainees):
 *    a. Highest Priority Events
 *    b. Trainee LMP events from Course Night Next Event List
 * 5. Schedule FTD Events:
 *    a. Highest Priority Events
 *    b. Trainee LMP events from Course Day Next Event List
 * 6. Schedule CPT/Ground Events:
 *    a. Highest Priority Events
 *    b. Trainee LMP events from Course Day Next Event List
 * 7. Schedule Day Flight Events:
 *    a. Trainee LMP events from Course Day Next Event +1 List
 * 8. Schedule FTD Events:
 *    a. Trainee LMP events from Course Day Next Event +1 List
 * 9. Schedule CPT/Ground Events:
 *    a. Trainee LMP events from Course Day Next Event +1 List
 */

// Export for integration into App.tsx
export const SCHEDULING_ORDER = {
    DUTY_SUP_DAY: 1,
    DUTY_SUP_NIGHT: 2,
    FLIGHT_DAY_PRIORITY: 3,
    FLIGHT_DAY_NEXT: 4,
    FLIGHT_NIGHT_PRIORITY: 5,
    FLIGHT_NIGHT_NEXT: 6,
    FTD_PRIORITY: 7,
    FTD_NEXT: 8,
    CPT_GROUND_PRIORITY: 9,
    CPT_GROUND_NEXT: 10,
    FLIGHT_DAY_PLUS_ONE: 11,
    FTD_PLUS_ONE: 12,
    CPT_GROUND_PLUS_ONE: 13
};

/**
 * Helper function to separate highest priority events by type
 */
export const separateHighestPriorityEventsByType = (
    highestPriorityEvents: ScheduleEvent[],
    buildDate: string
) => {
    const eventsForBuildDate = highestPriorityEvents.filter(e => e.date === buildDate && e.isTimeFixed);
    
    return {
        flight: eventsForBuildDate.filter(e => e.type === 'flight'),
        ftd: eventsForBuildDate.filter(e => e.type === 'ftd'),
        cpt: eventsForBuildDate.filter(e => e.type === 'cpt'),
        ground: eventsForBuildDate.filter(e => e.type === 'ground')
    };
};

/**
 * Plus-One Event Timing Rule
 * 
 * Clarification: Plus-one events are scheduled "after their primary"
 * This means after the trainee's first scheduled event (their Next Event)
 */
export const getPlusOneSearchStartTime = (
    trainee: Trainee,
    nextEventCode: string,
    generatedEvents: Omit<ScheduleEvent, 'date'>[],
    startTimeBoundary: number
): number => {
    // Find the trainee's primary (Next) event
    const primaryEvent = generatedEvents.find(e => 
        (e.student === trainee.fullName || e.attendees?.includes(trainee.fullName)) && 
        e.flightNumber === nextEventCode
    );
    
    if (!primaryEvent) {
        // Primary not scheduled yet, return boundary (will skip this trainee)
        return startTimeBoundary;
    }
    
    // Start search after primary event ends
    return Math.max(
        startTimeBoundary,
        primaryEvent.startTime + primaryEvent.duration
    );
};

/**
 * Night Flying Rules
 * 
 * Clarification 1: Only 1 BNF trainee = no night flying that night
 * This is already implemented correctly in the current algorithm
 */
export const shouldScheduleNightFlying = (bnfTraineeCount: number): boolean => {
    return bnfTraineeCount >= 2;
};

/**
 * Random Selection Rule
 * 
 * Clarification 3: Pure random selection (not deterministic)
 * Use: array.sort(() => 0.5 - Math.random())
 */
export const randomizeArray = <T>(array: T[]): T[] => {
    return [...array].sort(() => 0.5 - Math.random());
};

/**
 * STBY Line Management
 * 
 * Clarification 4: No separation, any FTD, CPT or Flight event can be allocated to STBY line
 * Just ensure they are all visible with no overlap on the tiles
 */
export const allocateToStbyLine = (
    event: Omit<ScheduleEvent, 'date'>,
    existingStbyEvents: Omit<ScheduleEvent, 'date'>[],
    stbyPrefix: string
): string => {
    // Find next available STBY line number
    let lineNumber = 1;
    let hasOverlap = true;
    
    while (hasOverlap) {
        const resourceId = `${stbyPrefix} ${lineNumber}`;
        const eventsOnThisLine = existingStbyEvents.filter(e => e.resourceId === resourceId);
        
        // Check if this event would overlap with any existing events on this line
        hasOverlap = eventsOnThisLine.some(e => {
            const eventEnd = event.startTime + event.duration;
            const existingEnd = e.startTime + e.duration;
            return event.startTime < existingEnd && eventEnd > e.startTime;
        });
        
        if (!hasOverlap) {
            return resourceId;
        }
        
        lineNumber++;
    }
    
    return `${stbyPrefix} ${lineNumber}`;
};

// Additional helper functions and types will be added as needed during integration