/**
 * Comprehensive validation system for unavailability periods
 * Provides detailed error messages and remediation instructions
 */

export interface ValidationError {
    type: 'error' | 'warning';
    field: 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'overlap' | 'general';
    message: string;
    remediation: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Validates unavailability period data with comprehensive error checking
 */
export function validateUnavailabilityPeriod(
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string,
    reason: string,
    existingPeriods?: any[]
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Validate required fields
    if (!startDate) {
        errors.push({
            type: 'error',
            field: 'startDate',
            message: 'Start date is required',
            remediation: 'Please select a start date from the calendar'
        });
    }

    if (!endDate) {
        errors.push({
            type: 'error',
            field: 'endDate',
            message: 'End date is required',
            remediation: 'Please select an end date from the calendar'
        });
    }

    // Validate time format
    const validateTimeFormat = (time: string, fieldName: 'startTime' | 'endTime'): boolean => {
        if (!time) return true; // Empty time is valid (all-day event)
        
        if (time.length !== 4) {
            errors.push({
                type: 'error',
                field: fieldName,
                message: `Invalid ${fieldName === 'startTime' ? 'start' : 'end'} time format`,
                remediation: 'Time must be exactly 4 digits in HHMM format (e.g., 0900 for 9:00 AM, 1400 for 2:00 PM)'
            });
            return false;
        }

        const hours = parseInt(time.substring(0, 2));
        const minutes = parseInt(time.substring(2, 4));

        if (isNaN(hours) || isNaN(minutes)) {
            errors.push({
                type: 'error',
                field: fieldName,
                message: `Invalid ${fieldName === 'startTime' ? 'start' : 'end'} time values`,
                remediation: 'Time must contain only numbers. Hours (00-23) and minutes (00-59)'
            });
            return false;
        }

        if (hours < 0 || hours > 23) {
            errors.push({
                type: 'error',
                field: fieldName,
                message: `${fieldName === 'startTime' ? 'Start' : 'End'} hour out of range`,
                remediation: 'Hours must be between 00 and 23. Use 24-hour format (e.g., 09 for 9 AM, 14 for 2 PM, 23 for 11 PM)'
            });
            return false;
        }

        if (minutes < 0 || minutes > 59) {
            errors.push({
                type: 'error',
                field: fieldName,
                message: `${fieldName === 'startTime' ? 'Start' : 'End'} minutes out of range`,
                remediation: 'Minutes must be between 00 and 59 (e.g., 00, 15, 30, 45)'
            });
            return false;
        }

        return true;
    };

    const isStartTimeValid = validateTimeFormat(startTime, 'startTime');
    const isEndTimeValid = validateTimeFormat(endTime, 'endTime');

    // If there are format errors, stop further validation
    if (errors.some(e => e.field === 'startTime' || e.field === 'endDate' || e.field === 'startDate')) {
        return { isValid: false, errors, warnings };
    }

    // Parse dates for comparison
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    // Validate date logic
    if (end < start) {
        errors.push({
            type: 'error',
            field: 'endDate',
            message: 'End date cannot be before start date',
            remediation: 'Select an end date that is the same as or after the start date'
        });
        return { isValid: false, errors, warnings };
    }

    const isAllDay = !startTime && !endTime;

    // Validate all-day events
    if (isAllDay) {
        if (end.getTime() === start.getTime()) {
            errors.push({
                type: 'error',
                field: 'endDate',
                message: 'All-day unavailability must span at least one full day',
                remediation: 'For a single all-day unavailability, set the end date to the next day. Example: If unavailable on Dec 15, set start date to Dec 15 and end date to Dec 16.'
            });
        }
    }

    // Validate timed events
    if (!isAllDay && isStartTimeValid && isEndTimeValid) {
        const startDecimal = parseFloat(startTime) / 100;
        const endDecimal = parseFloat(endTime) / 100;

        if (startDecimal >= endDecimal && start.getTime() === end.getTime()) {
            errors.push({
                type: 'error',
                field: 'endTime',
                message: 'End time must be after start time for same-day events',
                remediation: 'Set an end time that is later than the start time. Example: Start 0900, End 1200'
            });
        }

        // Check for reasonable times (business hours warning)
        if (startDecimal < 6 || endDecimal > 22) {
            warnings.push({
                type: 'warning',
                field: 'startTime',
                message: 'Unavailability times are outside normal operating hours',
                remediation: 'Consider if these times are correct. Normal operating hours are 0600-2200 (6:00 AM - 10:00 PM)'
            });
        }

        // Check for very short durations
        if (startDecimal > 0 && endDecimal > 0 && (endDecimal - startDecimal) < 0.5) {
            warnings.push({
                type: 'warning',
                field: 'startTime',
                message: 'Very short unavailability period',
                remediation: 'This is less than 30 minutes. Consider if this duration is correct or if it should be longer'
            });
        }

        // Multi-day timed event validation
        if (start.getTime() !== end.getTime()) {
            if (startDecimal > 0 && endDecimal < 23.983) {
                warnings.push({
                    type: 'warning',
                    field: 'endTime',
                    message: 'Multi-day timed event with specific end time',
                    remediation: 'For multi-day unavailability, consider using full-day (0001-2359) or setting end time to 2359 for last day'
                });
            }
        }
    }

    // Validate reason
    if (!reason || reason.trim() === '') {
        errors.push({
            type: 'error',
            field: 'general',
            message: 'Reason for unavailability is required',
            remediation: 'Please select a reason from the dropdown menu'
        });
    }

    // Check for overlapping periods (if existing periods provided)
    if (existingPeriods && existingPeriods.length > 0) {
        const overlaps = findOverlappingPeriods({
            startDate,
            endDate,
            startTime,
            endTime,
            allDay: isAllDay
        }, existingPeriods);

        if (overlaps.length > 0) {
            warnings.push({
                type: 'warning',
                field: 'overlap',
                message: `Overlaps with ${overlaps.length} existing unavailability period(s)`,
                remediation: 'Review existing unavailability periods to avoid duplication. Overlapping periods may not display correctly in the schedule.'
            });
        }
    }

    // Check for very long unavailability periods
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
        warnings.push({
            type: 'warning',
            field: 'endDate',
            message: 'Very long unavailability period',
            remediation: 'This unavailability spans more than 30 days. Please verify this is correct or consider breaking it into shorter periods'
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Finds overlapping unavailability periods
 */
function findOverlappingPeriods(newPeriod: any, existingPeriods: any[]): any[] {
    const overlaps: any[] = [];
    
    for (const existing of existingPeriods) {
        if (periodsOverlap(newPeriod, existing)) {
            overlaps.push(existing);
        }
    }
    
    return overlaps;
}

/**
 * Checks if two unavailability periods overlap
 */
function periodsOverlap(period1: any, period2: any): boolean {
    const start1 = new Date(period1.startDate + 'T00:00:00Z');
    const end1 = new Date(period1.endDate + 'T00:00:00Z');
    const start2 = new Date(period2.startDate + 'T00:00:00Z');
    const end2 = new Date(period2.endDate + 'T00:00:00Z');
    
    // Adjust end dates for all-day events
    if (period1.allDay) {
        end1.setUTCDate(end1.getUTCDate() - 1);
    }
    if (period2.allDay) {
        end2.setUTCDate(end2.getUTCDate() - 1);
    }
    
    return start1 <= end2 && start2 <= end1;
}

/**
 * Formats validation errors for display
 */
export function formatValidationMessage(validation: ValidationResult): string {
    if (validation.isValid) {
        return '';
    }

    const errorMessages = validation.errors.map(error => {
        return `❌ ${error.message}\n   🔧 ${error.remediation}`;
    }).join('\n\n');

    const warningMessages = validation.warnings.map(warning => {
        return `⚠️ ${warning.message}\n   💡 ${warning.remediation}`;
    }).join('\n\n');

    let message = '';
    if (errorMessages) {
        message += 'ERRORS:\n' + errorMessages;
    }
    if (warningMessages) {
        if (message) message += '\n\n';
        message += 'WARNINGS:\n' + warningMessages;
    }

    return message;
}