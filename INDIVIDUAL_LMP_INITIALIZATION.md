# Individual LMP Initialization from Trainee Profile

## Overview
When a new trainee is created, their Individual LMP is automatically initialized as a copy of the Master LMP specified in their profile's LMP field. After this initial setup, the Individual LMP and the LMP field operate independently.

## Implementation Date
January 14, 2025

## Feature Description

### Initial Setup Process
1. **Trainee Creation**: When a new trainee profile is created, the system reads the LMP field value
2. **Master LMP Lookup**: The system finds the corresponding Master LMP from the syllabus details
3. **Individual LMP Creation**: A copy of the Master LMP is created and assigned to the trainee
4. **Independence**: After creation, changes to the trainee's LMP field do NOT update their Individual LMP

### Example Scenario
```
Trainee: FLTLT Jones
LMP Field: FIC
Result: Jones's Individual LMP is initialized with all events from the FIC Master LMP

Later:
- If Jones's LMP field is changed to "OFI", his Individual LMP remains as FIC
- The Individual LMP can only be modified through:
  * Adding remedial packages
  * Adding currency events
  * Manual edits in the Individual LMP view
```

## Technical Implementation

### 1. Trainee Type Update
**File**: `types.ts`

Added `lmpType` field to Trainee interface:
```typescript
export interface Trainee {
  // ... existing fields
  lmpType?: string;  // NEW: Stores the LMP type (e.g., 'BPC+IPC', 'FIC', 'OFI')
  // ... other fields
}
```

### 2. Trainee Profile UI
**File**: `components/TraineeProfileFlyout.tsx`

**Changes**:
- Added LMP dropdown to trainee profile (4th column after Name, ID Number, Course)
- Available options match Master LMP page: BPC+IPC, FIC, OFI, WSO, FIC(I), PLT CONV, QFI CONV, PLT Refresh, Staff CAT
- Default value: 'BPC+IPC'
- Audit logging for LMP type changes
- Display in view mode with sky-blue styling

**Layout**:
```
Before: [Name] [ID Number] [Course]
After:  [Name] [ID Number] [Course] [LMP]
```

### 3. Individual LMP Initialization Logic
**File**: `App.tsx`

#### Function: `handleAddTrainee`
```typescript
const handleAddTrainee = useCallback((newTrainee: Trainee) => {
    setTraineesData(prev => [...prev, newTrainee]);
    
    // Initialize Individual LMP based on trainee's lmpType
    const lmpType = newTrainee.lmpType || 'BPC+IPC';
    const masterLMP = syllabusDetails.filter(item => {
        if (lmpType === 'BPC+IPC') {
            return !item.lmpType || item.lmpType === 'Master LMP';
        }
        return item.courses.includes(lmpType);
    });
    
    if (masterLMP.length > 0) {
        setTraineeLMPs(prev => {
            const newLMPs = new Map(prev);
            newLMPs.set(newTrainee.fullName, [...masterLMP]);
            console.log(`[Individual LMP] Initialized ${newTrainee.fullName}'s Individual LMP with ${lmpType} (${masterLMP.length} events)`);
            return newLMPs;
        });
    }
    
    setSuccessMessage('New Trainee Added!');
}, [syllabusDetails]);
```

#### Handler: `onUpdateTrainee` (in CourseRosterView)
```typescript
onUpdateTrainee={(data) => {
    const isNewTrainee = !traineesData.find(t => t.idNumber === data.idNumber);
    
    if (isNewTrainee) {
        // Initialize Individual LMP for new trainee
        const lmpType = data.lmpType || 'BPC+IPC';
        const masterLMP = syllabusDetails.filter(item => {
            if (lmpType === 'BPC+IPC') {
                return !item.lmpType || item.lmpType === 'Master LMP';
            }
            return item.courses.includes(lmpType);
        });
        
        if (masterLMP.length > 0) {
            setTraineeLMPs(prev => {
                const newLMPs = new Map(prev);
                newLMPs.set(data.fullName, [...masterLMP]);
                console.log(`[Individual LMP] Initialized ${data.fullName}'s Individual LMP with ${lmpType} (${masterLMP.length} events)`);
                return newLMPs;
            });
        }
    }
    
    setTraineesData(prev => prev.map(t => t.idNumber === data.idNumber ? data : t));
}}
```

## Master LMP Filtering Logic

### BPC+IPC (Default)
```typescript
if (lmpType === 'BPC+IPC') {
    return !item.lmpType || item.lmpType === 'Master LMP';
}
```
Includes all syllabus items that:
- Have no `lmpType` field (default items)
- Have `lmpType === 'Master LMP'`

### Other LMP Types (FIC, OFI, WSO, etc.)
```typescript
return item.courses.includes(lmpType);
```
Includes all syllabus items where the `courses` array contains the specified LMP type.

## Available LMP Types

The system supports the following LMP types (matching Master LMP page):

1. **BPC+IPC** - Basic and Intermediate Pilot Course (default)
2. **FIC** - Flight Instructor Course
3. **OFI** - Operational Flying Instructor
4. **WSO** - Weapon Systems Officer
5. **FIC(I)** - Flight Instructor Course (Instructor)
6. **PLT CONV** - Pilot Conversion
7. **QFI CONV** - Qualified Flying Instructor Conversion
8. **PLT Refresh** - Pilot Refresher
9. **Staff CAT** - Staff Category

## Data Flow

### New Trainee Creation Flow
```
1. User creates new trainee profile
   ↓
