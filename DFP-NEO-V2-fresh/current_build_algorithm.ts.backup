function generateDfpInternal(config: DfpConfig, setProgress: (progress: { message: string, percentage: number }) => void): Omit<ScheduleEvent, 'date'>[] {
    console.log(`🚀 [BUILD ALGORITHM START] ================================`);
    console.log(`🚀   Build Date: ${config.buildDate}`);
    console.log(`🚀   Allow Night Flying: ${config.allowNightFlying}`);
    console.log(`🚀   Night Flying Window: ${config.commenceNightFlying} - ${config.ceaseNightFlying}`);
    console.log(`🚀   Available Aircraft: ${config.availableAircraftCount}`);
    console.log(`🚀   Active Trainees: ${config.trainees.length}`);
    console.log(`🚀 ================================`);
    
    const { 
        instructors: originalInstructors, trainees, syllabus: syllabusDetails, scores, 
        coursePriorities, coursePercentages, availableAircraftCount, ftdCount,
        courseColors, school, dayStart: flyingStartTime, dayEnd: flyingEndTime,
        allowNightFlying, commenceNightFlying, ceaseNightFlying, buildDate,
        highestPriorityEvents, programWithPrimaries, traineeLMPs, flightTurnaround,
        ftdTurnaround, cptTurnaround, preferredDutyPeriod, maxCrewDutyPeriod,
        eventLimits, sctFtds, sctFlights, remedialRequests, sctEvents,
        getEventDayNightClassification
    } = config;

    // --- HELPER FUNCTIONS ---
    
    // Calculate total duty hours for an instructor including all assigned events (day and night)

    setProgress({ message: 'Initializing DFP build...', percentage: 0 });
    const intendedNightStaff = new Set<string>();

    let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [];
    const eventCounts = new Map<string, { flightFtd: number, ground: number, cpt: number, dutySup: number, isStby: boolean }>();
    originalInstructors.forEach(i => eventCounts.set(i.name, { flightFtd: 0, ground: 0, cpt: 0, dutySup: 0, isStby: false }));
    trainees.forEach(t => eventCounts.set(t.fullName, { flightFtd: 0, ground: 0, cpt: 0, dutySup: 0, isStby: false }));
    // Check if a person (staff or trainee) is scheduled for ANY day events
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

    // Check if a person (staff or trainee) is scheduled for ANY day events
    const isPersonScheduledForDayEvents = (personName: string): boolean => {
        console.log(`☀️ [isPersonScheduledForDayEvents] Checking ${personName}`);
        console.log(`☀️   generatedEvents.length: ${generatedEvents.length}`);
        
        const hasDayEvents = generatedEvents.some(e => {
            if (!getPersonnel(e).includes(personName)) return false;
            const classification = getEventDayNightClassification(e, syllabusDetails, sctEvents);
            const isDay = classification === 'Day' || classification === 'Day/Night';
            if (isDay && getPersonnel(e).includes(personName)) {
                console.log(`☀️   Found day event for ${personName}: ${e.flightNumber}, classification: ${classification}`);
            }
            return isDay;
        });
        
        console.log(`☀️   Final result: ${hasDayEvents}`);
        return hasDayEvents;
    };
    
    // Check if a person (staff or trainee) is scheduled for ANY night events (flights, FTD, CPT, ground, Duty Sup)
    // OR is intended for night assignments
    // NOTE: This now uses Master LMP Day/Night field instead of time-based calculation
    const isPersonScheduledForNightEvents = (personName: string): boolean => {
        console.log(`🌙 [isPersonScheduledForNightEvents] Checking ${personName}`);
        console.log(`🌙   allowNightFlying: ${allowNightFlying}`);
        console.log(`🌙   nextEventLists.bnf.length: ${nextEventLists.bnf.length}`);
        console.log(`🌙   generatedEvents.length: ${generatedEvents.length}`);
        console.log(`🌙   intendedNightStaff.has(${personName}): ${intendedNightStaff.has(personName)}`);
        
        // Check if night flying is enabled in the configuration
        if (!allowNightFlying) {
            console.log(`🌙   ❌ Night flying not allowed - returning false`);
            return false;
        }
        
        // Check both already scheduled night events AND intended night assignments using Master LMP Day/Night field
        const hasScheduledNightEvents = generatedEvents.some(e => {
            if (!getPersonnel(e).includes(personName)) return false;
            const classification = getEventDayNightClassification(e, syllabusDetails, sctEvents);
            const isNight = classification === 'Night' || classification === 'Day/Night';
            if (isNight && getPersonnel(e).includes(personName)) {
                console.log(`🌙   Found night event for ${personName}: ${e.flightNumber}, classification: ${classification}`);
            }
            return isNight;
        });
        
        const result = hasScheduledNightEvents || intendedNightStaff.has(personName);
        console.log(`🌙   hasScheduledNightEvents: ${hasScheduledNightEvents}`);
        console.log(`🌙   Final result: ${result}`);
        return result;
    };
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

    const nextPlusOneLists = { flight: [] as Trainee[], ftd: [] as Trainee[], cpt: [] as Trainee[], ground: [] as Trainee[] };
    
    console.log(`🎯 [BUILD ALGORITHM] Starting to populate nextEventLists`);
    console.log(`🎯   activeTrainees.length: ${activeTrainees.length}`);
    console.log(`🎯   allowNightFlying: ${allowNightFlying}`);
    
    activeTrainees.forEach(trainee => {
        const { next, plusOne } = traineeNextEventMap.get(trainee.fullName) || { next: null, plusOne: null };
        if (next) {
            console.log(`🎯   Processing trainee: ${trainee.fullName}, next event: ${next.code} (${next.type})`);

            if (next.code.startsWith('BNF') && next.type === 'Flight') {
                console.log(`🎯     BNF event detected for ${trainee.fullName}`);
                // Only add to BNF list if trainee doesn't have day events scheduled
                const hasDayEvents = isPersonScheduledForDayEvents(trainee.fullName);
                console.log(`🎯     hasDayEvents: ${hasDayEvents}`);
                if (!hasDayEvents) {
                    console.log(`🎯     ✅ Adding ${trainee.fullName} to BNF list`);
                    nextEventLists.bnf.push(trainee);
                } else {
                    console.log(`🎯     ❌ NOT adding ${trainee.fullName} to BNF list (has day events)`);
                }
            } else if (next.type === 'Flight') {
                console.log(`🎯     Adding ${trainee.fullName} to flight list`);
                nextEventLists.flight.push(trainee);
            } else if (next.type === 'FTD') {
                console.log(`🎯     Adding ${trainee.fullName} to FTD list`);
                nextEventLists.ftd.push(trainee);
            } else if (next.type === 'Ground School' && next.methodOfDelivery.includes('CPT')) {
                console.log(`🎯     Adding ${trainee.fullName} to CPT list`);
                nextEventLists.cpt.push(trainee);
            } else if (next.type === 'Ground School') {
                console.log(`🎯     Adding ${trainee.fullName} to ground list`);
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
    
    console.log(`🎯 [BUILD ALGORITHM] Finished populating nextEventLists`);
    console.log(`🎯   nextEventLists.bnf.length: ${nextEventLists.bnf.length}`);
    console.log(`🎯   nextEventLists.flight.length: ${nextEventLists.flight.length}`);
    console.log(`🎯   nextEventLists.ftd.length: ${nextEventLists.ftd.length}`);
    console.log(`🎯   nextEventLists.cpt.length: ${nextEventLists.cpt.length}`);
    console.log(`🎯   nextEventLists.ground.length: ${nextEventLists.ground.length}`);
    console.log(`🎯   BNF trainees:`, nextEventLists.bnf.map(t => t.fullName));
    
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
            ip.role === 'QFI' && 
            !isPersonStaticallyUnavailable(ip, nightDutyStartTime, nightDutyEndTime, buildDate, 'flight') &&
            !isPersonScheduledForDayEvents(ip.name)
        );
        
        const nightFlyingInstructors = [...nightEligiblePool].sort(() => 0.5 - Math.random()).slice(0, instructorsNeeded);
        const bnfTrainees = nextEventLists.bnf;
        
        nightFlyingInstructors.forEach((nfi, index) => {
            const trainee = bnfTrainees[index];
            if (trainee) {
                nightPairings.set(trainee.fullName, nfi.name);
                intendedNightStaff.add(nfi.name);

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
            return !isPersonStaticallyUnavailable(sup, commenceNightFlying, ceaseNightFlying, buildDate, 'duty_sup') &amp;&amp;
                   !isPersonScheduledForDayEvents(sup.name);
        }).sort(() => 0.5 - Math.random()); // Random selection instead of fewest assignments

        // Try to find a dedicated night supervisor first
        let nightDutySup = availableNightSupervisors.length > 0 ? availableNightSupervisors[0] : null;
        
        // If no dedicated night supervisor available, try anyone from eligible pool
        if (!nightDutySup) {
            nightDutySup = dutySupEligible.find(sup => {
                return !isPersonStaticallyUnavailable(sup, commenceNightFlying, ceaseNightFlying, buildDate, 'duty_sup') &amp;&amp;
                       !isPersonScheduledForDayEvents(sup.name);
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
            intendedNightStaff.add(nightDutySup.name);
        }
    }
    
    setProgress({ message: 'Build complete!', percentage: 100 });
    console.log(`🏁 [BUILD ALGORITHM END] ================================`);
    console.log(`🏁   Total events generated: ${generatedEvents.length}`);
    console.log(`🏁   Night flying events: ${generatedEvents.filter(e => {
        const classification = getEventDayNightClassification(e, syllabusDetails, sctEvents);
        return classification === 'Night';
    }).length}`);
    console.log(`🏁   Day flying events: ${generatedEvents.filter(e => {
        const classification = getEventDayNightClassification(e, syllabusDetails, sctEvents);
        return classification === 'Day';
    }).length}`);
    console.log(`🏁 ================================`);
    
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
        return 'Staff';
    };
