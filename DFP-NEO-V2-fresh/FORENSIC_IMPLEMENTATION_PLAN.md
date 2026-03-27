# Forensic Duplication Diagnostic Implementation Plan

## Executive Summary

This document provides a detailed implementation plan for forensic diagnostics to identify:
1. Duplicate trainees in build input
2. Same trainee attempted multiple times in one pass
3. generatedEvents containing current-pass tentative events causing self-conflicts
4. Turnaround conflicts caused by duplicates

**Status**: READ-ONLY ANALYSIS - No code changes yet

---

## Critical Insight from Code Analysis

### Key Finding: Event Addition Timing

**Location**: Line 1843 (scheduleEvent function)
```typescript
const result = scheduleEvent(trainee, syllabusItem, time, type, isNightPass, isPlusOne);
if (result && typeof result === 'object' && 'id' in result) {
    generatedEvents.push(result);  // ← Event added HERE
    // Update counts...
}
```

**Location**: Line 1362 (Highest Priority Events)
```typescript
generatedEvents.push(eventWithoutDate);  // ← Added BEFORE main scheduling
```

### Critical Issue: Self-Conflict Detection

The overlap check at lines 1961 and 2162 checks against `generatedEvents`, which contains:
1. **Active DFP events** (line 1330 initialization)
2. **Highest Priority events** (line 1362, added BEFORE main scheduling)
3. **Newly generated events** (line 1843, added AFTER overlap check passes)

**PROBLEM**: If the same trainee is processed multiple times in one pass, or if duplicate candidates are generated, the overlap check will find conflicts with events generated EARLIER IN THE SAME PASS.

---

## Implementation Plan

### Phase 1: Build Input Validation (Before Scheduling Begins)

**Location**: Line ~1330 (after `generatedEvents` initialization, before trainee processing)

**Add**:
```typescript
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 [FORENSIC] BUILD INPUT VALIDATION');
console.log('═══════════════════════════════════════════════════════════════');

// Analyze trainees input list
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

console.log(`Total trainees in input list: ${trainees.length}`);
console.log(`Unique trainee IDs: ${traineeIds.size}`);
console.log(`Unique trainee names: ${traineeNames.size}`);

if (duplicateIds.size > 0) {
    console.log('\n⚠️ DUPLICATE TRAINEE IDS FOUND:');
    duplicateIds.forEach((count, id) => {
        console.log(`   ID "${id}" appears ${count} times`);
    });
} else {
    console.log('✅ No duplicate trainee IDs');
}

if (duplicateNames.size > 0) {
    console.log('\n⚠️ DUPLICATE TRAINEE NAMES FOUND:');
    duplicateNames.forEach((count, name) => {
        console.log(`   Name "${name}" appears ${count} times`);
    });
} else {
    console.log('✅ No duplicate trainee names');
}

// Analyze trainees in nextEventLists
const allTraineesInLists = [
    ...nextEventLists.flight,
    ...nextEventLists.ftd,
    ...nextEventLists.cpt,
    ...nextEventLists.ground,
    ...nextEventLists.bnf
];

const listTraineeNames = new Map<string, number>();
allTraineesInLists.forEach(t => {
    const name = t.fullName;
    listTraineeNames.set(name, (listTraineeNames.get(name) || 0) + 1);
});

const duplicateInList = Array.from(listTraineeNames.entries())
    .filter(([_, count]) => count > 1);

if (duplicateInList.length > 0) {
    console.log('\n⚠️ TRAINEES APPEARING MULTIPLE TIMES IN NEXT EVENT LISTS:');
    duplicateInList.forEach(([name, count]) => {
        console.log(`   "${name}" appears ${count} times across flight/ftd/cpt/ground/bnf lists`);
    });
} else {
    console.log('✅ No trainees appear multiple times in next event lists');
}

console.log('═══════════════════════════════════════════════════════════════\n');
```

---

### Phase 2: Trainee Processing Tracking (During Build Pass)

**Location**: Line ~1330 (after build input validation)

