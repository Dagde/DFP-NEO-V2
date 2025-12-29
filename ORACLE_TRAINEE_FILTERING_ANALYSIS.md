# Oracle Trainee Filtering - Critical Issues Found

## Current Implementation Problems

### 1. MAJOR BUG: Incomplete Event Filtering
The current `handleOracleMouseUp` function filters trainees like this:

```typescript
const availableTraineesAnalysis = oracleAnalysis.trainees.filter(tr => {
    if (!tr.isEligible) return false;
    const personEvents = currentEvents.filter(e => getPersonnel(e).includes(tr.trainee.fullName));
    const hasOverlap = personEvents.some(e => {
        const existingWindow = getEventBookingWindow(e, syllabusDetails);
        return bookingWindow.start < existingWindow.end && bookingWindow.end > existingWindow.start;
    });
    return !isPersonStaticallyUnavailable(tr.trainee, bookingWindow.start, bookingWindow.end, analysisDate, 'flight') && !hasOverlap;
});
```

**Problem**: This only checks for TIME overlap, but doesn't check if the trainee is already scheduled for ANY flight event on that day!

### 2. MISSING: One Flight Per Day Rule
The current logic only checks:
- Basic eligibility (`tr.isEligible`)
- Time overlap with booking window  
- Static unavailability

**What's Missing**:
- ❌ **One flight per day rule** - Trainees should only appear if they don't have ANY flight already scheduled that day
- ❌ **Duplicate event checking** - Trainees shouldn't be offered the same flight they're already scheduled for
- ❌ **Duty rule validation** - Full trainee duty rules should be checked

### 3. Current Eligibility Logic Issues
The current `isEligible` calculation:

```typescript
const isEligible = !(hasFtd && hasFlight) && nextSyllabusEvent?.type === 'Flight';
```

**Problems**:
- Only checks if trainee has both FTD AND flight already
- Doesn't enforce one flight per day
- Doesn't check for duplicate event codes

## What the Oracle SHOULD Do (Correct Logic)

### 1. Check Trainee Has NO Existing Flight Events
```typescript
const hasExistingFlight = personEvents.some(e => 
    e.type === 'flight' && 
    e.date === analysisDate
);
if (hasExistingFlight) return false; // Already has a flight today
```

### 2. Check Not Already Scheduled for This Specific Event
```typescript
const hasThisEvent = personEvents.some(e => 
    e.flightNumber === proposedEvent.flightNumber &&
    e.date === analysisDate
);
if (hasThisEvent) return false; // Already scheduled for this exact event
```

### 3. Full Trainee Duty Rules
- Only 1 flight per day
- Maximum 1 FTD + 1 flight per day
- Maximum 2 ground events per day
- Day/night separation rules
- Currency and qualification requirements

## Implementation Required

The Oracle trainee filtering needs to be completely rewritten to:

1. **First filter by basic eligibility** (current logic)
2. **Then filter by daily flight assignments** - remove anyone who already has a flight that day
3. **Then filter by specific event assignments** - remove anyone already scheduled for this exact event
4. **Then apply full duty rule validation** - comprehensive rule checking
5. **Finally apply time-based availability** - current overlap checking

This would ensure that the Oracle only offers trainees who are:
- ✅ Available at the proposed time
- ✅ Don't already have a flight scheduled that day
- ✅ Haven't already completed this specific event
- ✅ Comply with all trainee duty rules
- ✅ Have the required qualifications for the event

The current implementation is essentially non-functional for proper trainee selection because it fails at step 2 and 3 - it will offer trainees who already have flights scheduled for that day.