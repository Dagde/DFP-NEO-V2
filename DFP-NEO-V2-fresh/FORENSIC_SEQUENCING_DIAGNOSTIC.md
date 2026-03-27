# Forensic Diagnostic: Next/Next+1 Sequencing Validation

## Problem Statement

The DFP build algorithm intentionally processes trainees multiple times across different category passes:
- Next events scheduled first (FLIGHT → FTD → CPT → GROUND)
- Next+1 events scheduled second (FLIGHT → FTD → CPT → GROUND)

The current failures may be caused by:
1. **Valid Next/Next+1 attempts being rejected as conflicts** (should be allowed)
2. **Trainees placed into wrong category lists** (mismatch between event type and list)
3. **Incorrect timing/buffer/turnaround calculations** (false conflicts from windows)
4. **Actual duplicate-processing bugs** (beyond intended Next/Next+1 logic)

## Scheduling Order (Critical Context)

The build algorithm schedules events in this exact order:

```
1. Add Highest Priority Events (all categories)
2. Schedule Day Flight Events (Next)
3. Schedule Night Flight Events (Next, if 2+ BNF trainees)
4. Schedule FTD Events (Next)
5. Schedule CPT Events (Next)
6. Schedule Ground Events (Next)
7. Schedule Day Flight Events (Next+1)
8. Schedule Night Flight Events (Next+1, Wave Two, if 2+ BNF trainees)
9. Schedule FTD Events (Next+1)
10. Schedule CPT Events (Next+1)
11. Schedule Ground Events (Next+1)
12. Schedule STBY flights
13. Schedule STBY FTD
```

**Key Insight**: A trainee can appear in both a Next list AND a Next+1 list for the SAME category (e.g., `nextEventLists.flight` AND `nextPlusOneLists.flight`).

## Category List Structure

Each trainee is placed into exactly these lists:

### Next Lists (scheduled first)
- `nextEventLists.flight` - Trainees whose next event is a Flight
- `nextEventLists.ftd` - Trainees whose next event is FTD
- `nextEventLists.cpt` - Trainees whose next event is CPT
- `nextEventLists.ground` - Trainees whose next event is Ground
- `nextEventLists.bnf` - Trainees whose next event is BNF Night Flight

### Next+1 Lists (scheduled second)
- `nextPlusOneLists.flight` - Trainees whose next+1 event is a Flight
- `nextPlusOneLists.ftd` - Trainees whose next+1 event is FTD
- `nextPlusOneLists.cpt` - Trainees whose next+1 event is CPT
- `nextPlusOneLists.ground` - Trainees whose next+1 event is Ground

## Overlap Check Locations

### 1. BNF Night Pass Overlap Check (Line 1961-1989)
**Context**: During BNF night flight scheduling
**Check**: Against `generatedEvents` (which includes Active DFP + Highest Priority + all previously scheduled events)

```typescript
const hasOverlap = generatedEvents
    .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
    .some(e => {
        if (!getPersonnel(e).includes(instructor.name)) return false;
        const existingIsGround = e.type === 'ground';
        const proposedIsGround = syllabusItemForCheck.type?.toLowerCase() === 'ground';
        if (existingIsGround !== proposedIsGround) return false; // Skip cross-type
        const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
        const overlaps = proposedBookingWindow.start < existingBookingWindow.end && 
                        proposedBookingWindow.end > existingBookingWindow.start;
        return overlaps;
    });
```

### 2. Main Candidate Loop Overlap Check (Line 2162-2194)
**Context**: During regular event scheduling
**Check**: Against `generatedEvents` (which includes Active DFP + Highest Priority + all previously scheduled events)

```typescript
const hasOverlap = generatedEvents
    .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
    .some(e => {
        if (!getPersonnel(e).includes(ip.name)) return false;
        const existingIsGround = e.type === 'ground';
        const proposedIsGround = type === 'ground';
        if (existingIsGround !== proposedIsGround) return false; // Skip cross-type
        const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
        const overlaps = proposedBookingWindow.start < existingBookingWindow.end && 
                        proposedBookingWindow.end > existingBookingWindow.start;
        return overlaps;
    });
```

## Event Source Tracking Required

To distinguish conflict sources, we need to tag all events with their origin:

