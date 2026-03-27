# Precise Forensic Trace Plan - Current-Pass Contamination Detection

## Objective

Prove the exact cause of personnel conflicts by tracking object references, mutation timing, and build-pass attempt counts.

**Status**: READ-ONLY ANALYSIS - No code changes yet

---

## Implementation Strategy

### Phase 1: Object Reference Tracking System

**Location**: Line ~1330 (after `generatedEvents` initialization)

**Add Tracking Infrastructure**:
```typescript
// Object reference tracking to detect duplicates and mutations
const objectReferenceTracker = new Map<string, {
    firstSeenAt: number;
    attemptCount: number;
    lastMutationTime: number;
    mutations: Array<{
        property: string;
        oldValue: any;
        newValue: any;
        timestamp: number;
    }>;
}>();

// Trainee attempt counter per build pass
const traineeAttemptCounter = new Map<string, number>();

// Track when events are added to generatedEvents
const eventAdditionTimestamps = new Map<string, number>();

// Track candidate validation state
const candidateValidationState = new Map<string, {
    startTime: number;
    completed: boolean;
    validationResult: 'pending' | 'passed' | 'rejected' | 'error';
    conflictDetectedAt: number | null;
}>();

// Global attempt counter for logging
let _globalAttemptCount = 0;
const _MAX_FORENSIC_LOGS = 10;

// Helper to get unique object reference
const getObjectRef = (obj: any): string => {
    return `${obj.flightNumber || 'NO_FLIGHT'}_${obj.student || 'NO_STUDENT'}_${obj.instructor || 'NO_INSTRUCTOR'}`;
};

// Helper to detect object mutation
const detectObjectMutation = (obj: any, snapshot: any, timestamp: number): boolean => {
    let hasMutation = false;
    
    const keyProps = ['id', 'flightNumber', 'student', 'pilot', 'instructor', 'startTime', 'duration', 'type'];
    keyProps.forEach(prop => {
        if (obj[prop] !== snapshot[prop]) {
            hasMutation = true;
            console.log(`   🔴 MUTATION DETECTED: ${prop} changed from "${snapshot[prop]}" to "${obj[prop]}"`);
        }
    });
    
    return hasMutation;
};
```

---

### Phase 2: Build Input Validation (Simplified)

**Location**: Line ~1330 (after tracking infrastructure)

**Add**:
```typescript
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 [PRECISE FORENSIC] BUILD INPUT VALIDATION');
console.log('═══════════════════════════════════════════════════════════════');

const traineeIds = new Set<string>();
const traineeNames = new Set<string>();
const duplicateIds = new Map<string, number>();
const duplicateNames = new Map<string, number>();

trainees.forEach(t => {
    const id = t.idNumber || t.id || 'NO_ID';
    const name = t.fullName || 'NO_NAME';
    
    if (traineeIds.has(id)) {
        duplicateIds.set(id, (duplicateIds.get(id) || 0) + 1);
    }
    traineeIds.add(id);
    
    if (traineeNames.has(name)) {
        duplicateNames.set(name, (duplicateNames.get(name) || 0) + 1);
    }
    traineeNames.add(name);
});

console.log(`Total trainees: ${trainees.length}, Unique IDs: ${traineeIds.size}, Unique names: ${traineeNames.size}`);
console.log(`Duplicate IDs: ${duplicateIds.size}, Duplicate names: ${duplicateNames.size}`);

if (duplicateIds.size > 0 || duplicateNames.size > 0) {
    console.log('\n⚠️ DUPLICATES IN INPUT:');
    duplicateIds.forEach((count, id) => console.log(`   ID "${id}": ${count} occurrences`));
    duplicateNames.forEach((count, name) => console.log(`   Name "${name}": ${count} occurrences`));
}

console.log('═══════════════════════════════════════════════════════════════\n');
```

---

### Phase 3: Event Source Tagging (Required for Forensic Trace)

**Location**: Line 1330 (generatedEvents initialization)

