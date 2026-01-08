# Optimize Scores API to Restore NEO Build

## Current Status
- ✅ App loads successfully
- ✅ Staff and trainees visible
- ✅ Duty Supervisors scheduled
- ❌ No training events scheduled (need scores)

## Task: Optimize Scores API Response
- [x] Modify /api/scores endpoint to return minimal fields
- [x] Remove: notes, details array, instructor
- [x] Keep: event, score, date
- [x] Re-enable scores loading in dataService.ts
- [x] Build and deploy
- [ ] Test response size (should be ~50KB instead of 371KB)
- [ ] Test NEO Build with optimized scores
- [ ] Verify training events are scheduled

## Deployment Status
- Commit 8342f01: Optimized scores API endpoint
- Commit 797c4e6: Re-enabled scores loading in frontend
- Status: Deployed to Railway (waiting for deployment to complete)

## Expected Outcome
- Scores load without browser hang
- NEO Build schedules flights, FTD, CPT, Ground events
- Full functionality restored