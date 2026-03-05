# DFP-NEO-V2 Sync Fix Tasks

## Completed
- [x] Fix ReferenceError: "can't access lexical declaration 'B' before initialization"
  - Moved sync useEffect to after state declarations
  - Fixed isDraggingRef.current usage
- [x] Fix bounce-back bug on schedule line drag
  - Root cause: Panel's sync useEffect was calling onUpdateCurrentAvailability when receiving external updates, creating a feedback loop
  - Fix: Panel now only updates local display when receiving external plannedAvailability changes

## Remaining
- [ ] Verify fix works in deployed app