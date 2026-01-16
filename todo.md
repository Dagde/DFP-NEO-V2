# TODO - NEO Build Instructor Filtering Issue

## ✅ Root Cause FIXED! 🎉

**Problem**: Alexander Burns (role='OFI', isQFI=true) was being filtered out by `fetchInstructors()` in `./lib/api.ts`

**Solution Applied**:
- Modified `fetchInstructors()` in `/workspace/lib/api.ts` to fetch ALL personnel (removed `?role=INSTRUCTOR` filter)
- This allows all instructor types (QFIs, OFIs, SIM IPs, etc.) to be included in the data
- The merging logic in `mergeInstructorData()` handles appropriate filtering

## ⚠️ NEW ISSUE: Burns appearing multiple times in Staff Schedule

**Root Cause**: TWO useEffect hooks in App.tsx are both fetching and setting `instructorsData`:
1. First useEffect (~3243-3279): Direct `/personnel` fetch and merge
2. Second useEffect (~3298+): Calls `initializeData()` which also fetches and merges

Both run on mount, causing the data to be set twice and potentially creating duplicates.

**Solution Required**:
- Remove the first useEffect (lines ~3243-3279)
- Keep only the second useEffect that calls `initializeData()`
- This avoids the double-fetching and potential duplication

## Completed Tasks
- [x] Identified root cause in `fetchInstructors()` function
- [x] Fixed the API call to fetch all personnel
- [x] Rebuilt application (bundle: index-CFQyEHFp.js)
- [x] Copied fresh build artifacts to public directory
- [x] Updated HTML files to reference new bundle
- [x] Committed and pushed (commit: dac449a)
- [x] Verified Burns is now scheduled in NEO Build

## Next Steps
- [ ] Remove duplicate useEffect in App.tsx
- [ ] Rebuild and test
- [ ] Verify Burns appears only once in Staff Schedule