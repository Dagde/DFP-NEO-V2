# NEO BUILD Technical Documentation
## Daily Flying Program (DFP) Generation System

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Data Models & Schema](#data-models--schema)
7. [The NEO BUILD Algorithm](#the-neo-build-algorithm)
8. [DFP Generation Workflow](#dfp-generation-workflow)
9. [Build Variables & Parameters](#build-variables--parameters)
10. [Active DFP Publishing](#active-dfp-publishing)
11. [API Endpoints](#api-endpoints)
12. [Key Functions & Utilities](#key-functions--utilities)

---

## 1. Architecture Overview

NEO BUILD is a sophisticated scheduling application for military flight training that automates the generation of Daily Flying Programs (DFPs). The system combines a standalone React frontend with a Next.js backend wrapper, utilizing PostgreSQL for data persistence.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
│  (React Standalone App - Static Assets in Next.js Public)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP Requests
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Next.js API Layer                          │
│  (API Routes - /api/* handlers)                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Prisma ORM
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  (Personnel, Trainees, DFPs, Schedules, Events, etc.)       │
└─────────────────────────────────────────────────────────────┘
```

### Dual Deployment Structure

1. **Standalone React App** (`/workspace`):
   - Built with Vite
   - Contains all UI components, scheduling logic, and NEO BUILD algorithm
   - Served as static assets from Next.js public directory

2. **Next.js Wrapper** (`/workspace/dfp-neo-platform`):
   - Provides API endpoints
   - Handles authentication (NextAuth v5)
   - Serves static React app
   - Manages database connections

---

## 2. Technology Stack

### Frontend
- **React 18+**: Component-based UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite 6.x**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Heroicons**: SVG icon library
- **React Hot Toast**: Toast notifications
- **html2canvas**: Screenshot generation

### Backend
- **Next.js 14+**: React framework with API routes
- **Node.js**: JavaScript runtime
- **NextAuth v5**: Authentication
- **Prisma ORM**: Database ORM
- **PostgreSQL**: Relational database

### Development Tools
- **Git**: Version control
- **Railway**: Cloud deployment platform
- **Nixpacks**: Container configuration

---

## 3. Project Structure

```
/workspace/
├── components/              # React components
│   ├── SettingsViewWithMenu.tsx
│   ├── InstructorListView.tsx
│   ├── StaffDatabaseTable.tsx
│   ├── UserListSection.tsx
│   ├── DarkMessageModal.tsx
│   ├── AuditButton.tsx
│   └── ...
├── lib/                     # Utility libraries
├── utils/                   # Helper functions
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
├── mockData.ts             # Mock data generators
├── App.tsx                 # Main React application
├── index.tsx               # Application entry point
├── package.json            # Dependencies
│
├── dfp-neo-platform/       # Next.js wrapper
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── personnel/  # Personnel CRUD
│   │   │   ├── users/      # User management
│   │   │   ├── trainees/   # Trainee management
│   │   │   ├── dfps/       # DFP operations
│   │   │   ├── schedules/  # Schedule operations
│   │   │   └── auth/       # Authentication
│   │   ├── admin/          # Admin dashboard
│   │   └── flight-school/  # Main app wrapper
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   ├── lib/
│   │   └── auth.ts         # NextAuth configuration
│   ├── public/
│   │   └── flight-school-app/  # Built React app assets
│   └── package.json        # Next.js dependencies
│
└── migration-scripts/      # Database migration utilities
    └── migrate-personnel-and-trainees.ts
```

---

## 4. Frontend Architecture

### Component Hierarchy

```
App.tsx (Main Application)
├── InstructorListView.tsx (STAFF tab)
├── SettingsViewWithMenu.tsx (SETTINGS tab)
│   ├── UserListSection.tsx
│   ├── StaffDatabaseTable.tsx
│   └── ...
├── ScheduleView (Main scheduling interface)
├── NEOBuildAlgorithm (DFP generation)
└── DarkMessageModal.tsx (Global modal)
```

### State Management

The application uses React's built-in `useState` and `useEffect` hooks for state management:

**Key State Variables in App.tsx:**
- `instructorsData`: Array of Instructor objects (staff)
- `traineesData`: Array of Trainee objects
- `events`: Array of ScheduleEvent objects
- `activeView`: Current active tab/view
- `date`: Current selected date
- `selectedEvent`: Currently selected schedule event
- `conflict`: Conflict detection state
- `showPrePost`: Toggle for pre/post flight times
- `timezoneOffset`: User's timezone offset

### Data Flow

```
User Action
    ↓
Component State Update
    ↓
Re-render
    ↓
API Call (if needed)
    ↓
Backend Response
    ↓
State Update
    ↓
UI Update
```

---

## 5. Backend Architecture

### Next.js API Routes

API routes follow RESTful conventions:

#### Personnel API (`/api/personnel`)
- `GET /api/personnel` - Fetch all personnel
  - Query params: `role`, `available`, `search`
  - Returns: `{ personnel: Personnel[] }`
  - Authentication: Required (NextAuth session)
- `POST /api/personnel` - Create new personnel
- `PUT /api/personnel/:id` - Update personnel
- `DELETE /api/personnel/:id` - Delete personnel

#### Users API (`/api/users`)
- `GET /api/users` - Fetch all users (staff + trainees)
- Returns: Array of User objects

#### Trainees API (`/api/trainees`)
- `GET /api/trainees` - Fetch all trainees
- `POST /api/trainees` - Create new trainee
- `PUT /api/trainees/:id` - Update trainee
- `DELETE /api/trainees/:id` - Delete trainee

#### DFPs API (`/api/dfps`)
- `GET /api/dfps` - Fetch all DFPs
- `POST /api/dfps` - Create new DFP
- `PUT /api/dfps/:id` - Update DFP
- `DELETE /api/dfps/:id` - Delete DFP

#### Schedules API (`/api/schedules`)
- `GET /api/schedules` - Fetch schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule

### Authentication (NextAuth v5)

Configuration in `dfp-neo-platform/lib/auth.ts`:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      // Credentials-based authentication
    }),
    // Additional providers can be added
  ],
  callbacks: {
    async session({ session, user }) {
      // Customize session object
      return session;
    },
    async jwt({ token, user }) {
      // Customize JWT token
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
});
```

---

## 6. Data Models & Schema

### Prisma Schema (`dfp-neo-platform/prisma/schema.prisma`)

#### User Model
```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          String    @default("USER")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  personnel     Personnel?
  trainee       Trainee?
  
  @@index([email])
}
```

#### Personnel Model
```prisma
model Personnel {
  id                      String   @id @default(cuid())
  userId                  String?  @unique
  name                    String
  rank                    String?
  role                    String?           // QFI, SIM_IP, etc.
  category                String?           // UnCat, D, C, B, A
  service                 String?           // RAAF, RAN, ARA
  location                String?
  unit                    String?
  flight                  String?
  idNumber                Int?              // PMKEYS ID
  callsignNumber          Int?
  email                   String?
  phoneNumber             String?
  
  // Boolean flags for qualifications/roles
  isQFI                   Boolean  @default(false)
  isOFI                   Boolean  @default(false)
  isCFI                   Boolean  @default(false)
  isIRE                   Boolean  @default(false)
  isTestingOfficer        Boolean  @default(false)
  isCommandingOfficer     Boolean  @default(false)
  isExecutive             Boolean  @default(false)
  isFlyingSupervisor      Boolean  @default(false)
  isDeputyFlightCommander Boolean  @default(false)
  isContractor            Boolean  @default(false)
  isAdminStaff            Boolean  @default(false)
  
  isActive                Boolean  @default(true)
  permissions             String[] @default([])
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  
  user                    User?    @relation("Personnel", fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([idNumber])
}
```

#### Trainee Model
```prisma
model Trainee {
  id               String   @id @default(cuid())
  userId           String?  @unique
  name             String
  fullName         String
  rank             String?
  service          String?
  course           String?  // BPC+IPC, etc.
  lmpType          String?  // Type of training
  idNumber         Int?     // PMKEYS ID
  traineeCallsign  String?
  flight           String?
  courseProgress   Json?    // Progress tracking
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  user             User?    @relation("Trainee", fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([idNumber])
}
```

#### DFP Model
```prisma
model DFP {
  id              String   @id @default(cuid())
  title           String
  date            DateTime
  location        String
  status          String   @default("DRAFT") // DRAFT, ACTIVE, ARCHIVED
  version         Int      @default(1)
  events          Json     // Array of scheduled events
  metadata        Json?    // Build parameters, conflicts, etc.
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([date])
  @@index([status])
}
```

#### Schedule Model
```prisma
model Schedule {
  id          String   @id @default(cuid())
  name        String
  events      Json     // Array of ScheduleEvent
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### TypeScript Types

#### Instructor Type
```typescript
interface Instructor {
  idNumber: number;
  name: string;
  rank: string;
  role: 'QFI' | 'SIM_IP' | 'OBSERVER' | 'TESTING_OFFICER';
  callsignNumber: number;
  service: 'RAAF' | 'RAN' | 'ARA';
  category: 'UnCat' | 'D' | 'C' | 'B' | 'A';
  location: string;
  unit: string;
  flight: string;
  email?: string;
  phoneNumber?: string;
  isQFI: boolean;
  isOFI: boolean;
  isTestingOfficer: boolean;
  isExecutive: boolean;
  isFlyingSupervisor: boolean;
  isCommandingOfficer: boolean;
  isCFI: boolean;
  isDeputyFlightCommander: boolean;
  isContractor: boolean;
  isAdminStaff: boolean;
  unavailability?: AvailabilityPeriod[];
  priorExperience?: PriorExperience;
  seatConfig: 'Normal' | 'Rear Seat Only';
  permissions?: string[];
  // ... additional fields
}
```

#### Trainee Type
```typescript
interface Trainee {
  idNumber: number;
  fullName: string;
  name: string;
  rank: string;
  service: 'RAAF' | 'RAN' | 'ARA';
  course: string;
  lmpType: string;
  traineeCallsign: number;
  flight: string;
  courseProgress: CourseProgress;
  // ... additional fields
}
```

#### ScheduleEvent Type
```typescript
interface ScheduleEvent {
  id: string;
  code: string;
  description: string;
  phase: string;
  module: string;
  type: 'Flight' | 'FTD' | 'Ground School';
  dayNight: 'Day' | 'Night' | 'Day/Night';
  startTime: string;      // HH:MM format
  endTime: string;        // HH:MM format
  duration: number;       // hours
  flightOrSimHours: number;
  preFlightTime: number;
  postFlightTime: number;
  location: string;
  methodOfDelivery: string[];
  instructor?: string;
  student?: string;
  resourcesPhysical: string[];
  resourcesHuman: string[];
  sortieType?: 'Dual' | 'Solo';
  twrDiReqd?: 'YES' | 'NO';
  cctOnly?: 'YES' | 'NO';
  isPrePost?: boolean;
  // ... additional fields
}
```

---

## 7. The NEO BUILD Algorithm

### Overview

The NEO BUILD Algorithm is a sophisticated constraint satisfaction and optimization system that generates Daily Flying Programs (DFPs) for military flight training. It considers multiple constraints, resources, and business rules to create optimal schedules.

### Algorithm Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NEO BUILD ALGORITHM                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Input Stage   │   │ Optimization  │   │ Validation    │
│               │   │ Stage         │   │ Stage         │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Stage 1: Input Preparation

#### Data Collection

The algorithm requires the following inputs:

**1. Instructor Data** (`instructorsData`)
- Available instructors with qualifications
- Unavailability periods
- Category ratings (UnCat, D, C, B, A)
- Roles (QFI, SIM_IP, etc.)
- Prior experience

**2. Trainee Data** (`traineesData`)
- Active trainees
- Course progress
- Current syllabus item
- Flight readiness status

**3. Syllabus Data** (`syllabus`)
- All syllabus items (BGF, BIF, BNF, etc.)
- Prerequisites (ground, flying)
- Resources required
- Time requirements

**4. Resource Data**
- Available aircraft
- Simulator availability
- FTD capacity
- Classroom availability

**5. Business Rules**
- Duty turnaround times
- Event limits per instructor
- Currency requirements
- Qualification requirements
- Testing officer requirements

### Stage 2: Constraint Analysis

#### Time Constraints

```typescript
// Time availability check
const isTimeSlotAvailable = (
  instructor: Instructor,
  startTime: string,
  endTime: string,
  events: ScheduleEvent[]
): boolean => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  // Check instructor's unavailability
  for (const unavail of instructor.unavailability || []) {
    if (timeOverlaps(start, end, unavail.start, unavail.end)) {
      return false;
    }
  }
  
  // Check existing events
  for (const event of events) {
    if (event.instructor === instructor.name) {
      const eventStart = timeToMinutes(event.startTime);
      const eventEnd = timeToMinutes(event.endTime);
      
      // Apply duty turnaround time
      const requiredGap = getDutyTurnaroundTime(
        event.type,
        event.dayNight
      );
      
      if (end + requiredGap > eventStart - requiredGap) {
        return false;
      }
    }
  }
  
  return true;
};
```

#### Qualification Constraints

```typescript
// Check if instructor is qualified for event
const isInstructorQualified = (
  instructor: Instructor,
  event: SyllabusItem
): boolean => {
  // Check role
  if (event.type === 'Flight' && !instructor.isQFI) return false;
  if (event.type === 'FTD' && !instructor.isOFI) return false;
  
  // Check category
  const requiredCategory = event.minCategory || 'D';
  const categoryLevels = ['UnCat', 'D', 'C', 'B', 'A'];
  const instructorLevel = categoryLevels.indexOf(instructor.category);
  const requiredLevel = categoryLevels.indexOf(requiredCategory);
  
  if (instructorLevel < requiredLevel) return false;
  
  // Check testing officer requirement
  if (event.requiresTestingOfficer && !instructor.isTestingOfficer) {
    return false;
  }
  
  // Check prior experience if required
  if (event.requiresPriorExperience) {
    const hasExperience = instructor.priorExperience?.some(
      exp => exp.code === event.code
    );
    if (!hasExperience) return false;
  }
  
  return true;
};
```

#### Prerequisite Constraints

```typescript
// Check if trainee has completed prerequisites
const arePrerequisitesMet = (
  trainee: Trainee,
  event: SyllabusItem,
  completedEvents: string[]
): boolean => {
  // Check ground prerequisites
  for (const prereq of event.prerequisitesGround || []) {
    if (!completedEvents.includes(prereq)) {
      return false;
    }
  }
  
  // Check flying prerequisites
  for (const prereq of event.prerequisitesFlying || []) {
    if (!completedEvents.includes(prereq)) {
      return false;
    }
  }
  
  // Check course progress
  if (trainee.courseProgress) {
    const currentPhase = trainee.courseProgress.currentPhase;
    if (event.phase !== currentPhase && event.phase !== 'All') {
      return false;
    }
  }
  
  return true;
};
```

### Stage 3: Candidate Generation

For each trainee and each syllabus item, generate candidate events:

```typescript
interface CandidateEvent {
  event: SyllabusItem;
  instructor: Instructor;
  trainee: Trainee;
  startTime: string;
  endTime: string;
  priority: number;
  score: number;
}

const generateCandidates = (
  trainee: Trainee,
  instructors: Instructor[],
  events: ScheduleEvent[],
  syllabus: SyllabusItem[]
): CandidateEvent[] => {
  const candidates: CandidateEvent[] = [];
  
  // Get next syllabus item for trainee
  const nextItem = getNextSyllabusItem(trainee, syllabus, events);
  if (!nextItem) return candidates;
  
  // Check prerequisites
  const completedEvents = getCompletedEvents(trainee, events);
  if (!arePrerequisitesMet(trainee, nextItem, completedEvents)) {
    return candidates;
  }
  
  // Find qualified instructors
  const qualifiedInstructors = instructors.filter(inst =>
    isInstructorQualified(inst, nextItem)
  );
  
  // Generate time slots
  const timeSlots = generateTimeSlots(
    nextItem,
    trainee.courseProgress?.currentPhase || 'BGF'
  );
  
  // For each instructor and time slot
  for (const instructor of qualifiedInstructors) {
    for (const timeSlot of timeSlots) {
      // Check availability
      if (isTimeSlotAvailable(instructor, timeSlot.start, timeSlot.end, events)) {
        // Check trainee availability
        if (isTraineeAvailable(trainee, timeSlot.start, timeSlot.end, events)) {
          // Calculate priority and score
          const priority = calculatePriority(
            trainee,
            nextItem,
            instructor
          );
          const score = calculateScore(
            trainee,
            nextItem,
            instructor,
            timeSlot
          );
          
          candidates.push({
            event: nextItem,
            instructor,
            trainee,
            startTime: timeSlot.start,
            endTime: timeSlot.end,
            priority,
            score
          });
        }
      }
    }
  }
  
  return candidates;
};
```

### Stage 4: Scoring & Prioritization

#### Priority Calculation

Events are prioritized based on:

1. **Course Progress**: Trainees closer to course completion get higher priority
2. **Critical Events**: Solo checks, proficiency tests have highest priority
3. **Unavailability**: Trainees nearing unavailability windows get higher priority
4. **Currency**: Instructors needing currency events get priority

```typescript
const calculatePriority = (
  trainee: Trainee,
  event: SyllabusItem,
  instructor: Instructor
): number => {
  let priority = 0;
  
  // Base priority from syllabus importance
  if (event.isCritical) priority += 100;
  if (event.isCheck) priority += 50;
  if (event.isSolo) priority += 75;
  
  // Course progress (higher for trainees further along)
  const progress = calculateCourseProgress(trainee);
  priority += Math.floor(progress * 10);
  
  // Trainee unavailability urgency
  const upcomingUnavailability = getUpcomingUnavailability(trainee);
  if (upcomingUnavailability) {
    priority += (100 - upcomingUnavailability.daysUntil);
  }
  
  // Instructor currency
  if (instructorNeedsCurrency(instructor, event)) {
    priority += 20;
  }
  
  return priority;
};
```

#### Score Calculation

Each candidate gets a comprehensive score:

```typescript
const calculateScore = (
  trainee: Trainee,
  event: SyllabusItem,
  instructor: Instructor,
  timeSlot: TimeSlot
): number => {
  let score = 0;
  
  // Instructor-trainee pairing score (prefer consistent pairs)
  const pairingScore = getPairingScore(trainee, instructor);
  score += pairingScore * 10;
  
  // Time slot preference (some times are better for certain events)
  const timeScore = getTimePreferenceScore(event, timeSlot);
  score += timeScore;
  
  // Instructor workload balance (prefer less loaded instructors)
  const workloadScore = getWorkloadBalanceScore(instructor, events);
  score += workloadScore * 5;
  
  // Resource availability
  const resourceScore = getResourceAvailabilityScore(event, timeSlot);
  score += resourceScore;
  
  // Category appropriateness (prefer higher category instructors for harder events)
  const categoryScore = getCategoryScore(instructor.category, event);
  score += categoryScore * 3;
  
  return score;
};
```

### Stage 5: Conflict Detection & Resolution

#### Conflict Types

1. **Time Conflicts**: Overlapping events for same instructor/trainee
2. **Resource Conflicts**: Same resource double-booked
3. **Qualification Conflicts**: Instructor not qualified for event
4. **Prerequisite Conflicts**: Trainee hasn't completed prerequisites
5. **Business Rule Conflicts**: Violates duty turnaround, currency, etc.

#### Conflict Detection

```typescript
interface Conflict {
  type: 'TIME' | 'RESOURCE' | 'QUALIFICATION' | 'PREREQUISITE' | 'RULE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  event1: ScheduleEvent;
  event2?: ScheduleEvent;
  suggestedResolution?: string;
}

const detectConflicts = (events: ScheduleEvent[]): Conflict[] => {
  const conflicts: Conflict[] = [];
  
  // Check time conflicts
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];
      
      // Same instructor
      if (event1.instructor === event2.instructor) {
        if (eventsOverlap(event1, event2)) {
          conflicts.push({
            type: 'TIME',
            severity: 'HIGH',
            message: `Instructor ${event1.instructor} double-booked`,
            event1,
            event2,
            suggestedResolution: 'Change time or assign different instructor'
          });
        }
      }
      
      // Same trainee
      if (event1.student === event2.student) {
        if (eventsOverlap(event1, event2)) {
          conflicts.push({
            type: 'TIME',
            severity: 'HIGH',
            message: `Trainee ${event1.student} double-booked`,
            event1,
            event2,
            suggestedResolution: 'Change time'
          });
        }
      }
      
      // Same resource (aircraft/simulator)
      const resourceOverlap = event1.resourcesPhysical.some(r => 
        event2.resourcesPhysical.includes(r)
      );
      if (resourceOverlap && eventsOverlap(event1, event2)) {
        conflicts.push({
          type: 'RESOURCE',
          severity: 'MEDIUM',
          message: `Resource ${resourceOverlap} double-booked`,
          event1,
          event2,
          suggestedResolution: 'Change time or assign different resource'
        });
      }
    }
  }
  
  // Check duty turnaround violations
  for (const event of events) {
    const previousEvent = getPreviousEventForInstructor(event, events);
    if (previousEvent) {
      const requiredGap = getDutyTurnaroundTime(
        previousEvent.type,
        previousEvent.dayNight
      );
      const actualGap = getGapBetweenEvents(previousEvent, event);
      
      if (actualGap < requiredGap) {
        conflicts.push({
          type: 'RULE',
          severity: 'HIGH',
          message: `Duty turnaround violation for ${event.instructor}`,
          event1: event,
          suggestedResolution: `Increase gap to ${requiredGap} minutes`
        });
      }
    }
  }
  
  // Check currency violations
  const instructorEvents = groupEventsByInstructor(events);
  for (const [instructorName, instEvents] of instructorEvents) {
    const instructor = getInstructorByName(instructorName);
    if (instructor) {
      for (const requirement of instructor.currencyRequirements || []) {
        if (!isCurrencyMet(instructor, instEvents, requirement)) {
          conflicts.push({
            type: 'RULE',
            severity: 'MEDIUM',
            message: `Currency violation for ${instructorName}: ${requirement.type}`,
            event1: instEvents[0],
            suggestedResolution: 'Add currency event'
          });
        }
      }
    }
  }
  
  return conflicts;
};
```

#### Conflict Resolution

Conflicts are resolved by:

1. **Reassigning Resources**: Find alternative instructors/resources
2. **Adjusting Times**: Move events to different time slots
3. **Dropping Low-Priority Events**: Remove if no resolution possible
4. **Splitting Events**: Break into multiple sessions

```typescript
const resolveConflicts = (
  conflicts: Conflict[],
  events: ScheduleEvent[]
): ScheduleEvent[] => {
  let resolvedEvents = [...events];
  
  // Sort conflicts by severity
  conflicts.sort((a, b) => 
    severityToNumber(b.severity) - severityToNumber(a.severity)
  );
  
  for (const conflict of conflicts) {
    switch (conflict.type) {
      case 'TIME':
        resolvedEvents = resolveTimeConflict(conflict, resolvedEvents);
        break;
      case 'RESOURCE':
        resolvedEvents = resolveResourceConflict(conflict, resolvedEvents);
        break;
      case 'QUALIFICATION':
        resolvedEvents = resolveQualificationConflict(conflict, resolvedEvents);
        break;
      case 'RULE':
        resolvedEvents = resolveRuleViolation(conflict, resolvedEvents);
        break;
    }
  }
  
  return resolvedEvents;
};
```

### Stage 6: Optimization

The algorithm uses multiple optimization strategies:

#### 1. Greedy Selection
```typescript
const greedySelect = (candidates: CandidateEvent[]): ScheduleEvent[] => {
  // Sort by priority (descending) then score (descending)
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.score - a.score;
  });
  
  const selected: ScheduleEvent[] = [];
  const usedResources = new Set<string>();
  
  for (const candidate of sorted) {
    const resourceKey = `${candidate.instructor.name}-${candidate.trainee.fullName}-${candidate.startTime}`;
    
    if (!usedResources.has(resourceKey)) {
      selected.push(candidateToScheduleEvent(candidate));
      usedResources.add(resourceKey);
    }
  }
  
  return selected;
};
```

#### 2. Backtracking Search
```typescript
const backtrackingSearch = (
  candidates: CandidateEvent[],
  index: number = 0,
  current: ScheduleEvent[] = []
): ScheduleEvent[] | null => {
  // Base case: all candidates processed
  if (index >= candidates.length) {
    return current;
  }
  
  const candidate = candidates[index];
  
  // Try including this candidate
  const conflict = checkConflict(candidate, current);
  if (!conflict) {
    const result = backtrackingSearch(
      candidates,
      index + 1,
      [...current, candidateToScheduleEvent(candidate)]
    );
    if (result) return result;
  }
  
  // Try excluding this candidate
  return backtrackingSearch(candidates, index + 1, current);
};
```

#### 3. Simulated Annealing (for large schedules)
```typescript
const simulatedAnnealing = (
  initialEvents: ScheduleEvent[],
  iterations: number = 1000
): ScheduleEvent[] => {
  let current = initialEvents;
  let best = current;
  let temperature = 1000;
  
  for (let i = 0; i < iterations; i++) {
    // Generate neighbor solution
    const neighbor = generateNeighbor(current);
    
    // Calculate energy (conflicts)
    const currentConflicts = countConflicts(current);
    const neighborConflicts = countConflicts(neighbor);
    
    // Accept if better or with probability
    if (neighborConflicts < currentConflicts ||
        Math.random() < Math.exp((currentConflicts - neighborConflicts) / temperature)) {
      current = neighbor;
      
      if (neighborConflicts < countConflicts(best)) {
        best = neighbor;
      }
    }
    
    // Cool down
    temperature *= 0.99;
  }
  
  return best;
};
```

### Stage 7: Final Validation

After optimization, the schedule undergoes final validation:

```typescript
const validateFinalSchedule = (events: ScheduleEvent[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for remaining conflicts
  const conflicts = detectConflicts(events);
  conflicts.forEach(conflict => {
    if (conflict.severity === 'CRITICAL' || conflict.severity === 'HIGH') {
      errors.push(conflict.message);
    } else {
      warnings.push(conflict.message);
    }
  });
  
  // Check instructor workloads
  const workloads = calculateInstructorWorkloads(events);
  for (const [instructor, workload] of workloads) {
    if (workload.totalHours > MAX_DAILY_HOURS) {
      errors.push(`${instructor} exceeds maximum daily hours`);
    }
    if (workload.nightFlights > MAX_NIGHT_FLIGHTS) {
      warnings.push(`${instructor} has many night flights`);
    }
  }
  
  // Check trainee progress
  const progress = calculateTraineeProgress(events);
  for (const [trainee, traineeProgress] of progress) {
    if (traineeProgress.stalledDays > MAX_STALL_DAYS) {
      warnings.push(`${trainee} progress is stalled`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    eventCount: events.length,
    instructorCount: new Set(events.map(e => e.instructor)).size,
    traineeCount: new Set(events.map(e => e.student)).size
  };
};
```

### Algorithm Summary

The NEO BUILD Algorithm follows this flow:

```
1. INPUT PREPARATION
   ├─ Collect instructor data
   ├─ Collect trainee data
   ├─ Load syllabus
   ├─ Load business rules
   └─ Load resource data

2. CONSTRAINT ANALYSIS
   ├─ Time constraints
   ├─ Qualification constraints
   └─ Prerequisite constraints

3. CANDIDATE GENERATION
   ├─ For each trainee
   ├─ For each syllabus item
   ├─ For each qualified instructor
   └─ For each available time slot

4. SCORING & PRIORITIZATION
   ├─ Calculate priority
   ├─ Calculate score
   └─ Sort candidates

5. CONFLICT DETECTION
   ├─ Time conflicts
   ├─ Resource conflicts
   ├─ Qualification conflicts
   ├─ Prerequisite conflicts
   └─ Rule violations

6. OPTIMIZATION
   ├─ Greedy selection
   ├─ Backtracking search
   └─ Simulated annealing

7. CONFLICT RESOLUTION
   ├─ Reassign resources
   ├─ Adjust times
   ├─ Drop low-priority
   └─ Split events

8. FINAL VALIDATION
   ├─ Check conflicts
   ├─ Check workloads
   ├─ Check progress
   └─ Generate report
```

---

## 8. DFP Generation Workflow

### Step-by-Step Process

#### Step 1: Access NEO BUILD Interface

1. Navigate to the NEO BUILD tab in the application
2. Ensure you have appropriate permissions (Admin or Scheduler role)
3. Review current system status and available resources

#### Step 2: Configure Build Parameters

```typescript
interface BuildParameters {
  // Date Selection
  buildDate: Date;
  
  // Location Selection
  location: 'ESL' | 'PEA' | 'OTH';
  
  // Instructor Selection
  includeInstructors: {
    category: InstructorCategory[];  // Which categories to include
    roles: string[];                 // Which roles to include
    specificIds?: number[];          // Specific instructor IDs
  };
  
  // Trainee Selection
  includeTrainees: {
    courses: string[];               // Which courses to include
    phases: string[];                // Which phases to include
    specificIds?: number[];          // Specific trainee IDs
    excludeUnready: boolean;         // Exclude trainees not ready for next event
  };
  
  // Resource Configuration
  resources: {
    aircraft: {
      totalAvailable: number;
      types: string[];               // PC-21, etc.
      availability: TimeSlot[];      // When each aircraft is available
    };
    simulators: {
      totalAvailable: number;
      types: string[];               // FTD, CPT
      availability: TimeSlot[];
    };
    classrooms: {
      totalAvailable: number;
      capacity: number;
      availability: TimeSlot[];
    };
  };
  
  // Business Rules
  rules: {
    dutyTurnaround: {
      flightDay: number;             // Minutes
      flightNight: number;           // Minutes
      ftd: number;                   // Minutes
      groundSchool: number;          // Minutes
    };
    eventLimits: {
      maxDailyPerInstructor: number;
      maxWeeklyPerInstructor: number;
      maxNightFlights: number;
    };
    currency: {
      enforce: boolean;
      requirements: CurrencyRequirement[];
    };
    testingOfficer: {
      requiredForChecks: boolean;
      requiredForSolos: boolean;
    };
  };
  
  // Optimization Settings
  optimization: {
    algorithm: 'GREEDY' | 'BACKTRACKING' | 'SIMULATED_ANNEALING';
    maxIterations: number;
    prioritizeProgress: boolean;
    balanceWorkload: boolean;
    minimizeConflicts: boolean;
  };
  
  // Output Options
  output: {
    includePrePost: boolean;         // Include pre/post flight times
    generateReport: boolean;
    exportFormats: ('PDF' | 'EXCEL' | 'JSON')[];
  };
}
```

#### Step 3: Execute Build

```typescript
const executeBuild = async (parameters: BuildParameters): Promise<BuildResult> => {
  // 1. Load and filter data
  const instructors = await loadInstructors(parameters.includeInstructors);
  const trainees = await loadTrainees(parameters.includeTrainees);
  const syllabus = await loadSyllabus(parameters.location);
  const resources = await loadResources(parameters.resources);
  
  // 2. Initialize algorithm
  const algorithm = new NEOBuildAlgorithm({
    instructors,
    trainees,
    syllabus,
    resources,
    rules: parameters.rules,
    optimization: parameters.optimization
  });
  
  // 3. Execute algorithm
  const startTime = Date.now();
  const result = await algorithm.generate();
  const endTime = Date.now();
  
  // 4. Generate report
  const report = await generateBuildReport(result, {
    buildTime: endTime - startTime,
    parameters,
    statistics: {
      totalEvents: result.events.length,
      conflicts: result.conflicts.length,
      instructorsUsed: result.instructorCount,
      traineesScheduled: result.traineeCount
    }
  });
  
  // 5. Return result
  return {
    events: result.events,
    conflicts: result.conflicts,
    statistics: result.statistics,
    report,
    metadata: {
      buildDate: parameters.buildDate,
      location: parameters.location,
      buildTime: endTime - startTime,
      parameters,
      version: '2.1.0'
    }
  };
};
```

#### Step 4: Review Results

The build results include:

1. **Generated Events**: All scheduled events with full details
2. **Conflicts**: List of any conflicts found
3. **Statistics**: Summary metrics
4. **Report**: Detailed analysis document

**Statistics Include:**
- Total events scheduled
- Events by type (Flight, FTD, Ground School)
- Events by phase (BGF, BIF, BNF, etc.)
- Instructor utilization rates
- Trainee progress achieved
- Resource utilization
- Conflict summary

#### Step 5: Manual Adjustments (Optional)

After the initial build, you can make manual adjustments:

1. **Drag & Drop**: Move events to different time slots
2. **Reassign**: Change instructor or trainee assignments
3. **Add/Remove**: Add missing events or remove unwanted ones
4. **Edit Details**: Modify event parameters

#### Step 6: Final Validation

Before publishing, run final validation:

```typescript
const finalValidation = validateSchedule(buildResult.events);

if (!finalValidation.isValid) {
  console.error('Validation failed:', finalValidation.errors);
  // Manual intervention required
  return;
}

console.log('Warnings:', finalValidation.warnings);
// Optional: review warnings
```

#### Step 7: Publish to Active DFP

See [Section 10: Active DFP Publishing](#active-dfp-publishing)

---

## 9. Build Variables & Parameters

### Environmental Variables

#### Date & Time Variables

| Variable | Type | Description | Default |
|----------|------|-------------|---------|
| `buildDate` | Date | Target date for DFP | Current date |
| `buildTimezone` | string | Timezone for schedule | 'UTC' |
| `daylightSavings` | boolean | DST adjustment | false |
| `operatingHours.start` | string | Day start time | '06:00' |
| `operatingHours.end` | string | Day end time | '18:00' |
| `nightHours.start` | string | Night start time | '18:00' |
| `nightHours.end` | string | Night end time | '06:00' |

#### Location Variables

| Variable | Type | Description | Options |
|----------|------|-------------|---------|
| `location` | string | Training location | 'ESL', 'PEA', 'OTH' |
| `unit` | string | Operating unit | '1FTS', '2FTS', etc. |
| `airfield` | string | Airfield designation | 'ESL', 'PEA' |

#### Personnel Variables

**Instructor Filters:**
```typescript
{
  categories: ['UnCat', 'D', 'C', 'B', 'A'],  // Categories to include
  roles: ['QFI', 'SIM_IP', 'TESTING_OFFICER'],  // Roles to include
  minCategory: 'D',                            // Minimum category
  excludeUnvailable: true,                      // Exclude unavailable
  excludeOnLeave: true,                        // Exclude on leave
  specificInstructors: [123, 456, 789]         // Specific IDs (optional)
}
```

**Trainee Filters:**
```typescript
{
  courses: ['BPC+IPC', 'FIC', 'WSO'],          // Courses to include
  phases: ['BGF', 'BIF', 'BNF'],                // Phases to include
  excludeUnready: true,                        // Exclude not ready
  excludeOnLeave: true,                        // Exclude on leave
  specificTrainees: [101, 102, 103]            // Specific IDs (optional)
}
```

#### Resource Variables

**Aircraft:**
```typescript
{
  totalAvailable: 12,                          // Total aircraft
  types: ['PC-21'],                            // Aircraft types
  maintenanceSchedule: [                        // Maintenance windows
    { id: 1, start: '08:00', end: '12:00', reason: 'Scheduled' }
  ],
  availability: [                              // Custom availability
    { id: 1, start: '06:00', end: '18:00' }
  ]
}
```

**Simulators:**
```typescript
{
  totalAvailable: 4,                           // Total simulators
  types: ['FTD', 'CPT'],                       // Simulator types
  maintenanceSchedule: [...],                   // Maintenance windows
  availability: [...]                          // Custom availability
}
```

**Classrooms:**
```typescript
{
  totalAvailable: 6,                           // Total classrooms
  capacity: 20,                                // Students per classroom
  availability: [...]                          // Custom availability
}
```

#### Business Rule Variables

**Duty Turnaround:**
```typescript
{
  flightDay: 30,                               // Minutes between day flights
  flightNight: 60,                             // Minutes between night flights
  ftd: 15,                                     // Minutes between FTDs
  groundSchool: 5,                             // Minutes between ground school
  soloToDual: 60,                              // Minutes after solo before dual
}
```

**Event Limits:**
```typescript
{
  maxDailyPerInstructor: 8,                    // Max events per instructor/day
  maxWeeklyPerInstructor: 40,                   // Max events per instructor/week
  maxDailyFlights: 6,                          // Max flights per instructor/day
  maxNightFlights: 2,                          // Max night flights per instructor/day
  maxDailyGroundSchool: 4,                     // Max ground school per instructor/day
}
```

**Currency Requirements:**
```typescript
{
  enforce: true,
  requirements: [
    {
      type: 'QFI',
      interval: 'DAYS',
      value: 90,
      minEvents: 3
    },
    {
      type: 'NIGHT',
      interval: 'DAYS',
      value: 30,
      minEvents: 1
    },
    {
      type: 'TESTING_OFFICER',
      interval: 'DAYS',
      value: 180,
      minEvents: 2
    }
  ]
}
```

**Testing Officer Requirements:**
```typescript
{
  requiredForChecks: true,                     // Check events need TO
  requiredForSolos: true,                      // Solo events need TO
  requiredForProficiencyTests: true            // PT events need TO
}
```

#### Optimization Variables

**Algorithm Selection:**
```typescript
{
  algorithm: 'GREEDY',                         // 'GREEDY', 'BACKTRACKING', 'SIMULATED_ANNEALING'
  maxIterations: 1000,                         // For simulated annealing
  temperature: 1000,                           // Initial temperature
  coolingRate: 0.99                            // Cooling rate
}
```

**Optimization Goals:**
```typescript
{
  prioritizeProgress: true,                    // Prioritize trainee progress
  balanceWorkload: true,                       // Balance instructor workload
  minimizeConflicts: true,                     // Minimize conflicts
  maximizeUtilization: false,                  // Maximize resource utilization
  preferConsistency: false                     // Prefer consistent instructor-trainee pairs
}
```

**Weights:**
```typescript
{
  progressWeight: 1.0,                         // Trainee progress importance
  workloadWeight: 0.8,                        // Workload balance importance
  conflictWeight: 1.0,                        // Conflict avoidance importance
  utilizationWeight: 0.5,                     // Utilization importance
  consistencyWeight: 0.3                      // Consistency importance
}
```

#### Syllabus Variables

**Event Configuration:**
```typescript
{
  includePhases: ['BGF', 'BIF', 'BNF', 'BNAV', 'FIC'],  // Phases to include
  includeTypes: ['Flight', 'FTD', 'Ground School'],     // Event types to include
  includeCourses: ['BPC+IPC'],                          // Courses to include
  enforcePrerequisites: true,                           // Enforce prerequisites
  allowConcurrent: false,                               // Allow concurrent events
  sortOrder: 'PROGRESS'                                 // 'PROGRESS', 'SYLLABUS'
}
```

### Parameter Impact Analysis

#### High-Impact Variables

1. **`includeInstructors.categories`**: Directly affects which instructors are available
   - Higher categories = fewer instructors available
   - Lower categories = more instructors but less qualified

2. **`resources.aircraft.totalAvailable`**: Limits number of concurrent flights
   - Fewer aircraft = fewer parallel flight events
   - More aircraft = more flexibility but higher resource cost

3. **`rules.dutyTurnaround`**: Affects event spacing
   - Longer turnaround = fewer events per instructor
   - Shorter turnaround = more events but higher fatigue risk

4. **`rules.eventLimits.maxDailyPerInstructor`**: Caps instructor workload
   - Lower limit = fewer total events possible
   - Higher limit = more events but higher workload

5. **`optimization.prioritizeProgress`**: Affects which events get scheduled
   - True = Prioritizes trainees further along
   - False = More balanced scheduling

#### Medium-Impact Variables

1. **`includeTrainees.courses`**: Determines which trainees are scheduled
2. **`rules.testingOfficer.requiredForChecks`**: Limits eligible instructors
3. **`optimization.balanceWorkload`**: Distributes events across instructors
4. **`optimization.minimizeConflicts`**: Prioritizes conflict-free scheduling

#### Low-Impact Variables

1. **`output.includePrePost`**: Display-only, doesn't affect scheduling
2. **`buildTimezone`**: Time formatting only
3. **`output.exportFormats`**: Output format selection

---

## 10. Active DFP Publishing

### What is "Active DFP"?

The **Active DFP** is the current, published Daily Flying Program that is:
- **Live**: Visible to all authorized personnel
- **Official**: The authoritative schedule for operations
- **Immutable**: Once published, cannot be modified (create new version instead)
- **Versioned**: Each publish creates a new version
- **Tracked**: All changes are logged for audit purposes

### DFP States

A DFP goes through these states:

```
DRAFT → REVIEW → APPROVED → ACTIVE → ARCHIVED
  ↓       ↓         ↓         ↓         ↓
Editable  Editable  Read-only  Live     Historical
```

**State Descriptions:**

1. **DRAFT**: Initial build, fully editable
2. **REVIEW**: Ready for review, still editable
3. **APPROVED**: Approved by commanding officer, read-only
4. **ACTIVE**: Currently in use, live and immutable
5. **ARCHIVED**: Historical record, no longer active

### Publishing Process

#### Step 1: Pre-Publish Validation

Before publishing, ensure:

```typescript
const prePublishChecks = async (dfp: DFP): Promise<ValidationResult> => {
  const checks = {
    hasEvents: dfp.events.length > 0,
    noCriticalConflicts: true,
    allInstructorsAvailable: true,
    allTraineesAvailable: true,
    allResourcesAllocated: true,
    businessRulesCompliant: true,
    requiredApprovals: true
  };
  
  // Check for events
  if (!checks.hasEvents) {
    return {
      isValid: false,
      errors: ['DFP has no events']
    };
  }
  
  // Check conflicts
  const conflicts = detectConflicts(dfp.events);
  const criticalConflicts = conflicts.filter(c => c.severity === 'CRITICAL');
  if (criticalConflicts.length > 0) {
    checks.noCriticalConflicts = false;
    return {
      isValid: false,
      errors: criticalConflicts.map(c => c.message)
    };
  }
  
  // Check instructor availability
  for (const event of dfp.events) {
    const instructor = await getInstructorByName(event.instructor);
    if (instructor && !isInstructorAvailable(instructor, dfp.date)) {
      checks.allInstructorsAvailable = false;
      return {
        isValid: false,
        errors: [`Instructor ${instructor.name} is not available on ${dfp.date}`]
      };
    }
  }
  
  // Check trainee availability
  for (const event of dfp.events) {
    const trainee = await getTraineeByName(event.student);
    if (trainee && !isTraineeAvailable(trainee, dfp.date)) {
      checks.allTraineesAvailable = false;
      return {
        isValid: false,
        errors: [`Trainee ${trainee.name} is not available on ${dfp.date}`]
      };
    }
  }
  
  // Check business rules
  const ruleViolations = checkBusinessRules(dfp.events, dfp.metadata.rules);
  if (ruleViolations.length > 0) {
    checks.businessRulesCompliant = false;
    return {
      isValid: false,
      errors: ruleViolations.map(v => v.message)
    };
  }
  
  return {
    isValid: true,
    errors: [],
    warnings: []
  };
};
```

#### Step 2: Generate Version

Each publish creates a new version:

```typescript
const generateVersion = async (dfp: DFP): Promise<string> => {
  // Get previous versions
  const previousVersions = await getDFPVersions(dfp.id);
  const versionNumber = previousVersions.length + 1;
  
  // Generate version string
  const version = `v${versionNumber}.${new Date().getFullYear()}.${new Date().getMonth() + 1}.${new Date().getDate()}`;
  
  return version;
};
```

#### Step 3: Create Snapshot

Create an immutable snapshot of the DFP:

```typescript
const createSnapshot = (dfp: DFP): DFP => {
  return {
    ...dfp,
    id: `${dfp.id}-${Date.now()}`,  // New ID for snapshot
    status: 'ACTIVE',
    version: dfp.version,
    snapshotOf: dfp.id,
    publishedAt: new Date().toISOString(),
    publishedBy: getCurrentUserId(),
    events: JSON.parse(JSON.stringify(dfp.events)),  // Deep copy
    metadata: {
      ...dfp.metadata,
      publishMetadata: {
        publishDate: new Date().toISOString(),
        publisher: getCurrentUserId(),
        approvalChain: dfp.metadata.approvalChain,
        changeLog: generateChangeLog(dfp)
      }
    }
  };
};
```

#### Step 4: Archive Previous Active

Archive the previous active DFP:

```typescript
const archivePreviousActive = async (date: Date): Promise<void> => {
  const previousActive = await getActiveDFP(date);
  
  if (previousActive) {
    await updateDFP(previousActive.id, {
      status: 'ARCHIVED',
      archivedAt: new Date().toISOString(),
      archivedBy: getCurrentUserId()
    });
  }
};
```

#### Step 5: Publish New Active

Publish the new active DFP:

```typescript
const publishActiveDFP = async (draftDFP: DFP): Promise<DFP> => {
  // 1. Pre-publish validation
  const validation = await prePublishChecks(draftDFP);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  // 2. Generate version
  const version = await generateVersion(draftDFP);
  
  // 3. Create snapshot
  const snapshot = createSnapshot(draftDFP);
  snapshot.version = version;
  
  // 4. Archive previous active
  await archivePreviousActive(draftDFP.date);
  
  // 5. Publish new active
  const activeDFP = await createDFP(snapshot);
  
  // 6. Create new draft from snapshot (for future edits)
  const newDraft = await createDFP({
    ...draftDFP,
    id: undefined,
    status: 'DRAFT',
    version: version,
    basedOn: activeDFP.id,
    createdAt: new Date().toISOString()
  });
  
  // 7. Log publication
  await logPublication({
    dfpId: activeDFP.id,
    version,
    publishedBy: getCurrentUserId(),
    publishedAt: new Date().toISOString(),
    eventCount: activeDFP.events.length,
    metadata: activeDFP.metadata
  });
  
  // 8. Notify subscribers
  await notifySubscribers({
    type: 'DFP_PUBLISHED',
    dfpId: activeDFP.id,
    version,
    date: activeDFP.date
  });
  
  return activeDFP;
};
```

### What Publishing Means

**When you publish a DFP, the following happens:**

1. **Immutable Record Created**: A permanent, unchangeable record is created
2. **Version Number Assigned**: Each publish gets a unique version number
3. **Previous Active Archived**: The previous active DFP is moved to archive
4. **New Draft Created**: A new draft is created from the published version for future edits
5. **Audit Trail Updated**: Publication is logged with who, when, and why
6. **Notifications Sent**: All authorized personnel are notified
7. **Access Control Applied**: Read-only access is enforced
8. **Status Changed**: Status changes from DRAFT/APPROVED to ACTIVE

**What You Can Do with an Active DFP:**

✅ View the schedule
✅ Export to PDF/Excel
✅ Print the schedule
✅ Share with authorized personnel
✅ Compare with other versions
✅ View audit history

**What You Cannot Do with an Active DFP:**

❌ Edit events
❌ Add/remove events
❌ Change assignments
❌ Modify parameters
❌ Delete the DFP

**To make changes to an Active DFP:**

1. Create a new draft from the Active version
2. Make your changes in the draft
3. Validate and review
4. Publish as a new version

### Access Control

Active DFPs have strict access control:

```typescript
interface DFPPermissions {
  canView: boolean;           // Can view the DFP
  canExport: boolean;         // Can export to PDF/Excel
  canPrint: boolean;          // Can print the schedule
  canShare: boolean;          // Can share with others
  canCompare: boolean;        // Can compare with other versions
  canViewHistory: boolean;    // Can view audit history
  canEdit: boolean;           // Can edit (only for DRAFT/APPROVED)
  canDelete: boolean;         // Can delete (only for DRAFT)
  canPublish: boolean;        // Can publish to ACTIVE
  canArchive: boolean;        // Can archive
}
```

**Role-Based Access:**

| Role | View | Export | Edit | Publish |
|------|------|--------|------|---------|
| Student | ✅ | ✅ | ❌ | ❌ |
| Instructor | ✅ | ✅ | ❌ | ❌ |
| Scheduler | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Commanding Officer | ✅ | ✅ | ❌ | ✅ (approve only) |

### Audit Trail

All publications are logged:

```typescript
interface AuditLog {
  id: string;
  dfpId: string;
  version: string;
  action: 'CREATED' | 'PUBLISHED' | 'ARCHIVED' | 'VIEWED' | 'EXPORTED';
  userId: string;
  userName: string;
  timestamp: Date;
  ipAddress?: string;
  metadata?: any;
}

// Query audit trail
const getAuditTrail = async (dfpId: string): Promise<AuditLog[]> => {
  return await prisma.auditLog.findMany({
    where: { dfpId },
    orderBy: { timestamp: 'desc' }
  });
};
```

---

## 11. API Endpoints

### Personnel API

#### GET /api/personnel
Fetch all personnel with optional filtering.

**Request:**
```typescript
GET /api/personnel?role=QFI&available=true&search=Smith
```

**Query Parameters:**
- `role` (optional): Filter by role (QFI, SIM_IP, etc.)
- `available` (optional): Filter by availability (true/false)
- `search` (optional): Search by name or rank

**Response:**
```json
{
  "personnel": [
    {
      "id": "clxxx...",
      "userId": "clxxx...",
      "name": "Smith, John",
      "rank": "SQLDR",
      "role": "QFI",
      "category": "B",
      "service": "RAAF",
      "location": "ESL",
      "idNumber": 1234567,
      "isQFI": true,
      "isTestingOfficer": true,
      "isActive": true,
      "createdAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/personnel
Create new personnel record.

**Request:**
```json
{
  "name": "Doe, Jane",
  "rank": "FLT-LT",
  "role": "QFI",
  "category": "C",
  "service": "RAAF",
  "location": "ESL",
  "idNumber": 7654321,
  "isQFI": true,
  "isTestingOfficer": false
}
```

**Response:**
```json
{
  "id": "clxxx...",
  "name": "Doe, Jane",
  "rank": "FLT-LT",
  "createdAt": "2024-01-10T00:00:00.000Z"
}
```

### Users API

#### GET /api/users
Fetch all users (staff and trainees).

**Response:**
```json
{
  "users": [
    {
      "id": "clxxx...",
      "name": "Smith, John",
      "email": "john.smith@example.com",
      "role": "INSTRUCTOR",
      "pmkeysId": "1234567",
      "userType": "STAFF",
      "createdAt": "2024-01-10T00:00:00.000Z"
    }
  ]
}
```

### DFPs API

#### GET /api/dfps
Fetch all DFPs.

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, ACTIVE, ARCHIVED)
- `date` (optional): Filter by date
- `location` (optional): Filter by location

**Response:**
```json
{
  "dfps": [
    {
      "id": "clxxx...",
      "title": "DFP - 2024-01-15",
      "date": "2024-01-15T00:00:00.000Z",
      "location": "ESL",
      "status": "ACTIVE",
      "version": "v1.2024.1.15",
      "eventCount": 45,
      "publishedAt": "2024-01-14T18:00:00.000Z",
      "publishedBy": "admin"
    }
  ]
}
```

#### POST /api/dfps
Create new DFP.

**Request:**
```json
{
  "title": "DFP - 2024-01-16",
  "date": "2024-01-16T00:00:00.000Z",
  "location": "ESL",
  "events": [
    {
      "id": "evt-001",
      "code": "BGF1",
      "startTime": "08:00",
      "endTime": "10:30",
      "instructor": "Smith, John",
      "student": "Doe, Jane",
      "type": "Flight"
    }
  ],
  "metadata": {
    "buildParameters": {...},
    "conflicts": []
  }
}
```

#### PUT /api/dfps/:id/publish
Publish DFP to Active.

**Request:**
```json
{
  "approvalChain": ["scheduler", "co"],
  "notes": "Ready for operations"
}
```

**Response:**
```json
{
  "id": "clxxx...",
  "status": "ACTIVE",
  "version": "v1.2024.1.16",
  "publishedAt": "2024-01-15T18:00:00.000Z"
}
```

### Schedules API

#### GET /api/schedules
Fetch all schedules.

**Response:**
```json
{
  "schedules": [
    {
      "id": "sch-001",
      "name": "ESL January 2024",
      "events": [...],
      "metadata": {...}
    }
  ]
}
```

#### POST /api/schedules
Create new schedule.

**Request:**
```json
{
  "name": "ESL February 2024",
  "events": [...],
  "metadata": {
    "location": "ESL",
    "period": {
      "start": "2024-02-01",
      "end": "2024-02-29"
    }
  }
}
```

---

## 12. Key Functions & Utilities

### Time Utilities

```typescript
// Convert time string (HH:MM) to minutes
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert minutes to time string (HH:MM)
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Check if two time ranges overlap
const timesOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean => {
  return start1 < end2 && end1 > start2;
};

// Calculate duration between two times
const calculateDuration = (start: string, end: string): number => {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  return endMinutes - startMinutes;
};
```

### Conflict Detection

```typescript
// Detect all conflicts in a schedule
const detectConflicts = (events: ScheduleEvent[]): Conflict[] => {
  const conflicts: Conflict[] = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const conflict = checkEventConflict(events[i], events[j]);
      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }
  
  return conflicts;
};

// Check if two events conflict
const checkEventConflict = (
  event1: ScheduleEvent,
  event2: ScheduleEvent
): Conflict | null => {
  // Check time overlap
  const start1 = timeToMinutes(event1.startTime);
  const end1 = timeToMinutes(event1.endTime);
  const start2 = timeToMinutes(event2.startTime);
  const end2 = timeToMinutes(event2.endTime);
  
  if (timesOverlap(start1, end1, start2, end2)) {
    // Check for same instructor
    if (event1.instructor === event2.instructor) {
      return {
        type: 'TIME',
        severity: 'HIGH',
        message: `Instructor ${event1.instructor} double-booked`,
        event1,
        event2
      };
    }
    
    // Check for same trainee
    if (event1.student === event2.student) {
      return {
        type: 'TIME',
        severity: 'HIGH',
        message: `Trainee ${event1.student} double-booked`,
        event1,
        event2
      };
    }
    
    // Check for same resource
    const resourceOverlap = event1.resourcesPhysical.some(r =>
      event2.resourcesPhysical.includes(r)
    );
    if (resourceOverlap) {
      return {
        type: 'RESOURCE',
        severity: 'MEDIUM',
        message: `Resource ${resourceOverlap} double-booked`,
        event1,
        event2
      };
    }
  }
  
  return null;
};
```

### Validation Functions

```typescript
// Validate a complete schedule
const validateSchedule = (events: ScheduleEvent[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for conflicts
  const conflicts = detectConflicts(events);
  conflicts.forEach(conflict => {
    if (conflict.severity === 'CRITICAL' || conflict.severity === 'HIGH') {
      errors.push(conflict.message);
    } else {
      warnings.push(conflict.message);
    }
  });
  
  // Check instructor workloads
  const workloads = calculateInstructorWorkloads(events);
  for (const [instructor, workload] of workloads) {
    if (workload.totalHours > MAX_DAILY_HOURS) {
      errors.push(`${instructor} exceeds maximum daily hours`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Check if instructor is qualified for event
const isInstructorQualified = (
  instructor: Instructor,
  event: SyllabusItem
): boolean => {
  // Check role
  if (event.type === 'Flight' && !instructor.isQFI) return false;
  if (event.type === 'FTD' && !instructor.isOFI) return false;
  
  // Check category
  const requiredCategory = event.minCategory || 'D';
  const categoryLevels = ['UnCat', 'D', 'C', 'B', 'A'];
  const instructorLevel = categoryLevels.indexOf(instructor.category);
  const requiredLevel = categoryLevels.indexOf(requiredCategory);
  
  if (instructorLevel < requiredLevel) return false;
  
  return true;
};

// Check if prerequisites are met
const arePrerequisitesMet = (
  trainee: Trainee,
  event: SyllabusItem,
  completedEvents: string[]
): boolean => {
  for (const prereq of event.prerequisitesGround || []) {
    if (!completedEvents.includes(prereq)) {
      return false;
    }
  }
  
  for (const prereq of event.prerequisitesFlying || []) {
    if (!completedEvents.includes(prereq)) {
      return false;
    }
  }
  
  return true;
};
```

### Data Processing

```typescript
// Calculate instructor workload
const calculateInstructorWorkloads = (
  events: ScheduleEvent[]
): Map<string, Workload> => {
  const workloads = new Map<string, Workload>();
  
  for (const event of events) {
    const instructor = event.instructor;
    const duration = calculateDuration(event.startTime, event.endTime);
    
    if (!workloads.has(instructor)) {
      workloads.set(instructor, {
        totalHours: 0,
        flightHours: 0,
        ftdHours: 0,
        groundSchoolHours: 0,
        eventCount: 0,
        nightFlights: 0
      });
    }
    
    const workload = workloads.get(instructor)!;
    workload.totalHours += duration;
    workload.eventCount++;
    
    if (event.type === 'Flight') {
      workload.flightHours += duration;
      if (event.dayNight === 'Night') {
        workload.nightFlights++;
      }
    } else if (event.type === 'FTD') {
      workload.ftdHours += duration;
    } else {
      workload.groundSchoolHours += duration;
    }
  }
  
  return workloads;
};

// Calculate trainee progress
const calculateTraineeProgress = (
  trainee: Trainee,
  events: ScheduleEvent[],
  syllabus: SyllabusItem[]
): Progress => {
  const completedEvents = events
    .filter(e => e.student === trainee.fullName)
    .map(e => e.code);
  
  const totalSyllabusItems = syllabus.filter(s =>
    s.courses.includes(trainee.course)
  ).length;
  
  const completedCount = completedEvents.length;
  const percentage = (completedCount / totalSyllabusItems) * 100;
  
  // Find next syllabus item
  const nextItem = syllabus.find(s =>
    s.courses.includes(trainee.course) &&
    !completedEvents.includes(s.code) &&
    arePrerequisitesMet(trainee, s, completedEvents)
  );
  
  return {
    completedCount,
    totalCount: totalSyllabusItems,
    percentage: Math.round(percentage),
    nextItem: nextItem?.code || null,
    stalledDays: calculateStalledDays(trainee, events)
  };
};
```

### Export Functions

```typescript
// Export schedule to JSON
const exportToJSON = (events: ScheduleEvent[]): string => {
  return JSON.stringify({
    exportDate: new Date().toISOString(),
    eventCount: events.length,
    events
  }, null, 2);
};

// Export schedule to CSV
const exportToCSV = (events: ScheduleEvent[]): string => {
  const headers = ['ID', 'Code', 'Description', 'Start Time', 'End Time', 'Instructor', 'Student', 'Type', 'Location'];
  const rows = events.map(event => [
    event.id,
    event.code,
    event.description,
    event.startTime,
    event.endTime,
    event.instructor,
    event.student,
    event.type,
    event.location
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

// Export schedule to PDF
const exportToPDF = async (events: ScheduleEvent[]): Promise<Blob> => {
  // Implementation depends on PDF library (e.g., jsPDF)
  // Generate formatted PDF document
  return new Blob();
};
```

---

## Conclusion

This documentation provides a comprehensive overview of the NEO BUILD application, covering its architecture, data models, the sophisticated NEO BUILD algorithm, DFP generation workflow, build parameters, publishing process, and key utilities.

### Key Takeaways

1. **Dual Architecture**: Standalone React app + Next.js backend wrapper
2. **Sophisticated Algorithm**: Multi-stage constraint satisfaction and optimization
3. **Real-Time Validation**: Comprehensive conflict detection and resolution
4. **Flexible Configuration**: Extensive build parameters for customization
5. **Version Control**: Immutable Active DFPs with full audit trail
6. **Role-Based Access**: Granular permissions for different user types
7. **RESTful API**: Clean, documented API endpoints
8. **Type Safety**: Full TypeScript implementation

### For Developers

To extend or modify the system:

1. **Frontend Changes**: Modify components in `/workspace/components/`
2. **Backend Changes**: Add/modify API routes in `/workspace/dfp-neo-platform/app/api/`
3. **Database Changes**: Update Prisma schema and run migrations
4. **Algorithm Changes**: Modify scheduling logic in the NEO BUILD algorithm section
5. **Build Process**: Update build scripts in `package.json`

### Contact & Support

For questions or issues related to this documentation or the NEO BUILD system, please contact the development team or refer to the project repository.

---

**Document Version**: 1.0.0  
**Last Updated**: 2024-01-15  
**Author**: NEO BUILD Development Team