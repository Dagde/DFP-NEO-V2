# Permissions & Database Structure Analysis

## Executive Summary

**Current Status:**
- ✅ **Permission System EXISTS** in login database via User.role enum
- ❌ **NO separate databases** for Trainee/Staff profiles - they are in-memory mock data
- ⚠️ **Access control NOT implemented** - role-based restrictions are not enforced

---

## 1. Permissions System Analysis

### ✅ Current Permission Structure

**Location:** `prisma/schema.prisma` - User model

```prisma
model User {
  id              String   @id @default(cuid())
  userId          String   @unique  // Primary identifier (e.g., "john.pilot")
  username        String   @unique  // Legacy field (same as userId)
  email           String?  @unique
  password        String
  role            Role     @default(USER)  // ← PERMISSIONS HERE
  firstName       String?
  lastName        String?
  isActive        Boolean  @default(true)
  // ... other fields
}

enum Role {
  SUPER_ADMIN  // Full system access
  ADMIN        // Administrative access
  PILOT        // Pilot-specific features
  INSTRUCTOR   // Instructor-specific features
  USER         // Basic user access
}
```

### ✅ Role-Based Access Control (RBAC) is Available

The `role` field in the User table provides a **simple but effective permission system**:

| Role | Intended Use | Expected Access Level |
|------|--------------|----------------------|
| **SUPER_ADMIN** | System administrators | Full access to all features, user management, settings |
| **ADMIN** | Department managers | Admin functions, but not full system control |
| **PILOT** | Active pilots | Flight schedules, personal availability, limited admin |
| **INSTRUCTOR** | Flying instructors | Trainee management, scheduling, assessments |
| **USER** | Basic users | View-only access, personal profile updates |

---

## 2. Database Architecture Analysis

### ⚠️ CRITICAL: No Separate Trainee/Staff Databases

**Your Question:** "Confirm the users profile (Trainee Profile and Staff Profile) are separate databases to the login database?"

**Answer:** ❌ **NO - They are NOT separate databases.**

#### Current Architecture:

1. **Login Database (PostgreSQL - Railway)** ✅
   - Table: `User` - Authentication & user accounts
   - Table: `Personnel` - Staff records (209 records migrated)
   - Table: `Aircraft` - Aircraft data (27 records)
   - Table: `Schedule`, `Session`, `AuditLog`, etc.
   - Status: ✅ Connected and operational

2. **Trainee/Staff Profiles (In-Memory Mock Data)** ⚠️
   - Location: `/workspace/mockData.ts` (TypeScript arrays)
   - Structure: `Instructor[]`, `Trainee[]` interfaces in `types.ts`
   - Storage: React state (NOT in database)
   - Status: ❌ Lost on app restart/logout

### 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     LOGIN DATABASE (PostgreSQL)              │
├─────────────────────────────────────────────────────────────┤
│  User Table:                                                 │
│  ├─ userId: "john.pilot"                                     │
│  ├─ role: "PILOT"                                            │
│  ├─ password: [hashed]                                       │
│  └─ isActive: true                                           │
│                                                              │
│  Personnel Table:                                            │
│  ├─ userId: "john.pilot"                                     │
│  ├─ name: "John Smith"                                       │
│  ├─ role: "PILOT"                                            │
│  ├─ qualifications: {...}                                    │
│  └─ availability: {...}                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    (Linked via userId)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              IN-MEMORY MOCK DATA (React State)               │
├─────────────────────────────────────────────────────────────┤
│  Instructors[]:                                              │
│  ├─ idNumber: 001                                            │
│  ├─ name: "John Smith"                                       │
│  ├─ rank: "SQNLDR"                                           │
│  ├─ role: "QFI"                                              │
│  ├─ isTestingOfficer: true                                   │
│  └─ ... (20+ more properties)                                │
│                                                              │
│  Trainees[]:                                                 │
│  ├─ idNumber: 101                                            │
│  ├─ fullName: "Jane Doe"                                     │
│  ├─ rank: "OFFCDT"                                           │
│  ├─ course: "BPC+IPC"                                        │
│  ├─ isPaused: false                                          │
│  └─ ... (15+ more properties)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Access Control Implementation Status

### ❌ CURRENT STATE: NO Role-Based Access Control

**Evidence:**
1. **No middleware enforcing role restrictions**
   - File: `lib/mobile-middleware.ts`
   - Only checks if user is authenticated
   - Does NOT check user.role

2. **No route guards for admin pages**
   - Directory: `app/admin/`
   - Anyone logged in can access admin pages
   - No SUPER_ADMIN or ADMIN role checks

3. **No role-based UI visibility**
   - All features visible to all authenticated users
   - No conditional rendering based on role

### ✅ WHAT SHOULD BE IMPLEMENTED:

