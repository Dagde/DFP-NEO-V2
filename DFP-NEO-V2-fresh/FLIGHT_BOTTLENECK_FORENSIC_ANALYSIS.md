# Flight Scheduling Bottleneck - Forensic Analysis Plan

## Current State
- **CPT events:** ✅ Scheduling successfully from DB
- **Ground events:** ✅ Scheduling successfully from DB
- **Flight events:** ⚠️ Only 2 flights scheduled (0800 and 0805)

## Objective
Identify the first exact bottleneck that stops additional PC-21 flight events after the first two successful allocations.

---

## Flight Scheduling Flow

### 1. Category List Build (lines 1580-1597)
```typescript
// Flight trainees categorized into NEXT and NEXT+1 lists
nextEventLists.flight.push(trainee);  // Primary flight events
nextPlusOneLists.flight.push(trainee); // Secondary flight events
```

**Key Points:**
- `nextEventLists.flight` contains all trainees needing their NEXT flight event
- `nextPlusOneLists.flight` contains trainees needing their NEXT+1 flight event
- Both lists are built BEFORE any scheduling begins

---

### 2. Main Flight Scheduling Call (line 2750)
```typescript
scheduleList(
    applyCoursePriority(filterOutBnfTrainees(nextEventLists.flight)), 
    'flight', 
    false,           // isPlusOne = false (NEXT events)
    flyingStartTime, // e.g., 0800
    flyingEndTime,   // e.g., 1700
    null,            // no standby prefix
    false            // not night pass
);
```

**Parameters:**
- `type = 'flight'`
- `isPlusOne = false` (NEXT events only)
- `startTimeBoundary = flyingStartTime` (e.g., 0800)
- `endTimeBoundary = flyingEndTime` (e.g., 1700)
- `timeIncrement = 5/60` (5 minutes for flights)

---

### 3. scheduleList Function (lines 1922-2005)

**Outer Loop - Pass Management:**
```typescript
while(placedThisPass && unplacedTrainees.length > 0) {
    placedThisPass = false;
    const remainingForNextPass: Trainee[] = [];
    
    for (const trainee of unplacedTrainees) {
        // Try to schedule this trainee
        // If successful: placedThisPass = true, continue
        // If failed: remainingForNextPass.push(trainee)
    }
    
    unplacedTrainees = remainingForNextPass;
}
```

**Behavior:**
- Iterates through all flight trainees
- For each trainee, tries multiple time slots
- If ANY trainee gets placed in a pass, `placedThisPass = true`
- Continues passes until no more trainees can be placed

---

### 4. Time Slot Search (lines 1960-1995)
```typescript
let searchStartTime = startTimeBoundary; // e.g., 0800

for (const space of searchSpaces) {
    for (let time = space.start; time <= space.end - syllabusItem.duration; time += timeIncrement) {
        // timeIncrement = 5/60 (5 minutes)
        // So times tried: 0800, 0805, 0810, 0815, 0820, 0825, ...
        
        const result = scheduleEvent(trainee, syllabusItem, time, type, isNightPass, isPlusOne);
        if (result && typeof result === 'object' && 'id' in result) {
            // SUCCESS - event scheduled
            generatedEvents.push({ ...result, _source: 'generated', _isNext: !isPlusOne, _traineeName: trainee.fullName });
            placed = true;
            placedThisPass = true;
            break;
        }
    }
}
```

**Key Points:**
- For EACH trainee, tries time slots at 5-minute intervals
- Starts at `startTimeBoundary` (e.g., 0800)
- Continues until `time + duration > endTimeBoundary`
- If `scheduleEvent()` returns a valid event, SUCCESS and move to next trainee

---

### 5. scheduleEvent Function (lines 2008-2520)

**Check Sequence for Each Time Slot:**

#### Step 1: Trainee Event Limits (lines 2020-2040)
```typescript
const traineeCounts = eventCounts.get(trainee.fullName)!;
const isBnfEvent = syllabusItem.code.startsWith('BNF') && syllabusItem.type === 'Flight';
const bnfFlightLimit = isBnfEvent ? 2 : eventLimits.trainee.maxFlightFtd;

if (type === 'flight' || type === 'ftd') {
    if (traineeCounts.flightFtd >= bnfFlightLimit) return null;
}

const bnfTotalLimit = isBnfEvent ? 4 : eventLimits.trainee.maxTotal;
if ((traineeCounts.flightFtd + traineeCounts.ground + traineeCounts.cpt) >= bnfTotalLimit) return null;
```

