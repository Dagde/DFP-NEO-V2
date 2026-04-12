// Aircraft Availability Types

export interface AircraftAvailabilitySnapshot {
    timestamp: Date;
    available: number;
    total: number;
    notes?: string;
}

export interface DailyAvailabilityRecord {
    date: string; // YYYY-MM-DD format
    snapshots: AircraftAvailabilitySnapshot[];
    averageAvailability: number; // Calculated average for the day
    dayFlyingStart: string; // HH:mm format
    dayFlyingEnd: string; // HH:mm format
}

export interface WeeklyAvailabilityRecord {
    weekStart: string; // YYYY-MM-DD format (Monday)
    weekEnd: string; // YYYY-MM-DD format (Sunday)
    averageAvailability: number;
    dailyRecords: DailyAvailabilityRecord[];
}

export interface MonthlyAvailabilityRecord {
    month: string; // YYYY-MM format
    averageAvailability: number;
    dailyRecords: DailyAvailabilityRecord[];
}

export interface AircraftAvailabilityHistory {
    dailyRecords: Map<string, DailyAvailabilityRecord>;
    weeklyRecords: Map<string, WeeklyAvailabilityRecord>;
    monthlyRecords: Map<string, MonthlyAvailabilityRecord>;
}