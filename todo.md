# Add OFI Staff to Staff Roster Page

## Problem
- Alexander Burns (SQNLDR, PMKEYS 8201112) is in the database with role='OFI'
- He is NOT showing in the Staff Roster page (InstructorListView)
- Staff Roster only shows: QFI (role='QFI' || isQFI=true) and SIM IP (role='SIM IP')
- Missing: OFI staff (role='OFI' || isOFI=true)

## Requirements
- All Staff in the database that have QFI, SIM IP, or OFI role should be included in Staff Roster
- Real database staff should be merged with mock data

## Solution
1. Add OFI column to Staff Roster page (similar to SIM IP column)
2. Filter OFI staff: role='OFI' || isOFI=true
3. Merge real database staff (from /api/personnel) with mock data
4. Display OFI staff in their own column

## Files to Modify
- `/workspace/components/InstructorListView.tsx` - Add OFI column and filtering logic
- `/workspace/App.tsx` - Ensure database staff are loaded into instructorsData state

## Status
- [x] Identified the issue
- [ ] Modify InstructorListView.tsx to add OFI filtering
- [ ] Add OFI column display
- [ ] Test that Alexander Burns appears in Staff Roster