**Rejection Reasons:**
- `TRAINEE_EVENT_LIMIT_EXCEEDED` - Too many flight/FTD events
- `TRAINEE_TOTAL_LIMIT_EXCEEDED` - Too many total events

---

#### Step 2: Trainee Static Unavailability (line 2044)
```typescript
const proposedBookingWindow = getEventBookingWindowForAlgo({ startTime, flightNumber: syllabusItem.id, duration: syllabusItem.duration }, syllabusDetails);
if (isPersonStaticallyUnavailable(trainee, proposedBookingWindow.start, proposedBookingWindow.end, buildDate, type)) return null;
```

**Rejection Reason:**
- `TRAINEE_STATICALLY_UNAVAILABLE` - Trainee has leave/unavailability at this time

---

#### Step 3: Instructor Assignment (lines 2046-2415)
```typescript
const isSoloFlight = syllabusItem.sortieType === 'Solo';
let instructor: Instructor | null = null;

if (!isSoloFlight) {
    instructor = findAvailableInstructor(trainee, syllabusItem, isPlusOne);
    if (!instructor) return null;
}
```

**findAvailableInstructor Flow:**

**A. Base Pool Filter (lines 2130-2145):**
```typescript
candidates = instructors.filter(ip => {
    if (type === 'flight' && ip.role !== 'QFI') return false;  // Flight = QFI only
    if (nextEventLists.bnf.length >= 2 && isPersonScheduledForNightEvents(ip.name)) return false;
    return true;
});
```
- Filters by role (Flight = QFI only)
- Excludes instructors already scheduled for night events

**B. Unit Eligibility Filter (line 2148):**
```typescript
candidates = candidates.filter(ip => isInstructorEligibleByUnit(ip, traineeForCheck));
```
- Applies staff-sharing rules
- May exclude cross-unit instructors if not allowed

**C. Candidate Ordering (lines 2150-2215):**
```typescript
// Priority order:
// 1. Primary instructor from same unit
// 2. Secondary instructor from same unit
// 3. Other same-unit instructors (by workload)
// 4. Primary instructor from other unit
// 5. Secondary instructor from other unit
// 6. Other instructors from other unit (by workload)
```

**D. Individual Instructor Checks (lines 2220-2350):**
```typescript
for (const ip of candidates) {
    // 1. Static unavailability check
    if (isPersonStaticallyUnavailable(ip, proposedBookingWindow.start, proposedBookingWindow.end, buildDate, 'flight')) {
        continue; // Rejection: INSTRUCTOR_STATICALLY_UNAVAILABLE
    }
    
    // 2. Soft duty limit check
    const currentDutyHours = calculateInstructorDutyHours(ip.name, proposedEvent);
    if (currentDutyHours > preferredDutyPeriod) {
        continue; // Rejection: INSTRUCTOR_SOFT_DUTY_LIMIT
    }
    
    // 3. Event limit check
    if (ipCounts.flightFtd >= eventLimits.instructor.maxFlightFtd) {
        continue; // Rejection: INSTRUCTOR_FLIGHT_LIMIT_EXCEEDED
    }
    
    // 4. Total event limit check
    if ((ipCounts.flightFtd + ipCounts.ground + ipCounts.cpt + ipCounts.dutySup) >= eventLimits.instructor.maxTotal) {
        continue; // Rejection: INSTRUCTOR_TOTAL_LIMIT_EXCEEDED
    }
    
    // 5. Time overlap check
    const hasOverlap = generatedEvents
        .filter(e => getPersonnel(e).includes(ip.name))
        .some(e => {
            const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
            return proposedBookingWindow.start < existingBookingWindow.end && 
                   proposedBookingWindow.end > existingBookingWindow.start;
        });
    if (hasOverlap) {
        continue; // Rejection: INSTRUCTOR_TIME_OVERLAP
    }
    
    // 6. Crew duty period check
    if ((dutyEndTime - dutyStartTime) > maxCrewDutyPeriod) {
        continue; // Rejection: INSTRUCTOR_CREW_DUTY_PERIOD_EXCEEDED
    }
    
    return ip; // SUCCESS - instructor found
}
```