2. User selects LMP type (e.g., "FIC")
   ↓
3. User clicks Save
   ↓
4. System detects new trainee (no matching ID number)
   ↓
5. System filters syllabusDetails for FIC events
   ↓
6. System creates Individual LMP as copy of FIC Master LMP
   ↓
7. Individual LMP stored in traineeLMPs Map
   ↓
8. Trainee saved with lmpType: "FIC"
```

### Existing Trainee Update Flow
```
1. User edits existing trainee profile
   ↓
2. User changes LMP field from "FIC" to "OFI"
   ↓
3. User clicks Save
   ↓
4. System detects existing trainee (matching ID number found)
   ↓
5. System updates trainee.lmpType to "OFI"
   ↓
6. Individual LMP remains unchanged (still FIC events)
   ↓
7. LMP field and Individual LMP are now independent
```

## Important Notes

### One-Time Initialization
- Individual LMP is ONLY initialized when a trainee is first created
- Subsequent changes to the LMP field do NOT affect the Individual LMP
- This is by design to preserve training progress and customizations

### Manual Individual LMP Management
After initialization, the Individual LMP can be modified through:
1. **Remedial Packages**: Adding remedial events inserts them into Individual LMP
2. **Currency Events**: Adding currency requirements updates Individual LMP
3. **Individual LMP View**: Direct editing of the trainee's Individual LMP
4. **Manual Adjustments**: Instructors can customize the Individual LMP as needed

### Why Independence?
Once a trainee begins training:
- Their Individual LMP may have remedial events added
- They may have completed events
- Prerequisites may have been customized
- Changing the LMP field should not wipe out this progress

## Console Logging

The system logs Individual LMP initialization for debugging:
```
[Individual LMP] Initialized Jones, Thomas's Individual LMP with FIC (79 events)
```

This helps verify:
- The correct LMP type was used
- The correct number of events were copied
- The initialization occurred at the right time

## Testing Checklist

### New Trainee Creation
- [ ] Create new trainee with LMP = "BPC+IPC"
- [ ] Verify Individual LMP contains BPC+IPC events
- [ ] Check console for initialization log
- [ ] Verify event count matches Master LMP

### Different LMP Types
- [ ] Create trainee with LMP = "FIC"
- [ ] Verify Individual LMP contains FIC events
- [ ] Create trainee with LMP = "OFI"
- [ ] Verify Individual LMP contains OFI events

### Independence Verification
- [ ] Create trainee with LMP = "FIC"
- [ ] Verify Individual LMP initialized with FIC
- [ ] Edit trainee, change LMP to "OFI"
- [ ] Verify Individual LMP still contains FIC events
- [ ] Confirm LMP field shows "OFI" but Individual LMP unchanged

### Edge Cases
- [ ] Create trainee without selecting LMP (should default to BPC+IPC)
- [ ] Create trainee with LMP type that has no events
- [ ] Verify existing trainees are not affected by this change

## Future Enhancements

### Potential Improvements
1. **LMP Change Warning**: Alert user when changing LMP field that it won't affect Individual LMP
2. **Re-initialization Option**: Add button to re-initialize Individual LMP from current LMP field (with confirmation)
3. **LMP Comparison**: Show differences between trainee's LMP field and their actual Individual LMP
4. **Bulk LMP Update**: Tool to update multiple trainees' Individual LMPs at once
5. **LMP History**: Track when Individual LMP was initialized and from which Master LMP

## Conclusion

The Individual LMP initialization feature provides:
- ✅ Automatic setup of Individual LMP based on trainee's LMP field
- ✅ One-time initialization at trainee creation
- ✅ Independence between LMP field and Individual LMP after creation
- ✅ Preservation of training progress and customizations
- ✅ Flexibility for instructors to manage Individual LMPs

This ensures trainees start with the correct syllabus while maintaining the ability to customize their training path without losing progress.