```typescript
type EventSource = 'active-dfp' | 'highest-priority' | 'generated-flight-next' | 
                   'generated-flight-next+1' | 'generated-ftd-next' | 
                   'generated-ftd-next+1' | 'generated-cpt-next' | 
                   'generated-cpt-next+1' | 'generated-ground-next' | 
                   'generated-ground-next+1' | 'unknown';

interface ForensicEvent extends Omit<ScheduleEvent, 'date'> {
    _source: EventSource;
    _generatedInPass: string; // e.g., 'flight-next', 'ftd-next+1', etc.
    _isNext: boolean;         // true for Next, false for Next+1
    _traineeId: string;
    _traineeName: string;
}
```

## Diagnostic Logging Requirements

For the first 20 rejected conflicts, log:

### 1. Candidate Event Snapshot
```typescript
{
    traineeId: "TRN-001",
    traineeName: "John Doe",
    eventName: "BGF9",
    category: "FLIGHT",
    isNext: true,                    // NEXT or NEXT+1
    plannedStart: 9.5,              // 09:30
    plannedEnd: 11.5,               // 11:30
    briefingWindow: { start: 9.0, end: 9.5 },  // preFlightTime
    debriefWindow: { start: 11.5, end: 12.0 }, // postFlightTime
    turnaroundWindow: 0,            // N/A for first event
    instructor: "Smith",
    resource: null,                 // Not yet assigned
    flightNumber: "BGF9",
    type: "flight"
}
```

### 2. Conflicting Event Snapshot
```typescript
{
    traineeId: "TRN-001",
    traineeName: "John Doe",
    eventName: "BGF10",
    category: "FLIGHT",
    isNext: false,                   // Was this Next or Next+1?
    start: 10.0,
    end: 12.0,
    briefingWindow: { start: 9.5, end: 10.0 },
    debriefWindow: { start: 12.0, end: 12.5 },
    turnaroundWindow: 0.5,          // 30 minutes
    instructor: "Smith",
    resource: "PC-21 3",
    source: "generated-flight-next", // Where did this come from?
    flightNumber: "BGF10",
    type: "flight"
}
```

### 3. Relationship Test
```typescript
{
    sameTrainee: true,
    sameInstructor: true,
    sameResource: false,              // Candidate not yet assigned
    sameCategory: true,
    sameDaySequentialEvent: true,    // Same trainee, same day, sequential events?
    actualClockOverlap: true,        // Do booking windows overlap?
    onlyOverlapBecauseOfBuffer: false,
    onlyOverlapBecauseOfTurnaround: false
}
```

### 4. Category-List Validation
```typescript
{
    traineeName: "John Doe",
    listsPlacedInto: [
        "nextEventLists.flight",      // For NEXT event
        "nextPlusOneLists.flight"     // For NEXT+1 event
    ],
    computedNextEvent: {
        code: "BGF9",
        type: "Flight",
        sortieType: "Dual"
    },
    computedNextPlusOneEvent: {
        code: "BGF10",
        type: "Flight",
        sortieType: "Dual"
    },
    categoryPlacementCorrect: true,   // Does list match event type?
    placementErrors: []
}
```

### 5. Sequencing Validation
```typescript
{
    traineeName: "John Doe",
    isConflictingTheEarlierNextEvent: true,  // Was conflicting event the NEXT event?
    isRejectedTheNextPlusOneEvent: true,     // Is rejected candidate the NEXT+1 event?
    shouldBeAllowed: true,                   // Should this second event be allowed later in day?
    rejectionReason: "INVALID",              // If NOT allowed, why was it attempted?
    schedulingGap: 0.5,                      // Hours between events (if no overlap)
    requiredTurnaround: 0.5,                 // Required gap
    actualGap: 0.0                           // Actual gap (negative = overlap)
}
```

## Implementation Plan

### Step 1: Event Source Tagging

**Location**: Line 1292 - `generatedEvents` initialization

```typescript
// Tag Active DFP events
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = activeDfpEventsWithoutDate.map(event => ({
    ...event,
    _source: 'active-dfp' as const,
    _generatedInPass: 'none',
    _isNext: false,
    _traineeId: event.student || '',
    _traineeName: event.student || ''
}));
```

**Location**: Line 1362 - Highest Priority Events

```typescript
generatedEvents.push({
    ...eventWithoutDate,
    _source: 'highest-priority' as const,
    _generatedInPass: 'priority',
    _isNext: false,
    _traineeId: event.student || '',
    _traineeName: event.student || ''
});
```

**Location**: Line 1843 - Generated Events (after scheduleEvent)

