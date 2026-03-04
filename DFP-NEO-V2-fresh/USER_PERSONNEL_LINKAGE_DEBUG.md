# User-Personnel Linkage Debug

## Problem
The app shows "INSTRUCTOR" (from User table) instead of "SQNLDR" (from Personnel table) for Alexander Burns.

## Root Cause Hypothesis
The app cannot link the logged-in User record to the correct Personnel record in the database because:
1. The User.userId field doesn't match any Personnel.userId field
2. OR there's no Personnel record for Alexander Burns at all
3. OR the linkage is using the wrong field for matching

## Debug Endpoint
**URL:** https://dfp-neo.com/api/debug/user-personnel-linkage

**Access:** Must be logged in as Alexander Burns

**What it shows:**
```json
{
  "sessionUserId": "value from NextAuth session",
  
  "user": {
    "id": "Prisma cuid",
    "userId": "PMKEYS (e.g., '8207938')",
    "firstName": "Alexander",
    "lastName": "Burns",
    "role": "INSTRUCTOR"
  },
  
  "personnelByUserId": {
    // Personnel record found by matching User.userId to Personnel.userId
  },
  
  "personnelByIdNumber": {
    // Personnel record found by matching User.userId to Personnel.idNumber (PMKEYS)
  },
  
  "samplePersonnel": [
    // Sample of all Personnel records to see what userId values exist
  ]
}
```

## Expected Scenarios

### Scenario 1: Direct userId Linkage Working
- User.userId = "abc123"
- Personnel.userId = "abc123"
- Result: personnelByUserId will show the record

### Scenario 2: PMKEYS Linkage Working
- User.userId = "8207938"
- Personnel.idNumber = 8207938
- Result: personnelByIdNumber will show the record

### Scenario 3: No Linkage Found
- personnelByUserId = null
- personnelByIdNumber = null
- Result: App falls back to User.role = "INSTRUCTOR"

## Next Steps
Based on the debug output:
1. Identify the correct matching field
2. Update the linkage logic in `/api/user/personnel/route.ts`
3. Test that Alexander Burns shows "SQNLDR" instead of "INSTRUCTOR"
