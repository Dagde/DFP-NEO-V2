# Flight Hours Source Documentation

## Where the App Gets Flight Length When Building Flight Tiles

### Answer: The app gets the flight length from **`syllabusItem.duration`**

### Data Flow:

1. **Source: `mockData.ts`** - The `createSyllabusItem` function sets the `duration` property:
   ```typescript
   // For flights (type === 'Flight'):
   flightOrSimHours = 1.2;  // Updated value
   totalEventHours = 2.7;   // Updated value
   duration: isGround ? totalEventHours : flightOrSimHours
   ```
   
   For flights, `duration` is set to `flightOrSimHours` (now 1.2 hours)

2. **Usage in DFP Build Algorithm** - In `App.tsx`, when creating ScheduleEvent objects:
   ```typescript
   return {
       id: uuidv4(),
       type: type,
       flightNumber: syllabusItem.id,
       duration: syllabusItem.duration,  // <-- Flight length comes from here
       startTime,
       resourceId,
       // ... other properties
   };
   ```

3. **Booking Window Calculation** - The app uses `syllabusItem.duration` to calculate booking windows:
   ```typescript
   const getEventBookingWindowForAlgo = (event, syllabusDetails) => {
       const syllabusItem = syllabusDetails.find(s => s.id === event.flightNumber);
       if (syllabusItem) {
           const start = event.startTime - syllabusItem.preFlightTime;
           const end = event.startTime + event.duration + syllabusItem.postFlightTime;
           return { start, end };
       }
       return { start: event.startTime, end: event.startTime + event.duration };
   };
   ```

### Key Properties:

- **`syllabusItem.duration`**: The actual flight/sim time (used for event scheduling)
- **`syllabusItem.totalEventHours`**: Total time including brief/debrief (used for Master LMP display)
- **`syllabusItem.preFlightTime`**: Time before the flight (brief, etc.)
- **`syllabusItem.postFlightTime`**: Time after the flight (debrief, etc.)

### Recent Changes:

**Before:**
- BNF flights: `flightOrSimHours = 1.0`, `totalEventHours = 2.5`
- Other flights: `flightOrSimHours = 1.5`, `totalEventHours = 3.0`

**After:**
- All flights: `flightOrSimHours = 1.2`, `totalEventHours = 2.7`

### Deployment Status:

✅ **Changes committed and pushed:**
- Commit: `4ea85983`
- Branch: `feature/comprehensive-build-algorithm`
- Directory: `DFP-NEO-V2-fresh` (correct Railway deployment directory)

⚠️ **Railway Deployment:**
- Railway will automatically rebuild when it detects the new commit
- The build command is: `cd DFP-NEO-V2-fresh && npm ci && npm run build`
- The updated `index.js` bundle includes the new 1.2 hour flight times

### To Verify Changes:

Once Railway deploys the new commit, the Master LMP should show:
- **TOTAL EVENT HRS: 2.7 hrs** (was 3.0 hrs)
- **DURATION: 2.7 hrs** (was 3.6 hrs - preFlightTime + flightOrSimHours + postFlightTime)

### Master LMP Display:

The Master LMP (Syllabus tab) displays values from the syllabus item properties:
- "Flight/Sim Hrs" or "Flight/Sim" field shows `flightOrSimHours`
- "TOTAL EVENT HRS" field shows `totalEventHours`
- "DURATION" field shows the calculated total (preFlightTime + flightOrSimHours + postFlightTime)

All these values are now updated to reflect the 1.2 hour flight duration.