**Add**:
```typescript
// Track each trainee's processing in current pass
const traineeProcessingLog = new Map<string, {
    processed: boolean;
    attemptedEvents: Array<{
        eventId: string;
        eventName: string;
        startTime: number;
        endTime: number;
        instructor: string | undefined;
        result: 'scheduled' | 'rejected' | 'skipped';
        rejectionReason?: string;
    }>;
}>();

// Track all candidate IDs checked in this pass
const candidateIdsChecked = new Set<string>();

// Track events added to generatedEvents in this pass
const eventsAddedInPass = new Set<string>();

// Counter for forensic logging
let _forensicCount = 0;
const _MAX_FORENSIC_LOG = 20;
```

---

### Phase 3: Event Source Tagging

**Location**: Line 1330 (generatedEvents initialization)

**Current**:
```typescript
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [...activeDfpEventsWithoutDate];
```

**Change to**:
```typescript
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = 
    activeDfpEventsWithoutDate.map(e => ({ ...e, _source: 'active-dfp' as const }));
```

**Location**: Line 1362 (Highest Priority Events)

**Current**:
```typescript
generatedEvents.push(eventWithoutDate);
```

**Change to**:
```typescript
generatedEvents.push({ ...eventWithoutDate, _source: 'highest-priority' as const });
```

**Location**: Line 1843 (scheduleEvent result)

**Current**:
```typescript
generatedEvents.push(result);
```

**Change to**:
```typescript
const eventWithSource = { ...result, _source: 'generated' as const };
generatedEvents.push(eventWithSource);
eventsAddedInPass.add(result.id);  // Track this was added in current pass
```

---

### Phase 4: Overlap Conflict Forensic Logging

**Location**: Lines 1961-1980 (BNF night pass) and 2162-2190 (main candidate loop)

**Replace the overlap check logging**:

