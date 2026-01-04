# SOLO Flight Display Fix

## Problem Analysis
- [x] Identified that SOLO flight is showing pilot name twice instead of "SOLO" badge
- [x] Confirmed the issue is that `event.flightType` is not set to "Solo" in the event data
- [x] The FlightTile component logic is correct, but the data coming from the backend is wrong

## Tasks to Fix

### 1. Backend Data Investigation
- [ ] Check how SOLO flights are stored in the database
- [ ] Verify the `flightType` field is being set correctly when creating SOLO flights
- [ ] Check if there's a data migration needed to fix existing SOLO flights

### 2. Frontend Detection Enhancement
- [ ] Add fallback SOLO detection logic that checks if pilot and student are the same person
- [ ] Implement this in the FlightTile component as a backup detection method

### 3. Testing
- [ ] Verify SOLO flights display correctly after fix
- [ ] Test with both new and existing SOLO flights