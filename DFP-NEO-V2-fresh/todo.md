# Daily Schedule Persistence Fix

## Phase 1: Understand current data structures
- [ ] Find where staff/trainee logbook hours are stored
- [ ] Find the date selector component in the Main Daily Schedule viewer
- [ ] Find where currency state is stored for instructors
- [ ] Check existing DataBackup API endpoints
- [ ] Check Prisma schema for any existing daily snapshot tables

## Phase 2: Database schema
- [ ] Add new DailySnapshot table to Prisma schema (per-date snapshot of all data)
- [ ] Push schema migration via prisma db push on Railway

## Phase 3: Server-side API
- [ ] POST /api/daily-snapshot/save — save full daily snapshot (non-seed only)
- [ ] GET /api/daily-snapshot?startDate=X&endDate=Y — load snapshots for date range
- [ ] GET /api/daily-snapshot/dates — list all dates that have snapshots (for calendar)
- [ ] DELETE seed data cleanup endpoint

## Phase 4: Frontend — save on publish
- [ ] Update handleConfirmPublish in App.tsx to call save endpoint (skip isHistoricalSeed)
- [ ] Load last 5 days of snapshots on app startup

## Phase 5: Frontend — date selector calendar
- [ ] Find the date selector component
- [ ] Add calendar dropdown to date selector
- [ ] Load snapshot on demand for dates older than 5 days

## Phase 6: Build & deploy
- [ ] npm run build
- [ ] Commit and push to GitHub