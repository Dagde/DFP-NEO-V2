# Daily Flying Program - AI Rebuild Instructions

## 1. Introduction

This document provides a complete guide for rebuilding the Daily Flying Program (DFP) Scheduler application from scratch using a large language model (LLM) or AI code assistant. If the source code is ever lost, follow these instructions to prompt an AI to regenerate the application, component by component.

**Application Overview:**
The DFP Scheduler is a web-based tool for managing flight school operations. It's inspired by military scheduling boards and provides a dynamic, visual interface for creating, viewing, and managing daily flight, simulator (FTD), and ground (CPT) schedules.

**Core Features:**
-   **Multiple Views:** Main Program Schedule (by resource), Instructor Schedule, and Trainee Schedule.
-   **Drag-and-Drop:** Intuitive rescheduling of events on the timeline.
-   **Data-Rich Modals:** Detailed flyouts for events, personnel profiles, and syllabus items.
-   **Automated DFP Generation:** A sophisticated algorithm that builds an optimized schedule for the next day based on a complex set of rules, priorities, and constraints.
-   **Data Visualization:** Dashboards and data analysis views for supervisors.
-   **Personnel Management:** Rosters and profiles for trainees and instructors, including unavailability tracking.

## 2. Project Setup & Structure

**Prompt:** "Set up a new React project using Vite that uses an `index.html` file to import React and other dependencies via an `importmap`. The main application will be in an `index.tsx` file. Use Tailwind CSS via its CDN link in the `index.html`."

### `index.html`
This is the entry point. It must include:
-   A link to the Tailwind CSS CDN.
-   An `importmap` to manage module dependencies (`react`, `@google/genai`, `uuid`). This avoids a `node_modules` folder.
-   A root div (`<div id="root"></div>`).
-   A module script import for `/index.tsx`.
-   Custom CSS for animations and button styling (`.btn-shape-fill`).

### `index.tsx`
This file is simple. It finds the root element and renders the main `<App />` component into it using `ReactDOM.createRoot`.

### File Structure
The project should have the following file structure. You will prompt the AI to create each file as you go.
```
/
├── index.html
├── index.tsx
├── App.tsx
├── types.ts
├── mockData.ts
├── REBUILD_INSTRUCTIONS.md
└── components/
    ├── Sidebar.tsx
    ├── Header.tsx
    ├── ScheduleView.tsx
    ├── FlightTile.tsx
    ├── FlightDetailModal.tsx
    ├── PrioritiesView.tsx
    ├── CourseRosterView.tsx
    ├── HateSheetView.tsx
    ├── ... (and all other components)
```

## 3. Core Data Structures (`types.ts`)

This is the most critical step. The entire application relies on a well-defined data model.

**Prompt:** "Create a `types.ts` file that defines all the necessary TypeScript interfaces for a flight school scheduler. Include types for personnel, events, syllabus items, and scores."

Provide the AI with the exact structure for each type:
-   `Instructor` & `Trainee`: Define their properties, including `rank`, `role`, `seatConfig`, and `unavailability`.
-   `UnavailabilityPeriod`: Detail the structure for leaves and appointments.
-   `ScheduleEvent`: This is a core type. Define its properties like `type`, `instructor`, `student`, `pilot`, `duration`, `startTime`, `resourceId`, etc.
-   `SyllabusItemDetail`: Define the properties for a lesson plan item, including `id`, `eventName`, `type`, `duration`, and `prerequisites`.
-   `Score`: Define the structure for grading a trainee's performance on an event.
-   `Conflict` types: For handling scheduling conflicts.

## 4. Mock Data & Simulation (`mockData.ts`)

The application is populated with realistic, dynamically generated data.

**Prompt:** "Create a `mockData.ts` file. First, define the entire syllabus as an array of `SyllabusItemDetail` objects. Then, create functions to procedurally generate instructors, trainees, and a simulated history of scores for them. Finally, generate an initial set of events for the current day's schedule."

Breakdown for the AI:
1.  **Syllabus Data:** Provide the raw data for all `syllabusItems`.
2.  **`populatePrerequisites` function:** Instruct the AI to create this function. **Logic:** It should iterate through the syllabus and automatically set an event's prerequisite to be the *immediately preceding non-Mass-Brief event*. This creates a sequential dependency chain.
3.  **Name Generation:** Provide the lists of first and last names and the `generateRandomName` helper function.
4.  **`generateInstructors` & `generateTraineesForCourse`:** Instruct the AI to build these functions based on the logic in the original file (rank distributions, roles, etc.).
5.  **`simulateProgressAndScores` function:** This is key for realism. **Logic:**
    -   For each trainee, determine a random point of progress within a predefined syllabus range for their course (e.g., 'Course 303' is between 'BGF6' and 'BGF17').
    -   Generate a history of `Score` objects for all syllabus events up to that point.
    -   **Crucially, this simulation must include `Ground School` and `CPT` events**, not just flights.
    -   Scores should have a 90% chance of being good (2-5) and a 10% chance of being poor (0-1).
    -   Each score should have a sequential date, and the trainee's `lastEventDate` and `lastFlightDate` should be updated based on this simulation.
