# Staff & Trainee Profile - Database Field Comparison

## Executive Summary

**CRITICAL FINDING:** The current database schema is **MISSING 80%+ of the fields** required by the Staff and Trainee profile pages.

---

## 1. Staff Profile Field Analysis

### Fields in InstructorProfileFlyout.tsx vs Personnel Table

| Category | Field Name | Type | UI Required | Database | Status |
|----------|------------|------|-------------|----------|--------|
| **Basic Info** | | | | | |
| | `idNumber` | number | ✅ | ❌ MISSING | **CRITICAL** |
| | `name` | string | ✅ | ✅ `name` | ✅ Present |
| | `rank` | enum | ✅ | ✅ `rank` | ✅ Present |
| | `service` | enum | ✅ | ❌ MISSING | **CRITICAL** |
| | `role` | 'QFI' \| 'SIM IP' | ✅ | ❌ MISSING | **CRITICAL** |
| | `callsignNumber` | number | ✅ | ❌ MISSING | **CRITICAL** |
| **Qualifications** | | | | | |
| | `category` | enum | ✅ | ❌ MISSING | **CRITICAL** |
| | `seatConfig` | enum | ✅ | ❌ MISSING | **CRITICAL** |
| | `isTestingOfficer` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isExecutive` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isFlyingSupervisor` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isIRE` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isCommandingOfficer` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isCFI` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isDeputyFlightCommander` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isContractor` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isAdminStaff` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isQFI` | boolean | ✅ | ❌ MISSING | **CRITICAL** |
| | `isOFI` | boolean | ✅ | ❌ MISSING | ❌ MISSING | **CRITICAL** |
| **Assignment** | | | | | |
| | `location` | string | ✅ | ❌ MISSING | **CRITICAL** |
| | `unit` | string | ✅ | ❌ MISSING | **CRITICAL** |
| | `flight` | string | ✅ | ❌ MISSING | **CRITICAL** |
| **Contact** | | | | | |
| | `phoneNumber` | string | ✅ | ❌ MISSING | **CRITICAL** |
| | `email` | string | ✅ | ❌ MISSING | **CRITICAL** |
| **Permissions** | | | | | |
| | `permissions` | string[] | ✅ | ❌ MISSING | **CRITICAL** |
| **Unavailability** | | | | | |
| | `unavailability` | array | ✅ | ✅ `availability` (JSON) | ⚠️ Partial |
| **Logbook** | | | | | |
| | `priorExperience` | complex object | ✅ | ❌ MISSING | **CRITICAL** |

### Current Personnel Table Structure

```prisma
model Personnel {
  id             String   @id @default(cuid())
  userId         String
  name           String
  rank           String?              // ✅ Present
  role           String               // ⚠️ Generic string, not enum
  qualifications Json?                // ⚠️ Generic JSON
  availability   Json?                // ⚠️ Generic JSON (should be unavailability)
  preferences    Json?                // ❌ Not used in UI
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation("Personnel", fields: [userId], references: [id])
}
```

### **PROBLEMS IDENTIFIED:**

1. **Only 4 out of 30+ fields present** (13% coverage)
2. `qualifications` and `availability` are generic JSON - no structure
3. No dedicated fields for boolean flags (isTestingOfficer, isExecutive, etc.)
4. No contact information fields
5. No logbook experience tracking
6. No permissions array

---

## 2. Trainee Profile Field Analysis

### Fields in TraineeProfileFlyout.tsx vs Missing Trainee Table

**CRITICAL:** There is **NO Trainee table** in the database schema at all!

| Category | Field Name | Type | UI Required | Database | Status |
|----------|------------|------|-------------|----------|--------|
| **Basic Info** | | | | | |
| | `idNumber` | number | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `name` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `fullName` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `rank` | enum | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `service` | enum | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `course` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `lmpType` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `traineeCallsign` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Status** | | | | | |
| | `seatConfig` | enum | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `isPaused` | boolean | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `unavailability` | array | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Assignment** | | | | | |
| | `unit` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `flight` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `location` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Contact** | | | | | |
| | `phoneNumber` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `email` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Instructors** | | | | | |
| | `primaryInstructor` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `secondaryInstructor` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Progress** | | | | | |
| | `lastEventDate` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `lastFlightDate` | string | ✅ | ❌ NO TABLE | **CRITICAL** |
| | `currencyStatus` | array | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Permissions** | | | | | |
| | `permissions` | string[] | ✅ | ❌ NO TABLE | **CRITICAL** |
| **Logbook** | | | | | |
| | `priorExperience` | complex object | ✅ | ❌ NO TABLE | **CRITICAL** |

### **CRITICAL PROBLEM:**
**The Trainee table does not exist in the database at all.**

All trainee data is currently stored in:
- `mockData.ts` (TypeScript arrays in memory)
- React state (lost on refresh/restart)

---

## 3. Detailed Field Analysis

### 3.1 Instructor Interface (from types.ts)

```typescript
interface Instructor {
  idNumber: number;
  name: string;
  rank: InstructorRank;
  role: 'QFI' | 'SIM IP';
  callsignNumber: number;
  service?: 'RAAF' | 'RAN' | 'ARA';
  category: InstructorCategory;
  isTestingOfficer: boolean;
  seatConfig: SeatConfig;
  isExecutive: boolean;
  isFlyingSupervisor: boolean;
  isIRE: boolean;
  isCommandingOfficer?: boolean;
  isCFI?: boolean;
  isDeputyFlightCommander?: boolean;
  isContractor?: boolean;
  isAdminStaff?: boolean;
  isQFI?: boolean;
  isOFI?: boolean;
  unavailability: UnavailabilityPeriod[];
  location?: string;
  unit?: string;
  flight?: string;
  phoneNumber?: string;
  email?: string;
  primaryInstructor?: string;  // For cross-training
  secondaryInstructor?: string;
  permissions?: string[];
  priorExperience?: LogbookExperience;
}
```

### 3.2 Trainee Interface (from types.ts)

```typescript
interface Trainee {
  idNumber: number;
  fullName: string;
  name: string;
  rank: TraineeRank;
  course: string;
  seatConfig: SeatConfig;
  isPaused: boolean;
  unit: string;
  flight?: string;
  service?: 'RAAF' | 'RAN' | 'ARA';
  unavailability: UnavailabilityPeriod[];
  lastEventDate?: string;
  lastFlightDate?: string;
  currencyStatus?: PersonCurrencyStatus[];
  location?: string;
  phoneNumber?: string;
  email?: string;
  primaryInstructor?: string;
  secondaryInstructor?: string;
  lmpType?: string;
  traineeCallsign?: string;
  permissions?: string[];
  priorExperience?: LogbookExperience;
}
```

### 3.3 LogbookExperience Interface

```typescript
interface LogbookExperience {
  day: { p1: number; p2: number; dual: number };
  night: { p1: number; p2: number; dual: number };
  total: number;
  captain: number;
  instructor: number;
  instrument: { sim: number; actual: number };
  simulator: { p1: number; p2: number; dual: number; total: number };
}
```

---

## 4. Recommended Database Schema Updates

### 4.1 Updated Personnel Table

```prisma
model Personnel {
  id                       String   @id @default(cuid())
  userId                   String   // Links to User table
  
  // Basic Information
  idNumber                 Int      @unique  // PMKeys/ID
  name                     String
  rank                     String   // WGCDR, SQNLDR, FLTLT, FLGOFF, PLTOFF, Mr
  service                  String?  // 'RAAF', 'RAN', 'ARA'
  role                     String?  // 'QFI', 'SIM IP'
  callsignNumber           Int?
  
  // Qualifications & Roles (Boolean flags)
  category                 String?  // 'A2', 'B1', 'B2', 'C1', 'C2', 'INSTRUCTOR'
  seatConfig               String?  // 'Normal', 'FWD/SHORT', 'REAR/SHORT', 'FWD/LONG'
  isTestingOfficer         Boolean  @default(false)
  isExecutive              Boolean  @default(false)
  isFlyingSupervisor       Boolean  @default(false)
  isIRE                    Boolean  @default(false)
  isCommandingOfficer      Boolean  @default(false)
  isCFI                    Boolean  @default(false)
  isDeputyFlightCommander  Boolean  @default(false)
  isContractor             Boolean  @default(false)
  isAdminStaff             Boolean  @default(false)
  isQFI                    Boolean  @default(false)
  isOFI                    Boolean  @default(false)
  
  // Assignment
  location                 String?
  unit                     String?
  flight                   String?
  
  // Contact
  phoneNumber              String?
  email                    String?
  
  // Permissions
  permissions              String[] // ['Trainee', 'Staff', 'Ops', 'Scheduler', 'Course Supervisor', 'Admin', 'Super Admin']
  
  // Unavailability
  unavailability           Json?    // Array of UnavailabilityPeriod objects
  
  // Logbook Experience
  priorExperience          Json?    // LogbookExperience object
  
  // Metadata
  isActive                 Boolean  @default(true)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  
  // Relations
  user                     User     @relation("Personnel", fields: [userId], references: [id])
  
  @@index([userId])
  @@index([idNumber])
  @@index([role])
  @@index([isActive])
}
```

### 4.2 New Trainee Table

```prisma
model Trainee {
  id                       String   @id @default(cuid())
  userId                   String?  // Links to User table (optional - trainees may not have login)
  
  // Basic Information
  idNumber                 Int      @unique  // PMKeys/ID
  name                     String
  fullName                 String   // "Name – Course"
  rank                     String   // OFFCDT, PLTOFF, SQNLDR, WGCDR
  service                  String?  // 'RAAF', 'RAN', 'ARA'
  course                   String   // 'BPC+IPC', 'FIC', 'OFI', 'WSO', etc.
  lmpType                  String?  @default('BPC+IPC')
  traineeCallsign          String?
  
  // Status
  seatConfig               String?  // 'Normal', 'FWD/SHORT', 'REAR/SHORT', 'FWD/LONG'
  isPaused                 Boolean  @default(false)
  
  // Unavailability
  unavailability           Json?    // Array of UnavailabilityPeriod objects
  
  // Assignment
  unit                     String
  flight                   String?
  location                 String?
  
  // Contact
  phoneNumber              String?
  email                    String?
  
  // Instructors
  primaryInstructor        String?  // Instructor name
  secondaryInstructor      String?  // Instructor name
  
  // Progress Tracking
  lastEventDate            DateTime?
  lastFlightDate           DateTime?
  currencyStatus           Json?    // Array of PersonCurrencyStatus objects
  
  // Permissions
  permissions              String[]
  
  // Logbook Experience
  priorExperience          Json?    // LogbookExperience object
  
  // Metadata
  isActive                 Boolean  @default(true)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  
  // Relations
  user                     User?    @relation("TraineeUser", fields: [userId], references: [id])
  
  @@index([userId])
  @@index([idNumber])
  @@index([course])
  @@index([unit])
  @@index([isActive])
}
```

### 4.3 Update User Table with Trainee Relation

```prisma
model User {
  // ... existing fields ...
  
  // Add trainee relation
  trainees                Trainee[] @relation("TraineeUser")
  
  // ... rest of existing fields ...
}
```

---

## 5. Migration Strategy

### Phase 1: Update Personnel Table
1. Add missing fields to Personnel table
2. Create migration script to convert existing `qualifications` JSON to individual fields
3. Migrate `availability` JSON to `unavailability` JSON
4. Add boolean flags for all qualification roles

### Phase 2: Create Trainee Table
1. Create new Trainee table with all required fields
2. Create migration script to import trainees from `mockData.ts`
3. Link trainees to existing User accounts (where applicable)

### Phase 3: Update API Routes
1. Update Personnel API routes to handle new fields
2. Create Trainee API routes (CRUD operations)
3. Implement permission checking on all routes

### Phase 4: Update Frontend
1. Update InstructorProfileFlyout to use database instead of mock data
2. Update TraineeProfileFlyout to use database instead of mock data
3. Remove dependency on `mockData.ts`

---

## 6. Summary

| Profile Type | Fields Required | Fields in DB | Coverage |
|--------------|-----------------|--------------|----------|
| **Staff** | 32 | 4 | **12.5%** |
| **Trainee** | 24 | 0 | **0%** (NO TABLE) |

### Critical Issues:
1. ❌ Staff table missing 28 out of 32 fields
2. ❌ Trainee table does not exist
3. ❌ No structured logbook experience tracking
4. ❌ No permission system integration
5. ❌ All profile data is in mock data (lost on restart)

### Recommendations:
1. **IMMEDIATE:** Create Trainee table with all required fields
2. **IMMEDIATE:** Update Personnel table with missing fields
3. **HIGH:** Create migration scripts to move data from mockData.ts to database
4. **HIGH:** Implement role-based access control using User.role field
5. **MEDIUM:** Create API routes for Staff and Trainee profile CRUD operations