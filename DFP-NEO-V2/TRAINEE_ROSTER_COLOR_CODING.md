# Trainee Roster Name Color Coding Implementation

## Requirements

### Color Rules
1. **RED** (Paused / NTSC)
   - Trainee is Paused OR NTSC
   - Highest priority - overrides all other colors

2. **AMBER** (Recent non-remedial poor performance)
   - Trainee is NOT RED (not Paused/NTSC)
   - Consider most recent Flight or FTD event that is NOT remedial
   - Mark AMBER if either:
     - Last non-remedial Flight/FTD was a fail (score = 0), OR
     - Last non-remedial Flight/FTD was the trainee's second consecutive non-remedial Flight/FTD event
   - Example: Flight → FTD (both non-remedial, back-to-back) = AMBER on second event

3. **GREEN** (Default)
   - Trainee is neither RED nor AMBER

### Precedence
RED > AMBER > GREEN

## Implementation Complete ✅

### Phase 1: Locate Component ✅
- [x] Found CourseRosterView.tsx
- [x] Located existing `getTraineeNameColorClass` function (line 164)
- [x] Identified trainee name rendering (line 284)

### Phase 2: Implement Color Logic ✅
- [x] Updated `getTraineeNameColorClass` function with new rules
- [x] **RED**: Check `trainee.isPaused` (covers both Paused and NTSC)
- [x] **AMBER**: Implemented two-part check:
  1. Filter scores for non-remedial Flight/FTD events only
  2. Check if last non-remedial Flight/FTD was fail (score = 0)
  3. Check if last non-remedial Flight/FTD was second consecutive
     - Get all non-remedial scores (all types)
     - Find indices of last two Flight/FTD events
     - If consecutive (indices differ by 1) → AMBER
- [x] **GREEN**: Default for all others

### Phase 3: Logic Details ✅

**Consecutive Score Check Algorithm:**
1. Get all non-remedial Flight/FTD scores (sorted by date, newest first)
2. Take the last two: `lastNonRemedialScore` and `secondLastNonRemedialScore`
3. Check if BOTH have score = 1
4. If both scores are 1 → AMBER

**Example Scenarios:**
- Last Flight score = 1, Second-last FTD score = 1 → **AMBER**
- Last Flight score = 1, Second-last FTD score = 2 → **GREEN**
- Last Flight score = 0 → **AMBER** (fail rule)
- Last Flight score = 2, Second-last FTD score = 1 → **GREEN**

**Note:** Only considers the last two non-remedial Flight/FTD events chronologically, regardless of other events in between.

### Files Modified
- [x] components/CourseRosterView.tsx - Updated `getTraineeNameColorClass` function

### Testing Checklist
- [ ] Test RED: Trainee with isPaused = true
- [ ] Test AMBER: Trainee with last non-remedial Flight/FTD score = 0
- [ ] Test AMBER: Trainee with two consecutive non-remedial Flight/FTD events
- [ ] Test GREEN: Trainee with good performance
- [ ] Test precedence: Paused trainee with fail score should be RED (not AMBER)