6.  **`generateFullSchedule` function:** Instruct the AI to create a function that generates a sample `events` array for the current day by scheduling events in waves (AM, MID, PM), checking for basic personnel availability.

## 5. The Main `App.tsx` Component

This is the central orchestrator of the application. Rebuild it in logical sections.

**Prompt:** "Create the main `App.tsx` component. It will manage the application's entire state, handle all user interactions, contain the DFP generation algorithm, and render the currently active view."

### 5.1. State Management
Instruct the AI to set up all `useState` hooks for:
-   Core data: `instructorsData`, `traineesData`, `events`, `scores`, etc.
-   DFP Build settings: `coursePriorities`, `coursePercentages`, `availableAircraftCount`, `flyingStartTime`, `flyingEndTime`.
-   UI state: `activeView`, `selectedEvent`, `conflict`, `zoomLevel`, etc.

### 5.2. Derived Data (`useMemo`, `useCallback`)
Instruct the AI to implement the memoized calculations:
-   **`personnelConflicts`:** This is a key `useMemo` hook. **Logic:** Iterate through all events for each person. For any two consecutive events, find their syllabus details to get pre/post-flight times. If the first event's end time (including post-flight) overlaps with the second event's start time (including pre-flight), it's a conflict.
-   Other memos for `activeTrainees`, `personnelData` (callsigns), etc.

### 5.3. DFP Generation Algorithm

**Prompt:** "Implement the DFP build algorithm using the following step-by-step logic."

**Next Event source of truth**
- For all scheduling, read Next Event and Next Event +1 from the Trainee Profile → Next Event panel. Do not recompute locally in the build; these fields are the single source of truth.

---

**Step 1 — Compile "Next Event" lists**
- Look at all trainees across all courses and build these four lists, based on each trainee's Next Event:
  - Next Event – Flight List
  - Next Event – FTD List
  - Next Event – CPT List
  - Next Event - Ground School List

**Step 2 — Compile "Next +1" (Subsequent) lists**
- For each trainee in the Next Event – Ground School List, inspect their Next +1 (the event immediately after their Next Event) and place them into any applicable list(s):
  - Next +1 - Flight List (if their Next +1 is a Flight)
  - Next +1 – FTD List (if their Next +1 is an FTD)
  - Next +1 – CPT List (if their Next +1 is a CPT)
  - Next +1 - Ground School List (if their Next +1 is Ground School)
- Note: Step 2 only evaluates trainees whose immediate Next Event is Ground School, to identify who could take a second event later in the day (if Ground School occurs first).

**Step 3 — Ordering Criterion A (recency baseline)**
- For each list compiled above (all Next Event lists and all Next +1 lists):
  1. Days Since Last Event: order trainees descending (longest since last event at the top).

**Step 4 — Ordering Criterion B (tiebreaker 1)**
- For the same lists, resolve ties from Step 3:
  1. Days Since Last Flight (tiebreaker): within any tied group, order descending (longest since last flight higher).
  2. All other items retain their existing order.

**Step 5 — Ordering Criterion C (tiebreaker 2)**
- For the same lists, if trainees remain tied after Step 4:
  1. Events Behind Course Median: order trainees descending (furthest behind moves higher).
  2. Apply only when Steps 3 and 4 cannot separate trainees.
- After Steps 3–5 are applied to each list, you have fully ranked, categorised lists suitable for allocation.

**Step 6 — Apply Course Priority Percentages (Criterion D — Course Priority Allocation)**
1. Read each course's priority percentage from the Priorities page (Course Priority window).
2. These percentages define how many event slots (Flight, FTD, CPT, Ground) each course receives out of the total available for the day.

**Criterion E — Reorder by Course Priority (per list)**
1. For each ranked list (from Steps 1–5), allocate its slots by cycling through courses in proportion to their percentages (round-robin across the whole day; do not front-load only the morning).
2. Example: a course with 50% priority should receive ~50% of top placements within that list over the day; a course with 20% priority receives ~20%, etc.

**Step 7 — Assign Events & Build the Daily Program**
- Use the final ordered lists to place events and resources for Flight, FTD, CPT, and Ground School, following these constraints:
  - **Takeoff Limits:** Maximum 8 takeoffs per sliding 60-minute window (rolling), not fixed clock hours.
  - **Operating Window:** First takeoff 08:00; last landing ≤ 17:00 (local).
  - **Takeoff Spacing:** Minimum 5 minutes between any two takeoffs (except formation).
  - **Aircraft Availability:** Do not exceed the simultaneous aircraft cap set in the Priorities page.
  - **Turnaround Times:** Minimum 1.2 hours between flights on the same aircraft tail; minimum 30 minutes between FTD events on the same device.
  - **Conflict Avoidance:** No overlaps for instructors or trainees, including pre- and post-times from the syllabus. This conflict check must consider Flight, FTD, CPT, Ground School, and Duty Supervisor events.
  - **Daily Event Limits:**
      - Trainees: max one Flight or FTD per day plus max one Ground School event per day.
      - Instructors: max two events (Flight or FTD or Duty Sup) combined per day.
      - Instructors with “Executive role" flag: max one (Flight or FTD) per day plus one Duty Sup period (≤ 2 hours).
  - **Even Distribution:** If any pane (Flight, FTD, CPT, Ground) still has empty lines, distribute remaining events across 08:00–17:00.
  - **Mass Briefs (MB):** Any item with “MB” in the title/code is manual-only and must not be auto-programmed or allowed to block placements.
  - **Standby Placement Rule:** If an instructor and trainee are both available from the Next Event Flight List, but no aircraft is available at that time, then place a STBY (Standby) tile into the Standby line. The standby event time must be selected so that it does not create a conflict with any other scheduled event for that instructor or trainee. If an aircraft becomes available later, this standby pairing may be auto-promoted into a valid flight slot.

