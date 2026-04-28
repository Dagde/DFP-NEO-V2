# Audit Button Implementation Plan

## Overview
Implement audit tracking functionality across multiple pages/windows with consistent "Audit" buttons that open flyout windows showing activity logs.

## Audit Button Design
- **Style**: Small and discreet
- **Appearance**: Consistent across all locations
- **Icon**: Small audit/history icon
- **Color**: Subtle gray that doesn't distract from main content

## Audit Flyout Window Features
- **Columns**:
  1. Who (User who viewed/altered)
  2. Action (View/Edit/Add/Delete/etc.)
  3. What Changed (Description of changes)
  4. Date
  5. Time
- **Actions**:
  - Print button
  - Close button
- **Style**: Clean, professional table layout

## Implementation Locations

### 1. Daily Flying Program (DFP)

#### Program Schedule (ScheduleView - Home Page)
- **Location**: Bottom left screen, between Name and Course numbers
- **Tracks**: Any changes to the schedule

#### Flight Details Window (EventDetailModal - Edit Mode)
- **Location**: Bottom left corner of footer
- **Tracks**: Any changes to flight details, including AUTH page signatures

#### Post Flight Sub-Window (PostFlightView/PostFlightModal)
- **Location**: Top right in header, next to Date
- **Tracks**: Any time someone enters times

### 2. Personnel Management

#### Staff Profile (InstructorListView)
- **Location**: Bottom of each Unit's staff list
- **Tracks**: Profile additions/deletions

#### Instructor Profile Window (InstructorProfileFlyout)
- **Location**: Bottom right, under Close button
- **Tracks**: Views and alterations to staff profile data

#### Archived Instructors Window (ArchivedInstructorsFlyout)
- **Location**: Bottom right corner
- **Tracks**: Archive movements with user and timestamp

#### Trainee Profile (CourseRosterView)
- **Location**: Bottom of each Course trainee list
- **Tracks**: Profile additions/deletions

#### Add Course Window (AddCourseFlyout)
- **Tracks**: Course additions

#### Archive Course Window (RemoveCourseFlyout)
- **Tracks**: Course archival with user and timestamp

#### Restore Course Window (RestoreCourseConfirmation)
- **Tracks**: Course restorations with user and timestamp

#### Trainee Profile Window (TraineeProfileFlyout)
- **Location**: Bottom right, under Close button
- **Tracks**: Views and alterations including unavailabilities and remedial packages

### 3. Training & Grading

#### Syllabus (SyllabusView)
- **Location**: Header, next to course select window
- **Tracks**: Views and alterations to course content

#### PT-051 Assessment (PT051View)
- **Location**: Header, next to Save button
- **Tracks**: Views and alterations to PT-051 content

#### Individual LMP (TraineeLmpView)
- **Location**: Header, next to Back button
- **Tracks**: Views of Individual LMP progress

### 4. Settings & Configuration

#### Scoring Matrix Window (ScoringMatrixFlyout)
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### Location Window
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### Units Window
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### SCT Events Window
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### Currencies Window
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### Events Limits Window
- **Location**: Top right, next to Edit button
- **Tracks**: Alterations with user, changes, and timestamp

#### Data Storage Window
- **Location**: Header, top right
- **Tracks**: Alterations with user, changes, and timestamp

## Technical Implementation

### Components to Create
1. **AuditButton.tsx** - Reusable audit button component
2. **AuditFlyout.tsx** - Flyout window for displaying audit logs
3. **auditLogger.ts** - Utility for logging audit events
4. **auditTypes.ts** - TypeScript interfaces for audit data

### Data Structure
```typescript
interface AuditLog {
  id: string;
  user: string;
  action: 'View' | 'Edit' | 'Add' | 'Delete' | 'Archive' | 'Restore';
  description: string;
  changes?: string;
  timestamp: Date;
  page: string;
}
```

### Storage
- Use localStorage for demo/development
- Structure for future backend integration
- Separate logs by page/component

## Implementation Priority
1. Create reusable components (AuditButton, AuditFlyout)
2. Implement audit logging utility
3. Add to high-priority pages first (DFP, Flight Details)
4. Roll out to remaining pages
5. Test print functionality
6. Add export/download options if needed