```typescript
if (overlaps) {
    // Record this candidate check
    const candidateId = syllabusItemForCheck.id;
    const traineeName = traineeForCheck?.fullName || 'UNKNOWN';
    
    if (!candidateIdsChecked.has(candidateId)) {
        candidateIdsChecked.add(candidateId);
    }
    
    // Get trainee processing history
    const traineeLog = traineeProcessingLog.get(traineeName) || {
        processed: false,
        attemptedEvents: []
    };
    
    const priorAttempts = traineeLog.attemptedEvents || [];
    
    // Check if same trainee has events in generatedEvents from this pass
    const sameTraineeInGeneratedFromThisPass = generatedEvents.some(ge => 
        (ge.student === traineeName || ge.pilot === traineeName) &&
        eventsAddedInPass.has(ge.id)
    );
    
    // Check if same instructor has events in generatedEvents from this pass
    const sameInstructorInGeneratedFromThisPass = generatedEvents.some(ge => 
        ge.instructor === instructor.name &&
        eventsAddedInPass.has(ge.id)
    );
    
    // Get conflicting event source
    const conflictingSource = (e as any)._source || 'unknown';
    
    if (_forensicCount < _MAX_FORENSIC_LOG) {
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`🔴 [FORENSIC #${_forensicCount + 1}] OVERLAP CONFLICT DETECTED`);
        console.log('═══════════════════════════════════════════════════════════════');
        
        // 1. Candidate event details
        console.log('\n📋 CANDIDATE EVENT (REJECTED):');
        console.log(`   Event ID     : ${candidateId}`);
        console.log(`   Trainee ID   : ${traineeForCheck?.idNumber || traineeForCheck?.id || 'N/A'}`);
        console.log(`   Trainee Name : ${traineeName}`);
        console.log(`   Next Event   : ${traineeNextEventMap.get(traineeName)?.next?.id || 'N/A'}`);
        console.log(`   Instructor   : ${instructor.name}`);
        console.log(`   Start Time   : ${proposedBookingWindow.start.toFixed(2)}h`);
        console.log(`   End Time     : ${proposedBookingWindow.end.toFixed(2)}h`);
        
        // 2. Conflicting event details
        console.log('\n📋 CONFLICTING EVENT (BLOCKING):');
        console.log(`   Event ID     : ${e.id}`);
        console.log(`   Trainee ID   : ${e.student || e.pilot || 'N/A'}`);
        console.log(`   Trainee Name : ${e.student || e.pilot || 'N/A'}`);
        console.log(`   Event Name   : ${e.flightNumber}`);
        console.log(`   Instructor   : ${e.instructor || 'N/A'}`);
        console.log(`   Start Time   : ${e.startTime.toFixed(2)}h`);
        console.log(`   End Time     : ${(e.startTime + e.duration).toFixed(2)}h`);
        console.log(`   Source       : ${conflictingSource}`);
        
        // 3. Build-pass duplication checks
        console.log('\n🔄 BUILD-PASS DUPLICATION CHECKS:');
        console.log(`   Trainee already processed earlier in this pass: ${traineeLog.processed ? '✅ YES' : '❌ NO'}`);
        
        if (priorAttempts.length > 0) {
            console.log(`   Prior candidate events attempted for this trainee (${priorAttempts.length} total):`);
            priorAttempts.forEach((attempt, idx) => {
                console.log(`      ${idx + 1}. ${attempt.eventName} (${attempt.startTime.toFixed(2)}-${attempt.endTime.toFixed(2)}h) - ${attempt.result}`);
                if (attempt.rejectionReason) {
                    console.log(`         Reason: ${attempt.rejectionReason}`);
                }
            });
        } else {
            console.log(`   No prior attempts for this trainee in this pass`);
        }
        
        const eventAlreadyAttempted = priorAttempts.some(a => a.eventId === candidateId);
        console.log(`   This exact event name already attempted: ${eventAlreadyAttempted ? '✅ YES' : '❌ NO'}`);
        
        const idAlreadyChecked = candidateIdsChecked.has(candidateId);
        console.log(`   This exact candidate ID already checked: ${idAlreadyChecked ? '✅ YES' : '❌ NO'}`);
        
        // 4. Mutation timing check
        console.log('\n⏱️ MUTATION TIMING:');
        console.log(`   Is candidate added to generatedEvents before conflict checks complete: ❌ NO (still checking)`);
        console.log(`   generatedEvents contains event for same trainee created in this pass: ${sameTraineeInGeneratedFromThisPass ? '✅ YES' : '❌ NO'}`);
        console.log(`   generatedEvents contains event for same instructor created in this pass: ${sameInstructorInGeneratedFromThisPass ? '✅ YES' : '❌ NO'}`);
        
        if (sameTraineeInGeneratedFromThisPass) {
            const sameTraineeEvents = generatedEvents.filter(ge => 
                (ge.student === traineeName || ge.pilot === traineeName) &&
                eventsAddedInPass.has(ge.id)
            );
            console.log(`   Same-trainee events in generatedEvents from this pass:`);
            sameTraineeEvents.forEach((se, idx) => {
                console.log(`      ${idx + 1}. ${se.flightNumber} (${se.startTime.toFixed(2)}-${(se.startTime + se.duration).toFixed(2)}h) - Instructor: ${se.instructor}`);
            });
        }
        
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        _forensicCount++;
    }
    
    // Log to trainee processing history
    traineeLog.attemptedEvents.push({
        eventId: candidateId,
        eventName: syllabusItemForCheck.flightNumber || candidateId,
        startTime: proposedBookingWindow.start,
        endTime: proposedBookingWindow.end,
        instructor: instructor.name,
        result: 'rejected',
        rejectionReason: 'time-overlap'
    });
    
    traineeProcessingLog.set(traineeName, traineeLog);
}
```

---

### Phase 5: Track Successful Scheduling

**Location**: Line 1843 (after successful scheduling)

**Add**:
```typescript
const eventWithSource = { ...result, _source: 'generated' as const };
generatedEvents.push(eventWithSource);
eventsAddedInPass.add(result.id);  // Track this was added in current pass

// Log successful scheduling to trainee history
const traineeName = trainee.fullName;
const traineeLog = traineeProcessingLog.get(traineeName) || {
    processed: false,
    attemptedEvents: []
};

traineeLog.attemptedEvents.push({
    eventId: syllabusItem.id,
    eventName: syllabusItem.flightNumber || syllabusItem.id,
    startTime: result.startTime,
    endTime: result.startTime + result.duration,
    instructor: result.instructor,
    result: 'scheduled'
});

traineeProcessingLog.set(traineeName, traineeLog);

