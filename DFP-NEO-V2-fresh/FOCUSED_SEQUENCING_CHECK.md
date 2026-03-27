# Focused Diagnostic: Same-Trainee NEXT → NEXT+1 Validation

## Objective

Prove whether valid NEXT → NEXT+1 sequential events are being incorrectly rejected.

**Focus**: SAME-TRAINEE conflicts ONLY.
**Question**: "Are valid NEXT+1 events being rejected even when there is no real overlap and sufficient turnaround?"

## Minimal Logging Requirements

For the first 10 SAME-TRAINEE conflict rejections, log ONLY:

### 1. Candidate (rejected event)
- trainee name
- event name
- isNext or isNext+1
- start time
- end time

### 2. Conflicting event
- trainee name
- event name
- isNext or isNext+1
- start time
- end time
- source (active-dfp or generated)

### 3. Sequencing check
- same trainee: YES/NO
- is NEXT vs NEXT+1 pairing: YES/NO
- actual clock overlap: YES/NO
- time gap between events (minutes)
- required turnaround (minutes)

### 4. Final verdict (must be explicit)
- SHOULD BE ALLOWED: YES/NO
- If NO → why? (true overlap / insufficient turnaround)
- If YES → mark as BUG

## Implementation

### Step 1: Event Source Tagging (Minimal)

Add minimal source tags to distinguish events:

```typescript
// Line 1292: Active DFP events
let generatedEvents: Omit<ScheduleEvent, 'date'>[] = activeDfpEventsWithoutDate.map(event => ({
    ...event,
    _source: 'active-dfp'
}));

// Line 1362: Highest Priority events
generatedEvents.push({
    ...eventWithoutDate,
    _source: 'highest-priority'
});

// Line 1843: Generated events
generatedEvents.push({
    ...result,
    _source: 'generated',
    _isNext: !isPlusOne  // true for Next, false for Next+1
});
```

### Step 2: Focused Logging Function

```typescript
const _MAX_SAME_TRAINEE_LOGS = 10;
let _sameTraineeLogCount = 0;

const _logSameTraineeConflict = (
    candidate: {
        traineeName: string,
        eventName: string,
        isNext: boolean,
        startTime: number,
        endTime: number
    },
    conflicting: {
        traineeName: string,
        eventName: string,
        isNext: boolean,
        startTime: number,
        endTime: number,
        source: string
    },
    requiredTurnaround: number
) => {
    // Only log same-trainee conflicts
    if (candidate.traineeName !== conflicting.traineeName) return;
    if (_sameTraineeLogCount >= _MAX_SAME_TRAINEE_LOGS) return;
    _sameTraineeLogCount++;

    const sameTrainee = candidate.traineeName === conflicting.traineeName;
    const isNextVsNextPlusOne = candidate.isNext !== conflicting.isNext;
    
    // Check actual clock overlap (including buffers)
    const candidateEnd = candidate.endTime;
    const conflictingStart = conflicting.startTime;
    const timeGap = (conflictingStart - candidateEnd) * 60; // Convert to minutes
    
    const hasClockOverlap = timeGap < 0;
    
    // Determine if this should be allowed
    const shouldAllow = isNextVsNextPlusOne && !hasClockOverlap && timeGap >= requiredTurnaround;
    
    const verdict = shouldAllow ? 
        "YES - BUG (valid NEXT+1 rejected)" : 
        hasClockOverlap ? 
            "NO - true overlap" : 
            timeGap < requiredTurnaround ?
                `NO - insufficient turnaround (need ${requiredTurnaround * 60}m, have ${Math.round(timeGap)}m)` :
                "NO - other reason";

    console.log(`
═══════════════════════════════════════════════════
🔴 SAME-TRAINEE CONFLICT #${_sameTraineeLogCount}
═══════════════════════════════════════════════════

1. CANDIDATE (rejected event)
   Trainee: ${candidate.traineeName}
   Event: ${candidate.eventName}
   Type: ${candidate.isNext ? 'NEXT' : 'NEXT+1'}
   Time: ${formatTime(candidate.startTime)} - ${formatTime(candidate.endTime)}

2. CONFLICTING EVENT
   Trainee: ${conflicting.traineeName}
   Event: ${conflicting.eventName}
   Type: ${conflicting.isNext ? 'NEXT' : 'NEXT+1'}
   Time: ${formatTime(conflicting.startTime)} - ${formatTime(conflicting.endTime)}
   Source: ${conflicting.source}

3. SEQUENCING CHECK
   Same trainee: ${sameTrainee ? 'YES' : 'NO'}
   Is NEXT vs NEXT+1 pairing: ${isNextVsNextPlusOne ? 'YES' : 'NO'}
   Actual clock overlap: ${hasClockOverlap ? 'YES' : 'NO'}
   Time gap: ${Math.round(timeGap)} minutes
   Required turnaround: ${requiredTurnaround * 60} minutes

4. FINAL VERDICT
   SHOULD BE ALLOWED: ${shouldAllow ? 'YES' : 'NO'}
   ${shouldAllow ? '🐛 BUG: Valid NEXT+1 event rejected!' : verdict}

═══════════════════════════════════════════════════
    `);
};

const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
```

### Step 3: Call Logging at Overlap Checks

**Location: Line 1975 (BNF Night Pass Overlap)**

