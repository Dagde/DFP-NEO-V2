# Pause Flight Ops Enhancements

## Task 1: Overlay visible from panel open (not just after build)
- [x] Add `onOverlayTimesChange` prop to PauseFlightOpsPanel interface
- [x] Add useEffect in PauseFlightOpsPanel to call onOverlayTimesChange when pauseStartDec/pauseEndDec change
- [x] Wire up onOverlayTimesChange in App.tsx PauseFlightOpsPanel rendering

## Task 2: Priority-aware event recycling on pause build
- [x] Review current handlePauseBuild — understand current STBY placement logic
- [x] Build rescheduledTraineeNames set from post-pause generated events
- [x] Filter: skip STBY for trainees already rescheduled by NEO Build algorithm
- [x] Only trainees that couldn't be scheduled remain on STBY cancelled

## Task 3: Build and push
- [x] Run TypeScript check — no new errors
- [x] npm run build succeeded (BUILD_DONE:0)
- [x] git commit 7ba84ae0
- [x] git push — SUCCESS: pushed to feature/comprehensive-build-algorithm