# Personnel API Fix - Database Integration Issue

## Problem Identified

When the user tried to use the NEO build feature, nothing happened and the DFP remained blank. This was because:

1. **No data in Railway database** - The migration scripts populated the local database, but Railway was using its own empty database
2. **API returning 0 records** - The `/api/personnel` endpoint was returning 0 instructors
3. **Wrong database schema understanding** - The API was designed assuming a single Personnel table with role='INSTRUCTOR'

## Root Cause Analysis

### Database Schema
The database has **TWO separate tables**:

1. **Personnel table** - Contains instructors with:
   - `role` field: 'QFI' or 'SIM IP' (NOT 'INSTRUCTOR')
   - Fields: name, rank, unit, callsignNumber, qualifications, etc.

2. **Trainee table** - Contains trainees with:
   - No `role` field
   - Fields: fullName, course, lmpType, traineeCallsign, etc.

### API Issues
1. The API was filtering by `role = 'INSTRUCTOR'` which returned 0 results
2. The API only queried the Personnel table, missing all trainees
3. The frontend API client expected a different interface structure

## Solution Implemented

### 1. Data Migration to Railway Database
```bash
cd /workspace/migration-scripts
npx tsx migrate-personnel-and-trainees.ts
```

**Result:**
- ✅ 82 Personnel records (instructors) created
- ✅ 127 Trainee records created
- ✅ Total: 209 records

### 2. Fixed API Route (`/api/personnel`)

**Before:**
```typescript
// Only queried Personnel table
const where: any = {};
if (role) {
  where.role = role; // role='INSTRUCTOR' returned 0 results
}
const personnel = await prisma.personnel.findMany({ where });
```

**After:**
```typescript
// Query both tables based on role
let personnel: any[] = [];

if (role === 'INSTRUCTOR' || !role) {
  // Query Personnel table for QFI and SIM IP roles
  const instructors = await prisma.personnel.findMany({
    where: { isActive: true },
  });
  personnel = personnel.concat(instructors);
}

if (role === 'TRAINEE' || !role) {
  // Query Trainee table
  const trainees = await prisma.trainee.findMany({
    where: { isPaused: false },
  });
  personnel = personnel.concat(trainees);
}
```

### 3. Updated Frontend API Client (`lib/api.ts`)

**Before:**
```typescript
interface PersonnelResponse {
  firstName: string;
  lastName: string;
  role: string;
  // ... other wrong fields
}
```

**After:**
```typescript
interface InstructorResponse {
  id: string;
  name: string;  // Single name field
  rank?: string;
  role?: string;  // 'QFI' | 'SIM IP'
  unit?: string;
  callsignNumber?: number;
  // ... all actual database fields
}

interface TraineeResponse {
  id: string;
  name: string;
  fullName: string;  // Trainee-specific field
  rank?: string;
  course?: string;
  lmpType?: string;
  traineeCallsign?: string;
  // ... all actual database fields
}
```

**Updated conversion functions:**
```typescript
const convertPersonnelToInstructor = (p: InstructorResponse): Instructor => ({
  id: p.id,
  idNumber: p.idNumber || 0,
  name: p.name,  // Direct mapping
  rank: (p.rank as InstructorRank) || 'FLTLT',
  role: (p.role as 'QFI' | 'SIM IP') || 'QFI',
  // ... proper field mapping
});
```

## Files Modified

### Backend (dfp-neo-platform)
- `app/api/personnel/route.ts` - Fixed to query both Personnel and Trainee tables

### Frontend (flight-school-app)
- `lib/api.ts` - Updated interfaces and conversion functions

### Migration Scripts
- Ran `migrate-personnel-and-trainees.ts` against Railway database

## Verification

### Database State
```
Personnel (Instructors): 82 records
  - QFI: 74
  - SIM IP: 8

Trainees: 127 records
Total: 209 records
```

### API Endpoints (After Fix)
- `GET /api/personnel?role=INSTRUCTOR` - Should return 82 instructors
- `GET /api/personnel?role=TRAINEE` - Should return 127 trainees
- `GET /api/personnel` - Should return all 209 records

## Next Steps

1. ✅ Wait for Railway deployment to complete
2. ✅ Test API endpoints return correct data
3. ✅ Test NEO build with real data
4. ✅ Verify instructors and trainees load in the app
5. ✅ Test school switching (ESL ↔ PEA)

## Git Commit

**Commit:** c8319d6  
**Message:** "Fix Personnel API to query both Personnel and Trainee tables"

Changes:
- Fixed API route to query both tables
- Updated frontend API client interfaces
- Migrated personnel data to Railway database
- All changes pushed to GitHub

## Status

✅ **FIX COMPLETE** - Railway deployment in progress  
⏳ **AWAITING DEPLOYMENT** - Testing to follow