# DFP Build Algorithm - Simplified Flow with Instructor Assignment Detail

## Overview
The Daily Flying Program (DFP) build algorithm automatically schedules training events for aircrew trainees based on their syllabus progress, instructor availability, and resource constraints.

---

## Algorithm Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DFP BUILD ALGORITHM                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. INITIALIZATION                                              │
│  • Load configuration (build date, flying windows, resources)   │
│  • Load instructor &amp; trainee data                               │
│  • Load syllabus, scores, and priorities                        │
│  • Pre-populate Highest Priority Events (fixed-time events)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. COMPUTE NEXT EVENTS FOR EACH TRAINEE                       │
│  • Filter active trainees (not paused, not unavailable)        │
│  • For each trainee:                                            │
│    - Check individual LMP (Learning Management Plan)           │
│    - Find completed events from scores                          │
│    - Apply ELCE (Effective Last Completed Event) logic         │
│    - Determine NEXT event (first uncompleted, prerequisites met)│
│    - Determine NEXT+1 event (sequential after next)            │
│  • Categorize trainees into lists:                             │
│    - FLIGHT: Day flight events                                  │
│    - FTD: Flight Training Device events                         │
│    - CPT: Cockpit Procedure Trainer events                      │
│    - GROUND: Ground school events                               │
│    - BNF: Basic Night Flying events                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RANK &amp; PRIORITIZE TRAINEES                                  │
│  Sort by:                                                       │
│  1. Days since last event (most overdue first)                 │
│  2. Days since last flight                                      │
│  3. Progress behind course median                               │
│  4. Name (alphabetical)                                         │
│                                                                 │
│  Apply course priority rotation (round-robin by course)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. NIGHT FLYING SETUP (if 2+ BNF trainees)                    │
│  ⭐ INSTRUCTOR ASSIGNMENT FOR NIGHT FLYING ⭐                   │
│  • Randomize selection of night-eligible QFI instructors       │
│  • PAIR night instructors with BNF trainees                    │
│  • Store pairings in nightPairings Map                         │
│  • Mark night staff as unavailable for day events              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. SCHEDULE DUTY SUPERVISORS (Day Window)                      │
│  • Cover ENTIRE day flying window                               │
│  • Priority: TMUF supervisors → Fewest assignments → Random    │
│  • Check: Availability, soft duty limit, no overlaps           │
│  • Assign in 2-hour blocks                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. SCHEDULE DAY EVENTS (in order)                              │
│                                                                 │
│  Order: FLIGHT → FTD → CPT → GROUND                            │
│         (Next events first, then Next+1 events)                │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  FOR EACH TRAINEE in list:                                │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  scheduleEvent() function is called                 │ │ │
│  │  │                                                      │ │ │
│  │  │  ┌─────────────────────────────────────────────┐    │ │ │
│  │  │  │  ⭐ findAvailableInstructor() ⭐            │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 1: Get trainee's primary/secondary    │    │ │ │
│  │  │  │          instructor preferences             │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 2: Build candidate pool based on      │    │ │ │
│  │  │  │          event type:                        │    │ │ │
│  │  │  │          • FLIGHT → QFI only                │    │ │ │
│  │  │  │          • FTD → SIM IP first, then QFI     │    │ │ │
│  │  │  │          • CPT/GROUND → Any instructor      │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 3: Filter out unavailable instructors │    │ │ │
│  │  │  │          (night duties, unavailability,     │    │ │ │
│  │  │  │           already scheduled)                │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 4: Order candidates by priority:      │    │ │ │
│  │  │  │          1. Primary instructor (if enabled)  │    │ │ │
│  │  │  │          2. Secondary instructor             │    │ │ │
│  │  │  │          3. Fewest current assignments       │    │ │ │
│  │  │  │          4. Alphabetical (fallback)          │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 5: For each candidate, validate:      │    │ │ │
│  │  │  │          □ Not marked unavailable           │    │ │ │
│  │  │  │          □ Under event limits               │    │ │ │
│  │  │  │          □ Under soft duty limit            │    │ │ │
│  │  │  │          □ No schedule overlap              │    │ │ │
│  │  │  │          □ Under hard duty limit            │    │ │ │
│  │  │  │                                             │    │ │ │
│  │  │  │  STEP 6: Return first valid instructor      │    │ │ │
│  │  │  │          or NULL if none available          │    │ │ │
│  │  │  └─────────────────────────────────────────────┘    │ │ │
│  │  │                                                      │ │ │
│  │  │  Then find available resource (aircraft/FTD/CPT)     │ │ │
│  │  │  Check takeoff spacing, training area, etc.         │ │ │
│  │  │                                                      │ │ │
│  │  │  If instructor + resource found → CREATE EVENT      │ │ │
│  │  │  If no resource → return "stby" (standby)           │ │ │
│  │  │  If no instructor → return NULL (skip)              │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. SCHEDULE NIGHT FLYING (if 2+ BNF trainees)                 │
│  • Uses PRE-ASSIGNED night instructors from Step 4             │
│  • Schedule BNF Wave 1 (Next events)                           │
│  • Schedule BNF Wave 2 (Next+1 events, if BNF sequel)          │
│  • Special handling for crew turnaround between flights        │
│  • Night Duty Supervisor for entire window                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. OUTPUT                                                      │
│  Return generated events array with:                            │
│  • Scheduled events (with resources assigned)                  │
│  • STBY events (waiting for resources)                         │
│  • Duty supervisor coverage                                     │
│  • Night flying events (if applicable)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Instructor Assignment - Two Distinct Points

