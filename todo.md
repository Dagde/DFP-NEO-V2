# TODO - NEO Build Instructor Filtering Issue

## Root Cause IDENTIFIED! 🎯

**Problem**: Alexander Burns (role='OFI', isQFI=true) is being filtered out by `fetchInstructors()` in `./lib/api.ts`

**How it happens**:
1. First useEffect (App.tsx ~3243): Fetches ALL personnel from `/personnel` endpoint - **Burns is included**
2. Second useEffect (App.tsx ~3298): Calls `initializeData()` which calls `fetchInstructors()` from `./lib/api.ts`
3. `fetchInstructors()` uses `/personnel?role=INSTRUCTOR` query - **Burns is FILTERED OUT** because his role is 'OFI'
4. Second useEffect overwrites instructorsData, losing Burns

**Fix Required**:
- Modify `fetchInstructors()` in `/workspace/lib/api.ts` to fetch ALL personnel
- Remove the `?role=INSTRUCTOR` filter
- Let the `mergeInstructorData()` function handle the filtering based on actual instructor types

## Next Steps
- [ ] Fix `fetchInstructors()` function in lib/api.ts
- [ ] Test that Burns appears in the build config
- [ ] Rebuild and deploy