**Rejection Reasons:**
- `NO_INSTRUCTORS_LOADED` - No instructors in config
- `NO_QUALIFIED` - No instructors match role requirements
- `NO_UNIT_MATCH` - No instructors eligible by unit
- `INSTRUCTOR_STATICALLY_UNAVAILABLE` - Instructor has leave/unavailability
- `INSTRUCTOR_SOFT_DUTY_LIMIT` - Would exceed preferred duty hours
- `INSTRUCTOR_FLIGHT_LIMIT_EXCEEDED` - Already at max flight/FTD events
- `INSTRUCTOR_TOTAL_LIMIT_EXCEEDED` - Already at max total events
- `INSTRUCTOR_TIME_OVERLAP` - Already booked at this time
- `INSTRUCTOR_CREW_DUTY_PERIOD_EXCEEDED` - Would exceed max duty period

---

#### Step 4: Aircraft Resource Assignment (lines 2420-2470)
```typescript
const resourcePrefix = type === 'flight' ? 'PC-21 ' : ...;
const resourceCount = type === 'flight' ? availableAircraftCount : ...;

for (let i = 1; i <= resourceCount; i++) {
    const id = `${resourcePrefix}${i}`; // e.g., "PC-21 1", "PC-21 2", ...
    
    const resourceIsOccupied = generatedEvents.some(e => {
        if (e.resourceId !== id) return false;
        
        let turnaround = flightTurnaround; // e.g., 1.2 hours
        
        const existingEventEnd = e.startTime + e.duration + turnaround;
        const newEventStart = startTime;
        return newEventStart < existingEventEnd && (startTime + syllabusItem.duration) > e.startTime;
    });
    
    if (!resourceIsOccupied) {
        resourceId = id;
        break; // SUCCESS - aircraft available
    }
}

if (!resourceId) return null; // Rejection: NO_AIRCRAFT_AVAILABLE
```

**Rejection Reason:**
- `NO_AIRCRAFT_AVAILABLE` - All aircraft occupied or in turnaround

---

#### Step 5: Area Assignment (lines 2475-2495)
```typescript
if (type === 'flight') {
    const isBnf = syllabusItem.code.startsWith('BNF');
    const endTimeBoundary = isBnf ? ceaseNightFlying : flyingEndTime;
    
    if (startTime < (isBnf ? commenceNightFlying : flyingStartTime) || 
        startTime + syllabusItem.duration > endTimeBoundary) {
        return null; // Rejection: TIME_BOUNDARY_VIOLATION
    }
    
    area = findAvailableArea(startTime, syllabusItem.duration, generatedEvents);
    if (!area) return null; // Rejection: NO_AREA_AVAILABLE
}
```

**Rejection Reasons:**
- `TIME_BOUNDARY_VIOLATION` - Start/end outside allowed window
- `NO_AREA_AVAILABLE` - No training area available

---

#### Step 6: Takeoff Separation Check (lines 2497-2515)
```typescript
const nonStbyFlights = generatedEvents.filter(e => 
    !e.resourceId.startsWith('STBY') && 
    !e.resourceId.startsWith('BNF-STBY')
);

// HOURLY DISPATCH LIMIT
const takeoffsInLastHour = nonStbyFlights.filter(e => 
    e.type === 'flight' && 
    e.startTime > startTime - 1 && 
    e.startTime <= startTime
).length;

if (takeoffsInLastHour >= 8) return null; // Rejection: HOURLY_DISPATCH_LIMIT

// TAKEOFF SEPARATION
const takeoffConflict = nonStbyFlights.some(e => {
    if (e.type !== 'flight') return false;
    const diffHours = Math.abs(e.startTime - startTime);
    const diffMinutes = Math.round(diffHours * 60);
    const minSeparation = isNightCheck ? 5 : 5;
    return diffMinutes < minSeparation;
});

if (takeoffConflict) return null; // Rejection: TAKEOFF_SEPARATION_VIOLATION
```

**Rejection Reasons:**
- `HOURLY_DISPATCH_LIMIT` - More than 8 takeoffs in last hour
- `TAKEOFF_SEPARATION_VIOLATION` - Less than 5 minutes from another takeoff

