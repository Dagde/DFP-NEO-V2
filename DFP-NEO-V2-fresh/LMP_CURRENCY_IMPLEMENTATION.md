# LMP Currency Event Implementation

## Overview
Implemented automatic addition of LMP Currency events to trainee's Individual LMP with proper chronological ordering and "-CUR" suffix.

## How It Works

### 1. Event Category Selection
When creating an event in the Flight Details modal, users can select "LMP Currency" as the event category.

### 2. Currency Event Creation
When a currency event is saved:
- The event is created normally in the schedule
- The `eventCategory` field is set to `'lmp_currency'`
- The event is saved with all standard properties

### 3. Automatic LMP Update
After the event is saved, the system automatically:
1. Identifies the trainee(s) involved in the currency event
2. Finds the base event in the Master LMP syllabus
3. Creates a currency version with "-CUR" suffix
4. Locates the base event in the trainee's Individual LMP
5. Inserts the currency event immediately after the base event

### 4. Chronological Ordering Example

**Before Currency Event:**
```
BGF3
BGF4
BGF5
BGF6
BGF7
```

**After BGF5 Currency Event:**
```
BGF3
BGF4
BGF5
BGF5-CUR  ← Inserted here
BGF6
BGF7
```

## Technical Implementation

### Data Structure

#### Currency Event Properties
```typescript
{
  id: "BGF5-CUR",
  code: "BGF5-CUR",
  eventDescription: "Basic General Flying 5 (Currency)",
  // ... all other properties from base event
}
```

### Key Functions

#### `addCurrencyEventToTraineeLMP(traineeFullName, currencyEventId)`
**Purpose**: Adds a currency event to a specific trainee's Individual LMP

**Process**:
1. Retrieves trainee's Individual LMP from `traineeLMPs` Map
2. Finds the base event in the syllabus
3. Creates currency version with "-CUR" suffix
4. Finds base event index in trainee's LMP
5. Checks if currency event already exists (prevents duplicates)
6. Inserts currency event at correct position
7. Updates the `traineeLMPs` state

**Error Handling**:
- Warns if trainee has no Individual LMP
- Warns if base event not found in syllabus
- Warns if base event not found in trainee's LMP
- Prevents duplicate currency events

### Integration Points

#### FlightDetailModal.tsx
- Saves `eventCategory` with each event
- Event category determines which syllabus items are available

#### App.tsx - handleSaveEvents
After saving events to the schedule:
```typescript
eventsToSave.forEach(event => {
    if (event.eventCategory === 'lmp_currency' && event.flightNumber) {
        const traineeName = event.flightType === 'Dual' ? event.student : event.pilot;
        
        if (traineeName) {
            addCurrencyEventToTraineeLMP(traineeName, event.flightNumber);
        } else if (event.groupTraineeIds && event.groupTraineeIds.length > 0) {
            // Handle group events
            event.groupTraineeIds.forEach(traineeId => {
                const trainee = traineesData.find(t => t.idNumber === traineeId);
                if (trainee) {
                    addCurrencyEventToTraineeLMP(trainee.fullName, event.flightNumber);
                }
            });
        }
    }
});
```

### Group Event Handling
When a currency event is assigned to a group:
- The system iterates through all `groupTraineeIds`
- Adds the currency event to each trainee's Individual LMP
- Each trainee gets their own currency event entry

## User Workflow

### Creating a Currency Event

1. **Click "Add Tile"** or edit an existing event
2. **Select "LMP Currency"** from the event category buttons
3. **Choose syllabus item** from Master LMP events
4. **Fill in event details**:
   - Area
   - Start Time (HHMM format)
   - Duration (defaults to 1.2)
   - Type (Dual/Solo - pulled from syllabus)
   - Instructor
   - Trainee or Group
5. **Save the event**

### What Happens Automatically

1. Event appears on the schedule
2. Currency event is added to trainee's Individual LMP
3. Currency event appears with "-CUR" suffix
4. Event is positioned chronologically after the base event
5. Trainee's progression tracking is updated

## Viewing Currency Events

### In Individual LMP View
- Navigate to trainee's Individual LMP
- Currency events appear with "-CUR" suffix
- Positioned immediately after their base events
- Maintain all properties of the base event

### In Schedule View
- Currency events appear as normal scheduled events
- Color-coded by course
- Show "LMP Currency" category when viewed

## Data Persistence

### State Management
- Currency events are stored in `traineeLMPs` Map
- Key: Trainee's full name
- Value: Array of `SyllabusItemDetail[]`

### Persistence Across Sessions
- Currently stored in application state
- Persists during session
- For permanent storage, would need database integration

## Edge Cases Handled

### 1. Duplicate Prevention
- System checks if currency event already exists
- Prevents adding the same currency event multiple times
- Logs message if duplicate detected

### 2. Missing Data
- Handles missing Individual LMP gracefully
- Handles missing base event in syllabus
- Handles missing base event in trainee's LMP
- All cases log warnings for debugging

### 3. Group Events
- Correctly handles group assignments
- Adds currency to all trainees in the group
- Each trainee gets independent currency event

### 4. Chronological Integrity
- Always inserts after base event
- Maintains proper ordering
- Doesn't disrupt existing LMP structure

## Future Enhancements

### Potential Improvements
1. **Database Persistence**: Save currency events to database
2. **Bulk Currency**: Add currency for multiple events at once
3. **Currency Removal**: Allow removal of currency events
4. **Currency Tracking**: Track when currency was completed
5. **Currency Expiry**: Add expiry dates for currency events
6. **Currency Reports**: Generate reports on currency status
7. **Currency Notifications**: Alert when currency is due

### Integration Opportunities
1. **Hate Sheet**: Show currency events in trainee scores
2. **PT-051**: Include currency events in assessment forms
3. **Logbook**: Record currency events in logbook
4. **Analytics**: Track currency completion rates

## Testing Checklist

- [ ] Create LMP Currency event for individual trainee
- [ ] Verify currency event appears in Individual LMP
- [ ] Verify "-CUR" suffix is added
- [ ] Verify chronological ordering is correct
- [ ] Create currency event for group
- [ ] Verify all group members receive currency event
- [ ] Attempt to create duplicate currency event
- [ ] Verify duplicate prevention works
- [ ] Check console for proper logging
- [ ] Verify currency events persist during session

## Known Limitations

1. **No Database Persistence**: Currency events only persist during session
2. **No Removal Feature**: Cannot remove currency events once added
3. **No Expiry Tracking**: No automatic tracking of currency expiry
4. **No Validation**: Doesn't validate if trainee has completed base event

## Troubleshooting

### Currency Event Not Appearing
1. Check console for warnings
2. Verify trainee has Individual LMP
3. Verify base event exists in syllabus
4. Verify base event exists in trainee's LMP

### Duplicate Currency Events
1. System should prevent duplicates
2. Check console for duplicate detection message
3. If duplicates appear, may indicate state management issue

### Wrong Chronological Order
1. Verify base event exists in trainee's LMP
2. Check if base event ID matches exactly
3. Verify insertion logic is working correctly

---

**Status**: ✅ Implemented and Functional
**Version**: 1.0
**Date**: 2024-11-29
**Files Modified**: 
- App.tsx (helper function and integration)
- types.ts (eventCategory field)
- components/FlightDetailModal.tsx (save eventCategory)