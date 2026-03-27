# Enhanced Personnel Conflict Diagnostic Analysis

## Current Implementation Status

### Existing Diagnostic Logging (Commit aa670719)
**Location**: `App.tsx` lines 1112-1139

**Function**: `_logOverlapRejection()`

**Current Parameters**:
- instructorName
- candidateFlightNumber
- candidateType
- candidateStart/End
- conflictingFlightNumber
- conflictingType
- conflictingStart/End

**Current Output Example**:
```
[OVERLAP-REJ #1] ✅ SAME-TYPE (correct block)
  Instructor  : IP_NAME
  Candidate   : BGF-01 (type=flight, 8.00-10.00h)
  Conflicts w : BGF-02 (type=flight, 9.00-11.00h)
```

**Limitations**:
1. Only shows basic event identifiers and times
2. Does NOT show full event details (student, pilot, personnel array)
3. Does NOT identify conflicting event source (Active DFP vs Highest Priority vs Generated)
4. Does NOT show exact overlap reason (which personnel matched?)
5. Does NOT track trainee processing history
6. Does NOT show if same trainee was processed earlier

---

## Data Available for Enhanced Logging

### From ScheduleEvent Interface
```typescript
{
  id: string;                          // ✅ Unique identifier
  flightNumber: string;                // ✅ Already logged
  type: 'flight' | 'ftd' | 'ground' | 'cpt' | 'deployment';  // ✅ Already logged
  startTime: number;                   // ✅ Already logged
  duration: number;                    // ✅ Can calculate end time
  instructor?: string;                 // ✅ Available
  student?: string;                    // ✅ Available
  pilot?: string;                      // ✅ Available
  crew?: string;                       // ✅ Available (for SCT events)
  attendees?: string[];                // ✅ Available (for ground events)
  resourceId: string;                  // ✅ Available
}
```

### From getPersonnel() Function
```typescript
// Returns array of all personnel involved in event
const personnel = getPersonnel(event);
// For SCT events: pilot + crew
// For training: instructor + student (or pilot for solo)
// For ground: instructor + attendees
```

### Event Source Tracking
**Current Implementation**:
```typescript
// Line 1330: Initialize with Active DFP events
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = [...activeDfpEventsWithoutDate];

// Lines 1374: Add Highest Priority Events
highestPriorityEvents.forEach(event => {
    if(event.date === buildDate && event.isTimeFixed) {
        const { date, ...eventWithoutDate } = event;
        generatedEvents.push(eventWithoutDate);
    }
});

// Throughout build: Add newly generated events
```

**Problem**: Events in `generatedEvents` array lose their source information after initialization.

**Solution**: Add `_source` field tag to each event when pushed to `generatedEvents`:
- `'active-dfp'` for events from publishedSchedules[buildDate]
- `'highest-priority'` for force-scheduled events
- `'generated'` for events created in current build pass

### Trainee Processing History
**Current Context**: The build algorithm processes trainees in loops

**Available Tracking**:
- `traineeNextEventMap.get(trainee.fullName)` - next scheduled event for trainee
- `traineeNextEventMap.get(trainee.fullName).next` - next event details
- `traineeNextEventMap.get(trainee.fullName).previous` - previous event details

**Solution**: Track which trainees have been processed and which events generated for them.

---

## Enhanced Diagnostic Requirements

### User Request (Latest Message)
> "Do not change code yet. The console only shows the candidate event that was rejected for personnel conflict. I now need the exact conflicting event that caused the rejection. For the first 20 personnel conflict rejections, log all of the following..."

### Required Information

#### 1. **Full Candidate Event Details**
- id
- name (flightNumber)
- type
- start/end times
- instructor
- student
- pilot
- personnel array (from getPersonnel())

#### 2. **Full Conflicting Event Details**
- id
- name (flightNumber)
- type
- start/end times
- instructor
- student
- pilot
- personnel array (from getPersonnel())
- **Source**: (active DFP, highest priority, generated, or other)

#### 3. **Exact Overlap Reason**
- Which personnel name(s) match between candidate and conflicting event?
- Time overlap details (exact overlap window in hours)

#### 4. **Trainee Processing History**
- Whether candidate trainee was processed earlier in same pass
- Whether another candidate for same trainee was generated earlier

---

## Implementation Strategy

### Phase 1: Add Event Source Tagging
**Location**: Lines 1330, 1374, and all `generatedEvents.push()` locations

