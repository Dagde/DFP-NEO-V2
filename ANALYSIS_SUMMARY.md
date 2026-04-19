# DFP-NEO-V2 Repository Analysis
## Feature Branch: `feature/comprehensive-build-algorithm`

---

## Executive Summary

DFP-NEO-V2 is a comprehensive **Daily Flying Program (DFP) management system** for military flight training operations. It's a React/TypeScript application that automates the scheduling of flight training events, manages instructor and trainee assignments, tracks syllabus progress, and handles resource allocation for flight schools.

---

## 1. Technology Stack

| Category | Technology |
|----------|------------|
| **Frontend** | React 19.2, TypeScript 5.8, Vite 7.3 |
| **Backend** | Express.js, Node.js 20.x |
| **Database** | PostgreSQL with Prisma ORM 6.0 |
| **UI Libraries** | Bootstrap 5.3, Heroicons React |
| **PDF Generation** | jsPDF, html2canvas |
| **AI Integration** | Google Gemini AI (@google/genai) |

---

## 2. Project Structure

```
dfp-neo-v2/
├── App.tsx                    # Main application (716KB - massive component)
├── DFP-NEO-V2-fresh/          # Primary working directory
│   ├── current_build_algorithm.ts  # Core scheduling algorithm
│   ├── components/            # 200+ React components
│   ├── lib/                   # Data services, API, auth
│   ├── utils/                 # Utility functions
│   ├── prisma/               # Database schema
│   └── server.js             # Express backend
├── components/                # Shared components
├── types.ts                  # TypeScript type definitions
├── mockData.ts               # Mock data for testing
└── buildAlgorithmV2.ts       # New algorithm implementation
```

---

## 3. Core Build Algorithm

### 3.1 Purpose
The build algorithm automatically generates the Daily Flying Program by scheduling training events for aircrew trainees based on:
- Syllabus progress (Learning Management Plan - LMP)
- Instructor availability and qualifications
- Resource constraints (aircraft, FTDs, CPTs)
- Time windows (day/night flying)

### 3.2 Algorithm Flow

```
1. INITIALIZATION
   ├── Load configuration (build date, flying windows, resources)
   ├── Load instructor & trainee data
   ├── Load syllabus, scores, and priorities
   └── Pre-populate Highest Priority Events (fixed-time events)

2. COMPUTE NEXT EVENTS
   ├── Filter active trainees (not paused, not unavailable)
   ├── For each trainee:
   │   ├── Check individual LMP
   │   ├── Find completed events from scores
   │   ├── Apply ELCE (Effective Last Completed Event) logic
   │   ├── Determine NEXT event (first uncompleted, prerequisites met)
   │   └── Determine NEXT+1 event
   └── Categorize trainees: FLIGHT | FTD | CPT | GROUND | BNF | SOLO

3. RANK & PRIORITIZE
   ├── Sort by: days since last event → days since last flight → behind median → name
   └── Apply course priority rotation

4. NIGHT FLYING SETUP (if 2+ BNF trainees)
   ├── Randomize selection of night-eligible QFI instructors
   ├── PAIR night instructors with BNF trainees
   └── Mark night staff as unavailable for day events

5. SCHEDULE DUTY SUPERVISORS
   └── Assign duty supervisors for day/night windows

6. SCHEDULE EVENTS (in order)
   ├── Day Flights (Next → Next+1)
   ├── Day FTD (Next → Next+1)
   ├── Day CPT (Next → Next+1)
   ├── Day Ground (Next → Next+1)
   ├── Solo Flights (special handling)
   ├── Night Flights (BNF Wave 1 & 2)
   └── Night Duty Supervisor

7. OUTPUT
   └── Return generated events array
```

### 3.3 Key Constraints

| Constraint Type | Details |
|-----------------|---------|
| **Event Limits** | Instructors: max 2 Flight/FTD, max 3 total; Executives: max 1 Flight/FTD |
| **Duty Limits** | Soft limit: ~8 hours; Hard limit: ~10 hours |
| **Night Flying** | Requires minimum 2 BNF trainees; Night instructors cannot have day events |
| **Takeoff Constraints** | Max 8 takeoffs/hour; 5-minute minimum separation |
| **Turnaround** | Configurable per event type (flight, FTD, CPT) |

---

## 4. Data Models

### Core Entities

```typescript
// Instructor
interface Instructor {
  idNumber: number;
  name: string;
  rank: 'WGCDR' | 'SQNLDR' | 'FLTLT' | 'FLGOFF' | 'PLTOFF' | 'Mr';
  role: 'QFI' | 'SIM IP' | 'INSTRUCTOR';
  category: 'UnCat' | 'D' | 'C' | 'B' | 'A';
  isFlyingSupervisor: boolean;
  isExecutive: boolean;
  isTestingOfficer: boolean;
  unavailability: UnavailabilityPeriod[];
  location?: string;
  unit?: string;
}

// Trainee
interface Trainee {
  idNumber: number;
  fullName: string;
  rank: TraineeRank;
  course: string;
  seatConfig: SeatConfig;
  isPaused: boolean;
  unit: string;
  primaryInstructor?: string[];
  secondaryInstructor?: string[];
  unavailability: UnavailabilityPeriod[];
}

// ScheduleEvent
interface ScheduleEvent {
  id: string;
  date: string;
  type: 'flight' | 'ftd' | 'ground' | 'cpt' | 'deployment';
  instructor?: string;
  student?: string;
  flightNumber: string;
  duration: number;
  startTime: number;
  resourceId: string;
  flightType: 'Dual' | 'Solo';
  // ... many more fields
}
```