```typescript
generatedEvents.push({
    ...result,
    _source: `generated-${type}-${isPlusOne ? 'next+1' : 'next'}` as EventSource,
    _generatedInPass: `${type}-${isPlusOne ? 'next+1' : 'next'}`,
    _isNext: !isPlusOne,
    _traineeId: trainee.idNumber,
    _traineeName: trainee.fullName
});
```

### Step 2: Trainee List Placement Tracking

**Location**: Line 1426 - After `traineeNextEventMap` creation

```typescript
// Track which lists each trainee was placed into
const traineeListPlacement = new Map<string, string[]>();

activeTrainees.forEach(trainee => {
    const { next, plusOne } = traineeNextEventMap.get(trainee.fullName) || { next: null, plusOne: null };
    const placements: string[] = [];
    
    if (next) {
        if (next.code.startsWith('BNF') && next.type === 'Flight') {
            placements.push('nextEventLists.bnf');
        } else if (next.type === 'Flight') {
            placements.push('nextEventLists.flight');
        } else if (next.type === 'FTD') {
            placements.push('nextEventLists.ftd');
        } else if (next.type === 'Ground School' && next.methodOfDelivery.includes('CPT')) {
            placements.push('nextEventLists.cpt');
        } else if (next.type === 'Ground School') {
            placements.push('nextEventLists.ground');
        }
    }
    
    if (plusOne) {
        if (plusOne.type === 'Flight') {
            placements.push('nextPlusOneLists.flight');
        } else if (plusOne.type === 'FTD') {
            placements.push('nextPlusOneLists.ftd');
        } else if (plusOne.type === 'Ground School' && plusOne.methodOfDelivery.includes('CPT')) {
            placements.push('nextPlusOneLists.cpt');
        } else if (plusOne.type === 'Ground School') {
            placements.push('nextPlusOneLists.ground');
        }
    }
    
    traineeListPlacement.set(trainee.fullName, placements);
});
```

### Step 3: Enhanced Overlap Rejection Logging

**Replace**: Line 1114-1139 - `_logOverlapRejection`

```typescript
const _MAX_FORENSIC_LOGS = 20;
let _forensicLogCount = 0;

const _logForensicRejection = (
    candidate: {
        trainee: Trainee,
        syllabusItem: SyllabusItemDetail,
        isNext: boolean,
        plannedStartTime: number,
        plannedEndTime: number,
        bookingWindow: { start: number, end: number },
        instructorName: string,
        type: string
    },
    conflictingEvent: any,
    conflictLocation: string
) => {
    if (_forensicLogCount >= _MAX_FORENSIC_LOGS) return;
    _forensicLogCount++;
    
    // Get syllabus details for both events
    const candidateSyllabus = candidate.syllabusItem;
    const conflictingSyllabus = syllabusDetails.find(s => s.id === conflictingEvent.flightNumber);
    
    // Calculate windows
    const candidateBriefingWindow = {
        start: candidate.plannedStartTime - (candidateSyllabus.preFlightTime || 0),
        end: candidate.plannedStartTime
    };
    const candidateDebriefWindow = {
        start: candidate.plannedEndTime,
        end: candidate.plannedEndTime + (candidateSyllabus.postFlightTime || 0)
    };
    
    const conflictingBriefingWindow = conflictingSyllabus ? {
        start: conflictingEvent.startTime - (conflictingSyllabus.preFlightTime || 0),
        end: conflictingEvent.startTime
    } : null;
    
    const conflictingDebriefWindow = conflictingSyllabus ? {
        start: conflictingEvent.startTime + conflictingEvent.duration,
        end: conflictingEvent.startTime + conflictingEvent.duration + (conflictingSyllabus.postFlightTime || 0)
    } : null;
    
    // Determine turnaround gap
    let turnaroundGap = 0;
    if (conflictingDebriefWindow && candidateBriefingWindow) {
        turnaroundGap = candidateBriefingWindow.start - conflictingDebriefWindow.end;
    }
    
    // Get list placement for trainee
    const listPlacements = traineeListPlacement.get(candidate.trainee.fullName) || [];
    const nextEvents = traineeNextEventMap.get(candidate.trainee.fullName);
    
    // Determine if conflicting was the earlier Next event
    const conflictingWasNextEvent = conflictingEvent._isNext === true;
    const candidateIsNextPlusOne = candidate.isNext === false;
    
    // Determine category
    const getCategory = (type: string) => {
        if (type === 'flight') return 'FLIGHT';
        if (type === 'ftd') return 'FTD';
        if (type === 'cpt' || type === 'ground') return 'GROUND';
        if (conflictingEvent.flightNumber?.startsWith('BNF')) return 'BNF';
        return type.toUpperCase();
    };
    
    // Relationship tests
    const sameTrainee = conflictingEvent._traineeName === candidate.trainee.fullName;
    const sameInstructor = conflictingEvent.instructor === candidate.instructorName;
    const sameResource = conflictingEvent.resourceId && 
                        (candidate.type === 'flight' || candidate.type === 'ftd') &&
                        conflictingEvent.resourceId === `PC-21 ${someResource}`; // Need to check
    
    // Check actual clock overlap
    const actualClockOverlap = candidate.bookingWindow.start < 
                               (conflictingEvent.startTime + conflictingEvent.duration + (conflictingSyllabus?.postFlightTime || 0)) &&
                               candidate.bookingWindow.end > 
                               (conflictingEvent.startTime - (conflictingSyllabus?.preFlightTime || 0));
    
    // Check if overlap is only due to buffers
    const coreCandidateWindow = { start: candidate.plannedStartTime, end: candidate.plannedEndTime };
    const coreConflictingWindow = { start: conflictingEvent.startTime, end: conflictingEvent.startTime + conflictingEvent.duration };
    const coreOverlap = coreCandidateWindow.start < coreConflictingWindow.end && 
                       coreCandidateWindow.end > coreConflictingWindow.start;
    
    const onlyOverlapBecauseOfBuffer = actualClockOverlap && !coreOverlap;
    
    // Check if overlap is only due to turnaround
    const requiredTurnaround = candidateSyllabus.type === 'flight' ? flightTurnaround :
                              candidateSyllabus.type === 'ftd' ? ftdTurnaround :
                              candidateSyllabus.type === 'ground' ? cptTurnaround : 0;
    
    const onlyOverlapBecauseOfTurnaround = actualClockOverlap && 
                                          turnaroundGap >= 0 && 
                                          turnaroundGap < requiredTurnaround;
    
    // Sequencing validation
    const shouldBeAllowed = sameTrainee && 
                           candidateIsNextPlusOne && 
                           conflictingWasNextEvent && 
                           !actualClockOverlap;
    
    const rejectionReason = shouldBeAllowed ? "INVALID (should be allowed - sequential event)" : 
                           sameTrainee && candidateIsNextPlusOne && conflictingWasNextEvent ?
                           "TURNAROUND_CONSTRAINT" : "DUPLICATE_PROCESSING";
    
    console.log(`
