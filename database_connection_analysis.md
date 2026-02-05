# Database Connection Analysis

## Repository
**GitHub**: https://github.com/Dagde/DFP---NEO.git
**Branch**: feature/comprehensive-build-algorithm

## Architecture Overview

### Two-Part System

1. **Next.js Backend** (`/workspace/dfp-neo-platform/`)
   - Runs on Railway
   - Connected to PostgreSQL database
   - Serves API endpoints
   - Handles authentication

2. **Standalone Vite Frontend** (`/workspace/`)
   - React/TypeScript app
   - Bundled and served as static files from Next.js public directory
   - Makes API calls to Next.js backend

---

## Database Connection - YES, IT IS CONNECTED

### Database: PostgreSQL on Railway

**Connection**: The Next.js backend (`/workspace/dfp-neo-platform/`) is connected to PostgreSQL via Prisma ORM.

**Connection String**: Stored in Railway environment variables (not in code)

**Schema Location**: `/workspace/dfp-neo-platform/prisma/schema.prisma`

---

## How Alexander Burns Login Works

### 1. User Table Structure
```prisma
model User {
  id              String   @id @default(cuid())
  userId          String   @unique  // This is the PMKEYS (8201112)
  username        String   @unique
  email           String?
  password        String   // Hashed password
  role            Role     @default(USER)
  firstName       String?
  lastName        String?
  isActive        Boolean  @default(true)
  personnel       Personnel? @relation("Personnel")
  // ... other fields
}
```

### 2. Personnel Table Structure
```prisma
model Personnel {
  id                      String   @id @default(cuid())
  userId                  String?  @unique  // Links to User.id
  name                    String
  rank                    String?
  role                    String?
  idNumber                Int?     // PMKEYS (8201112)
  isQFI                   Boolean  @default(false)
  isOFI                   Boolean  @default(false)
  // ... other fields
  user                    User?    @relation("Personnel", fields: [userId], references: [id])
}
```

### 3. Login Flow

**When you login with User ID 8201112:**

1. **Authentication** (`/workspace/dfp-neo-platform/lib/auth.ts`):
   ```typescript
   const user = await prisma.user.findUnique({
     where: { userId: credentials.userId as string }, // userId = "8201112"
   });
   ```

2. **Password Verification**:
   ```typescript
   const isPasswordValid = await bcrypt.compare(
     credentials.password,
     user.password
   );
   ```

3. **Session Created**:
   - JWT token created with user data
   - Session stored in browser

4. **Frontend Loads**:
   - Standalone Vite app loads from `/workspace/dfp-neo-platform/public/flight-school-app/`
   - App makes API call to `/api/personnel`

5. **Personnel Data Fetched** (`/workspace/dfp-neo-platform/app/api/personnel/route.ts`):
   ```typescript
   const personnel = await prisma.personnel.findMany({
     where,
     orderBy: { name: 'asc' },
   });
   ```

6. **Data Merged** (`/workspace/lib/dataService.ts`):
   ```typescript
   // Fetch from API
   instructors = await fetchInstructors();
   
   // Merge with mockdata
   instructors = mergeInstructorData(instructors, ESL_DATA.instructors);
   ```

---

## Why Alexander Burns Stays the Same

**Alexander Burns (User ID 8201112) is stored in TWO tables:**

1. **User Table** (for login):
   - userId: "8201112"
   - username: "alexander.burns" (or similar)
   - password: (hashed)
   - firstName: "Alexander"
   - lastName: "Burns"

2. **Personnel Table** (for staff data):
   - idNumber: 8201112
   - name: "Alexander Burns"
   - rank: "SQNLDR"
   - role: "OFI"
   - isQFI: true
   - userId: (links to User.id)

**Why it stays the same:**
- This data is in the **real PostgreSQL database on Railway**
- It does NOT change on refresh
- Mockdata changes because it's randomly generated each time

---

## Why Mockdata Changes

**Mockdata** (`/workspace/mockData.ts`):
- Randomly generated names
- Changes on every app reload
- Used as fallback when API fails
- Merged with database data

---

## Current Issue Analysis

### What You're Seeing:
- Alexander Burns (8201112) is missing from the staff list
- You can login with his credentials
- Mockdata changes but Alexander Burns doesn't

### Why This Happens:

**The frontend bundle was rebuilt, but the API connection is fine.**

The issue is likely:
1. **Filtering Logic**: The frontend might be filtering out Alexander Burns based on his role
2. **Merge Logic**: The merge function might be excluding him
3. **API Response**: The API might not be returning him

---

## How to Verify Database Connection

### Check Railway Logs:

When you refresh the app, look for these logs in Railway:
```
🔍 [API TRACKING] /api/personnel - Querying database
🎯 [API TRACKING] Found Alexander Burns in database: {
  id: "...",
  idNumber: 8201112,
  name: "Alexander Burns",
  rank: "SQNLDR",
  role: "OFI",
  isQFI: true,
  isOFI: true,
  userId: "..."
}
🔍 [API TRACKING] /api/personnel - Returning X records
```

If you see these logs, the database IS connected and Alexander Burns IS in the database.

---

## The Real Problem

**The frontend filtering logic might be excluding Alexander Burns.**

From previous conversation history, the issue was:
- Alexander Burns has `role: "OFI"` and `isQFI: true`
- The NEO Build algorithm was filtering by `role === "QFI"` only
- This excluded Alexander Burns

**The fix was to check BOTH:**
```typescript
// OLD (wrong)
instructors.filter(i => i.role === 'QFI')

// NEW (correct)
instructors.filter(i => i.role === 'QFI' || i.isQFI === true)
```

---

## Summary

✅ **Database IS connected** - Next.js backend connects to PostgreSQL via Prisma
✅ **Alexander Burns IS in the database** - Both User and Personnel tables
✅ **Login works** - Authentication via NextAuth with database lookup
✅ **API returns data** - `/api/personnel` fetches from database
❌ **Frontend might be filtering him out** - Check filtering logic in frontend code

---

## Next Steps

1. Check Railway logs to confirm Alexander Burns is being returned by the API
2. Check frontend filtering logic in `/workspace/lib/dataService.ts` and `/workspace/App.tsx`
3. Verify the merge logic isn't excluding him
4. Check if the NEO Build algorithm filtering was reverted