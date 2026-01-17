# TODO - Recent Fixes Completed

## Fix 1: Burns Duplication Issue - FIXED ✅
**Commit**: 6226be8

### Issue
Alexander Burns was appearing 5 times in the Staff MockData table with the same PMKEYS (8281112) but different ranks.

### Root Cause
The `mergeInstructorData()` function in `/workspace/lib/dataService.ts` had a bug where it was including ALL database records including duplicates when merging with mockdata.

**Buggy Code:**
```typescript
const dbInstructorMap = new Map();
dbInstructors.forEach((instructor: any) => {
    dbInstructorMap.set(instructor.idNumber, instructor);  // Overwrites duplicates!
});
const merged = [...dbInstructors];  // ❌ Includes ALL database records, including duplicates
```

### Solution
Changed to use only unique idNumbers from the Map:
```typescript
const merged = Array.from(dbInstructorMap.values());  // ✅ Only unique idNumbers
```

### Expected Results
- Alexander Burns appears only ONCE in Staff MockData table
- Total staff count reduced from 128 to a lower number
- All staff with duplicate PMKEYS properly deduplicated

---

## Fix 2: Tile Color Timezone Issue - FIXED ✅
**Commit**: 01d6b28

### Issue
Flight tiles were turning amber/red based on incorrect time calculations. The color logic was not using local time but UTC time, causing tiles to change colors at the wrong time.

### Root Cause
The oracle preview tile in ScheduleView.tsx was using `currentTime={new Date()}` instead of `currentTime={currentTime}` (the timezone-adjusted state variable).

**Buggy Code (ScheduleView.tsx line 997):**
```typescript
<FlightTile
    ...
    currentTime={new Date()}  // ❌ Uses UTC time
/>
```

### How Timezone Adjustment Works
The ScheduleView component maintains a `currentTime` state that:
1. Initializes with timezone offset applied
2. Updates every second via setInterval
3. Applies the timezoneOffset prop (default UTC+11) to all time calculations

**Timezone Adjustment Logic:**
```typescript
const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    const offsetMs = timezoneOffset * 60 * 60 * 1000;
    return new Date(now.getTime() + offsetMs);
});

useEffect(() => {
    const updateTime = () => {
        const now = new Date();
        const offsetMs = timezoneOffset * 60 * 60 * 1000;
        const adjustedTime = new Date(now.getTime() + offsetMs);
        setCurrentTime(adjustedTime);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
}, [timezoneOffset]);
```

### Tile Color Logic (FlightTile.tsx)
The `getAuthorizationTextColorClass` and `getDynamicRingClass` functions use `currentTime` to determine colors:

**Color Rules:**
- **Green**: Fully authorized (both AUTHO and Captain signed)
- **Sky Blue**: AUTHO signed, awaiting Captain
- **Red**: Needs authorization urgently (≤ 15 minutes until takeoff)
- **Amber**: Needs authorization soon (≤ 2 hours until takeoff)
- **Default**: Unsigned flights > 2 hours away

**Time Calculation:**
```typescript
const nowInHours = currentTime.getHours() + currentTime.getMinutes() / 60;
const timeUntilStart = event.startTime - nowInHours;

if (timeUntilStart <= 0.25) {
    return 'text-red-500';  // ≤ 15 minutes
}
if (timeUntilStart <= 2) {
    return 'text-amber-400';  // ≤ 2 hours
}
```

### Solution
Changed oracle preview to use the timezone-adjusted currentTime:
```typescript
<FlightTile
    ...
    currentTime={currentTime}  // ✅ Uses timezone-adjusted time
/>
```

### Expected Results
- Tiles will turn amber at the correct local time (2 hours before takeoff)
- Tiles will turn red at the correct local time (15 minutes before takeoff)
- All time-based calculations will respect the configured timezone

---

## Fix 3: Category Dropdown and Page Name Update - FIXED ✅
**Commit**: fd7a900

### Issue
The Category dropdown in the New Instructor and Staff Profile pages was using outdated categories (A2, B1, B2, C1, C2, INSTRUCTOR) that didn't match the type definition. The page was also named "New Instructor" instead of "New Staff".

### Root Cause
The UI dropdown options were hardcoded with old category values that didn't align with the `InstructorCategory` type definition in `types.ts`.

**Old Dropdown Options:**
```typescript
<Dropdown label="Category">
    <option value="A2">A2</option>
    <option value="B1">B1</option>
    <option value="B2">B2</option>
    <option value="C1">C1</option>
    <option value="C2">C2</option>
    <option value="INSTRUCTOR">INSTRUCTOR</option>
</Dropdown>
```

**Type Definition (already correct in types.ts):**
```typescript
export type InstructorCategory = 'UnCat' | 'D' | 'C' | 'B' | 'A';
```

### Solution
Updated the Category dropdown in `InstructorProfileFlyout.tsx` to use the correct options that match the type definition, and renamed the page title.

**New Dropdown Options:**
```typescript
<Dropdown label="Category">
    <option value="A">A</option>
    <option value="B">B</option>
    <option value="C">C</option>
    <option value="D">D</option>
    <option value="UnCat">U</option>
</Dropdown>
```

**Page Title Change:**
```typescript
// Old
<h2>{isCreating ? 'New Instructor' : 'Staff Profile'}</h2>

// New
<h2>{isCreating ? 'New Staff' : 'Staff Profile'}</h2>
```

### Expected Results
- Category dropdown now shows: A, B, C, D, U
- Dropdown options align with the `InstructorCategory` type definition
- Page title when creating new staff shows "New Staff" instead of "New Instructor"

---

## Deployment Status
All three fixes have been deployed to Railway:
- **Latest Commit**: fd7a900
- **Latest Bundle**: index-Da7TMiIi.js
- **Branch**: feature/comprehensive-build-algorithm
- **Status**: Pushed to Railway (deploying)

## Testing Instructions
1. Wait for Railway to complete deployment
2. Clear browser cache or use Incognito mode
3. **Test Burns fix**: Navigate to Settings → Staff MockData, verify Burns appears only once
4. **Test tile color fix**: Monitor flight tiles and verify they change colors at the correct local times
5. **Test Category dropdown**: 
   - Navigate to Staff page and click "Add Staff" or open a Staff Profile
   - Verify the Category dropdown shows: A, B, C, D, U
   - Verify the page title shows "New Staff" when creating a new staff member