### Point A: Night Flying Pre-Assignment (Step 4)
**When:** Before any scheduling begins  
**Purpose:** Reserve instructors for night flying duties  
**Method:** Random selection from eligible QFIs who:
- Are not scheduled for day events
- Are available during night window
- Number needed = number of BNF trainees

```typescript
// Line 324-343 in current_build_algorithm.ts
const nightFlyingInstructors = [...nightEligiblePool]
    .sort(() => 0.5 - Math.random())  // Random selection
    .slice(0, instructorsNeeded);

nightFlyingInstructors.forEach((nfi, index) => {
    const trainee = bnfTrainees[index];
    nightPairings.set(trainee.fullName, nfi.name);  // Store pairing
});
```

### Point B: Day Event Instructor Assignment (Step 6)
**When:** During `scheduleEvent()` for each trainee  
**Purpose:** Find available instructor for specific event  
**Method:** Priority-based selection with validation

```typescript
// Line 502-732 in current_build_algorithm.ts
const findAvailableInstructor = (
    trainee: Trainee,
    syllabusItem: SyllabusItemDetail,
    isPlusOne: boolean
): Instructor | null => {
    // Build candidate pool based on event type
    // Filter by availability and constraints
    // Return first valid candidate
};

// Called at line 732:
const instructor = findAvailableInstructor(trainee, syllabusItem, isPlusOne);
```

---

## Instructor Candidate Priority Order

```
┌─────────────────────────────────────────────────────────────┐
│  INSTRUCTOR SELECTION PRIORITY (when "Program with Primaries")│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1️⃣ PRIMARY INSTRUCTOR                                       │
│     └── Trainee's assigned primary instructor                │
│                                                              │
│  2️⃣ SECONDARY INSTRUCTOR                                     │
│     └── Trainee's assigned secondary instructor              │
│                                                              │
│  3️⃣ OTHER QUALIFIED INSTRUCTORS                              │
│     └── Sorted by:                                           │
│         a. Fewest current assignments (load balancing)       │
│         b. Alphabetical name (deterministic tiebreaker)      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

NOTE: If "Program with Primaries" is DISABLED, all instructors
are sorted only by assignment count then name.
```

---

## Validation Checks for Instructor Assignment

For each candidate instructor, the algorithm checks:

| Check | Description | Code Location |
|-------|-------------|---------------|
| **Role Match** | QFI for flights, SIM IP for FTD priority | Line 627-630 |
| **Availability** | Not marked unavailable for this time | Line 662 |
| **Event Limits** | Under max Flight/FTD count | Line 682-689 |
| **Total Events** | Under max total events (3) | Line 690 |
| **Soft Duty Limit** | Total duty hours ≤ preferredDutyPeriod | Line 668-673 |
| **Hard Duty Limit** | Full duty window ≤ maxCrewDutyPeriod | Line 715-723 |
| **No Overlap** | Doesn't conflict with existing events | Line 692-698 |
| **Night Separation** | Day instructors can't have night duties | Line 566-568 |

---

## Key Constraints &amp; Rules

### Event Limits
| Role | Max Flight/FTD | Max Ground | Max Total | Max Duty Sup |
|------|---------------|------------|-----------|--------------|
| Instructor | 2 | 1 (if flying) or 4 | 3 | 1 |
| Executive | 1 | - | 3 | 2 |
| SIM IP | 4 (FTD only) | - | 4 | - |

### Duty Limits
- **Soft Limit** (preferred): ~8 hours
- **Hard Limit** (maximum): ~10 hours (maxCrewDutyPeriod)
- Includes pre-flight briefing + event + post-flight debrief

### Night Flying Rules
- Requires **minimum 2 BNF trainees**
- Night instructors **cannot** have day events
- BNF trainees are **excluded** from day event lists
- Night Duty Supervisor required for entire night window

### Resource Turnaround
| Event Type | Turnaround Time |
|------------|-----------------|
| Flight | Configurable (default ~30 min) |
| FTD | Configurable |
| CPT | Configurable |

### Takeoff Constraints
- **Max 8 takeoffs per hour**
- **5-minute minimum separation** between takeoffs

---

## ELCE Logic (Effective Last Completed Event)

When a trainee has a scheduled event that:
- Has already **finished** (end time < current time)
- Was **not cancelled**
- Was **not unsuccessful**

The system treats it as "completed" for scheduling purposes, even if paperwork (PT-051) hasn't been entered yet. This ensures the Next Event is correctly calculated.

---

## Build Order Summary

```
1. Highest Priority Events (fixed-time)
2. Night Flying Instructor Pre-Assignment ⭐
3. Duty Supervisor (Day Window)
4. Day Flights (Next → Next+1) [Instructor assigned per event ⭐]
5. Day FTD (Next → Next+1) [Instructor assigned per event ⭐]
6. Day CPT (Next → Next+1) [Instructor assigned per event ⭐]
7. Day Ground (Next → Next+1) [Instructor assigned per event ⭐]
8. Night Flights (BNF Wave 1) [Uses pre-assigned instructors]
9. Night Flights (BNF Wave 2, if applicable)
10. Night Duty Supervisor
```