// Aircraft Availability Utility Functions

import { AircraftAvailabilitySnapshot, DailyAvailabilityRecord } from '../types/AircraftAvailability';

/**
 * Calculate time-weighted average availability for a day
 * FOLLOWING THE CORRECT ALGORITHM:
 * 1. Get flying window (start/end times)
 * 2. Read availability as timeline of time-stamped values
 * 3. Break window into segments where availability is constant
 * 4. Calculate (availability × duration) for each segment
 * 5. Average = total contribution ÷ total window duration
 * 
 * @param availabilityTimeline Array of {time: string, availability: number} - time-stamped availability changes
 * @param windowStart Flying window start time (e.g., "0800")
 * @param windowEnd Flying window end time (e.g., "1600")
 * @returns Average availability rounded to 1 decimal place
 */
export function calculateDailyAverageAvailability(
    availabilityTimeline: {time: string, availability: number}[],
    windowStart: string,
    windowEnd: string
): number {
    console.log('\n=== AIRCRAFT AVAILABILITY CALCULATION ===');
    console.log('Flying Window:', windowStart, '-', windowEnd);
    console.log('Timeline:', availabilityTimeline);

       // Step 1: Parse flying window times to decimal hours
       const parseTime = (timeStr: string): number => {
           if (!timeStr) {
               console.log('❌ Invalid time string provided:', timeStr);
               return 0;
           }
           
           if (timeStr.includes(':')) {
               const [hours, minutes] = timeStr.split(':').map(Number);
               return hours + minutes / 60;
           }
           // Handle format like "0800"
           const hours = parseInt(timeStr.substring(0, 2));
           const minutes = parseInt(timeStr.substring(2, 4));
           return hours + minutes / 60;
       };

       const startTime = parseTime(windowStart);
       const endTime = parseTime(windowEnd);
       const totalWindowDuration = endTime - startTime;

       console.log('Parsed times: start=', startTime, 'end=', endTime, 'duration=', totalWindowDuration, 'hours');

       if (totalWindowDuration <= 0) {
           console.log('❌ Invalid flying window');
           return 0;
       }

       // Step 2: Sort timeline and filter to relevant changes
       const sortedTimeline = availabilityTimeline
        .map(item => ({ time: parseTime(item.time), availability: item.availability }))
        .sort((a, b) => a.time - b.time)
        .filter(item => item.time < endTime); // Ignore changes after window end

    console.log('Sorted timeline:', sortedTimeline);

    // Step 3: Determine availability at window start
    const availabilityAtStart = (() => {
        const changeAtOrBeforeStart = sortedTimeline
            .filter(item => item.time <= startTime)
            .pop();
        return changeAtOrBeforeStart?.availability || sortedTimeline[0]?.availability || 0;
    })();

    console.log('Availability at window start:', availabilityAtStart);

    // Step 4: Create segments where availability is constant
    const segments = [];
    let currentSegmentStart = startTime;
    let currentAvailability = availabilityAtStart;

    for (const change of sortedTimeline) {
        if (change.time > currentSegmentStart && change.time < endTime) {
            // Close current segment at the change time
            const segmentDuration = change.time - currentSegmentStart;
            const contribution = currentAvailability * segmentDuration;
            
            segments.push({
                start: currentSegmentStart,
                end: change.time,
                availability: currentAvailability,
                duration: segmentDuration,
                contribution: contribution
            });

            console.log(`Segment: ${currentSegmentStart.toFixed(2)}-${change.time.toFixed(2)} hours, availability=${currentAvailability}, duration=${segmentDuration.toFixed(2)}h, contribution=${contribution.toFixed(2)}`);

            // Start new segment
            currentSegmentStart = change.time;
            currentAvailability = change.availability;
        }
    }

    // Add final segment to window end
    if (currentSegmentStart < endTime) {
        const segmentDuration = endTime - currentSegmentStart;
        const contribution = currentAvailability * segmentDuration;
        
        segments.push({
            start: currentSegmentStart,
            end: endTime,
            availability: currentAvailability,
            duration: segmentDuration,
            contribution: contribution
        });

        console.log(`Final segment: ${currentSegmentStart.toFixed(2)}-${endTime.toFixed(2)} hours, availability=${currentAvailability}, duration=${segmentDuration.toFixed(2)}h, contribution=${contribution.toFixed(2)}`);
    }

    // Step 5: Calculate total aircraft-hours and average
    const totalAircraftHours = segments.reduce((sum, segment) => sum + segment.contribution, 0);
    const averageAvailability = totalAircraftHours / totalWindowDuration;

    console.log('\n=== CALCULATION SUMMARY ===');
    console.log('Total window duration:', totalWindowDuration.toFixed(2), 'hours');
    console.log('Total aircraft-hours:', totalAircraftHours.toFixed(2));
    console.log('Average availability:', averageAvailability.toFixed(2), 'aircraft');
    console.log('=== END CALCULATION ===\n');

    return Math.round(averageAvailability * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate weekly average from daily records
 */
export function calculateWeeklyAverage(dailyRecords: DailyAvailabilityRecord[]): number {
    if (dailyRecords.length === 0) return 0;
    
    const sum = dailyRecords.reduce((acc, record) => acc + record.averageAvailability, 0);
    const average = sum / dailyRecords.length;
    return Math.round(average * 10) / 10;
}

/**
 * Calculate monthly average from daily records
 */
export function calculateMonthlyAverage(dailyRecords: DailyAvailabilityRecord[]): number {
    if (dailyRecords.length === 0) return 0;
    
    const sum = dailyRecords.reduce((acc, record) => acc + record.averageAvailability, 0);
    const average = sum / dailyRecords.length;
    return Math.round(average * 10) / 10;
}

/**
 * Get date range for last N weeks
 */
export function getLastNWeeksRange(weeks: number): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (weeks * 7));
    return { start, end };
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Get week start (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

/**
 * Get week end (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return end;
}

/**
 * Format time as HH:mm
 */
export function formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
}

/**
 * Parse time string (HH:mm) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:mm format
 */
export function minutesToTimeString(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Calculate time-weighted average availability from flying window start to current time
 * This is used for live calculations during the day
 * 
 * @param availabilityTimeline Array of {time: string, availability: number} - time-stamped availability changes
 * @param windowStart Flying window start time (e.g., "0800")
 * @param windowEnd Flying window end time (e.g., "1600")
 * @returns Average availability rounded to 1 decimal place
 */
export function calculateCurrentDayAvailability(
    availabilityTimeline: {time: string, availability: number}[],
    windowStart: string,
    windowEnd: string
): number {
    console.log('\n=== CURRENT DAY AVAILABILITY CALCULATION ===');
    console.log('Flying Window:', windowStart, '-', windowEnd);
    console.log('Timeline:', availabilityTimeline);

    // Step 1: Parse flying window times to decimal hours
    const parseTime = (timeStr: string): number => {
        if (!timeStr) {
            console.log('❌ Invalid time string provided:', timeStr);
            return 0;
        }
        
        if (timeStr.includes(':')) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours + minutes / 60;
        }
        // Handle format like "0800"
        const hours = parseInt(timeStr.substring(0, 2));
        const minutes = parseInt(timeStr.substring(2, 4));
        return hours + minutes / 60;
    };

    // Get current time
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHours + currentMinutes / 60;

    const startTime = parseTime(windowStart);
    const endTime = parseTime(windowEnd);

    // Use current time as the effective end time if we're still within the flying window
    const effectiveEndTime = Math.min(currentTime, endTime);
    const totalWindowDuration = effectiveEndTime - startTime;

    console.log('Current time:', currentTime.toFixed(2), 'hours');
    console.log('Effective window end:', effectiveEndTime.toFixed(2), 'hours');
    console.log('Parsed times: start=', startTime, 'end=', effectiveEndTime, 'duration=', totalWindowDuration, 'hours');

    if (totalWindowDuration <= 0) {
        console.log('❌ Invalid flying window or current time before window start');
        return 0;
    }

    // Step 2: Sort timeline and filter to relevant changes
    const sortedTimeline = availabilityTimeline
        .map(item => ({ time: parseTime(item.time), availability: item.availability }))
        .sort((a, b) => a.time - b.time)
        .filter(item => item.time < effectiveEndTime); // Ignore changes after effective end time

    console.log('Sorted timeline:', sortedTimeline);

    // Step 3: Determine availability at window start
    const availabilityAtStart = (() => {
        const changeAtOrBeforeStart = sortedTimeline
            .filter(item => item.time <= startTime)
            .pop();
        return changeAtOrBeforeStart?.availability || sortedTimeline[0]?.availability || 0;
    })();

    console.log('Availability at window start:', availabilityAtStart);

    // Step 4: Create segments where availability is constant
    const segments = [];
    let currentSegmentStart = startTime;
    let currentAvailability = availabilityAtStart;

    for (const change of sortedTimeline) {
        if (change.time > currentSegmentStart && change.time < effectiveEndTime) {
            // Close current segment at the change time
            const segmentDuration = change.time - currentSegmentStart;
            const contribution = currentAvailability * segmentDuration;
            
            segments.push({
                start: currentSegmentStart,
                end: change.time,
                availability: currentAvailability,
                duration: segmentDuration,
                contribution: contribution
            });

            console.log(`Segment: ${currentSegmentStart.toFixed(2)}-${change.time.toFixed(2)} hours, availability=${currentAvailability}, duration=${segmentDuration.toFixed(2)}h, contribution=${contribution.toFixed(2)}`);

            // Start new segment
            currentSegmentStart = change.time;
            currentAvailability = change.availability;
        }
    }

    // Add final segment to current time (or effective end time)
    if (currentSegmentStart < effectiveEndTime) {
        const segmentDuration = effectiveEndTime - currentSegmentStart;
        const contribution = currentAvailability * segmentDuration;
        
        segments.push({
            start: currentSegmentStart,
            end: effectiveEndTime,
            availability: currentAvailability,
            duration: segmentDuration,
            contribution: contribution
        });

        console.log(`Final segment: ${currentSegmentStart.toFixed(2)}-${effectiveEndTime.toFixed(2)} hours, availability=${currentAvailability}, duration=${segmentDuration.toFixed(2)}h, contribution=${contribution.toFixed(2)}`);
    }

    // Step 5: Calculate total aircraft-hours and average
    const totalAircraftHours = segments.reduce((sum, segment) => sum + segment.contribution, 0);
    const averageAvailability = totalAircraftHours / totalWindowDuration;

    console.log('\n=== CURRENT DAY CALCULATION SUMMARY ===');
    console.log('Total window duration:', totalWindowDuration.toFixed(2), 'hours');
    console.log('Total aircraft-hours:', totalAircraftHours.toFixed(2));
    console.log('Average availability:', averageAvailability.toFixed(2), 'aircraft');
    console.log('=== END CURRENT DAY CALCULATION ===\n');

    return Math.round(averageAvailability * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert AircraftAvailabilitySnapshot[] to timeline format for calculation
 * This bridges the gap between existing data format and the correct algorithm
 */
export function convertSnapshotsToTimeline(snapshots: AircraftAvailabilitySnapshot[]): {time: string, availability: number}[] {
    return snapshots.map(snapshot => ({
        time: new Date(snapshot.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        }).replace(':', ''),
        availability: snapshot.available
    }));
}
