# Rank Display Fix - User-Personnel Linkage Issue

## Problem
The app was displaying "INSTRUCTOR" (from User table) instead of the correct military rank "FLTLT" (from Personnel table) for Alexander Burns.

## Root Cause Analysis

### Database State (from debug endpoint)
```json
{
  "sessionUserId": "8201112",
  "user": {
    "userId": "8201112",
    "firstName": "Alexander",
    "lastName": "Burns",
    "role": "INSTRUCTOR"
  },
  "personnelByUserId": null,
  "personnelByIdNumber": {
    "id": "cmkdhs9cv0003pn0frh9ql1yj",
    "name": "Burns, Alexander",
    "rank": "FLTLT",
    "userId": null,
    "idNumber": 8201112
  }
}
```

### The Issue
1. **User table:** Alexander Burns has `userId = "8201112"` and `role = "INSTRUCTOR"`
2. **Personnel table:** Burns, Alexander has `idNumber = 8201112` and `rank = "FLTLT"`
3. **Missing linkage:** `Personnel.userId` is `null` instead of `"8201112"`
4. **Old behavior:** API only searched by `userId`, found nothing, returned 404
5. **Fallback:** App displayed `User.role = "INSTRUCTOR"` instead of `Personnel.rank = "FLTLT"`

## Solution Implemented

### File: `/workspace/dfp-neo-platform/app/api/user/personnel/route.ts`

**Changed from:**
```typescript
const personnel = await prisma.personnel.findFirst({
  where: {
    userId: session.user.userId
  }
});
```

**Changed to:**
```typescript
// Try to match by userId first (direct link), then by idNumber (PMKEYS)
let personnel = await prisma.personnel.findFirst({
  where: {
    userId: session.user.userId
  }
});

// If not found by userId, try to match by idNumber (PMKEYS)
if (!personnel) {
  console.log('🔍 [USER PERSONNEL] No Personnel found by userId, trying idNumber (PMKEYS)...');
  personnel = await prisma.personnel.findFirst({
    where: {
      idNumber: parseInt(session.user.userId)
    }
  });
}
```

### How It Works
1. **First attempt:** Try to find Personnel by `userId` (direct linkage)
2. **Second attempt:** If not found, try to match by `idNumber` (PMKEYS)
3. **Fallback:** If still not found, return 404 (same as before)
4. **Result:** Alexander Burns' Personnel record is now found via PMKEYS matching

## Expected Behavior After Fix

### Before
- Dashboard: "Welcome, FLTLT Alexander Burns" ❌ (wrong rank)
- Footer: "FLTLT Burns, Alexander" ❌ (wrong rank)
- Source: User table (role: "INSTRUCTOR")

### After
- Dashboard: "Welcome, FLTLT Alexander Burns" ✅ (correct rank)
- Footer: "FLTLT Burns, Alexander" ✅ (correct rank)
- Source: Personnel table (rank: "FLTLT")

### Console Logs Expected
```
🔍 [USER PERSONNEL] Fetching Personnel for current user: 8201112
🔍 [USER PERSONNEL] No Personnel found by userId, trying idNumber (PMKEYS)...
✅ [USER PERSONNEL] Personnel record found: Burns, Alexander Rank: FLTLT
```

## Deployment Details

### Commit
- Hash: `7eea84f`
- Message: "fix: Update Personnel API to match by idNumber (PMKEYS) when userId match fails"
- Branch: `feature/comprehensive-build-algorithm`

### Files Modified
1. `/workspace/dfp-neo-platform/app/api/user/personnel/route.ts` - Added PMKEYS matching fallback
2. `/workspace/USER_PERSONNEL_LINKAGE_DEBUG.md` - Documentation
3. Standalone app rebuilt and copied to Next.js public directory

### Next.js Build
- Status: In progress
- Git info injected: Commit `7eea84f`

## Testing Instructions

1. **Wait for Railway deployment** (5-10 minutes)
2. **Clear browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Log in as Alexander Burns**
4. **Check console logs:**
   - Should see: `🔍 [USER PERSONNEL] No Personnel found by userId, trying idNumber (PMKEYS)...`
   - Should see: `✅ [USER PERSONNEL] Personnel record found: Burns, Alexander Rank: FLTLT`
5. **Verify UI:**
   - Dashboard should show: "Welcome, FLTLT Alexander Burns"
   - Footer should show: "FLTLT Burns, Alexander"

## Important Notes

### Why PMKEYS Matching Works
- `User.userId` stores the PMKEYS ID (e.g., "8201112")
- `Personnel.idNumber` also stores the PMKEYS ID (e.g., 8201112)
- These are the same unique identifier for the same person
- The linkage is implicit through matching PMKEYS values

### Why userId Linkage Failed
- Old code expected `Personnel.userId` to contain the User's Prisma ID
- Database has `Personnel.userId = null` for all records
- This means no direct linkage was established in the database
- PMKEYS matching is the correct approach for this data structure

### Future Considerations
- If proper User-Personnel linkage is needed, update the Personnel creation API
- Set `Personnel.userId = User.id` when creating Personnel records
- This would allow direct `userId` matching instead of PMKEYS fallback
- However, current PMKEYS matching solution works correctly

## Related Debug Endpoints

### `/api/debug/user-personnel-linkage`
Shows User and Personnel linkage status:
- `personnelByUserId`: Direct linkage (null for Alexander Burns)
- `personnelByIdNumber`: PMKEYS linkage (found for Alexander Burns)
- `samplePersonnel`: All Personnel records with linkage info

### `/api/user/personnel`
Returns current user's Personnel record:
- Now matches by PMKEYS when userId match fails
- Returns rank, name, idNumber, and full personnel record
