# AC History Enhancement Tasks

## 1. Add Delete Button to Cancellation Codes Table
- [x] Add onDeleteCode prop to CancellationCodesTable interface
- [x] Add delete button to each row in the table
- [x] Implement delete confirmation dialog
- [x] Add delete handler in ACHistoryPage
- [x] Update localStorage when code is deleted
- [x] Prevent deletion of codes that are currently in use

## 2. Create Recent Cancellations Table
- [x] Create new component: RecentCancellationsTable.tsx
- [x] Display cancellation records with: date, flight/event name, personnel, cancellation code, reason
- [x] Add filtering by time period (Last 7 Days, Last 30 Days, Last 90 Days, All Time)
- [x] Add sorting capabilities (by date, by code, by personnel)
- [x] Style table to match existing design
- [x] Integrate into ACHistoryPage component

## 3. Move Cancelled Flights to STBY Line with Red X
- [x] Identify where flight cancellation logic is handled in App.tsx
- [x] When a flight is cancelled, move it to STBY line (already implemented)
- [x] Add visual indicator (red X overlay) to cancelled flight tiles
- [x] Update flight tile rendering to show red X for cancelled events
- [x] Ensure cancelled flights maintain their data but are visually distinct
- [ ] Test cancellation flow end-to-end

## 4. Testing & Integration
- [ ] Test delete functionality for cancellation codes
- [ ] Test recent cancellations table with various filters
- [ ] Test cancelled flight movement to STBY line
- [ ] Verify red X display on cancelled flights
- [x] Rebuild and deploy application