---

## Potential Bottlenecks (Ranked by Probability)

### 1. ⚠️ INSTRUCTOR_SOFT_DUTY_LIMIT (HIGHEST PROBABILITY)
**Why:** Only 2 flights scheduled at the VERY start (0800, 0805). This suggests instructors may be hitting the soft duty limit very early.

**Check:** 
- What is `preferredDutyPeriod` value?
- What are instructor duty hours after 2 flights?
- Are instructors already at or near the limit when flights start?

---

### 2. ⚠️ NO_AIRCRAFT_AVAILABLE
**Why:** If `availableAircraftCount` is low (e.g., 2), after scheduling 2 flights at 0800 and 0805, all aircraft may be occupied for the next slots.

**Check:**
- What is `availableAircraftCount`?
- What is `flightTurnaround` time?
- When are PC-21 aircraft becoming available after the first 2 flights?

---

### 3. ⚠️ INSTRUCTOR_TIME_OVERLAP
**Why:** If the first 2 flights are scheduled with ALL available instructors, subsequent time slots (0810, 0815, ...) may have no instructors available due to overlap with existing events.

**Check:**
- How many instructors are in the pool?
- Which instructors are assigned to the first 2 flights?
- Are other instructors unavailable for other reasons?

---

### 4. ⚠️ NO_AREA_AVAILABLE
**Why:** If there are limited training areas, after 2 flights, all areas may be occupied or in cooldown.

**Check:**
- How many areas are available?
- What is area turnaround time?
- When do areas become available after the first 2 flights?

---

## Diagnostic Logging Requirements

### 1. First 2 Successful Flight Events
For each successfully scheduled flight, log:
```
✅ FLIGHT SCHEDULED
  Trainee: <name>
  Event: <flightNumber> (<code>)
  Time: <startTime> - <endTime>
  Instructor: <instructorName or SOLO>
  Aircraft: <resourceId>
  Area: <area>
  NEXT/NEXT+1: <isNext>
  Time Slot: <HH:MM>
```

### 2. Next 10 Failed Flight Candidates
For each failed candidate, log:
```
❌ FLIGHT REJECTED
  Trainee: <name>
  Event: <flightNumber> (<code>)
  Proposed Time: <startTime> - <endTime>
  Instructor Candidates: <count> - <list of names>
  Aircraft Candidates: <count> - <list of IDs>
  Area Candidates: <count>
  Rejection Reason: <EXPLICIT_BUCKET>
```

### 3. Rejection Bucket Counts
After the first 2 successful flights, count rejections:
```
FLIGHT REJECTION BUCKETS (after first 2 successes):
  NO_INSTRUCTORS_LOADED: <count>
  NO_QUALIFIED: <count>
  NO_UNIT_MATCH: <count>
  INSTRUCTOR_STATICALLY_UNAVAILABLE: <count>
  INSTRUCTOR_SOFT_DUTY_LIMIT: <count>
  INSTRUCTOR_FLIGHT_LIMIT_EXCEEDED: <count>
  INSTRUCTOR_TOTAL_LIMIT_EXCEEDED: <count>
  INSTRUCTOR_TIME_OVERLAP: <count>
  INSTRUCTOR_CREW_DUTY_PERIOD_EXCEEDED: <count>
  NO_AIRCRAFT_AVAILABLE: <count>
  TIME_BOUNDARY_VIOLATION: <count>
  NO_AREA_AVAILABLE: <count>
  HOURLY_DISPATCH_LIMIT: <count>
  TAKEOFF_SEPARATION_VIOLATION: <count>
  TRAINEE_EVENT_LIMIT_EXCEEDED: <count>
  TRAINEE_TOTAL_LIMIT_EXCEEDED: <count>
  TRAINEE_STATICALLY_UNAVAILABLE: <count>
```

### 4. Time Slot Verification
Log what time slots are being tried:
```
FLIGHT TIME SLOTS TRIED:
  After 0800, 0805: <list of times tried>
  0810: <success/failure> <reason>
  0815: <success/failure> <reason>
  0820: <success/failure> <reason>
  0825: <success/failure> <reason>
  0830: <success/failure> <reason>
  ...
```

---

## Implementation Strategy