═══════════════════════════════════════════════════════════════
🔴 FORENSIC REJECTION #${_forensicLogCount}
Location: ${conflictLocation}
═══════════════════════════════════════════════════════════════

📋 1. CANDIDATE EVENT
   Trainee ID: ${candidate.trainee.idNumber}
   Trainee Name: ${candidate.trainee.fullName}
   Event Name: ${candidate.syllabusItem.code}
   Category: ${getCategory(candidate.type)}
   Is Next: ${candidate.isNext ? 'YES (NEXT)' : 'NO (NEXT+1)'}
   Planned Time: ${formatTime(candidate.plannedStartTime)} - ${formatTime(candidate.plannedEndTime)}
   Briefing Window: ${formatTime(candidateBriefingWindow.start)} - ${formatTime(candidateBriefingWindow.end)}
   Debrief Window: ${formatTime(candidateDebriefWindow.start)} - ${formatTime(candidateDebriefWindow.end)}
   Turnaround Window: N/A (first event)
   Instructor: ${candidate.instructorName}
   Resource: Not yet assigned

📋 2. CONFLICTING EVENT
   Trainee ID: ${conflictingEvent._traineeId || 'N/A'}
   Trainee Name: ${conflictingEvent._traineeName || 'N/A'}
   Event Name: ${conflictingEvent.flightNumber}
   Category: ${getCategory(conflictingEvent.type)}
   Is Next: ${conflictingEvent._isNext ? 'YES (NEXT)' : 'NO (NEXT+1)'}
   Time: ${formatTime(conflictingEvent.startTime)} - ${formatTime(conflictingEvent.startTime + conflictingEvent.duration)}
   Briefing Window: ${conflictingBriefingWindow ? `${formatTime(conflictingBriefingWindow.start)} - ${formatTime(conflictingBriefingWindow.end)}` : 'N/A'}
   Debrief Window: ${conflictingDebriefWindow ? `${formatTime(conflictingDebriefWindow.start)} - ${formatTime(conflictingDebriefWindow.end)}` : 'N/A'}
   Turnaround: ${formatDuration(requiredTurnaround)} required
   Instructor: ${conflictingEvent.instructor}
   Resource: ${conflictingEvent.resourceId || 'N/A'}
   Source: ${conflictingEvent._source || 'unknown'}
   Generated In Pass: ${conflictingEvent._generatedInPass || 'unknown'}

