# Trainee Display Fix

## Problem
- 127 trainees in database (Trainee table) with FIC211/CFS not showing in Trainee Roster
- Only 10 trainees showing (from mock data)

## Root Cause Found
- `fetchTrainees()` in `lib/api.ts` was querying `/api/personnel?role=TRAINEE` (Personnel table)
- BUT trainees are stored in the `Trainee` table (separate from Personnel)
- The `/api/trainees` endpoint exists and queries the correct table

## Fix Applied
- [x] Changed `fetchTrainees()` to use `/api/trainees` instead of `/api/personnel?role=TRAINEE`
- [x] Pushed to GitHub (commit: d6af8ef5)

## Status: Deployed ✓
Waiting for Railway to rebuild and deploy.