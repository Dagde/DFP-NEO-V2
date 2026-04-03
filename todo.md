# Fix Staff Profile - Only 2 Staff Showing

## Root Cause
`mergeInstructorData()` in `lib/dataService.ts` uses `instructor.idNumber` as the Map key.
All 102 restored DB staff have `idNumber: null` → they all map to the same `null` key,
overwriting each other. Only the last one + Burns (real idNumber) survive → 2 staff.

## Tasks
- [x] Fix `mergeInstructorData` to use `id` (CUID) as key when `idNumber` is null
- [x] Also fix mock instructor deduplication check (uses idNumber to skip mockdata duplicates)
- [x] Build, commit, push (commit 9837454b)
- [x] Verified Railway deployed new commit (9837454 live)