# Implementation Plan for Add Flight Tile Modal Changes

## Requirements:
1. When "Add Deployment Tile" checkbox is ticked, hide all flight-related options except Deployment Period and number of aircraft
2. Start time and end time should have dropdown lists with 30-minute intervals (0000 to 2330)
3. Default setting is 0800
4. Manual time entry should be permitted
5. Date window needs to be wider (year is obscured)

## Changes Made:

1. ✅ Added deploymentTimeOptions with 30-minute intervals (0000-2330)
2. ✅ Changed default deployment times to '08:00'
3. ✅ Widened date/time inputs with min-w-[140px]
4. ⚠️ Conditional rendering needs to be fixed

## Issue:
The current implementation has broken JSX structure due to incorrect placement of conditional blocks.

## Fix Required:
Need to properly structure the JSX to have:
- Deployment Checkbox ALWAYS visible
- When isDeploy=true: Show Deployment Details, hide Flight Type, Location, Date, Notes
- When isDeploy=false: Show Flight Type, Location, Date, Notes, hide Deployment Details

Let me create a clean, complete fix.