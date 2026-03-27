# Forensic Duplication Analysis - Read-Only Diagnostic Plan

## Objective
Identify whether duplicate trainees are being processed multiple times in a single build pass, and whether generatedEvents contains tentative events causing false conflicts.

---

## Analysis Points

### 1. Build Input Validation (Before Scheduling Begins)

**Location**: Near line 1330-1400 where `generateDfpInternal()` starts

**What to Log**:
```typescript
// BEFORE any scheduling begins
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
    console.log('\n⚠️ DUPLICATE TRAINEE IDs FOUND:');
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

// Analyze trainees in activeTrainees / nextEventsList
// (Find where these are populated and analyze)
```

---

### 2. Trainee Processing Tracking (During Build Pass)

**Location**: Near line 1330, add tracking structures

**What to Track**:
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
```

---

### 3. Event Source Tagging (For Conflict Detection)

**Location**: Line 1330 (generatedEvents initialization)

**Current State**:
```typescript
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [...activeDfpEventsWithoutDate];
```

**What events are in generatedEvents at this point**:
- Events from `activeDfpEventsWithoutDate` (Active DFP - published schedules)
- No events added yet

**Need to add source tracking** (READ-ONLY - just analyze where to add):
```typescript
// For each event, track its source:
// - 'active-dfp': from publishedSchedules[buildDate]
// - 'highest-priority': force-scheduled events
// - 'generated': newly created in current pass
```

---

### 4. Overlap Conflict Forensic Logging

**Location**: Lines 1961-1980 (BNF night pass) and 2162-2190 (main candidate loop)

**What to Log** (READ-ONLY - just design the logging):

```typescript
// Inside hasOverlap check where overlap is detected
if (overlaps) {
    const traineeInfo = traineeProcessingLog.get(traineeForCheck?.fullName || '');
    const priorAttempts = traineeInfo?.attemptedEvents || [];
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`🔴 [FORENSIC #${_forensicCount}] OVERLAP CONFLICT DETECTED`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // 1. Candidate event details
    console.log('\n📋 CANDIDATE EVENT (REJECTED):');
    console.log(`   Event ID     : ${syllabusItemForCheck.id}`);
    console.log(`   Trainee ID   : ${traineeForCheck?.idNumber || traineeForCheck?.id || 'N/A'}`);
    console.log(`   Trainee Name : ${traineeForCheck?.fullName || 'N/A'}`);
    console.log(`   Next Event   : ${traineeNextEventMap.get(traineeForCheck?.fullName || '')?.next?.id || 'N/A'}`);
    console.log(`   Instructor   : ${instructor.name}`);
    console.log(`   Start Time   : ${proposedBookingWindow.start.toFixed(2)}h`);
    console.log(`   End Time     : ${proposedBookingWindow.end.toFixed(2)}h`);
    
    // 2. Conflicting event details
    console.log('\n📋 CONFLICTING EVENT (BLOCKING):');
    console.log(`   Event ID     : ${e.id}`);
    console.log(`   Trainee ID   : ${e.student || e.pilot || 'N/A'}`); // Need to extract from student/pilot
    console.log(`   Trainee Name : ${e.student || e.pilot || 'N/A'}`);
    console.log(`   Event Name   : ${e.flightNumber}`);
    console.log(`   Instructor   : ${e.instructor || 'N/A'}`);
    console.log(`   Start Time   : ${e.startTime.toFixed(2)}h`);
    console.log(`   End Time     : ${(e.startTime + e.duration).toFixed(2)}h`);
    console.log(`   Source       : ${(e as any)._source || 'unknown'}`); // Need to add _source field
    
    // 3. Build-pass duplication checks
    console.log('\n🔄 BUILD-PASS DUPLICATION CHECKS:');
    const alreadyProcessed = traineeInfo?.processed || false;
    console.log(`   Trainee already processed earlier in this pass: ${alreadyProcessed ? '✅ YES' : '❌ NO'}`);
    
    if (priorAttempts.length > 0) {
        console.log(`   Prior candidate events attempted for this trainee:`);
        priorAttempts.forEach((attempt, idx) => {
            console.log(`      ${idx + 1}. ${attempt.eventName} (${attempt.startTime.toFixed(2)}-${attempt.endTime.toFixed(2)}h) - ${attempt.result}`);
            if (attempt.rejectionReason) {
                console.log(`         Reason: ${attempt.rejectionReason}`);
            }
        });
    } else {
        console.log(`   No prior attempts for this trainee in this pass`);
    }
    
    const eventAlreadyAttempted = priorAttempts.some(a => a.eventId === syllabusItemForCheck.id);
    console.log(`   This exact event name already attempted: ${eventAlreadyAttempted ? '✅ YES' : '❌ NO'}`);
    
    const idAlreadyChecked = candidateIdsChecked.has(syllabusItemForCheck.id);
    console.log(`   This exact candidate ID already checked: ${idAlreadyChecked ? '✅ YES' : '❌ NO'}`);
    
    // 4. Mutation timing check
    console.log('\n⏱️ MUTATION TIMING:');
    console.log(`   Is candidate added to generatedEvents before conflict checks complete: ❌ NO (still checking)`);
    
    const sameTraineeInGenerated = generatedEvents.some(ge => 
        ge.student === traineeForCheck?.fullName || ge.pilot === traineeForCheck?.fullName
    );
    console.log(`   generatedEvents contains event for same trainee created in this pass: ${sameTraineeInGenerated ? '✅ YES' : '❌ NO'}`);
    
    const sameInstructorInGenerated = generatedEvents.some(ge => 
        ge.instructor === instructor.name && eventsAddedInPass.has(ge.id)
    );
    console.log(`   generatedEvents contains event for same instructor created in this pass: ${sameInstructorInGenerated ? '✅ YES' : '❌ NO'}`);
    
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    _forensicCount++;
    
    if (_forensicCount >= 20) {
        console.log('🛑 [FORENSIC] Reached 20 conflict logs - stopping logging');
    }
}
```

---

### 5. Key Analysis Points

#### A. Check for Duplicate Trainees in Build Input
**Location**: Where `trainees` array is built for `generateDfpInternal()`
- Check if same trainee appears multiple times
- Check if trainee IDs are unique
- Check if trainee names are unique

#### B. Check if Same Trainee Attempted Multiple Times
**Location**: Main trainee loops in `generateDfpInternal()`
- Track each trainee processing
- Log all attempted events for each trainee
- Identify if same trainee is processed in multiple passes

#### C. Check if generatedEvents Contains Current-Pass Tentative Events
**Location**: Line 1330 (initialization) and throughout build
- Track when events are added to `generatedEvents`
- Identify if conflicts are with events added in CURRENT pass vs Active DFP

#### D. Check if Turnaround Conflicts Are Self-Inflicted
**Location**: Line 5616-5622 (UI conflict checker turnaround detection)
- Check if turnaround conflicts are with events created in same pass
- Check if turnaround conflicts are with Active DFP events

#### E. First Proven Root Cause
- Compile all forensic evidence
- Identify the primary cause of duplicate conflicts

---

## Implementation Locations

### File: DFP-NEO-V2-fresh/App.tsx

#### Section 1: Build Input Validation
**Line**: ~1330 (near `generateDfpInternal()` start)
**Action**: Add logging before any scheduling begins

#### Section 2: Trainee Processing Tracking
**Line**: ~1330 (before trainee loops)
**Action**: Initialize tracking maps

#### Section 3: Event Source Tagging
**Line**: ~1330 (generatedEvents initialization)
**Action**: Add `_source` field to events when pushing to `generatedEvents`

#### Section 4: Overlap Conflict Forensic Logging
**Line**: ~1961-1980 (BNF night pass overlap check)
**Line**: ~2162-2190 (main candidate loop overlap check)
**Action**: Add comprehensive logging when overlap detected

#### Section 5: Turnaround Conflict Logging
**Line**: ~5350-5390 (detectConflictsForEvent turnaround check)
**Action**: Add logging when turnaround conflict detected

---

## Expected Output Format

### Build Input Validation
```
═══════════════════════════════════════════════════════════════
🔍 [FORENSIC] BUILD INPUT VALIDATION
═══════════════════════════════════════════════════════════════
Total trainees in input list: 50
Unique trainee IDs: 50
Unique trainee names: 50
✅ No duplicate trainee IDs
✅ No duplicate trainee names
```

### Overlap Conflict Forensic Log
```
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
   Event ID     : 67890-abc123
   Trainee ID   : 12345
   Trainee Name : Scott, Harper – ADF301
   Event Name   : BGF-01
   Instructor   : Anderson, Benjamin
   Start Time   : 8.00h
   End Time     : 10.00h
   Source       : generated