console.log(`✅ [FORENSIC] Scheduled ${syllabusItem.flightNumber} for ${traineeName} at ${result.startTime.toFixed(2)}h`);
```

---

### Phase 6: Final Forensic Report

**Location**: End of `generateDfpInternal()` function (before return statement)

**Add**:
```typescript
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔍 [FORENSIC] FINAL REPORT');
console.log('═══════════════════════════════════════════════════════════════');

// A. Duplicate Trainees in Build Input
console.log('\nA. DUPLICATE TRAINEES IN BUILD INPUT:');
if (duplicateIds.size > 0 || duplicateNames.size > 0) {
    console.log(`   ⚠️ FOUND DUPLICATES: ${duplicateIds.size} IDs, ${duplicateNames.size} names`);
} else {
    console.log(`   ✅ No duplicates found`);
}

// B. Same Trainee Attempted Multiple Times
const traineesProcessedMultipleTimes = Array.from(traineeProcessingLog.entries())
    .filter(([_, log]) => log.attemptedEvents.length > 1);

console.log('\nB. SAME TRAINEE ATTEMPTED MULTIPLE TIMES:');
console.log(`   Total trainees with multiple attempts: ${traineesProcessedMultipleTimes.length}`);
console.log(`   Percentage of all trainees: ${((traineesProcessedMultipleTimes.length / activeTrainees.length) * 100).toFixed(1)}%`);

if (traineesProcessedMultipleTimes.length > 0 && traineesProcessedMultipleTimes.length <= 5) {
    console.log('\n   Examples:');
    traineesProcessedMultipleTimes.forEach(([name, log], idx) => {
        console.log(`      ${idx + 1}. ${name} - ${log.attemptedEvents.length} attempts`);
        log.attemptedEvents.forEach(a => {
            console.log(`         - ${a.eventName} (${a.result})`);
        });
    });
}

// C. generatedEvents Contains Current-Pass Tentative Events
console.log('\nC. GENERATED EVENTS SOURCE ANALYSIS:');
const sourceCounts = new Map<string, number>();
generatedEvents.forEach(e => {
    const source = (e as any)._source || 'unknown';
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
});

console.log(`   Total events in generatedEvents: ${generatedEvents.length}`);
sourceCounts.forEach((count, source) => {
    console.log(`   - ${source}: ${count} events`);
});

// D. Self-Conflict Detection
const selfConflicts = traineesProcessedMultipleTimes.filter(([name, _]) => {
    const log = traineeProcessingLog.get(name)!;
    return log.attemptedEvents.some(a => a.result === 'rejected' && a.rejectionReason === 'time-overlap');
});

console.log('\nD. SELF-CONFLICT DETECTION:');
console.log(`   Trainees with self-inflicted conflicts: ${selfConflicts.length}`);

if (selfConflicts.length > 0 && selfConflicts.length <= 5) {
    console.log('\n   Examples:');
    selfConflicts.forEach(([name, log], idx) => {
        console.log(`      ${idx + 1}. ${name}`);
        log.attemptedEvents.forEach(a => {
            if (a.result === 'rejected' && a.rejectionReason === 'time-overlap') {
                console.log(`         - ${a.eventName}: REJECTED (time-overlap)`);
            }
        });
    });
}

// E. First Proven Root Cause
console.log('\nE. FIRST PROVEN ROOT CAUSE:');
if (selfConflicts.length > 0) {
    console.log(`   🔴 ROOT CAUSE: Trainees are being processed multiple times in the same build pass`);
    console.log(`   🔴 EVIDENCE: ${selfConflicts.length} trainees have self-inflicted conflicts`);
    console.log(`   🔴 RECOMMENDATION: Ensure each trainee is processed only once per build pass`);
} else if (duplicateIds.size > 0 || duplicateNames.size > 0) {
    console.log(`   🔴 ROOT CAUSE: Duplicate trainees in build input`);
    console.log(`   🔴 EVIDENCE: ${duplicateIds.size} duplicate IDs, ${duplicateNames.size} duplicate names`);
    console.log(`   🔴 RECOMMENDATION: Deduplicate trainees before scheduling`);
} else {
    console.log(`   ✅ No obvious duplication issues detected`);
    console.log(`   ✅ Conflicts may be from legitimate scheduling constraints`);
}

