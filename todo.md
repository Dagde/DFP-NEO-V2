# Fix Solo Flight Formatting in Flight Details Modal

## Status: In Progress

## Tasks

### 1. Understand Current Code
- [x] Examine FlightDetailsModal component
- [x] Identify where pilot/crew information is displayed
- [x] Understand current Solo vs Dual logic

### 2. Implement Solo Formatting Fix
- [x] Write new code to handle Solo flights correctly
- [x] Ensure PIC position shows the pilot (staff or trainee)
- [x] Ensure second position shows yellow "SOLO" badge
- [x] Apply to LMP, SCT, and TWR DI events

### 3. Test and Deploy
- [ ] Build the application
- [ ] Test the changes
- [ ] Push to GitHub
- [ ] Verify deployment

## Requirements
- Solo flights: Show pilot in PIC position, "SOLO" in second position
- Applies to: LMP events, SCT events, TWR DI events
- Must not break existing Dual flight functionality

## Changes Made
- Modified FlightDetailModal.tsx display section (lines 1818-1841)
- Changed Solo flight display from "Pilot: [name]" to:
  * "PIC: [name]"
  * "Second Position: SOLO" (with yellow badge styling)