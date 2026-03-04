# Rank Display Fix - Summary

## Problem
The application was displaying "Instructor" as the user's rank prefix instead of the actual military rank (e.g., "SQNLDR") from the Personnel table.

## Root Cause
The `sessionUser` state was storing the User table role ("INSTRUCTOR") in the `role` field, but this role was being used to display the user's military rank in the UI.

The User table has:
- `role`: "INSTRUCTOR", "SUPERVISOR", "ADMIN", etc. (NextAuth role)

The Personnel table has:
- `rank`: "FLTLT", "SQNLDR", "WGCDR", etc. (Military rank)

The application was fetching the military rank from `/api/user/personnel` endpoint and storing it in `actualRank` variable, but then setting `sessionUser.role = actualRank`, which overwrote the User table role. This created confusion and the UI was still showing "Instructor" from the User role.

## Solution
Added a separate `militaryRank` field to the `sessionUser` state to properly separate the two concepts:

1. **sessionUser.role**: User table role (INSTRUCTOR, SUPERVISOR, ADMIN)
2. **sessionUser.militaryRank**: Personnel table military rank (SQNLDR, FLTLT, etc.)

### Changes Made

#### 1. Updated sessionUser State Type (Line 3140)
```typescript
// Before:
const [sessionUser, setSessionUser] = useState<{firstName: string | null, lastName: string | null, role: string, userId: string} | null>(null);

// After:
const [sessionUser, setSessionUser] = useState<{firstName: string | null, lastName: string | null, role: string, militaryRank: string, userId: string} | null>(null);
```

#### 2. Updated setSessionUser Call (Lines 3187-3188)
```typescript
// Before:
setSessionUser({
    firstName: data.user.firstName || null,
    lastName: data.user.lastName || null,
    role: actualRank,
    userId: data.user.userId || ''
});

// After:
setSessionUser({
    firstName: data.user.firstName || null,
    lastName: data.user.lastName || null,
    role: data.user.role || 'INSTRUCTOR',  // User table role
    militaryRank: actualRank,               // Personnel table military rank
    userId: data.user.userId || ''
});
```

#### 3. Updated MyDashboard userRank Prop
```typescript
// Before:
userRank={sessionUser?.role || 'FLTLT'}

// After:
userRank={sessionUser?.militaryRank || sessionUser?.role || 'FLTLT'}
```

#### 4. Updated Other currentUserRank Props (Lines 8948, 9231)
```typescript
// Before:
currentUserRank={sessionUser?.role || currentUser?.rank || 'FLTLT'}

// After:
currentUserRank={sessionUser?.militaryRank || sessionUser?.role || currentUser?.rank || 'FLTLT'}
```

## Impact
- **MyDashboard**: Will now display "Welcome, SQNLDR Bloggs, Joe" instead of "Welcome, Instructor Bloggs, Joe"
- **All components using currentUserRank**: Will now display the military rank from Personnel table instead of the User table role
- **Backward compatibility**: Fallback chain ensures the app still works if militaryRank is not available

## Testing
1. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
2. Navigate to My Dashboard
3. Verify the welcome message shows the military rank (e.g., "Welcome, SQNLDR Last, First")
4. Check console logs for `[SESSION] Fetched actual rank from Personnel:` to confirm the API call is working

## Files Modified
- `/workspace/App.tsx`

## API Endpoint Used
- `/api/user/personnel` - Returns the Personnel record linked to the current user, including the military rank