📋 3. RELATIONSHIP TEST
   Same Trainee: ${sameTrainee ? '✓ YES' : '✗ NO'}
   Same Instructor: ${sameInstructor ? '✓ YES' : '✗ NO'}
   Same Resource: ${sameResource ? '✓ YES' : '✗ NO'}
   Same Category: ${getCategory(candidate.type) === getCategory(conflictingEvent.type) ? '✓ YES' : '✗ NO'}
   Same Day Sequential Event: ${sameTrainee ? '✓ YES' : '✗ NO'}
   Actual Clock Overlap: ${actualClockOverlap ? '✓ YES' : '✗ NO'}
   Only Overlap Because of Buffer: ${onlyOverlapBecauseOfBuffer ? '✓ YES' : '✗ NO'}
   Only Overlap Because of Turnaround: ${onlyOverlapBecauseOfTurnaround ? '✓ YES' : '✗ NO'}
   Turnaround Gap: ${turnaroundGap >= 0 ? formatDuration(turnaroundGap) : `${formatDuration(Math.abs(turnaroundGap))} OVERLAP`}
   Required Turnaround: ${formatDuration(requiredTurnaround)}

📋 4. CATEGORY-LIST VALIDATION
   Trainee: ${candidate.trainee.fullName}
   Lists Placed Into: ${listPlacements.join(', ') || 'NONE'}
   Computed Next Event: ${nextEvents?.next ? `${nextEvents.next.code} (${nextEvents.next.type})` : 'NONE'}
   Computed Next+1 Event: ${nextEvents?.plusOne ? `${nextEvents.plusOne.code} (${nextEvents.plusOne.type})` : 'NONE'}
   Category Placement Correct: ${listPlacements.includes(candidate.isNext ? 'nextEventLists.' + getCategory(candidate.type).toLowerCase() : 'nextPlusOneLists.' + getCategory(candidate.type).toLowerCase()) ? '✓ YES' : '✗ NO'}

📋 5. SEQUENCING VALIDATION
   Is Conflicting the Earlier NEXT Event? ${conflictingWasNextEvent ? '✓ YES' : '✗ NO'}
   Is Rejected the NEXT+1 Event? ${candidateIsNextPlusOne ? '✓ YES' : '✗ NO'}
   Should This Be Allowed Later in Day? ${shouldBeAllowed ? '✓ YES (sequential scheduling)' : '✗ NO'}
   Rejection Reason: ${rejectionReason}

🎯 ANALYSIS:
   ${shouldBeAllowed ? '⚠️  POTENTIAL BUG: Valid Next+1 event rejected as conflict!' : 
     sameTrainee && candidateIsNextPlusOne ? '✅ VALID REJECTION: Turnaround constraint' : 
     sameTrainee ? '❌ POSSIBLE BUG: Duplicate processing?' : '✅ VALID REJECTION: Different trainee'}

═══════════════════════════════════════════════════════════════
    `);
};

// Helper functions
const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};
```

### Step 4: Call Forensic Logging at Overlap Checks

**Location**: Line 1975 - BNF Night Pass Overlap

```typescript
if (overlaps) {
    _logForensicRejection(
        {
            trainee: traineeForCheck,
            syllabusItem: syllabusItemForCheck,
            isNext: false, // Plus One check
            plannedStartTime: proposedBookingWindow.start + (syllabusItemForCheck.preFlightTime || 0),
            plannedEndTime: proposedBookingWindow.end - (syllabusItemForCheck.postFlightTime || 0),
            bookingWindow: proposedBookingWindow,
            instructorName: instructor.name,
            type: syllabusItemForCheck.type || 'unknown'
        },
        e,
        'BNF Night Pass Overlap Check (Line 1975)'
    );
}
```

**Location**: Line 2180 - Main Candidate Loop Overlap

```typescript
if (overlaps) {
    _logForensicRejection(
        {
            trainee: trainee,
            syllabusItem: syllabusItem,
            isNext: !isPlusOne,
            plannedStartTime: proposedBookingWindow.start + (syllabusItem.preFlightTime || 0),
            plannedEndTime: proposedBookingWindow.end - (syllabusItem.postFlightTime || 0),
            bookingWindow: proposedBookingWindow,
            instructorName: ip.name,
            type: type
        },
        e,
        'Main Candidate Loop Overlap Check (Line 2180)'
    );
}
```

