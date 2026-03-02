/**
 * Calculates the average aircraft availability across the day's flying window.
 * 
 * This function performs a time-weighted average calculation based on:
 * 1. The day's flying window (from Build Priorities → Build Factors → Day Flying Window)
 * 2. The aircraft availability timeline as a sequence of time-stamped values
 */

interface AvailabilityChange {
  timestamp: number; // Time in hours (e.g., 8.0 for 0800, 16.0 for 1600)
  availability: number; // Number of aircraft available
}

interface FlyingWindow {
  startTime: number; // Start time in hours (e.g., 8.0 for 0800)
  endTime: number; // End time in hours (e.g., 16.0 for 1600)
}

interface AvailabilitySegment {
  startTime: number;
  endTime: number;
  availability: number;
  duration: number;
}

/**
 * Calculate average aircraft availability across the flying window
 */
export function calculateAverageAircraftAvailability(
  flyingWindow: FlyingWindow,
  availabilityTimeline: AvailabilityChange[]
): number {
  // Edge case: empty timeline
  if (availabilityTimeline.length === 0) {
    return 0;
  }

  // Step 1: Filter availability changes to only those within the flying window
  const relevantChanges = availabilityTimeline.filter(change => 
    change.timestamp < flyingWindow.endTime
  );

  // If no changes within window, we need to determine the availability at window start
  if (relevantChanges.length === 0) {
    // Find the last change before the window start
    const lastChangeBeforeWindow = availabilityTimeline
      .filter(change => change.timestamp < flyingWindow.startTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return lastChangeBeforeWindow?.availability || 0;
  }

  // Step 2: Determine availability at window start
  const windowStartAvailability = (() => {
    const changeAtOrBeforeStart = availabilityTimeline
      .filter(change => change.timestamp <= flyingWindow.startTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    return changeAtOrBeforeStart?.availability || 0;
  })();

  // Step 3: Create segments
  const segments: AvailabilitySegment[] = [];
  
  // Start with window start
  let currentSegmentStart = flyingWindow.startTime;
  let currentAvailability = windowStartAvailability;

  // Sort changes by timestamp
  const sortedChanges = relevantChanges.sort((a, b) => a.timestamp - b.timestamp);

  for (const change of sortedChanges) {
    // If this change happens after our current segment start and within window
    if (change.timestamp > currentSegmentStart && change.timestamp < flyingWindow.endTime) {
      // Close current segment
      segments.push({
        startTime: currentSegmentStart,
        endTime: change.timestamp,
        availability: currentAvailability,
        duration: change.timestamp - currentSegmentStart
      });
      
      // Start new segment
      currentSegmentStart = change.timestamp;
      currentAvailability = change.availability;
    }
  }

  // Add final segment to window end
  if (currentSegmentStart < flyingWindow.endTime) {
    segments.push({
      startTime: currentSegmentStart,
      endTime: flyingWindow.endTime,
      availability: currentAvailability,
      duration: flyingWindow.endTime - currentSegmentStart
    });
  }

  // Step 4: Calculate total aircraft-hours
  const totalAircraftHours = segments.reduce((sum, segment) => {
    return sum + (segment.availability * segment.duration);
  }, 0);

  // Step 5: Calculate average
  const totalWindowDuration = flyingWindow.endTime - flyingWindow.startTime;
  const averageAvailability = totalAircraftHours / totalWindowDuration;

  // Debug information
  console.log('Aircraft Availability Calculation:', {
    flyingWindow,
    availabilityTimeline,
    segments,
    totalAircraftHours,
    totalWindowDuration,
    averageAvailability
  });

  return averageAvailability;
}

/**
 * Parse time string to decimal hours (e.g., "0800" -> 8.0, "1230" -> 12.5)
 */
export function parseTimeString(timeString: string): number {
  if (typeof timeString === 'number') return timeString;
  
  const cleanTime = timeString.replace(/[^0-9]/g, '');
  if (cleanTime.length === 4) {
    const hours = parseInt(cleanTime.substring(0, 2));
    const minutes = parseInt(cleanTime.substring(2, 4));
    return hours + minutes / 60;
  }
  return parseFloat(timeString) || 0;
}

/**
 * Create availability timeline from user input format
 */
export function createAvailabilityTimeline(changes: {time: string, availability: number}[]): AvailabilityChange[] {
  return changes.map(change => ({
    timestamp: parseTimeString(change.time),
    availability: change.availability
  })).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Example usage function
 */
export function exampleCalculation() {
  // Example: Flying window 0800-1600
  const flyingWindow: FlyingWindow = {
    startTime: 8.0,  // 0800
    endTime: 16.0    // 1600
  };

  // Example: 10 aircraft from 0800-1200, then 20 aircraft from 1200-1600
  const availabilityTimeline: AvailabilityChange[] = [
    { timestamp: 8.0, availability: 10 },  // At 0800: 10 aircraft
    { timestamp: 12.0, availability: 20 }, // At 1200: changed to 20 aircraft
  ];

  const average = calculateAverageAircraftAvailability(flyingWindow, availabilityTimeline);
  console.log(`Average aircraft availability: ${average}`);
  
  // Expected output: Average aircraft availability: 15
  return average;
}