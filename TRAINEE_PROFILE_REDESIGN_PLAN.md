# Trainee Profile Redesign Plan

## Reference Image Analysis

### Structure from Reference Image:
1. **Top Header Section**
   - Name with status badge (Active/Paused)
   - Profile photo (left side)

2. **Identity Block** (Main information grid)
   - ID Number
   - Course
   - LMP
   - Rank
   - Service
   - Unit
   - Seat Config
   - Location
   - Phone Number
   - Email
   - Callsign
   - Flight
   - Secondary Callsign (shown as [None])
   - Permissions

3. **Instructor Section**
   - Primary Instructor (with photo)
   - Secondary Instructor (with photo)

4. **Logbook Section** - Prior Experience (PC-21 only)
   - Day Flying (P1, P2, Dual with totals)
   - Night Flying (P1, P2, Dual with totals)
   - Totals (TOTAL, Captain, Instructor)
   - Instrument (Sim, Actual)
   - Simulator (P1, P2, Dual, Total)
   - **NOTE:** Reference shows circular gauges - MUST NOT USE THESE
   - Display as clean text only

5. **Event Information Section**
   - Next Event (Event code, Type, Duration)
   - Next Event +1 (Event code, Type, Duration)
   - Last Flight (Event code, Date, Days since)
   - Last Event (Event code, Date, Days since)

6. **Unavailability Section**
   - List of unavailability periods or "No unavailability periods scheduled"

---

## Current Implementation Data Fields

### Basic Information (Currently in grid layout):
- ✅ Name (Surname, Firstname)
- ✅ ID Number
- ✅ Course (with color badge)
- ✅ LMP (with badge)
- ✅ Trainee Callsign (with badge)
- ✅ Rank
- ✅ Callsign (system-generated from personnelData)
- ✅ Service
- ✅ Unit
- ✅ Flight
- ✅ Seat Config
- ✅ Location
- ✅ Phone Number
- ✅ Email

### Instructor Information:
- ✅ Primary Instructor (name only, no photo in current)
- ✅ Secondary Instructor (name only, no photo in current)

### Status Information:
- ✅ Status (Active/Paused/NTSC)
- ✅ Pause toggle (edit mode only)

### Permissions:
- ✅ Permissions list (Trainee, Staff, Ops, Course Supervisor, Admin, Super Admin)

### Logbook - Prior Experience (PC-21 only):
- ✅ Day Flying: P1, P2, Dual
- ✅ Night Flying: P1, P2, Dual
- ✅ Totals: TOTAL, Captain, Instructor
- ✅ Instrument: Sim, Actual
- ✅ Simulator: P1, P2, Dual, Total

### Event Information:
- ✅ Next Event (Event code, Type, Duration)
- ✅ Next Event +1 (Event code, Type, Duration)
- ✅ Last Flight (Event code, Date, Days since)
- ✅ Last Event (Event code, Date, Days since)

### Unavailability:
- ✅ List of unavailability periods with:
  - Reason
  - Date range
  - Time range (if not all day)
  - All Day indicator

---

## Data Field Mapping: Current → Redesigned Layout

### Section 1: Top Header
**Current:** Title "Trainee Profile" with close button
**Redesigned:** 
- Name with status badge (Active/Paused)
- Profile photo placeholder (left side)
- Close button (top right)

### Section 2: Identity Block (Main Grid)
**Layout:** Clean grid with consistent spacing

**Row 1:**
- ID Number
- Course (with color badge)
- LMP (with badge)
- Callsign (system-generated)

**Row 2:**
- Rank
- Service
- Unit
- Seat Config

**Row 3:**
- Location
- Phone Number
- Email
- Flight

**Row 4:**
- Trainee Callsign (with badge)
- Permissions (inline list or badge group)

### Section 3: Instructor Section
**Layout:** Two columns side by side
- Primary Instructor (name, photo placeholder)
- Secondary Instructor (name, photo placeholder)

### Section 4: Logbook Section
**Title:** "Logbook - Prior Experience (PC-21 only)"
**Layout:** Grid of text-based data (NO GAUGES)

**Sub-sections:**
1. Day Flying: P1, P2, Dual (with calculated total)
2. Night Flying: P1, P2, Dual (with calculated total)
3. Totals: TOTAL, Captain, Instructor
4. Instrument: Sim, Actual (with calculated total)
5. Simulator: P1, P2, Dual, Total

### Section 5: Events Section
**Layout:** 4-column grid

**Columns:**
1. Next Event (Event code, Type, Duration)
2. Next Event +1 (Event code, Type, Duration)
3. Last Flight (Event code, Date, Days since)
4. Last Event (Event code, Date, Days since)

### Section 6: Unavailability Section
**Layout:** List view with clean cards
- Each period shows: Reason, Date range, Time (if applicable)
- Empty state: "No unavailability periods scheduled"

---

## Right Side Action Buttons (UNCHANGED)

**Current buttons (must remain exactly as-is):**
1. Unavailable (75px × 60px, btn-aluminium-brushed)
2. Currency (75px × 60px, btn-aluminium-brushed)
3. PT-051 (75px × 60px, btn-aluminium-brushed)
4. View Individual LMP (75px × 60px, btn-aluminium-brushed)
5. Add Remedial Package (75px × 60px, btn-aluminium-brushed)
6. Logbook (75px × 60px, btn-aluminium-brushed)
7. Edit (75px × 60px, btn-aluminium-brushed) - view mode only
8. Close (75px × 60px, btn-aluminium-brushed) - view mode only
9. Save (75px × 60px, btn-aluminium-brushed) - edit mode only
10. Cancel (75px × 60px, btn-aluminium-brushed) - edit mode only