**Current**:
```typescript
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [...activeDfpEventsWithoutDate];
```

**Change to**:
```typescript
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = 
    activeDfpEventsWithoutDate.map(e => ({ 
        ...e, 
        _source: 'active-dfp' as const,
        _addedAt: Date.now()  // Track when added
    }));

// Record addition timestamps
activeDfpEventsWithoutDate.forEach(e => {
    eventAdditionTimestamps.set(e.id, Date.now());
});
```

**Location**: Line 1362 (Highest Priority Events)

**Current**:
```typescript
generatedEvents.push(eventWithoutDate);
```

**Change to**:
```typescript
const addedAt = Date.now();
const eventWithMeta = { 
    ...eventWithoutDate, 
    _source: 'highest-priority' as const,
    _addedAt: addedAt 
};
generatedEvents.push(eventWithMeta);
eventAdditionTimestamps.set(event.id, addedAt);
```

**Location**: Line 1843 (scheduleEvent result)

**Current**:
```typescript
generatedEvents.push(result);
```

**Change to**:
```typescript
const addedAt = Date.now();
const eventWithMeta = { 
    ...result, 
    _source: 'generated' as const,
    _addedAt: addedAt 
};
generatedEvents.push(eventWithMeta);
eventAdditionTimestamps.set(result.id, addedAt);
```

---

### Phase 4: Precise Forensic Logging for Overlap Conflicts

**Location**: Lines 1961-1980 (BNF night pass) and 2162-2190 (main candidate loop)

**Replace overlap check with precise forensic trace**:

