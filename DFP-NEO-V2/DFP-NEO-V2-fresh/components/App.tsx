import { ScheduleEvent, SyllabusItemDetail, NeoTimeShiftRemedy, Instructor, Trainee, NeoInstructorRemedy } from '../types';

export interface AlgoContext {
    flightTurnaround: number;
    ftdTurnaround: number;
    syllabusDetails: SyllabusItemDetail[];
    instructorsData: Instructor[];
    traineesData: Trainee[];
    getPersonnel: (event: ScheduleEvent | Omit<ScheduleEvent, 'date'>) => string[];
    getEventBookingWindow: (event: any, syllabusDetails: SyllabusItemDetail[]) => { start: number, end: number };
    isPersonStaticallyUnavailable: (person: Instructor | Trainee, start: number, end: number, date: string, type: any) => boolean;
    generateInstructorRemediesAtTime: (conflictedEvent: ScheduleEvent, allEvents: ScheduleEvent[], atTime: number) => NeoInstructorRemedy[];
    // FIX: Add 'maxCrewDutyPeriod' to the AlgoContext interface.
    maxCrewDutyPeriod: number;
}

export const generateTargetedTimeShiftRemedies = (
    conflictedEvent: ScheduleEvent, 
    allEvents: ScheduleEvent[], 
    errors: string[], 
    flyingEndTime: number,
    context: AlgoContext
): NeoTimeShiftRemedy[] => {
    const { 
        flightTurnaround, 
        ftdTurnaround, 
        syllabusDetails, 
        instructorsData, 
        traineesData, 
        getPersonnel, 
        getEventBookingWindow, 
        isPersonStaticallyUnavailable, 
        generateInstructorRemediesAtTime,
        // FIX: Destructure maxCrewDutyPeriod from context.
        maxCrewDutyPeriod
    } = context;

    const buffer = 5 / 60; // 5 minute buffer

    const eventsOnResource = allEvents
        .filter(e => e.resourceId === conflictedEvent.resourceId)
        .sort((a, b) => a.startTime - b.startTime);

    let turnaround = 0;
    if (conflictedEvent.type === 'flight') turnaround = flightTurnaround;
    else if (conflictedEvent.type === 'ftd') turnaround = ftdTurnaround;

    const previousViolationError = errors.find(e => e.includes('Turnaround violation with previous'));

    // PRIORITY 1: Handle PREVIOUS violations. This is the only place we generate DELAY remedies.
    if (previousViolationError) {
        const prevEvent = eventsOnResource.filter(e => e.startTime < conflictedEvent.startTime && !e.resourceId.startsWith('STBY')).pop();
        
        if (!prevEvent) return [];

        // --- NEW LOGIC: Check for Crew Overlap & Briefing Times ---
        let effectiveTurnaround = turnaround;
        
        const prevCrew = getPersonnel(prevEvent);
        const currentCrew = getPersonnel(conflictedEvent);
        const hasCommonCrew = prevCrew.some(p => currentCrew.includes(p));

        if (hasCommonCrew) {
            const prevSyllabus = syllabusDetails.find(s => s.id === prevEvent.flightNumber);
            const currentSyllabus = syllabusDetails.find(s => s.id === conflictedEvent.flightNumber);
            
            const postFlightA = prevSyllabus?.postFlightTime || 0;
            const preFlightB = currentSyllabus?.preFlightTime || 0;
            const crewGap = postFlightA + preFlightB;
            
            // The required gap is the MAX of resource turnaround or crew briefing needs
            effectiveTurnaround = Math.max(turnaround, crewGap);
        }
        // -----------------------------------------------------------

        const requiredStartTime = prevEvent.startTime + prevEvent.duration + effectiveTurnaround;
        const nextEvent = eventsOnResource.find(e => e.startTime > conflictedEvent.startTime);
        
        const maxStartTime = nextEvent 
            ? nextEvent.startTime - conflictedEvent.duration - turnaround 
            : flyingEndTime - conflictedEvent.duration;
        
        if (requiredStartTime + buffer <= maxStartTime) {
            const finalStartTime = requiredStartTime + buffer;
            
            const originalCrew = getPersonnel(conflictedEvent).filter(p => instructorsData.some(i => i.name === p) || traineesData.some(t => t.fullName === p));
            const originalCrewAvailable = originalCrew.every(personName => {
                const person = [...instructorsData, ...traineesData].find(p => ('fullName' in p ? p.fullName : p.name) === personName);
                if (!person) return false;
                const newEventWindow = getEventBookingWindow({ ...conflictedEvent, startTime: finalStartTime } as any, syllabusDetails);
                const hasConflict = allEvents.some(e => {
                    if (e.id === conflictedEvent.id || !getPersonnel(e).includes(personName)) return false;
                    const otherEventWindow = getEventBookingWindow(e, syllabusDetails);
                    return newEventWindow.start < otherEventWindow.end && newEventWindow.end > otherEventWindow.start;
                });
                return !isPersonStaticallyUnavailable(person, newEventWindow.start, newEventWindow.end, conflictedEvent.date, conflictedEvent.type as any) && !hasConflict;
            });

            if (originalCrewAvailable) {
                    return [{ type: 'timeshift', newStartTime: finalStartTime, instructor: { name: conflictedEvent.instructor || '' } as any }];
            }
            
            const remedies = generateInstructorRemediesAtTime(conflictedEvent, allEvents, finalStartTime);
            if (remedies.length > 0) {
                    return remedies.map(r => ({ type: 'timeshift', newStartTime: finalStartTime, instructor: r.instructor }));
            }
        }
        
        return [];
    } 
    
    // PRIORITY 2: Handle NEXT violations ONLY IF no previous violation existed.
    const nextViolationError = errors.find(e => e.includes('Turnaround violation with next'));
    if (nextViolationError) {
            const nextEvent = eventsOnResource.find(e => e.startTime > conflictedEvent.startTime);
            if (!nextEvent) return [];

            // --- NEW LOGIC: Check for Crew Overlap & Briefing Times ---
            let effectiveTurnaround = turnaround;
            
            const nextCrew = getPersonnel(nextEvent);
            const currentCrew = getPersonnel(conflictedEvent);
            const hasCommonCrew = nextCrew.some(p => currentCrew.includes(p));

            if (hasCommonCrew) {
                const currentSyllabus = syllabusDetails.find(s => s.id === conflictedEvent.flightNumber);
                const nextSyllabus = syllabusDetails.find(s => s.id === nextEvent.flightNumber);
                
                const postFlightA = currentSyllabus?.postFlightTime || 0;
                const preFlightB = nextSyllabus?.preFlightTime || 0;
                const crewGap = postFlightA + preFlightB;
                
                effectiveTurnaround = Math.max(turnaround, crewGap);
            }
            // -----------------------------------------------------------
            
            const requiredEndTime = nextEvent.startTime - effectiveTurnaround;
            const newStartTime = requiredEndTime - conflictedEvent.duration;
            
            const syllabusItem = syllabusDetails.find(s => s.id === conflictedEvent.flightNumber);
            const preFlightTime = syllabusItem?.preFlightTime || 0;
            const nowInHours = new Date().getHours() + new Date().getMinutes() / 60;
            
            if (newStartTime - preFlightTime >= nowInHours) {
                // Check if moving backward creates a conflict with prev event
                const prevEvent = eventsOnResource.filter(e => e.startTime < conflictedEvent.startTime).pop();
                const minStartTime = prevEvent ? prevEvent.startTime + prevEvent.duration + turnaround : -Infinity;
                
                if (newStartTime - buffer >= minStartTime) {
                    const finalStartTime = newStartTime - buffer;
                    const originalCrew = getPersonnel(conflictedEvent).filter(p => instructorsData.some(i => i.name === p) || traineesData.some(t => t.fullName === p));
                    const originalCrewAvailable = originalCrew.every(personName => {
                        const person = [...instructorsData, ...traineesData].find(p => ('fullName' in p ? p.fullName : p.name) === personName);
                        if (!person) return false;
                        const newEventWindow = getEventBookingWindow({ ...conflictedEvent, startTime: finalStartTime } as any, syllabusDetails);
                        const hasConflict = allEvents.some(e => {
                            if (e.id === conflictedEvent.id || !getPersonnel(e).includes(personName)) return false;
                            const otherEventWindow = getEventBookingWindow(e, syllabusDetails);
                            return newEventWindow.start < otherEventWindow.end && newEventWindow.end > otherEventWindow.start;
                        });
                        return !isPersonStaticallyUnavailable(person, newEventWindow.start, newEventWindow.end, conflictedEvent.date, conflictedEvent.type as any) && !hasConflict;
                    });

                    if (originalCrewAvailable) {
                    return [{ type: 'timeshift', newStartTime: finalStartTime, instructor: { name: conflictedEvent.instructor || '' } as any }];
                    }
                    
                    const remedies = generateInstructorRemediesAtTime(conflictedEvent, allEvents, finalStartTime);
                    if (remedies.length > 0) {
                        return remedies.map(r => ({ type: 'timeshift', newStartTime: finalStartTime, instructor: r.instructor }));
                    }
                }
            }
    }

    return [];
};