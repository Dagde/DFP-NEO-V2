# TODO - NEO Build Instructor Filtering Issue

## ✅ ALL ISSUES RESOLVED! 🎉

### Issue 1: Burns Not Being Scheduled - FIXED ✅
**Problem**: Alexander Burns (role='OFI', isQFI=true) was being filtered out by `fetchInstructors()` in `./lib/api.ts`

**Solution**: Modified `fetchInstructors()` to fetch ALL personnel instead of filtering by `role=INSTRUCTOR`

**Commit**: dac449a

### Issue 2: Burns Appearing Multiple Times - FIXED ✅
**Problem**: Burns was appearing 5 times in Staff Schedule due to TWO useEffect hooks both fetching and setting `instructorsData`

**Solution**: Removed the redundant useEffect that was duplicating the work done by `initializeData()`

**Commit**: ef709d0

## Completed Tasks
- [x] Identified root cause in `fetchInstructors()` function
- [x] Fixed the API call to fetch all personnel
- [x] Verified Burns is now scheduled in NEO Build
- [x] Identified and removed duplicate useEffect
- [x] Rebuilt and deployed (bundle: index-CZwAIc5i.js)
- [x] Committed and pushed both fixes

## Final Status
**Alexander Burns should now:**
- ✅ Appear ONCE in Staff Combined Data
- ✅ Appear ONCE in Staff Schedule
- ✅ Be included in NEO Build algorithm configuration
- ✅ Be scheduled for events as a QFI

**Deployment:**
- Latest commit: ef709d0
- Bundle: index-CZwAIc5i.js
- Branch: feature/comprehensive-build-algorithm
- Status: Deployed to Railway