**Change**: Add `_source` property to events when pushing to `generatedEvents`:
```typescript
// Line 1330
const activeDfpEventsWithoutDate = activeDfpEvents.map(e => {
    const { date, ...eventWithoutDate } = e;
    return { ...eventWithoutDate, _source: 'active-dfp' };
});

// Line 1374
generatedEvents.push({ ...eventWithoutDate, _source: 'highest-priority' });

// All generatedEvents.push() calls for new events
generatedEvents.push({ 
    ...newEvent, 
    _source: 'generated' 
});
```

### Phase 2: Track Trainee Processing History
**Location**: Near line 1330 (after `generatedEvents` initialization)

**Change**: Add tracking maps:
```typescript
const traineeProcessingHistory = new Map<string, { processed: boolean, generatedEvents: string[] }>();
const traineeName = trainee.fullName; // In trainee loops

// When processing trainee
if (!traineeProcessingHistory.has(traineeName)) {
    traineeProcessingHistory.set(traineeName, { processed: false, generatedEvents: [] });
}

// When generating event for trainee
traineeProcessingHistory.get(traineeName)!.generatedEvents.push(syllabusItem.id);

// After completing trainee
traineeProcessingHistory.get(traineeName)!.processed = true;
```

### Phase 3: Enhance _logOverlapRejection Function
**Location**: Lines 1112-1139