```typescript
// Example: Role-based middleware (NOT IMPLEMENTED)
export async function requireRole(allowedRoles: Role[]) {
  return async function middleware(request: NextRequest) {
    const { user, error } = await authenticateMobileRequest(request);
    
    if (error) return error;
    
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    return user;
  };
}

// Example: Usage in admin routes
const adminMiddleware = requireRole(['SUPER_ADMIN', 'ADMIN']);
const instructorMiddleware = requireRole(['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN']);
```

---

## 4. Answering Your Questions

### Q1: "Can you confirm there is a permissions field to restrict access to certain areas depending on the users position in the organisation?"

**Answer:** ✅ **YES, but NOT IMPLEMENTED**

- The `role` field EXISTS in the User table
- It CAN be used to restrict access
- Currently NOT enforcing any restrictions
- All authenticated users have access to all features

### Q2: "Does this permissions need to be in the login database if we have it in the users profile we can restrict access from there?"

**Answer:** ✅ **YES - Permissions should be in the login database**

**Reasons:**
1. **Security:** Login credentials + permissions in one place = easier security management
2. **Consistency:** Single source of truth for user access
3. **Simplicity:** No need to join multiple databases for permission checks
4. **Performance:** Permission checks are faster when in login database
5. **Best Practice:** Standard RBAC implementation pattern

**Current Implementation:**
- ✅ `User.role` field exists in login database (CORRECT)
- ✅ Already linked to Personnel records via `userId`
- ❌ Not being used to restrict access (NEEDS IMPLEMENTATION)

### Q3: "Confirm the users profile (Trainee Profile and Staff Profile) are separate databases to the login database we are dealing with now?"

**Answer:** ❌ **NO - They are NOT separate databases**

**Current Reality:**
- Login database: PostgreSQL (Railway) ✅
- Trainee/Staff profiles: In-memory mock data (React state) ❌

**Data Structure:**

| Data Type | Storage | Persistence | Schema |
|-----------|---------|-------------|--------|
| **User Accounts** | PostgreSQL (Railway) | ✅ Permanent | User table |
| **Personnel Records** | PostgreSQL (Railway) | ✅ Permanent | Personnel table |
| **Trainee Data** | React State (mockData.ts) | ❌ Lost on restart | TypeScript interface |
| **Staff Data** | React State (mockData.ts) | ❌ Lost on restart | TypeScript interface |
| **Syllabus/LMP** | React State (mockData.ts) | ❌ Lost on restart | TypeScript interface |

---

## 5. Recommended Architecture

### ✅ PROPOSED: Single Database with Role-Based Access

```
┌─────────────────────────────────────────────────────────────┐
│              SINGLE POSTGRESQL DATABASE (Railway)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐                                            │
│  │  User       │  ← LOGIN + PERMISSIONS                     │
│  │  ├─ userId  │                                            │
│  │  ├─ password│                                            │
│  │  └─ role    │  ← SUPER_ADMIN / ADMIN / PILOT / INSTRUCTOR│
│  └──────┬──────┘                                            │
│         │                                                   │
│         ├──────────────┬──────────────┐                      │
│         ↓              ↓              ↓                      │
│  ┌─────────────┐ ┌───────────┐ ┌──────────┐                │
│  │  Personnel  │ │ Trainee   │ │ Schedule │                │
│  │  (Staff)    │ │ Profile   │ │          │                │
│  └─────────────┘ └───────────┘ └──────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Access Control:
├─ Middleware checks User.role before granting access
├─ Role-based route guards
└─ Conditional UI rendering based on role
```

### 📋 Implementation Tasks:

1. **Phase 1: Role-Based Access Control (Priority)**
   - Create role-checking middleware
   - Protect admin routes with SUPER_ADMIN/ADMIN roles
   - Protect instructor features with INSTRUCTOR role
   - Protect pilot features with PILOT role

2. **Phase 2: Profile Migration (Future)**
   - Create TraineeProfile model in Prisma
   - Migrate trainee data from mockData.ts to database
   - Update Personnel table with additional fields from Staff interface
   - Remove dependency on in-memory mock data

3. **Phase 3: API Permissions (Future)**
   - Add role checks to all API endpoints
   - Implement permission-based data filtering
   - Add audit logging for permission changes

---

## 6. Summary

| Question | Answer | Status |
|----------|--------|--------|
| Permissions field exists? | ✅ Yes (User.role) | Available but not used |
| Should permissions be in login database? | ✅ Yes | Already there, correct |
| Separate databases for profiles? | ❌ No | Profiles are in-memory mock data |
| Access control implemented? | ❌ No | Need to add role-based restrictions |

**Next Steps:**
1. Implement role-based middleware to enforce access control
2. Create route guards for admin and instructor features
3. (Future) Migrate trainee/staff profiles to database
4. (Future) Remove dependency on mockData.ts