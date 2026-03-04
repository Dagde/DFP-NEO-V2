import { Trainee, DailyRecord, Aircraft, Flight, EventType } from './db';

// Format date and time for display
export function formatDateTime(date: Date): string {
  return date.toLocaleString();
}

// Calculate course statistics
export function calculateCourseStatistics(trainees: Trainee[], dailyRecords: DailyRecord[]) {
  const courseStats: { [key: string]: any } = {};
  
  // Group trainees by course
  const traineesByCourse = trainees.reduce((acc, trainee) => {
    if (!acc[trainee.course]) {
      acc[trainee.course] = [];
    }
    acc[trainee.course].push(trainee);
    return acc;
  }, {} as { [key: string]: Trainee[] });
  
  // Calculate stats for each course
  Object.keys(traineesByCourse).forEach(course => {
    const courseTrainees = traineesByCourse[course];
    const totalTrainees = courseTrainees.length;
    const availableTrainees = courseTrainees.filter(t => !t.isPaused).length;
    
    courseStats[course] = {
      totalTrainees,
      availableTrainees,
      pausedTrainees: totalTrainees - availableTrainees,
      averageProgress: 0, // Calculate based on daily records
      completionRate: 0
    };
  });
  
  return courseStats;
}

// Format flight information
export function formatFlightInfo(flight: Flight): string {
  return `${flight.eventType} - ${flight.aircraft || 'No Aircraft'}`;
}

// Calculate trainee progress
export function calculateTraineeProgress(trainee: Trainee, dailyRecords: DailyRecord[]): number {
  // Implementation would depend on how progress is tracked
  return 0;
}

// Get trainee status
export function getTraineeStatus(trainee: Trainee): string {
  if (trainee.isPaused) return 'Paused';
  if (trainee.unavailability && trainee.unavailability.length > 0) return 'Unavailable';
  return 'Active';
}

// Format availability status
export function formatAvailabilityStatus(available: number, total: number): string {
  const percentage = total > 0 ? Math.round((available / total) * 100) : 0;
  return `${available}/${total} (${percentage}%)`;
}