🔄 BUILD-PASS DUPLICATION CHECKS:
   Trainee already processed earlier in this pass: ❌ NO
   Prior candidate events attempted for this trainee: None
   This exact event name already attempted: ❌ NO
   This exact candidate ID already checked: ❌ NO

⏱️ MUTATION TIMING:
   Is candidate added to generatedEvents before conflict checks complete: ❌ NO (still checking)
   generatedEvents contains event for same trainee created in this pass: ✅ YES
   generatedEvents contains event for same instructor created in this pass: ✅ YES

═══════════════════════════════════════════════════════════════
```

---

## Summary Report Structure

After running the build with forensic logging, deliver:

### A. Duplicate Trainees in Build Input
- Number of duplicate trainee IDs
- Number of duplicate trainee names
- List of duplicates if any

### B. Same Trainee Attempted Multiple Times
- Percentage of trainees processed multiple times
- Examples of trainees with multiple attempts
- Whether this is causing conflicts

### C. generatedEvents Contains Current-Pass Tentative Events
- Percentage of conflicts caused by current-pass events
- Examples of self-inflicted conflicts
- Whether this is the root cause

### D. Turnaround Conflicts Caused by Duplicates
- Number of turnaround conflicts
- Whether they're self-inflicted
- Whether they're from Active DFP

### E. First Proven Root Cause
- Primary cause of duplicate conflict detections
- Supporting evidence
- Recommended fix

---

**Status**: READ-ONLY ANALYSIS - No code changes yet
**Purpose**: Identify the exact cause of duplicate conflict detections before implementing fixes