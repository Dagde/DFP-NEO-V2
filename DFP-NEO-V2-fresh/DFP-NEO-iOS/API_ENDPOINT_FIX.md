# iOS App API Endpoint Fix

## Issue
The iOS app was calling incorrect API endpoints, causing authentication and data fetching to fail.

## Root Cause
The backend mobile API endpoints are under `/mobile/...` but the iOS app was calling endpoints without the `/mobile` prefix.

## Changes Made

### AuthService.swift
- `/auth/login` → `/mobile/auth/login`
- `/auth/refresh` → `/mobile/auth/refresh`
- `/auth/logout` → `/mobile/auth/logout`
- `/auth/me` → `/mobile/auth/me`

### ScheduleViewModel.swift
- `/schedule` → `/mobile/schedule`

### UnavailabilityViewModel.swift
- `/unavailability/reasons` → `/mobile/unavailability/reasons`
- `/unavailability/quick` → `/mobile/unavailability/quick`
- `/unavailability/create` → `/mobile/unavailability/create`

## Testing
After rebuilding the iOS app with these changes:
1. Login should work correctly
2. Schedule fetching should work
3. Unavailability submission should work

## Backend API Base URL
The app connects to: `https://dfp-neo.com/api`

Full endpoint examples:
- Login: `https://dfp-neo.com/api/mobile/auth/login`
- Schedule: `https://dfp-neo.com/api/mobile/schedule?date=2024-01-06`
- Unavailability: `https://dfp-neo.com/api/mobile/unavailability/reasons`