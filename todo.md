# Formation Pilot Duplication Fix

## 1. Analysis & Understanding
- [x] Identify root cause: duplicate pilots in formation creation
- [x] Understand the formation creation flow
- [x] Locate the formation creation code in EventDetailModal.tsx

## 2. Fix Formation Creation Logic
- [x] Update FlightDetailModal.tsx to filter out already-assigned pilots from dropdowns
- [x] Ensure each aircraft in formation gets a different pilot from the selection list
- [x] Applied to both staff dropdown and trainee dropdown

## 3. Add Validation
- [x] Add validation in conflict detection to identify duplicate pilots in same formation
- [x] Check runs FIRST before other conflict checks
- [x] Returns personnel conflict type with duplicate pilot name

## 4. Testing & Verification
- [ ] Test creating new formations with unique pilot requirement
- [ ] Test NEO conflict detection with formations
- [ ] Verify instructor assignment works correctly after fix
- [ ] Deploy and verify with user

## 5. Completion
- [ ] All fixes implemented and tested
- [ ] User confirms issue is resolved