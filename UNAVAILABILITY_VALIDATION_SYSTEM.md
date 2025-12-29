# Unavailability Validation System Documentation

## Overview
A comprehensive validation system for unavailability data entry that provides detailed error messages and remediation instructions to help users correct data entry errors.

## Features

### 🔍 **Comprehensive Validation**
- **Required Fields**: Validates that all required fields are completed
- **Time Format**: Ensures HHMM format (0000-2359)
- **Date Logic**: Validates start/end date relationships
- **Time Logic**: Validates start/end time relationships
- **Overlap Detection**: Warns about overlapping unavailability periods
- **Duration Warnings**: Flags unusually long or short periods
- **Business Hours**: Warns about times outside normal operating hours

### 📝 **Detailed Error Messages**
Each validation error includes:
- **Clear Problem Description**: What's wrong
- **Specific Remediation**: How to fix it
- **Visual Indicators**: Field highlighting for problematic inputs

### ⚠️ **Warning System**
- Non-blocking warnings for potential issues
- User can choose to proceed with warnings
- Helpful suggestions for better data entry

## Validation Rules

### **Required Field Validation**
- Start Date: Must be selected
- End Date: Must be selected  
- Reason: Must be selected from dropdown

### **Time Format Validation**
- Format: Exactly 4 digits (HHMM)
- Hours: 00-23 (24-hour format)
- Minutes: 00-59
- Examples: 0900, 1400, 2359

### **Date Logic Validation**
- End date cannot be before start date
- All-day events must span at least one full day
- Multi-day events with times need special consideration

### **Time Logic Validation**
- End time must be after start time (same day events)
- Business hours check (0600-2200 warning)
- Minimum duration check (< 30 minutes warning)

### **Duration Validation**
- Single day: Start time → End time
- Multi-day start: Start time → 2359
- Multi-day end: 0001 → End time
- Middle days: 0001 → 2359 (full day)

## Error Message Examples

### **❌ Error Messages**

#### Missing Required Field
```
❌ Start date is required
   🔧 Please select a start date from the calendar
```

#### Invalid Time Format
```
❌ Invalid start time format
   🔧 Time must be exactly 4 digits in HHMM format (e.g., 0900 for 9:00 AM, 1400 for 2:00 PM)
```

#### Time Out of Range
```
❌ Start hour out of range
   🔧 Hours must be between 00 and 23. Use 24-hour format (e.g., 09 for 9 AM, 14 for 2 PM, 23 for 11 PM)
```

#### End Time Before Start Time
```
❌ End time must be after start time for same-day events
   🔧 Set an end time that is later than the start time. Example: Start 0900, End 1200
```

#### All-Day Event Logic
```
❌ All-day unavailability must span at least one full day
   🔧 For a single all-day unavailability, set the end date to the next day. Example: If unavailable on Dec 15, set start date to Dec 15 and end date to Dec 16.
```

### **⚠️ Warning Messages**

#### Outside Business Hours
```
⚠️ Unavailability times are outside normal operating hours
   💡 Consider if these times are correct. Normal operating hours are 0600-2200 (6:00 AM - 10:00 PM)
```

#### Very Short Duration
```
⚠️ Very short unavailability period
   💡 This is less than 30 minutes. Consider if this duration is correct or if it should be longer
```

#### Overlapping Periods
```
⚠️ Overlaps with 1 existing unavailability period(s)
   💡 Review existing unavailability periods to avoid duplication. Overlapping periods may not display correctly in the schedule.
```

#### Very Long Duration
```
⚠️ Very long unavailability period
   💡 This unavailability spans more than 30 days. Please verify this is correct or consider breaking it into shorter periods
```

## Implementation Details

### **Files Created**
- `utils/unavailabilityValidation.ts`: Core validation logic
- `components/ValidationErrorDisplay.tsx`: Error display component
- Updated `components/AddUnavailabilityFlyout.tsx`: Integration with validation system

### **Key Functions**

#### `validateUnavailabilityPeriod()`
Main validation function that returns a `ValidationResult` object containing:
- `isValid`: Boolean indicating if validation passed
- `errors`: Array of validation errors that prevent submission
- `warnings`: Array of warnings that don't prevent submission

#### `ValidationErrorDisplay Component`
Renders validation errors in a user-friendly format with:
- Red error boxes for blocking errors
- Yellow warning boxes for non-blocking warnings
- Clear icons and formatting
- Remediation instructions

### **Real-time Validation**
- Validation triggers on field changes after first submission attempt
- Fields with errors are highlighted with red borders
- Error display automatically scrolls into view
- Validation state persists until form is cleared or successfully submitted

## User Experience

### **Flow**
1. User fills out unavailability form
2. Clicks "Add Custom Period"
3. If errors exist, they are displayed with remediation instructions
4. Fields with errors are highlighted in red
5. User corrects errors and re-submits
6. If warnings exist, user can choose to proceed or make changes
7. Successful submission clears the form and validation state

### **Visual Feedback**
- ✅ Valid fields: Normal appearance
- ❌ Invalid fields: Red border highlighting
- 📄 Error display: Red box with clear error messages
- ⚠️ Warning display: Yellow box with helpful suggestions
- 🔄 Real-time updates: Validation updates as user types

## Testing Scenarios

### **Error Scenarios**
1. Missing start date
2. Missing end date
3. Invalid time format (e.g., "9:00", "25:00", "9abc")
4. Hours out of range (> 23)
5. Minutes out of range (> 59)
6. End date before start date
7. End time before start time (same day)
8. Single-day all-day event

### **Warning Scenarios**
1. Times before 0600 or after 2200
2. Duration less than 30 minutes
3. Overlapping unavailability periods
4. Periods longer than 30 days
5. Multi-day events with specific end times

### **Success Scenarios**
1. Valid single-day timed event
2. Valid multi-day all-day event
3. Valid multi-day timed event with proper logic
4. "Today Only" quick selection

## Deployment
- **Live URL**: https://sites.super.myninja.ai/d9db0e8f-9740-4599-bd24-0c029e49bfcf/d89706a5/index.html
- **Git Commit**: c8b220c - "Implement comprehensive unavailability validation system"
- **Branch**: feature/comprehensive-build-algorithm

This validation system significantly improves data entry quality by providing clear, actionable feedback when users make errors, reducing support requests and ensuring data integrity.