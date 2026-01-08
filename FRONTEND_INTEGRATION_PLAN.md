# Phase 4: Frontend Integration Plan

## Status
- **Start Date:** 2024-01-07
- **Current Progress:** 0% (Starting now)
- **Git Marker:** v1.0-stable-before-integration (created for rollback)

## Architecture Overview

### Current State
```
App.tsx → imports from mockData.ts
   ↓
Hardcoded ESL_DATA (instructors)
   ↓
Hardcoded PEA_DATA (trainees) 
   ↓
Compiled to dist/
   ↓
Served from public/flight-school-app/
```

### Target State
```
App.tsx → API calls to /api/personnel, /api/aircraft, /api/schedule
   ↓
Fetch data from Railway PostgreSQL database
   ↓
State management with React hooks
   ↓
Compiled to dist/
   ↓
Served from public/flight-school-app/
```

## API Endpoints Available

### Personnel API
- `GET /api/personnel` - Get all personnel (instructors & trainees)
- `GET /api/personnel/:id` - Get specific personnel
- Filters: role, availability, search

### Aircraft API
- `GET /api/aircraft` - Get all aircraft
- `GET /api/aircraft/:id` - Get specific aircraft
- Filters: type, status

### Schedule API
- `GET /api/schedule` - Get schedules
- `POST /api/schedule` - Save schedule
- Filters: date range, user ID

### Unavailability API
- `GET /api/unavailability` - Get unavailability records
- `POST /api/unavailability` - Create unavailability
- `PATCH /api/unavailability/:id` - Update unavailability

## Implementation Tasks

### Task 1: Create API Client Utilities
- [ ] Create `lib/api.ts` with fetch wrapper functions
- [ ] Add error handling and loading states
- [ ] Add TypeScript types for API responses

### Task 2: Update App.tsx - Personnel Integration
- [ ] Replace `ESL_DATA` import with API call
- [ ] Replace `PEA_DATA` import with API call
- [ ] Filter personnel by role (INSTRUCTOR vs PILOT/TRAINEE)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test instructor list
- [ ] Test trainee list

### Task 3: Update App.tsx - Aircraft Integration
- [ ] Replace aircraft data with API call
- [ ] Map aircraftNumber field correctly
- [ ] Add loading states
- [ ] Add error handling
- [ ] Test aircraft display

### Task 4: Update App.tsx - Schedule Integration
- [ ] Replace localStorage with POST /api/schedule
- [ ] Replace localStorage with GET /api/schedule
- [ ] Handle date field conversion (String ↔ Date)
- [ ] Test schedule save
- [ ] Test schedule load
- [ ] Remove localStorage dependencies

### Task 5: Update App.tsx - Unavailability Integration
- [ ] Replace unavailability localStorage with API calls
- [ ] Integrate POST /api/unavailability
- [ ] Integrate PATCH /api/unavailability
- [ ] Test unavailability management

### Task 6: Testing & Verification
- [ ] Test complete workflow end-to-end
- [ ] Test data persistence across page reloads
- [ ] Test error handling for API failures
- [ ] Verify user authentication integration
- [ ] Test all existing features still work

### Task 7: Build & Deploy
- [ ] Run `npm run build` to compile updated app
- [ ] Copy dist/* to dfp-neo-platform/public/flight-school-app/
- [ ] Commit changes to git
- [ ] Push to GitHub
- [ ] Verify Railway deployment succeeds
- [ ] Test in production

## Rollback Plan

If anything goes wrong:
1. `git checkout v1.0-stable-before-integration`
2. `git checkout -b hotfix-rollback`
3. Rebuild and deploy

## Success Criteria

- ✅ All mock data removed
- ✅ All data comes from database via APIs
- ✅ No localStorage usage for persistent data
- ✅ All existing features work correctly
- ✅ Error handling in place
- ✅ Deployed and tested in production