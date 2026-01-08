# Optimize Scores API to Restore NEO Build

## Current Status
- ✅ App loads successfully
- ✅ Staff and trainees visible
- ✅ Duty Supervisors scheduled
- ❌ No training events scheduled (need scores)

## Task: Optimize Scores API Response
- [ ] Modify /api/scores endpoint to return minimal fields
- [ ] Remove: notes, details array, instructor
- [ ] Keep: event, score, date
- [ ] Test response size (should be ~50KB instead of 371KB)
- [ ] Re-enable scores loading in dataService.ts
- [ ] Test NEO Build with optimized scores
- [ ] Verify training events are scheduled

## Expected Outcome
- Scores load without browser hang
- NEO Build schedules flights, FTD, CPT, Ground events
- Full functionality restored