# Debug Logging Deployment - Explanation

## What We Did

We added comprehensive debug logging to track the instructor filtering process in the NEO Build algorithm. This will help us understand why Alexander Burns is not being scheduled despite appearing in the Staff Combined Data table.

## Debug Logging Locations

### 1. generateInstructorCandidates Function (Lines ~2450-2460)
**Location:** NEO Build candidate selection

**What it logs:**
- All instructors being passed into the function
- The filtered candidates after role-based filtering
- The event type being processed

**Purpose:** To see what instructors are available when the build algorithm looks for candidates, and which ones pass the `role === 'QFI'` filter.

### 2. Pilot Remedies Generation (Line ~6737)
**Location:** Pilot remedies for SCT events

**What it logs:**
- All instructors in `instructorsData` 
- The filtered `qualifiedPilots` after `role === 'QFI'` filter

**Purpose:** To see which instructors are considered qualified pilots for remedies.

### 3. Config Creation (Line ~6142)
**Location:** DFP Config creation for NEO Build

**What it logs:**
- All instructors being passed to the config
- Total count of instructors

**Purpose:** To verify the complete instructor list being used by the NEO Build.

## How to Use This

1. **Clear browser cache** or use **Incognito/Private window**
2. **Open browser console** (F12)
3. **Run NEO Build** 
4. **Look for these log messages:**
   - `🔍 [NEO BUILD CONFIG DEBUG] Creating config with instructors:`
   - `🔍 [NEO BUILD DEBUG] generateInstructorCandidates - Input instructors:`
   - `🔍 [NEO BUILD DEBUG] generateInstructorCandidates - Filtered candidates:`
   - `🔍 [PILOT REMEDIES DEBUG] Input instructorsData:`
   - `🔍 [PILOT REMEDIES DEBUG] Filtered qualifiedPilots:`

5. **Check for Alexander Burns (idNumber: 8201112)**
   - Does he appear in the INPUT logs?
   - Does he appear in the FILTERED logs?
   - What role is shown for him in each log?

## Expected Scenarios

### Scenario 1: Burns NOT in input logs
- **Meaning:** Burns is not being passed to the NEO Build at all
- **Possible causes:**
  - Database query is excluding him
  - Data transformation is filtering him out
  - He's being removed during the merge process

### Scenario 2: Burns in input logs, NOT in filtered logs
- **Meaning:** Burns is being passed to NEO Build but filtered out
- **Possible causes:**
  - His `role` field is not 'QFI' in the data
  - There's a data type mismatch (e.g., role is null/undefined)
  - Case sensitivity issue (e.g., 'qfi' vs 'QFI')

### Scenario 3: Burns in both input AND filtered logs
- **Meaning:** Burns passes the filter but still not being scheduled
- **Possible causes:**
  - Availability issues
  - Constraint violations
  - Different scheduling logic path

## Key Information to Collect

From the console logs, note:
1. **Total instructors** in each log
2. **Alexander Burns' data:**
   - idNumber
   - name
   - role
3. **Any other instructors** with similar role patterns
4. **Event types** being processed when logs appear

## Next Steps

Once we see the console output, we can:
1. Identify exactly where Burns is being filtered out
2. Fix the specific issue (data problem, filter logic, etc.)
3. Verify the fix works for all affected staff
4. Remove debug logging after fix is confirmed

## Build Information

- **Commit:** 26e539f
- **Bundle:** index-xPDxhrH8.js
- **Branch:** feature/comprehensive-build-algorithm
- **Status:** Deployed to Railway, awaiting redeployment