---

## 5. Recent Changes (Feature Branch)

### Commits (Latest 30)

| Commit | Description |
|--------|-------------|
| `f38fbde6` | Solo flights use standard dispatch logic with 09:00-15:00 window + grouping |
| `147d7049` | FTD duration 1.5hrs for all events + enforce ftdTurnaround spacing |
| `8c325834` | Solo scheduling fixes + Daily schedule persists after hard refresh |
| `17136996` | Solo flights now schedule correctly in night-only sessions |
| `c44ef077` | Persistent schedule after hard refresh + snapshot race condition fix |
| `28295f73` | Solo grouping + staff sharing unit enforcement |
| `2fd127c8` | Skip BNF3 scheduling + exclude night trainees from daytime STBY |

### Key Improvements
1. **Solo Flight Scheduling** - Special handling for solo events with time windows and grouping
2. **BNF (Basic Night Flying)** - BNF3 never auto-scheduled; night trainees excluded from day STBY
3. **Staff Sharing** - Cross-unit instructor eligibility based on sharing groups
4. **Persistence** - Schedule persists after hard refresh via snapshot save/load
5. **FTD Duration** - Standardized 1.5hr duration with proper turnaround spacing

---

## 6. Known Issues (Documented)

### Bug 1: Role Mismatch
- **Problem**: 93 DB instructors have `role='INSTRUCTOR'`, algorithm requires `role='QFI'`
- **Impact**: Only Burns (the only QFI) can be allocated to flights
- **Fix**: Update DB records to set `role='QFI'` for all flying instructors

### Bug 2: Night Reservation Lookup
- **Problem**: Uses `idNumber` for lookup, but all DB staff have `idNumber: null`
- **Impact**: Wrong instructor gets night reservation
- **Fix**: Change lookup to use `i.name === nfi.name`

### Bug 3: Missing Location Filter
- **Problem**: `instructorsData` useMemo has no location filter
- **Impact**: All 100 DB staff enter build regardless of school (ESL vs PEA)
- **Fix**: Add location filtering like traineesData

### Bug 4: Missing Supervisor Flags
- **Problem**: `isFlyingSupervisor: false` on all DB staff
- **Impact**: No DB instructor qualifies as Duty Supervisor
- **Fix**: Set flags on WGCDRs/SQNLDRs who are Flying Supervisors

---

## 7. Component Architecture

### Key Views/Pages
- `NeoOverview.tsx` - Main dashboard
- `ScheduleView.tsx` - Daily schedule display
- `PrioritiesView.tsx` - Trainee priority management
- `CourseProgressView.tsx` - Syllabus progress tracking
- `StaffView.tsx` - Instructor management
- `TraineeView.tsx` - Trainee management
- `BuildAnalysisView.tsx` - Build results analysis
- `CurrencyView.tsx` - Currency tracking

### Flyout Components (Modals)
- `FlightDetailModal.tsx` - Flight event details
- `InstructorProfileFlyout.tsx` - Instructor profiles
- `TraineeProfileFlyout.tsx` - Trainee profiles
- `SyllabusDetailFlyout.tsx` - Syllabus information

---

## 8. API Structure

### Endpoints (via Express server)
```
/api/instructors     - Staff CRUD operations
/api/trainees        - Trainee CRUD operations
/api/aircraft        - Aircraft management
/api/scores          - PT-051 scores
/api/schedule        - DFP schedule storage
/api/courses         - Course management
/api/syllabus        - Syllabus data
```

---

## 9. Database Schema (Prisma)

### Key Tables
- `User` - Authentication and user management
- `Personnel` - Instructor/staff data
- `Trainee` - Trainee data with course assignments
- `Schedule` - DFP schedule storage
- `Score` - PT-051 assessment scores
- `Aircraft` - Aircraft inventory
- `Course` - Course definitions
- `AuditLog` - System audit trail

---

## 10. Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `tsconfig.json` | TypeScript configuration |
| `prisma/schema.prisma` | Database schema |
| `nixpacks.toml` | Railway deployment config |
| `railway.json` | Railway settings |

---

## 11. Key Files to Understand

1. **`DFP-NEO-V2-fresh/current_build_algorithm.ts`** - Core scheduling logic
2. **`DFP-NEO-V2-fresh/App.tsx`** - Main React application
3. **`types.ts`** - All TypeScript interfaces
4. **`lib/dataService.ts`** - Data loading and merging
5. **`DFP-NEO-V2-fresh/server.js`** - Express backend

---

## 12. Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run git-sync   # Git automation sync
```

---

## Summary

The `feature/comprehensive-build-algorithm` branch represents a significant enhancement to the DFP scheduling system, with improvements to solo flight handling, night flying operations, staff sharing across units, and data persistence. The codebase is well-documented with extensive analysis files (BUILD_ALGORITHM_ANALYSIS.md, DFP-Build-Algorithm-Flow.md) explaining the complex scheduling logic.

**Ready to answer questions about any aspect of this repository.**