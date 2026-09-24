# NEO Guide Intent Coverage Gap Report

Generated: 2026-09-24T10:40:46.730Z
Curated functions: 59
Candidate gaps: 25

This report flags user-facing controls and generated functions that look insufficiently covered by the curated NEO Guide intent library. It is a triage aid, not proof that every listed item needs a new intent.

## components/FlightDetailModal.tsx

- Delete Event
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.57)
- Restore to Schedule Removes the cancellation and restores this event to active status with full functionality.
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.80)
- Cancel Flight Stays on the schedule with a redline through it. Requires a cancellation code.
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.67)
- Remove from Schedule Permanently removes the event. Not visible on the schedule and deleted from the database.
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.78)
- Yes, Restore Event
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.67)

## components/PauseFlightOpsPanel.tsx

- Clear all selections and restore the original Active DFP schedule
  - Risk score: 9
  - Best curated match: Cancel, restore or delete a scheduled event (0.50)
- Discard all changes and restore the original Active DFP schedule
  - Risk score: 7
  - Best curated match: Pause Flight Ops (0.75)

## components/SctRequestFlyout.tsx

- Configure continuationLongLabel events in Settings
  - Risk score: 8
  - Best curated match: Initial Setup Wizard (0.50)

## components/AuthorisationFlyout.tsx

- Enter any authorisation notes here...
  - Risk score: 7
  - Best curated match: Authorisation notes (0.80)

## components/CourseRosterView.tsx

- canViewTraineeProfile(trainee) ? statusLabel : 'Your permission profile does not allow this trainee profile'
  - Risk score: 7
  - Best curated match: Primary and Secondary Instructor (0.50)

## components/AddRemedialPackageFlyout.tsx

- instructor.name
  - Risk score: 6
  - Best curated match: Staff unavailability (0.50)
- getEventOptionLabel(event)
  - Risk score: 6
  - Best curated match: Trainee unavailability (0.50)

## components/CourseEditFlyout.tsx

- formatPersonOptionLabel(staff)
  - Risk score: 6
  - Best curated match: Staff unavailability (0.50)
- formatPersonOptionLabel(staff)
  - Risk score: 6
  - Best curated match: Staff unavailability (0.50)
- Enter new course number...
  - Risk score: 6
  - Best curated match: Initial Setup Wizard (0.50)

## components/CurrencyBuilderView.tsx

- Input Type(s) in Post-Flight (select all that apply)
  - Risk score: 6
  - Best curated match: Special continuation training request (0.50)
- Input Type(s) in Post-Flight (select all that apply)
  - Risk score: 6
  - Best curated match: Special continuation training request (0.50)

## components/CurrencySetupFlyout.tsx

- currency.name
  - Risk score: 6
  - Best curated match: Currency builder (0.50)

## components/DeleteTraineeConfirmation.tsx

- formatPersonOptionLabel(trainee)
  - Risk score: 6
  - Best curated match: Trainee unavailability (0.50)

## components/InstructorProfileFlyout.tsx

- Generate Report
  - Risk score: 6
  - Best curated match: Course Progress (0.50)

## components/PrioritiesView.tsx

- Select second pilot / Solo Solo
  - Risk score: 6
  - Best curated match: Authorisation notes (0.50)
- Select second pilot / Solo
  - Risk score: 6
  - Best curated match: Authorisation notes (0.50)

## components/ScoringMatrixFlyout.tsx

- Add new flight element
  - Risk score: 6
  - Best curated match: Add flight tile (0.75)

## components/TraineeProfileFlyout.tsx

- event.id
  - Risk score: 6
  - Best curated match: Trainee unavailability (0.50)
- View Individual LMP
  - Risk score: 6
  - Best curated match: Master LMP Access (0.67)