**Action:** Reduce button panel width from current 224px (w-56) to minimum required width

---

## Design Constraints

### MUST NOT USE:
- ❌ Circular progress gauges
- ❌ Dial graphics
- ❌ Gauge-style number displays
- ❌ Horizontal divider lines between sections
- ❌ Heavy borders to separate sections
- ❌ Glow effects
- ❌ Strong gradients
- ❌ Decorative separators

### MUST USE:
- ✅ Clean text-only number displays
- ✅ Spacing and alignment to define structure
- ✅ Consistent grid alignment
- ✅ Consistent margins and vertical rhythm
- ✅ Dark mode aesthetic
- ✅ Subtle depth through spacing only
- ✅ Minimal visual noise

---

## Typography Hierarchy

### Headings (Labels):
- Section titles: text-sm font-semibold text-gray-300
- Field labels: text-xs font-medium text-gray-400
- Subsection titles: text-sm font-bold text-gray-400

### Data Values:
- Primary data: text-white font-medium
- Secondary data: text-gray-300
- Numeric data: text-white font-mono
- Status indicators: Colored badges (green for Active, amber for Paused)
- Course/LMP: Colored badges with appropriate background

---

## Layout Specifications

### Grid System:
- Main content area: Flexible grid with consistent gaps (gap-4 or gap-6)
- Identity block: 4-column grid for main fields
- Logbook: 5-column grid (Day, Night, Totals, Instrument, Simulator)
- Events: 4-column grid
- Instructor: 2-column grid

### Spacing:
- Section spacing: space-y-6 or space-y-8
- Field spacing within sections: gap-4
- Padding: p-6 for main content, p-4 for subsections

### Colors:
- Background: bg-gray-900
- Section backgrounds: bg-gray-800/30 or transparent
- Field backgrounds: bg-gray-700/50 (for read-only display)
- Borders: border-gray-700 (subtle, minimal use)
- Text: text-white (primary), text-gray-300 (secondary), text-gray-400 (labels)

---

## Functional Requirements

### Edit Mode:
- All editable fields must remain editable
- Input fields: bg-gray-700 with border-gray-600
- Dropdowns: Same styling as inputs
- Checkboxes: For permissions
- Number inputs: For logbook experience

### View Mode:
- Read-only display with clean text
- Badges for Course, LMP, Trainee Callsign, Status
- Clickable event codes (navigate to syllabus)

### Interactions:
- All existing functionality must be preserved
- All callbacks and handlers must remain functional
- All validation must remain in place
- All audit logging must remain in place

---

## Data Integrity Checklist

### All Current Fields Accounted For:
- ✅ Name
- ✅ ID Number
- ✅ Course
- ✅ LMP
- ✅ Trainee Callsign
- ✅ Rank
- ✅ Callsign (system-generated)
- ✅ Service
- ✅ Unit
- ✅ Flight
- ✅ Seat Config
- ✅ Location
- ✅ Phone Number
- ✅ Email
- ✅ Primary Instructor
- ✅ Secondary Instructor
- ✅ Status (Active/Paused)
- ✅ Permissions
- ✅ Logbook (all fields)
- ✅ Next Event
- ✅ Next Event +1
- ✅ Last Flight
- ✅ Last Event
- ✅ Unavailability periods

### No Data Loss:
- All fields from current implementation are mapped to new layout
- No fields removed or hidden
- All functionality preserved

---

## Implementation Approach

### Phase 1: Structure
1. Create new layout structure with sections
2. Implement grid system for each section
3. Add spacing and alignment

### Phase 2: Content
1. Map all data fields to new positions
2. Implement typography hierarchy
3. Add badges and status indicators

### Phase 3: Styling
1. Apply dark mode colors
2. Add subtle backgrounds
3. Ensure clean, minimal aesthetic

### Phase 4: Functionality
1. Preserve all edit mode functionality
2. Preserve all view mode functionality
3. Preserve all callbacks and handlers
4. Test all interactions

### Phase 5: Refinement
1. Adjust button panel width
2. Fine-tune spacing and alignment
3. Verify no data loss
4. Verify no functionality loss

---

## Questions for Clarification

### Profile Photos:
- Should we add profile photo placeholders for trainee and instructors?
- If yes, what should the placeholder look like?
- Should photos be functional (upload/display) or just visual placeholders?

### Secondary Callsign:
- Reference image shows "Secondary Callsign: [None]"
- Current implementation doesn't have this field
- Should we add this field or omit it?

### Permissions Display:
- Current: List format in fieldset
- Reference: Shows as "Trainee" inline
- Should permissions be displayed as inline badges or remain as list?

### Logbook Totals:
- Should we calculate and display totals for each category?
- Day Flying total = P1 + P2 + Dual
- Night Flying total = P1 + P2 + Dual
- Instrument total = Sim + Actual

---

## Ready to Proceed?

Before implementing, please confirm:
1. ✅ All data fields are accounted for
2. ✅ Layout structure is acceptable
3. ✅ No visual gauges will be used
4. ✅ No separator lines will be used
5. ✅ Button panel will remain unchanged (except width reduction)
6. ⏳ Clarification on profile photos
7. ⏳ Clarification on secondary callsign
8. ⏳ Clarification on permissions display format
9. ⏳ Clarification on logbook totals calculation

Once confirmed, I will proceed with implementation.