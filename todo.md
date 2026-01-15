# Add OFI Staff to Staff Roster Page

## Problem
- Alexander Burns (SQNLDR, PMKEYS 8201112) is in the database with role='OFI'
- He is NOT showing in the Staff Roster page (InstructorListView)
- Staff Roster only shows: QFI (role='QFI' || isQFI=true) and SIM IP (role='SIM IP')
- Missing: OFI staff (role='OFI' || isOFI=true)

## Requirements
- All Staff in the database that have QFI, SIM IP, or OFI role should be included in Staff Roster
- Real database staff should be merged with mock data

## Solution Implemented
1. ✅ Add OFI filtering logic to InstructorListView.tsx (role='OFI' || isOFI=true)
2. ✅ Add OFI column display (purple theme) to Staff Roster page
3. ✅ Add useEffect to fetch database staff from /api/personnel endpoint
4. ✅ Merge database staff with mockdata, removing duplicates by idNumber

## Files Modified
- `/workspace/components/InstructorListView.tsx` - Added OFI column and filtering logic
- `/workspace/App.tsx` - Added useEffect to load database staff and merge with mockdata

## Status
- [x] Identified the issue
- [x] Modified InstructorListView.tsx to add OFI filtering
- [x] Added OFI column display
- [x] Added database staff loading useEffect
- [x] Built and deployed changes
- [ ] Test that Alexander Burns appears in Staff Roster after Railway deployment

## Commit
`0fcf44e` - "feat: Add OFI column to Staff Roster and merge database staff"