**Scheduling Guardrails (to Maximise Utilisation)**
-   Run a continuous placement loop at 5-minute ticks from 08:00–17:00; keep scheduling until no valid placement is possible for a full pass.
-   Do not terminate after "one event per trainee” or once morning course percentages are met; continue allocating across the entire day.
-   Treat Aircraft Availability as a simultaneous cap (not daily or hourly total).
-   Enforce ≤8 takeoffs per sliding 60-minute window and ≥5-minute global gap (no stacked spacing).
-   Apply turnaround only to the same tail/device (1.2h for aircraft, 30m for FTD), not fleet-wide.
-   Allow Ground School/CPT as a second event when due (Flight/FTD remains the primary).
-   MB items are manual-only; never auto-program or block scheduling.
-   If an instructor and trainee are available but no aircraft is available now or anywhere later before 17:00, assign them to the Standby line for potential use if an aircraft becomes free.

### 5.4. View Rendering & JSX
-   Instruct the AI to create the `renderActiveView` function with a `switch` statement based on the `activeView` state.
-   Lay out the main JSX: `<Sidebar>`, `<Header>`, and the rendered active view.
-   Include the conditional rendering for all modals and flyouts at the bottom (e.g., `{selectedEvent && <FlightDetailModal ... />}`).

## 6. Component-by-Component Reconstruction

Prompt the AI to build each component one by one.

### `ScheduleView.tsx`
**Prompt:** "Create the `ScheduleView` component. It should render a timeline grid with resources as rows and time as columns. It must support drag-and-drop for events."
-   **Layout:** Use CSS Grid for the main layout (sticky resource column, sticky time header, scrollable grid).
-   **Rendering:** Map over resources to create rows. For each row, filter and map events to render `<FlightTile>` components.
-   **Drag-and-Drop:** Implement `handleMouseDown`, `handleMouseMove`, and `handleMouseUp`. In `handleMouseMove`, calculate the new start time and resource row based on the cursor's position. Enforce constraints (e.g., a flight can't be dragged to an FTD row).
-   **Real-time Validation:** While dragging, check for personnel and resource conflicts with other non-dragged events and provide immediate visual feedback.

### `FlightDetailModal.tsx`
**Prompt:** "Create the `FlightDetailModal`. It should display event details and have an 'Edit' mode with form fields to modify the event."
-   Manage view/edit state internally.
-   In edit mode, all fields (syllabus item, time, crew) become inputs/selects.
-   Handle special logic for formation flights (`SCT FORM`), where the number of crew members can be adjusted.

### `PrioritiesView.tsx`
**Prompt:** "Create the `PrioritiesView` component. It needs three sections: Course Priority, Flying Window, and Aircraft Availability. It should also display the text of the build algorithm."
-   **Course Priority:**
    -   Render `coursePriorities` as a draggable list. Implement `onDragStart`, `onDragEnter`, and `onDragEnd` to allow reordering.
    -   For each course, display its percentage from `coursePercentages` with up/down buttons to adjust the value in 5% increments.
    -   Display the total percentage, highlighted in red if not equal to 100%.
-   **Other Sections:** Use simple input/select elements for the other build factors.
-   **Algorithm Text:** Hard-code the detailed description of the build algorithm steps and rules for user reference. Make sure this text describes the **Continuous Scheduling Model**.

### Other Components
For the remaining components, provide a clear, one-sentence prompt.
-   **`Header.tsx`:** "Create a `Header` with buttons for adding new events, zoom controls, and a school selector."
-   **`Sidebar.tsx`:** "Create a `Sidebar` with navigation buttons for all main views, a section for the 'Next Day Build' flow, and a legend for course colors."
-   **`CourseRosterView.tsx`:** "Create a `CourseRosterView` that displays trainees grouped by their course in columns. Allow toggling between active and archived courses."
-   **`HateSheetView.tsx` & `ScoreDetailView.tsx`:** "Create a `HateSheetView` to list a trainee's scores, and a `ScoreDetailView` to show the full breakdown of a selected score."
-   **Profile Flyouts (`InstructorProfileFlyout`, `TraineeProfileFlyout`):** "Create a profile flyout for a [Trainee/Instructor]. It should display their details and have an edit mode to update information and manage unavailability periods."

By following this structured, detailed approach, you can guide an AI assistant to systematically reconstruct the application with high fidelity, preserving its complex logic and interconnected features.