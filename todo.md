# TODO - Burns Duplication Issue Investigation

## Current Status
**Issue NOT RESOLVED** - Burns still appearing 5 times in Staff MockData table

## Evidence from Screenshot
- "128 Staff Members" in Staff MockData table
- Alexander Burns (PMKEYS: 8281112) appears 5 times with different ranks
- All entries show ROLE="OFI" and UNIT="1FTS"

## Previous Attempts (FAILED)
1. **Commit dac449a**: Fixed Burns not being scheduled (removed role filter)
2. **Commit ef709d0**: Removed duplicate useEffect (did NOT fix duplication)

## Current Investigation Findings
- Console showed: "DUPLICATES IN initializeData() RESULT: 4"
- Console showed: "All Burns entries: Array(5)"
- Console showed: "personnelCount: 128"
- **Conclusion**: There are 5 duplicate Burns records in the DATABASE, not in mockdata

## Data Flow Analysis
1. `initializeData()` calls `fetchInstructors()` 
2. `fetchInstructors()` fetches from `/personnel` API
3. API returns 128 personnel records
4. Data is merged with mockdata (ESL_DATA.instructors)
5. Deduplication happens by `idNumber`
6. Result: Burns appears 5 times (all 5 have same idNumber but different ranks)

## Root Cause
**The deduplication logic in `mergeInstructorData()` is NOT working correctly for Burns**
- It should skip mockdata entries if database has same idNumber
- But Burns appears 5 times with SAME idNumber but DIFFERENT ranks
- This suggests 5 separate database records with same idNumber

## Tasks
- [ ] Verify Burns records in database via direct query
- [ ] Identify why 5 database records have same idNumber
- [ ] Remove duplicate Burns records from database
- [ ] Verify deduplication logic works correctly
- [ ] Test that Burns appears only once after cleanup