### Diagnostic Placement Points:

1. **scheduleEvent Entry (line 2008):** Log each call with trainee, event, proposed time
2. **scheduleEvent Success (line 1992):** Log successful flight details
3. **scheduleEvent Failure (each return null):** Log explicit rejection reason
4. **findAvailableInstructor (line 2046):** Log instructor pool and final result
5. **Aircraft Assignment (line 2420):** Log aircraft availability check
6. **Area Assignment (line 2475):** Log area availability check

### Tracking Variables Needed:
- `flightSuccessCount` - Count successful flights
- `flightRejectionBuckets` - Map of rejection reason to count
- `timeSlotsTried` - Set of time slots attempted for flights

---

## Expected Output Format

```
🔴🔴🔴 [FLIGHT-BOTTLENECK] DIAGNOSTIC START 🔴🔴🔴

✅ FLIGHT #1 SCHEDULED
  Trainee: John Smith
  Event: FIC210_001 (FIC210)
  Time: 8.00 - 9.17
  Instructor: Burns
  Aircraft: PC-21 1
  Area: A1
  NEXT/NEXT+1: NEXT
  Time Slot: 08:00

✅ FLIGHT #2 SCHEDULED
  Trainee: Jane Doe
  Event: FIC210_002 (FIC210)
  Time: 8.08 - 9.25
  Instructor: Miller
  Aircraft: PC-21 2
  Area: A2
  NEXT/NEXT+1: NEXT
  Time Slot: 08:05

❌ FLIGHT REJECTED #3
  Trainee: Bob Johnson
  Event: FIC210_003 (FIC210)
  Proposed Time: 8.17 - 9.33
  Instructor Candidates: 0
  Aircraft Candidates: 2 (PC-21 1, PC-21 2)
  Area Candidates: 2 (A1, A2)
  Rejection Reason: NO_INSTRUCTOR_AVAILABLE

❌ FLIGHT REJECTED #4
  Trainee: Alice Williams
  Event: FIC211_001 (FIC211)
  Proposed Time: 8.25 - 9.42
  Instructor Candidates: 5 (Burns, Miller, Smith, Jones, Wilson)
  Aircraft Candidates: 2 (PC-21 1, PC-21 2)
  Area Candidates: 2 (A1, A2)
  Rejection Reason: INSTRUCTOR_SOFT_DUTY_LIMIT

... (up to #12)

FLIGHT REJECTION BUCKETS (after first 2 successes):
  NO_INSTRUCTOR_AVAILABLE: 8
  INSTRUCTOR_SOFT_DUTY_LIMIT: 2
  NO_AIRCRAFT_AVAILABLE: 0
  NO_AREA_AVAILABLE: 0
  [all buckets listed]

FLIGHT TIME SLOTS TRIED (after first 2 successes):
  0810: 3 attempts - FAILED: NO_INSTRUCTOR_AVAILABLE
  0815: 2 attempts - FAILED: INSTRUCTOR_SOFT_DUTY_LIMIT
  0820: 1 attempt - FAILED: NO_INSTRUCTOR_AVAILABLE
  0825: 0 attempts - SKIPPED (no candidates remaining)
  ...

🔴🔴🔴 [FLIGHT-BOTTLENECK] DIAGNOSTIC COMPLETE 🔴🔴🔴
```

---

## Key Questions to Answer

1. **Are instructors available after the first 2 flights?**
   - If NO: Bottleneck is instructor availability
   - If YES: Bottleneck is elsewhere (aircraft, area, etc.)

2. **Is the soft duty limit being hit?**
   - If YES: This is the primary bottleneck
   - If NO: Check other limits

3. **Are aircraft available?**
   - If NO: Bottleneck is aircraft count or turnaround time
   - If YES: Check area availability

4. **Are areas available?**
   - If NO: Bottleneck is area availability
   - If YES: Check takeoff separation

5. **Are later time slots being tried?**
   - If NO: Loop may be terminating early (pass management issue)
   - If YES: Bottleneck is in scheduling logic

---

## Conclusion

The most likely bottleneck is **INSTRUCTOR_SOFT_DUTY_LIMIT** given that only 2 flights are scheduled at the very start of the window. However, the diagnostic will definitively identify the first exact bottleneck preventing additional flights.