### Step 5: Final Forensic Report

**Location**: End of `generateDfpInternal()` function (before return statement)

```typescript
// Generate final forensic summary
console.log(`
═══════════════════════════════════════════════════════════════
📊 FORENSIC SUMMARY REPORT
═══════════════════════════════════════════════════════════════

Total Conflicts Logged: ${_forensicLogCount}

A. Conflict Source Analysis:
   Active DFP Events: [count from logs]
   Highest Priority Events: [count from logs]
   Generated Events (Flight Next): [count from logs]
   Generated Events (Flight Next+1): [count from logs]
   Generated Events (FTD Next): [count from logs]
   Generated Events (FTD Next+1): [count from logs]
   Generated Events (CPT Next): [count from logs]
   Generated Events (CPT Next+1): [count from logs]
   Generated Events (Ground Next): [count from logs]
   Generated Events (Ground Next+1): [count from logs]

B. Same-Trainee Conflict Analysis:
   Valid Next vs Next+1 Sequencing: [count]
   True Duplicate-Processing Bugs: [count]
   Other Same-Trainee Conflicts: [count]

C. Timing Window Analysis:
   Conflicts from Clock Overlap: [count]
   Conflicts from Buffer/Debrief Only: [count]
   Conflicts from Turnaround Only: [count]

D. Category-List Validation:
   Trainees with Incorrect Placement: [count]
   Placement Errors: [list specific errors]

E. First Proven Root Cause:
   [Identify the most common issue]

═══════════════════════════════════════════════════════════════
`);
```

## Expected Output Analysis

### Scenario 1: Valid Next+1 Rejected (BUG)
```
📋 3. RELATIONSHIP TEST
   Same Trainee: ✓ YES
   Same Instructor: ✓ YES
   Actual Clock Overlap: ✗ NO
   Turnaround Gap: 1h 30m
   Required Turnaround: 30m

📋 5. SEQUENCING VALIDATION
   Is Conflicting the Earlier NEXT Event? ✓ YES
   Is Rejected the NEXT+1 Event? ✓ YES
   Should This Be Allowed Later in Day? ✓ YES (sequential scheduling)

🎯 ANALYSIS:
   ⚠️  POTENTIAL BUG: Valid Next+1 event rejected as conflict!
```

### Scenario 2: Turnaround Constraint (VALID)
```
📋 3. RELATIONSHIP TEST
   Same Trainee: ✓ YES
   Same Instructor: ✓ YES
   Actual Clock Overlap: ✓ YES
   Turnaround Gap: -15m OVERLAP
   Required Turnaround: 30m

📋 5. SEQUENCING VALIDATION
   Is Conflicting the Earlier NEXT Event? ✓ YES
   Is Rejected the NEXT+1 Event? ✓ YES
   Should This Be Allowed Later in Day? ✗ NO

🎯 ANALYSIS:
   ✅ VALID REJECTION: Turnaround constraint
```

### Scenario 3: Duplicate Processing (BUG)
```
📋 3. RELATIONSHIP TEST
   Same Trainee: ✓ YES
   Same Instructor: ✓ YES
   Actual Clock Overlap: ✓ YES
   
📋 5. SEQUENCING VALIDATION
   Is Conflicting the Earlier NEXT Event? ✗ NO
   Is Rejected the NEXT+1 Event? ✗ NO
   Should This Be Allowed Later in Day? ✗ NO
   Rejection Reason: DUPLICATE_PROCESSING

🎯 ANALYSIS:
   ❌ POSSIBLE BUG: Duplicate processing?
```

## Key Differences from Previous Approach

1. **No Generic Duplicate Check**: We don't flag "same trainee appears twice" as an error
2. **Context-Aware Analysis**: We distinguish between valid Next/Next+1 sequencing vs actual bugs
3. **Source Tracking**: We know exactly which pass generated each conflicting event
4. **Turnaround Validation**: We check if conflicts are due to legitimate turnaround constraints
5. **Category Validation**: We verify trainees were placed in correct lists

## Next Steps

Once implemented, run the build and analyze the output to determine:

1. **Are most conflicts from Active DFP?** → Expected behavior
2. **Are conflicts Next vs Next+1 with sufficient turnaround?** → Bug in overlap detection
3. **Are conflicts due to incorrect category placement?** → Bug in list assignment
4. **Are conflicts genuine duplicate processing?** → Bug in event generation logic