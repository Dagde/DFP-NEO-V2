# TODO - NEO Build Instructor Filtering Issue

## Current Status
- ✅ Debug logging deployed (commit 26e539f)
- ⏳ Waiting for Railway redeployment
- ⏳ Waiting for user to provide console logs

## Completed Tasks
- [x] Fixed lexical declaration error in InstructorListView
- [x] Added debug logging to track instructor filtering
- [x] Rebuilt and deployed debug version
- [x] Created explanation document

## Pending Tasks
- [ ] User runs NEO Build and collects console logs
- [ ] Analyze console logs to identify where Burns is filtered out
- [ ] Implement fix based on findings
- [ ] Test fix thoroughly
- [ ] Remove debug logging after fix confirmed

## Investigation Notes
- Alexander Burns shows as QFI in Staff Combined Data (role='QFI', isQFI=true per screenshot)
- Burns is NOT being scheduled in NEO Build
- Need to determine: Is he not in the data, or is he being filtered out?

## Key Debug Log Messages to Look For
1. `🔍 [NEO BUILD CONFIG DEBUG] Creating config with instructors:`
2. `🔍 [NEO BUILD DEBUG] generateInstructorCandidates - Input instructors:`
3. `🔍 [NEO BUILD DEBUG] generateInstructorCandidates - Filtered candidates:`
4. `🔍 [PILOT REMEDIES DEBUG] Input instructorsData:`
5. `🔍 [PILOT REMEDIES DEBUG] Filtered qualifiedPilots:`