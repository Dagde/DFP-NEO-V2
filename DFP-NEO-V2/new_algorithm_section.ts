// NEW COMPREHENSIVE BUILD ALGORITHM
// This will replace the current generateDfpInternal function in App.tsx

// STEP 1: Add ELCE helper function before computeNextEventsForTrainee

/**
 * Get Effective Last Completed Event from today's DFP
 * 
 * Simple Example: A trainee flew BGF2 today and finished the flight at 1100.
 * The paperwork (PT-051) has not been entered yet, so the system still shows
 * their last completed event as BGF1. When building tomorrow's program, the
 * scheduler looks at today's DFP and sees that the trainee had a scheduled
 * event (BGF2) that has already finished, was not cancelled, and was not marked
 * unsuccessful. Therefore, the system treats BGF2 as the trainee's "Effective
 * Last Completed Event" (ELCE).
 */
const getEffectiveLastCompletedEvent = (
    traineeName: string,
    publishedSchedules: Record<string, ScheduleEvent[]>,
    buildDate: string
): string | null => {
    // Calculate yesterday's date (the day we're checking for completed events)
    const buildDateObj = new Date(buildDate + 'T00:00:00Z');
    buildDateObj.setDate(buildDateObj.getDate() - 1);
    const yesterdayStr = buildDateObj.toISOString().split('T')[0];
    
    // Get yesterday's DFP
    const yesterdayDfp = publishedSchedules[yesterdayStr] || [];
    
    if (yesterdayDfp.length === 0) {
        return null;
    }
    
    // Find all events for this trainee from yesterday's DFP
    const traineeEvents = yesterdayDfp.filter(e => 
        e.student === traineeName || e.attendees?.includes(traineeName)
    );
    
    if (traineeEvents.length === 0) {
        return null;
    }
    
    // Get current time in decimal hours (for checking if event has finished)
    const now = new Date();
    const currentDecimalHour = now.getHours() + now.getMinutes() / 60;
    
    // Filter for events that have finished (end time < current time)
    // and were not cancelled or marked unsuccessful
    const completedEvents = traineeEvents.filter(e => {
        const eventEndTime = e.startTime + e.duration;
        
        // For yesterday's events, we assume they've all finished
        // But we still check for cancellation and unsuccessful status
        const notCancelled = !e.isCancelled;
        const notUnsuccessful = !e.isUnsuccessful;
        
        return notCancelled && notUnsuccessful;
    });
    
    if (completedEvents.length === 0) {
        return null;
    }
    
    // Return the last completed event code (latest by start time)
    const lastEvent = completedEvents.sort((a, b) => b.startTime - a.startTime)[0];
    
    console.log(`ELCE for ${traineeName}: ${lastEvent.flightNumber} (completed ${yesterdayStr} at ${lastEvent.startTime})`);
    
    return lastEvent.flightNumber;
};

// STEP 2: Update computeNextEventsForTrainee to use ELCE

const computeNextEventsForTraineeWithELCE = (
    trainee: Trainee,
    traineeLMPs: Map<string, SyllabusItemDetail[]>,
    scores: Map<string, Score[]>,
    masterSyllabus: SyllabusItemDetail[],
    publishedSchedules: Record<string, ScheduleEvent[]>,
    buildDate: string
): { next: SyllabusItemDetail | null, plusOne: SyllabusItemDetail | null } => {
    // Check individual LMP first, then fallback to master syllabus
    const individualLMP = traineeLMPs.get(trainee.fullName) || masterSyllabus;

    if (!individualLMP || individualLMP.length === 0) {
        return { next: null, plusOne: null };
    }
    
    const traineeScores = scores.get(trainee.fullName) || [];
    const completedEventIds = new Set(traineeScores.map(s => s.event));
    
    // NEW: Check for ELCE - events completed yesterday but not yet in PT-051
    const elce = getEffectiveLastCompletedEvent(trainee.fullName, publishedSchedules, buildDate);
    if (elce) {
        // Add ELCE to completed events set
        completedEventIds.add(elce);
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

// STEP 3: Update generateDfpInternal signature to include publishedSchedules

function generateDfpInternal(
    config: DfpConfig, 
    setProgress: (progress: { message: string, percentage: number }) => void,
    publishedSchedules: Record<string, ScheduleEvent[]> // NEW PARAMETER
): Omit<ScheduleEvent, 'date'>[] {
    // ... existing code ...
    
    // CHANGE: Use new function with ELCE
    activeTrainees.forEach(trainee => {
        const nextEvents = computeNextEventsForTraineeWithELCE(
            trainee, 
            traineeLMPs, 
            scores, 
            syllabusDetails,
            publishedSchedules, // NEW
            buildDate // NEW
        );
        traineeNextEventMap.set(trainee.fullName, nextEvents);
    });
    
    // ... rest of existing code ...
}