# Add Flight Tile Modal Fixes

## Issues to Fix
1. [x] Auto-populate callsign from Captain's profile (callsignNumber field)
2. [x] Fix "Add to Schedule" button - calling `handleSaveEvent` instead of `handleSaveEvents`
3. [x] Reset form data when event category changes
4. [x] Default to SOLO for SCT and TWR DI event categories

## Implementation Plan
- [x] Read and understand current code structure
- [x] Fix App.tsx - change `handleSaveEvent` to `handleSaveEvents`
- [x] Add useEffect in AddFlightTileModal to auto-populate callsign when picName changes
- [x] Add useEffect to reset form when eventCategory changes
- [x] Add useEffect to set flightType to 'Solo' when eventCategory is 'sct' or 'twr_di'
- [x] Commit and push changes