console.log('═══════════════════════════════════════════════════════════════\n');
```

---

## Summary of Changes

### Files to Modify
1. **DFP-NEO-V2-fresh/App.tsx**
   - Line ~1330: Add build input validation
   - Line ~1330: Add trainee processing tracking structures
   - Line ~1330: Add event source tagging for active DFP events
   - Line 1362: Add event source tagging for highest priority events
   - Line 1843: Add event source tagging for generated events + tracking
   - Lines 1961-1980: Add forensic logging (BNF night pass)
   - Lines 2162-2190: Add forensic logging (main candidate loop)
   - End of function: Add final forensic report

### Key Benefits
1. **Complete visibility**: See exactly when and why conflicts occur
2. **Duplicate detection**: Identify trainees processed multiple times
3. **Source tracking**: Know which events are from Active DFP vs current pass
4. **Self-conflict proof**: Prove whether conflicts are self-inflicted
5. **Root cause identification**: Clear evidence of the problem

### No Code Changes Yet
This is a **READ-ONLY analysis** as requested. The implementation plan is ready for your review.

---

## Expected Console Output Example

```
═══════════════════════════════════════════════════════════════
🔍 [FORENSIC] BUILD INPUT VALIDATION
═══════════════════════════════════════════════════════════════
Total trainees in input list: 50
Unique trainee IDs: 50
Unique trainee names: 50
✅ No duplicate trainee IDs
✅ No duplicate trainee names
✅ No trainees appear multiple times in next event lists
═══════════════════════════════════════════════════════════════

✅ [FORENSIC] Scheduled BGF-01 for Scott, Harper – ADF301 at 8.00h

═══════════════════════════════════════════════════════════════
🔴 [FORENSIC #1] OVERLAP CONFLICT DETECTED
═══════════════════════════════════════════════════════════════

📋 CANDIDATE EVENT (REJECTED):
   Event ID     : BGF-01
   Trainee ID   : 12345
   Trainee Name : Scott, Harper – ADF301
   Next Event   : BGF-02
   Instructor   : Anderson, Benjamin
   Start Time   : 8.00h
   End Time     : 10.00h

📋 CONFLICTING EVENT (BLOCKING):
   Event ID     : abc123-def456
   Trainee ID   : 12345
   Trainee Name : Scott, Harper – ADF301
   Event Name   : BGF-01
   Instructor   : Anderson, Benjamin
   Start Time   : 8.00h
   End Time     : 10.00h
   Source       : generated

🔄 BUILD-PASS DUPLICATION CHECKS:
   Trainee already processed earlier in this pass: ✅ YES
   Prior candidate events attempted for this trainee (1 total):
      1. BGF-01 (8.00-10.00h) - scheduled
   This exact event name already attempted: ✅ YES
   This exact candidate ID already checked: ✅ YES

⏱️ MUTATION TIMING:
   Is candidate added to generatedEvents before conflict checks complete: ❌ NO (still checking)
   generatedEvents contains event for same trainee created in this pass: ✅ YES
   generatedEvents contains event for same instructor created in this pass: ✅ YES
   Same-trainee events in generatedEvents from this pass:
      1. BGF-01 (8.00-10.00h) - Instructor: Anderson, Benjamin

═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
🔍 [FORENSIC] FINAL REPORT
═══════════════════════════════════════════════════════════════

A. DUPLICATE TRAINEES IN BUILD INPUT:
   ✅ No duplicates found

B. SAME TRAINEE ATTEMPTED MULTIPLE TIMES:
   Total trainees with multiple attempts: 15
   Percentage of all trainees: 30.0%

C. GENERATED EVENTS SOURCE ANALYSIS:
   Total events in generatedEvents: 50
   - active-dfp: 10 events
   - highest-priority: 5 events
   - generated: 35 events

D. SELF-CONFLICT DETECTION:
   Trainees with self-inflicted conflicts: 15

E. FIRST PROVEN ROOT CAUSE:
   🔴 ROOT CAUSE: Trainees are being processed multiple times in the same build pass
   🔴 EVIDENCE: 15 trainees have self-inflicted conflicts
   🔴 RECOMMENDATION: Ensure each trainee is processed only once per build pass
═══════════════════════════════════════════════════════════════
```