```typescript
if (overlaps) {
    // Only log if same trainee
    const candidateTrainee = traineeForCheck.fullName;
    const conflictingTrainee = getPersonnel(e).find(p => p !== instructor.name) || e.student || e.pilot || '';
    
    if (candidateTrainee && conflictingTrainee && candidateTrainee === conflictingTrainee) {
        _logSameTraineeConflict(
            {
                traineeName: candidateTrainee,
                eventName: syllabusItemForCheck.id,
                isNext: false, // This is Plus One check
                startTime: proposedBookingWindow.start + (syllabusItemForCheck.preFlightTime || 0),
                endTime: proposedBookingWindow.end - (syllabusItemForCheck.postFlightTime || 0)
            },
            {
                traineeName: conflictingTrainee,
                eventName: e.flightNumber,
                isNext: e._isNext || false,
                startTime: e.startTime,
                endTime: e.startTime + e.duration,
                source: e._source || 'unknown'
            },
            flightTurnaround  // Or appropriate turnaround
        );
    }
}
```

**Location: Line 2180 (Main Candidate Loop Overlap)**

```typescript
if (overlaps) {
    // Only log if same trainee
    const candidateTrainee = trainee.fullName;
    const conflictingTrainee = getPersonnel(e).find(p => p !== ip.name) || e.student || e.pilot || '';
    
    if (candidateTrainee && conflictingTrainee && candidateTrainee === conflictingTrainee) {
        _logSameTraineeConflict(
            {
                traineeName: candidateTrainee,
                eventName: syllabusItem.id,
                isNext: !isPlusOne,
                startTime: proposedBookingWindow.start + (syllabusItem.preFlightTime || 0),
                endTime: proposedBookingWindow.end - (syllabusItem.postFlightTime || 0)
            },
            {
                traineeName: conflictingTrainee,
                eventName: e.flightNumber,
                isNext: e._isNext || false,
                startTime: e.startTime,
                endTime: e.startTime + e.duration,
                source: e._source || 'unknown'
            },
            type === 'flight' ? flightTurnaround : 
            type === 'ftd' ? ftdTurnaround : 
            type === 'ground' || type === 'cpt' ? cptTurnaround : 0
        );
    }
}
```

## Expected Output Examples

### Example 1: BUG - Valid NEXT+1 Rejected
```
═══════════════════════════════════════════════════
🔴 SAME-TRAINEE CONFLICT #1
═══════════════════════════════════════════════════

1. CANDIDATE (rejected event)
   Trainee: John Doe
   Event: BGF10
   Type: NEXT+1
   Time: 14:30 - 16:30

2. CONFLICTING EVENT
   Trainee: John Doe
   Event: BGF9
   Type: NEXT
   Time: 09:00 - 11:00
   Source: generated

3. SEQUENCING CHECK
   Same trainee: YES
   Is NEXT vs NEXT+1 pairing: YES
   Actual clock overlap: NO
   Time gap: 210 minutes
   Required turnaround: 30 minutes

4. FINAL VERDICT
   SHOULD BE ALLOWED: YES
   🐛 BUG: Valid NEXT+1 event rejected!

═══════════════════════════════════════════════════
```

### Example 2: VALID - Insufficient Turnaround
```
═══════════════════════════════════════════════════
🔴 SAME-TRAINEE CONFLICT #2
═══════════════════════════════════════════════════

1. CANDIDATE (rejected event)
   Trainee: John Doe
   Event: BGF10
   Type: NEXT+1
   Time: 11:15 - 13:15

2. CONFLICTING EVENT
   Trainee: John Doe
   Event: BGF9
   Type: NEXT
   Time: 09:00 - 11:00
   Source: generated

3. SEQUENCING CHECK
   Same trainee: YES
   Is NEXT vs NEXT+1 pairing: YES
   Actual clock overlap: NO
   Time gap: 15 minutes
   Required turnaround: 30 minutes

4. FINAL VERDICT
   SHOULD BE ALLOWED: NO
   NO - insufficient turnaround (need 30m, have 15m)

═══════════════════════════════════════════════════
```

### Example 3: VALID - True Overlap
```
═══════════════════════════════════════════════════
🔴 SAME-TRAINEE CONFLICT #3
═══════════════════════════════════════════════════

1. CANDIDATE (rejected event)
   Trainee: Jane Smith
   Event: BGF8
   Type: NEXT
   Time: 10:30 - 12:30

2. CONFLICTING EVENT
   Trainee: Jane Smith
   Event: BGF7
   Type: NEXT+1
   Time: 11:00 - 13:00
   Source: active-dfp

3. SEQUENCING CHECK
   Same trainee: YES
   Is NEXT vs NEXT+1 pairing: YES
   Actual clock overlap: YES
   Time gap: -30 minutes
   Required turnaround: 30 minutes

4. FINAL VERDICT
   SHOULD BE ALLOWED: NO
   NO - true overlap

═══════════════════════════════════════════════════
```

## Answer to the Question

After running the build, the logs will provide a clear answer:

**"Are valid NEXT+1 events being rejected even when there is no real overlap and sufficient turnaround?"**

If any logs show:
- SHOULD BE ALLOWED: YES
- Time gap >= Required turnaround
- Actual clock overlap: NO

Then the answer is **YES - BUG CONFIRMED**.

If all logs show:
- SHOULD BE ALLOWED: NO
- Either true overlap OR insufficient turnaround

Then the answer is **NO - NO BUG**.

## Summary

This minimal diagnostic:
1. ✅ Filters to SAME-TRAINEE conflicts only
2. ✅ Logs ONLY the required fields
3. ✅ Provides explicit YES/NO verdict
4. ✅ Clearly marks bugs when valid NEXT+1 is rejected
5. ✅ Answers the specific question with no extra noise