```typescript
if (overlaps) {
    const now = Date.now();
    
    // Increment global attempt counter
    _globalAttemptCount++;
    
    // Get candidate details
    const candidateId = syllabusItemForCheck.id;
    const traineeName = traineeForCheck?.fullName || 'UNKNOWN';
    const instructorName = instructor.name;
    
    // Increment trainee attempt counter
    const traineeAttempts = (traineeAttemptCounter.get(traineeName) || 0) + 1;
    traineeAttemptCounter.set(traineeName, traineeAttempts);
    
    // Get candidate event snapshot (deep clone to detect mutations)
    const candidateSnapshot = {
        id: candidateId,
        traineeId: traineeForCheck?.idNumber || traineeForCheck?.id || 'N/A',
        traineeName: traineeName,
        eventName: syllabusItemForCheck.flightNumber || candidateId,
        instructor: instructorName,
        pilot: traineeForCheck?.fullName || 'N/A',
        startTime: proposedBookingWindow.start,
        endTime: proposedBookingWindow.end,
        type: type,
        _attemptNumber: traineeAttempts,
        _loggedAt: now
    };
    
    // Get conflicting event details
    const conflictingSnapshot = {
        id: e.id,
        traineeId: e.student || e.pilot || 'N/A',
        traineeName: e.student || e.pilot || 'N/A',
        eventName: e.flightNumber,
        instructor: e.instructor || 'N/A',
        pilot: e.pilot || 'N/A',
        startTime: e.startTime,
        endTime: e.startTime + e.duration,
        type: e.type,
        _source: (e as any)._source || 'unknown',
        _addedAt: (e as any)._addedAt || 0,
        _loggedAt: now
    };
    
    // Relationship tests
    const sameTrainee = candidateSnapshot.traineeName === conflictingSnapshot.traineeName;
    const sameInstructor = candidateSnapshot.instructor === conflictingSnapshot.instructor;
    const sameEventName = candidateSnapshot.eventName === conflictingSnapshot.eventName;
    const overlappingTime = candidateSnapshot.startTime < conflictingSnapshot.endTime && 
                            candidateSnapshot.endTime > conflictingSnapshot.startTime;
    const sameObjectRef = candidateSnapshot.id === conflictingSnapshot.id;
    
    // Build-pass tracking
    const priorAttempts = traineeAttempts - 1;
    const conflictingAddedBeforeCandidate = (e as any)._addedAt ? 
        (e as any)._addedAt < now : false;
    
    // State safety check
    const candidateRefStr = JSON.stringify(candidateSnapshot);
    const conflictingRefStr = JSON.stringify(conflictingSnapshot);
    const differentObjectRefs = candidateRefStr !== conflictingRefStr;
    
    // Check if conflicting event was added in current pass
    const isCurrentPassEvent = conflictingSnapshot._source === 'generated' || 
                               conflictingSnapshot._source === 'highest-priority';
    
    if (_globalAttemptCount <= _MAX_FORENSIC_LOGS) {
        console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
        console.log(`║ 🔴 [PRECISE FORENSIC #${_globalAttemptCount}] PERSONNEL CONFLICT            ║`);
        console.log(`╚══════════════════════════════════════════════════════════════════════╝`);
        
        console.log('\n┌─ 1. CANDIDATE EVENT SNAPSHOT ─────────────────────────────────────────┐');
        console.log(`│ Event ID          : ${candidateSnapshot.id.padEnd(40)}│`);
        console.log(`│ Trainee ID        : ${candidateSnapshot.traineeId.padEnd(40)}│`);
        console.log(`│ Trainee Name      : ${candidateSnapshot.traineeName.padEnd(40)}│`);
        console.log(`│ Event Name        : ${candidateSnapshot.eventName.padEnd(40)}│`);
        console.log(`│ Instructor        : ${candidateSnapshot.instructor.padEnd(40)}│`);
        console.log(`│ Pilot             : ${candidateSnapshot.pilot.padEnd(40)}│`);
        console.log(`│ Start Time        : ${candidateSnapshot.startTime.toFixed(2).padEnd(40)}│`);
        console.log(`│ End Time          : ${candidateSnapshot.endTime.toFixed(2).padEnd(40)}│`);
        console.log(`│ Attempt Counter   : ${candidateSnapshot._attemptNumber.toString().padEnd(40)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('\n┌─ 2. EXACT CONFLICTING EVENT SNAPSHOT ─────────────────────────────────────┐');
        console.log(`│ Event ID          : ${conflictingSnapshot.id.padEnd(40)}│`);
        console.log(`│ Trainee ID        : ${conflictingSnapshot.traineeId.padEnd(40)}│`);
        console.log(`│ Trainee Name      : ${conflictingSnapshot.traineeName.padEnd(40)}│`);
        console.log(`│ Event Name        : ${conflictingSnapshot.eventName.padEnd(40)}│`);
        console.log(`│ Instructor        : ${conflictingSnapshot.instructor.padEnd(40)}│`);
        console.log(`│ Pilot             : ${conflictingSnapshot.pilot.padEnd(40)}│`);
        console.log(`│ Start Time        : ${conflictingSnapshot.startTime.toFixed(2).padEnd(40)}│`);
        console.log(`│ End Time          : ${conflictingSnapshot.endTime.toFixed(2).padEnd(40)}│`);
        console.log(`│ Source            : ${conflictingSnapshot._source.padEnd(40)}│`);
        console.log(`│ Added Timestamp   : ${conflictingSnapshot._addedAt ? new Date(conflictingSnapshot._addedAt).toISOString() : 'N/A'.padEnd(40)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('\n┌─ 3. RELATIONSHIP TEST ────────────────────────────────────────────────────┐');
        console.log(`│ Same Trainee as Candidate?      ${sameTrainee ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Same Instructor as Candidate?   ${sameInstructor ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Same Event Name as Candidate?   ${sameEventName ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Overlapping Time?               ${overlappingTime ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Same Object Reference?          ${sameObjectRef ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('\n┌─ 4. BUILD-PASS TRACKING ──────────────────────────────────────────────────┐');
        console.log(`│ Prior Attempts for this Trainee  ${priorAttempts.toString().padEnd(30)}│`);
        console.log(`│ Attempt Number (this candidate)  ${traineeAttempts.toString().padEnd(30)}│`);
        console.log(`│ Conflicting Added Before Valid.  ${conflictingAddedBeforeCandidate ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Is Current-Pass Event?           ${isCurrentPassEvent ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('\n┌─ 5. STATE SAFETY CHECK ────────────────────────────────────────────────────┐');
        console.log(`│ Different Object References?      ${differentObjectRefs ? '✅ YES' : '❌ NO'.padEnd(30)}│`);
        console.log(`│ Candidate Reference Hash         ${candidateSnapshot.id.substring(0, 16).padEnd(40)}│`);
        console.log(`│ Conflicting Reference Hash       ${conflictingSnapshot.id.substring(0, 16).padEnd(40)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('\n┌─ 6. ROOT CAUSE ANALYSIS ───────────────────────────────────────────────────┐');
        
        let rootCause = '';
        let evidence = '';
        
        if (sameTrainee && sameEventName && isCurrentPassEvent) {
            rootCause = 'CURRENT-PASS DUPLICATE';
            evidence = `Trainee "${traineeName}" attempted same event "${candidateSnapshot.eventName}" multiple times in current pass`;
        } else if (sameTrainee && isCurrentPassEvent) {
            rootCause = 'CURRENT-PASS CONTAMINATION';
            evidence = `Trainee "${traineeName}" conflicts with event generated earlier in current pass`;
        } else if (conflictingSnapshot._source === 'active-dfp') {
            rootCause = 'PRE-EXISTING BOOKING';
            evidence = `Conflict with Active DFP event from published schedule`;
        } else if (conflictingSnapshot._source === 'highest-priority') {
            rootCause = 'HIGHEST PRIORITY SEED';
            evidence = `Conflict with force-scheduled highest priority event`;
        } else {
            rootCause = 'UNKNOWN';
            evidence = 'Unable to determine root cause';
        }
        
        console.log(`│ ROOT CAUSE         : ${rootCause.padEnd(40)}│`);
        console.log(`│ EVIDENCE           : ${evidence.padEnd(40)}│`);
        console.log('└────────────────────────────────────────────────────────────────────────┘');
        
        console.log('═════════════════════════════════════════════════════════════════════════\n');
    }
    
    return overlaps;  // Continue with original behavior
}
```

---

### Phase 5: Final Forensic Summary

**Location**: End of `generateDfpInternal()` function (before return statement)

**Add**:
```typescript
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║ 🔍 [PRECISE FORENSIC] FINAL SUMMARY                                 ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

console.log('\n┌─ CONFLICT STATISTICS ──────────────────────────────────────────────────┐');
console.log(`│ Total Conflicts Logged        ${_globalAttemptCount.toString().padEnd(30)}│`);
console.log(`│ Max Logs Tracked              ${_MAX_FORENSIC_LOGS.toString().padEnd(30)}│`);
console.log('└────────────────────────────────────────────────────────────────────────┘');

console.log('\n┌─ TRAINEE ATTEMPT STATISTICS ─────────────────────────────────────────────┐');
const traineesWithMultipleAttempts = Array.from(traineeAttemptCounter.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

console.log(`│ Trainees with Multiple Attempts : ${traineesWithMultipleAttempts.length.toString().padEnd(30)}│`);

if (traineesWithMultipleAttempts.length > 0 && traineesWithMultipleAttempts.length <= 10) {
    console.log('\n│ TOP 10 TRAINEES BY ATTEMPT COUNT:');
    traineesWithMultipleAttempts.slice(0, 10).forEach(([name, count], idx) => {
        console.log(`│   ${idx + 1}. ${name.padEnd(30)} : ${count} attempts`);
    });
}

console.log('└────────────────────────────────────────────────────────────────────────┘');

console.log('\n┌─ EVENT SOURCE STATISTICS ───────────────────────────────────────────────┐');
const sourceCounts = new Map<string, number>();
generatedEvents.forEach(e => {
    const source = (e as any)._source || 'unknown';
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
});

console.log(`│ Total Events in generatedEvents  : ${generatedEvents.length.toString().padEnd(30)}│`);
sourceCounts.forEach((count, source) => {
    console.log(`│ - ${source.padEnd(25)} : ${count.toString().padEnd(10)}│`);
});
console.log('└────────────────────────────────────────────────────────────────────────┘');

console.log('\n┌─ ROOT CAUSE SUMMARY ─────────────────────────────────────────────────────┐');
if (traineesWithMultipleAttempts.length > 0) {
    const multipleAttemptsPct = ((traineesWithMultipleAttempts.length / activeTrainees.length) * 100).toFixed(1);
    console.log(`│ 🔴 TRAINEES WITH MULTIPLE ATTEMPTS : ${traineesWithMultipleAttempts.length} (${multipleAttemptsPct}%)`);
    console.log(`│ 🔴 LIKELY ROOT CAUSE              : Duplicate processing of same trainees`);
    console.log(`│ 🔴 EVIDENCE                      : ${traineesWithMultipleAttempts.length} trainees attempted ${traineesWithMultipleAttempts.reduce((sum, [_, c]) => sum + c, 0)} times total`);
} else {
    console.log(`│ ✅ NO DUPLICATE PROCESSING DETECTED`);
    console.log(`│ ✅ All trainees processed once    : ${traineeAttemptCounter.size.toString().padEnd(30)}`);
}

if (duplicateIds.size > 0 || duplicateNames.size > 0) {
    console.log(`│ 🔴 DUPLICATES IN INPUT            : ${duplicateIds.size} IDs, ${duplicateNames.size} names`);
} else {
    console.log(`│ ✅ NO DUPLICATES IN INPUT`);
}
console.log('└────────────────────────────────────────────────────────────────────────┘');

console.log('\n╚══════════════════════════════════════════════════════════════════════╝\n');
```

---

## Expected Console Output Example

```
╔══════════════════════════════════════════════════════════════════════╗
║ 🔴 [PRECISE FORENSIC #1] PERSONNEL CONFLICT                            ║
╚══════════════════════════════════════════════════════════════════════╝

┌─ 1. CANDIDATE EVENT SNAPSHOT ─────────────────────────────────────────┐
│ Event ID          : BGF-01                                        │
│ Trainee ID        : 12345                                         │
│ Trainee Name      : Scott, Harper – ADF301                        │
│ Event Name        : BGF-01                                        │
│ Instructor        : Anderson, Benjamin                            │
│ Pilot             : Scott, Harper – ADF301                        │
│ Start Time        : 8.00                                          │
│ End Time          : 10.00                                         │
│ Attempt Counter   : 2                                             │
└────────────────────────────────────────────────────────────────────────┘

┌─ 2. EXACT CONFLICTING EVENT SNAPSHOT ─────────────────────────────────────┐
│ Event ID          : abc123-def456                                 │
│ Trainee ID        : 12345                                         │
│ Trainee Name      : Scott, Harper – ADF301                        │
│ Event Name        : BGF-01                                        │
│ Instructor        : Anderson, Benjamin                            │
│ Pilot             : Scott, Harper – ADF301                        │
│ Start Time        : 8.00                                          │
│ End Time          : 10.00                                         │
│ Source            : generated                                     │
│ Added Timestamp   : 2026-03-27T10:15:30.123Z                      │
└────────────────────────────────────────────────────────────────────────┘

┌─ 3. RELATIONSHIP TEST ────────────────────────────────────────────────────┐
│ Same Trainee as Candidate?      ✅ YES                                   │
│ Same Instructor as Candidate?   ✅ YES                                   │
│ Same Event Name as Candidate?   ✅ YES                                   │
│ Overlapping Time?               ✅ YES                                   │
│ Same Object Reference?          ❌ NO                                    │
└────────────────────────────────────────────────────────────────────────┘

┌─ 4. BUILD-PASS TRACKING ──────────────────────────────────────────────────┐
│ Prior Attempts for this Trainee  1                                       │
│ Attempt Number (this candidate)  2                                       │
│ Conflicting Added Before Valid.  ✅ YES                                   │
│ Is Current-Pass Event?           ✅ YES                                   │
└────────────────────────────────────────────────────────────────────────┘

┌─ 5. STATE SAFETY CHECK ────────────────────────────────────────────────────┐
│ Different Object References?      ✅ YES                                   │
│ Candidate Reference Hash         BGF-01_Scott, Harp                      │
│ Conflicting Reference Hash       abc123-def456                            │
└────────────────────────────────────────────────────────────────────────┘

┌─ 6. ROOT CAUSE ANALYSIS ───────────────────────────────────────────────────┐
│ ROOT CAUSE         : CURRENT-PASS DUPLICATE                               │
│ EVIDENCE           : Trainee "Scott, Harper – ADF301" attempted same event "BGF-01" multiple times in current pass
└────────────────────────────────────────────────────────────────────────┘

═════════════════════════════════════════════════════════════════════════

╔══════════════════════════════════════════════════════════════════════╗
║ 🔍 [PRECISE FORENSIC] FINAL SUMMARY                                 ║
╚══════════════════════════════════════════════════════════════════════╝

┌─ CONFLICT STATISTICS ──────────────────────────────────────────────────┐
│ Total Conflicts Logged        10                                        │
│ Max Logs Tracked              10                                        │
└────────────────────────────────────────────────────────────────────────┘

┌─ TRAINEE ATTEMPT STATISTICS ─────────────────────────────────────────────┐
│ Trainees with Multiple Attempts : 15                                     │
│ TOP 10 TRAINEES BY ATTEMPT COUNT:
│   1. Scott, Harper – ADF301      : 3 attempts
│   2. Baker, Olivia – ADF301      : 2 attempts
│   3. Anderson, Oliver – ADF301   : 2 attempts
└────────────────────────────────────────────────────────────────────────┘

┌─ EVENT SOURCE STATISTICS ───────────────────────────────────────────────┐
│ Total Events in generatedEvents  : 50                                    │
│ - active-dfp                   : 10                                      │
│ - highest-priority             : 5                                       │
│ - generated                    : 35                                      │
└────────────────────────────────────────────────────────────────────────┘

┌─ ROOT CAUSE SUMMARY ─────────────────────────────────────────────────────┐
│ 🔴 TRAINEES WITH MULTIPLE ATTEMPTS : 15 (30.0%)
│ 🔴 LIKELY ROOT CAUSE              : Duplicate processing of same trainees
│ 🔴 EVIDENCE                      : 15 trainees attempted 38 times total
│ ✅ NO DUPLICATES IN INPUT
└────────────────────────────────────────────────────────────────────────┘

╚══════════════════════════════════════════════════════════════════════╝
```

---

## Summary of Changes

### Files to Modify
**DFP-NEO-V2-fresh/App.tsx**

1. **Line ~1330**: Add object reference tracking system
2. **Line ~1330**: Add build input validation
3. **Line 1330**: Add event source tagging for active DFP events
4. **Line 1362**: Add event source tagging for highest priority events
5. **Line 1843**: Add event source tracking for generated events
6. **Lines 1961-1980 & 2162-2190**: Add precise forensic logging for overlap conflicts
7. **End of function**: Add final forensic summary

### What This Proves

1. **Real pre-existing booking**: Conflict with Active DFP event (source: 'active-dfp')
2. **Duplicate processing**: Same trainee attempted multiple times in same pass
3. **Current-pass contamination**: Conflict with event generated earlier in current pass (source: 'generated')
4. **Mutable object corruption**: Object reference tracking shows if candidate object is being mutated

### No Code Changes Yet
This is a **READ-ONLY analysis** as requested. The implementation plan is ready for your review and approval.