**Change**: Expand parameters and logging:
```typescript
const _MAX_OVERLAP_LOG = 20; // Increased from 10 to 20

const _logOverlapRejection = (
    // Candidate event details
    candidateEvent: Omit<ScheduleEvent, 'date'>,
    candidatePersonnel: string[],
    candidateBookingWindow: { start: number, end: number },
    
    // Conflicting event details
    conflictingEvent: Omit<ScheduleEvent, 'date'>,
    conflictingPersonnel: string[],
    conflictingBookingWindow: { start: number, end: number },
    conflictingSource: string,
    
    // Trainee processing history
    traineeName: string,
    traineeAlreadyProcessed: boolean,
    traineeEarlierEvents: string[]
) => {
    if (_overlapRejCount >= _MAX_OVERLAP_LOG) return;
    _overlapRejCount++;
    
    // Find matching personnel
    const matchingPersonnel = candidatePersonnel.filter(p => conflictingPersonnel.includes(p));
    
    // Calculate exact overlap window
    const overlapStart = Math.max(candidateBookingWindow.start, conflictingBookingWindow.start);
    const overlapEnd = Math.min(candidateBookingWindow.end, conflictingBookingWindow.end);
    const overlapDuration = overlapEnd - overlapStart;
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
    console.log(`🔴 [OVERLAP-REJ #${_overlapRejCount}] PERSONNEL CONFLICT DETECTED`);
    console.log(`═══════════════════════════════════════════════════════════════════════════`);
    console.log(`\n📋 CANDIDATE EVENT (REJECTED):`);
    console.log(`   ID          : ${candidateEvent.id}`);
    console.log(`   Flight      : ${candidateEvent.flightNumber}`);
    console.log(`   Type        : ${candidateEvent.type}`);
    console.log(`   Time        : ${candidateBookingWindow.start.toFixed(2)}h - ${candidateBookingWindow.end.toFixed(2)}h`);
    console.log(`   Duration    : ${(candidateBookingWindow.end - candidateBookingWindow.start).toFixed(2)}h`);
    console.log(`   Instructor  : ${candidateEvent.instructor || 'N/A'}`);
    console.log(`   Student     : ${candidateEvent.student || 'N/A'}`);
    console.log(`   Pilot       : ${candidateEvent.pilot || 'N/A'}`);
    console.log(`   Personnel   : [${candidatePersonnel.join(', ')}]`);
    
    console.log(`\n📋 CONFLICTING EVENT (BLOCKING):`);
    console.log(`   ID          : ${conflictingEvent.id}`);
    console.log(`   Flight      : ${conflictingEvent.flightNumber}`);
    console.log(`   Type        : ${conflictingEvent.type}`);
    console.log(`   Source      : ${conflictingSource}`);
    console.log(`   Time        : ${conflictingBookingWindow.start.toFixed(2)}h - ${conflictingBookingWindow.end.toFixed(2)}h`);
    console.log(`   Duration    : ${(conflictingBookingWindow.end - conflictingBookingWindow.start).toFixed(2)}h`);
    console.log(`   Instructor  : ${conflictingEvent.instructor || 'N/A'}`);
    console.log(`   Student     : ${conflictingEvent.student || 'N/A'}`);
    console.log(`   Pilot       : ${conflictingEvent.pilot || 'N/A'}`);
    console.log(`   Personnel   : [${conflictingPersonnel.join(', ')}]`);
    
    console.log(`\n⚡ OVERLAP DETAILS:`);
    console.log(`   Matched Personnel : ${matchingPersonnel.join(', ')}`);
    console.log(`   Overlap Window    : ${overlapStart.toFixed(2)}h - ${overlapEnd.toFixed(2)}h (${overlapDuration.toFixed(2)}h)`);
    console.log(`   Is Cross-Type     : ${(candidateEvent.type === 'ground') !== (conflictingEvent.type === 'ground') ? '⚠️ YES (should not block)' : '✅ NO (correct block)'}`);
    
    console.log(`\n👤 TRAINEE PROCESSING HISTORY:`);
    console.log(`   Trainee           : ${traineeName}`);
    console.log(`   Already Processed : ${traineeAlreadyProcessed ? '✅ YES' : '❌ NO'}`);
    console.log(`   Earlier Events    : ${traineeEarlierEvents.length > 0 ? traineeEarlierEvents.join(', ') : 'None'}`);
    console.log(`═══════════════════════════════════════════════════════════════════════════\n`);
};
```

### Phase 4: Update _logOverlapRejection Call Sites
**Location**: Lines 1975 (BNF night pass) and 2180 (main candidate loop)

**Change**: Pass full event objects instead of individual fields:
```typescript
// Line 1961-1980 (BNF night pass)
const hasOverlap = generatedEvents
     .filter(e => !e.resourceId.startsWith('STBY') && !e.resourceId.startsWith('BNF-STBY'))
     .some(e => {
         if (!getPersonnel(e).includes(instructor.name)) return false;
         
         const existingIsGround = e.type === 'ground';
         const proposedIsGround = syllabusItemForCheck.type?.toLowerCase() === 'ground';
         if (existingIsGround !== proposedIsGround) return false;
         
         const existingBookingWindow = getEventBookingWindowForAlgo(e, syllabusDetails);
         const overlaps = proposedBookingWindow.start < existingBookingWindow.end && 
                          proposedBookingWindow.end > existingBookingWindow.start;
         
         if (overlaps) {
             // Build candidate event object
             const candidateEvent: Omit<ScheduleEvent, 'date'> = {
                 id: syllabusItemForCheck.id,
                 flightNumber: syllabusItemForCheck.id,
                 type: (syllabusItemForCheck.type?.toLowerCase() === 'ground') ? 'ground' : 
                       (type === 'ftd' ? 'ftd' : 'flight'),
                 startTime: proposedBookingWindow.start,
                 duration: proposedBookingWindow.end - proposedBookingWindow.start,
                 instructor: instructor.name,
                 student: traineeForCheck?.fullName,
                 pilot: traineeForCheck?.fullName,
                 resourceId: '',
                 color: '',
                 flightType: 'Dual',
                 locationType: 'Local',
                 origin: '',
                 destination: '',
                 _source: 'candidate'
             };
             
             _logOverlapRejection(
                 candidateEvent,
                 getPersonnel(candidateEvent),
                 proposedBookingWindow,
                 e,
                 getPersonnel(e),
                 existingBookingWindow,
                 (e as any)._source || 'unknown',
                 traineeForCheck?.fullName || 'N/A',
                 traineeProcessingHistory.get(traineeForCheck?.fullName || '')?.processed || false,
                 traineeProcessingHistory.get(traineeForCheck?.fullName || '')?.generatedEvents || []
             );
         }
         
         return overlaps;
     });

// Line 2162-2190 (main candidate loop) - Similar changes
```

---

## Summary of Changes Needed

### Files to Modify
1. **DFP-NEO-V2-fresh/App.tsx**
   - Lines ~1112-1139: Enhance `_logOverlapRejection()` function
   - Line ~1330: Add `_source` tagging for active DFP events
   - Line ~1374: Add `_source` tagging for highest priority events
   - All `generatedEvents.push()` calls: Add `_source: 'generated'` tagging
   - Line ~1330: Add `traineeProcessingHistory` tracking map
   - Lines 1961-1980: Update overlap check logging (BNF night pass)
   - Lines 2162-2190: Update overlap check logging (main candidate loop)

### Key Benefits
1. **Full visibility**: See complete details of both candidate and conflicting events
2. **Source tracking**: Identify whether conflicting event comes from Active DFP, Highest Priority, or newly generated
3. **Exact overlap reason**: Know which personnel names are causing the conflict
4. **Trainee history**: Understand if same trainee was processed earlier or already has events
5. **Better debugging**: 20 rejections logged (up from 10) with comprehensive detail

### No Code Changes Yet
This analysis is READ-ONLY as requested by user. User will review and approve before implementation.