# Aircraft Availability Tracking System - User Guide

## Overview

The Aircraft Availability Tracking System provides real-time monitoring and historical analysis of aircraft availability throughout the day. This system helps track actual aircraft availability versus planned availability, calculate daily averages, and maintain historical records for analysis.

## Features

### 1. Real-Time Availability Panel (Active DFP)

Located on the Program Schedule view, accessible via a floating button in the top-right corner.

**Key Features:**
- **Current Availability Display**: Shows current available aircraft vs. total aircraft
- **Interactive Slider**: Drag to adjust current availability (0 to total aircraft)
- **Quick Actions**: 
  - `-1 U/S` button: Mark one aircraft as unserviceable
  - `+1 Serviceable` button: Mark one aircraft as serviceable
- **Planned vs. Actual**: Compare planned availability with current status
- **Daily Average**: Real-time calculation of average availability for the day
- **Today's History**: Timeline of all availability changes throughout the day

**Color Coding:**
- 🟢 Green: ≥80% availability
- 🟡 Yellow: 60-79% availability
- 🔴 Red: <60% availability

### 2. Historical Analysis (Settings - Validation)

Access via Settings → Validation → Aircraft Availability

**Three View Modes:**

#### Daily View
- Shows individual day records with:
  - Date
  - Day flying window (start - end time)
  - Average availability percentage
  - Number of availability changes

#### Weekly View
- Aggregated weekly statistics:
  - Week date range (Monday - Sunday)
  - Weekly average availability
  - Number of days with recorded data

#### Monthly View
- Monthly aggregated statistics:
  - Month and year
  - Monthly average availability
  - Number of days with recorded data

**Date Range Selection:**
- Quick ranges: Last Week, Last 2 Weeks, Last 4 Weeks, Last 3 Months
- Custom date range: Select specific start and end dates
- Default: Last 4 weeks

**Data Export:**
- Export all data as JSON file
- Includes daily, weekly, and monthly records
- Filename format: `aircraft-availability-YYYY-MM-DD.json`

## How It Works

### Availability Calculation Methodology

The system uses **time-weighted averaging** to calculate daily average availability:

1. **Snapshots**: Each time availability changes, a snapshot is recorded with:
   - Timestamp
   - Available aircraft count
   - Total aircraft count
   - Optional notes

2. **Time-Weighted Average**: 
   - Each availability level is weighted by how long it was in effect
   - Only counts time within the day flying window
   - Formula: `Σ(availability × duration) / total_day_duration`

3. **Example**:
   - Day flying: 08:00 - 17:00 (9 hours = 540 minutes)
   - 08:00-12:00: 20/24 aircraft (83.3% × 240 min)
   - 12:00-17:00: 18/24 aircraft (75.0% × 300 min)
   - Average: `(83.3×240 + 75.0×300) / 540 = 78.6%`

4. **Rounding**: All averages rounded to 1 decimal place

### Data Storage

- **Location**: Browser localStorage
- **Key Format**: `aircraft-availability-YYYY-MM-DD`
- **Persistence**: Data persists across browser sessions
- **Structure**: JSON format with snapshots array and calculated average

## Usage Scenarios

### Scenario 1: Morning Aircraft Count
1. Open Program Schedule
2. Click aircraft availability button (top-right)
3. Adjust slider to actual available aircraft
4. System records initial availability

### Scenario 2: Aircraft Goes Unserviceable
1. Open availability panel
2. Click `-1 U/S` button
3. System records new snapshot with timestamp
4. Daily average automatically recalculates

### Scenario 3: Reviewing Historical Trends
1. Go to Settings → Validation
2. Scroll to Aircraft Availability section
3. Select desired view (Daily/Weekly/Monthly)
4. Adjust date range as needed
5. Export data for external analysis if required

### Scenario 4: Weekly Performance Review
1. Access Aircraft Availability settings
2. Switch to Weekly view
3. Select "Last 4 Weeks"
4. Review weekly averages to identify trends
5. Compare against target availability (e.g., 80%)

## Best Practices

1. **Update Regularly**: Update availability when changes occur, not just at day start/end
2. **Add Notes**: Use the notes field for significant changes (e.g., "Major inspection")
3. **Review Trends**: Check weekly/monthly views to identify patterns
4. **Export Data**: Regularly export data for backup and external analysis
5. **Day Flying Window**: Ensure day flying times are correctly set in NEO-Build settings

## Technical Details

### Components
- `AircraftAvailabilityPanel.tsx`: Real-time tracking panel
- `AircraftAvailabilitySettings.tsx`: Historical analysis interface
- `aircraftAvailabilityUtils.ts`: Calculation functions
- `AircraftAvailability.ts`: Type definitions

### Data Types
```typescript
interface AircraftAvailabilitySnapshot {
    timestamp: Date;
    available: number;
    total: number;
    notes?: string;
}

interface DailyAvailabilityRecord {
    date: string; // YYYY-MM-DD
    snapshots: AircraftAvailabilitySnapshot[];
    averageAvailability: number;
    dayFlyingStart: string; // HH:mm
    dayFlyingEnd: string; // HH:mm
}
```

## Troubleshooting

**Issue**: Panel not appearing
- **Solution**: Click the floating button in top-right corner of Program Schedule

**Issue**: Data not saving
- **Solution**: Check browser localStorage is enabled and not full

**Issue**: Incorrect averages
- **Solution**: Verify day flying window times in NEO-Build settings

**Issue**: Missing historical data
- **Solution**: Data is stored per-browser; check correct browser/device

## Future Enhancements

Potential future features:
- Automatic aircraft status integration
- Predictive availability forecasting
- Alert notifications for low availability
- Integration with maintenance schedules
- Multi-location tracking
- Mobile app support

## Support

For issues or questions:
- Check this guide first
- Review the calculation methodology
- Contact NinjaTech AI support team