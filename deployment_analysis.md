# Complete Deployment Failure Analysis - All Logs

## LOG TIMELINE AND ERRORS

### logs.1773019442699 & 1773019811602 (March 9) - WORKING ERA
- install: cd DFP-NEO-V2-fresh && npm install --omit=dev || npm install
- build:   cd DFP-NEO-V2-fresh && npm ci && npm run build
- start:   cd DFP-NEO-V2-fresh && node server.js
- STATUS: These appear to be the WORKING configuration
- Railway root = REPO ROOT (not dfp-neo-platform)
- All commands use "cd DFP-NEO-V2-fresh" prefix

### logs.1773409136864 (between March 9-14) - EMPTY LOG
- No content - possibly a successful deploy or config change

### logs.1773463657231 (March 14, 04:40) - FIRST FAILING LOG TODAY
- install: npm ci  (NO "cd DFP-NEO-V2-fresh" prefix!)
- build:   npm run build (NO prefix!)  
- start:   npx prisma migrate deploy && npm run start (NO prefix!)
- CHANGE: Railway root dir changed to dfp-neo-platform BETWEEN March 9 and March 14
- BUILD SUCCEEDED (Next.js built OK)
- RUNTIME FAILED: healthcheck timeout - prisma migrate deploy failing silently or Next.js not serving /api/health

### logs.1773470159196 (March 14, 04:51)
- Same config as above (npm ci, npm run build, prisma migrate deploy)
- BUILD SUCCEEDED
- RUNTIME FAILED: "Attempt #1 failed with service unavailable"
- The Next.js app starts but /api/health doesn't exist in Next.js!

### logs.1773476486990 (March 14, 08:17)  
- Same config (npm ci, npm run build, prisma migrate deploy)
- BUILD SUCCEEDED
- RUNTIME FAILED: "Attempt #1 failed with service unavailable"
- Same issue: Next.js has no /api/health endpoint

### logs.1773477698598 (March 14, 08:39)
- This is RUNTIME ONLY log - no build phase shown
- RUNTIME FAILED: P3005 - database schema not empty
- start: npx prisma migrate deploy && npm run start
- Repeatedly crashing and restarting (P3005 every 2 seconds)

### logs.1773480992886 (March 14, 09:32)
- RUNTIME ONLY - same P3005 crash loop
- Same start command: prisma migrate deploy failing

### logs.1773489379762 (March 14, 11:53) - MY FIRST FIX ATTEMPT
- install: npm ci (still in dfp-neo-platform context)
- build:   cd .. && npm ci && npm run build  ← MY CHANGE
- start:   cd .. && node server.js  ← MY CHANGE
- BUILD FAILED: npm ci fails because no package-lock.json exists at /
  (cd .. from /app/ goes to container root /, not DFP-NEO-V2-fresh)

### logs.1773489995324 (March 14, 12:00) - MY SECOND FIX ATTEMPT  
- install: npm ci
- build:   npm ci  ← MY CHANGE (dfp-neo-platform/railway.json buildCommand)
- start:   node server.js  ← MY CHANGE (copied server.js to dfp-neo-platform)
- INSTALL SUCCEEDED: 225 packages installed, express included
- BUILD FAILED: EBUSY error - "resource busy or locked, rmdir /app/node_modules/.cache"
  The build step runs "npm ci" again which tries to rmdir node_modules/.cache
  but it's mounted as a Docker cache volume - LOCKED!

## ROOT CAUSE ANALYSIS

### Primary Issue: Railway root directory changed
Between March 9 and March 14, the Railway project root directory setting 
was changed from the REPO ROOT to DFP-NEO-V2-fresh/dfp-neo-platform.

Evidence: March 9 logs show "cd DFP-NEO-V2-fresh" prefix. March 14 logs don't.

### The EBUSY error (latest log) - NEW PROBLEM I INTRODUCED
By setting buildCommand = "npm ci" in railway.json, Railway runs:
1. Install phase: npm ci (standard)  
2. Build phase: npm ci (my buildCommand) ← RUNS AGAIN
Both phases mount /app/node_modules/.cache as Docker cache volume.
The second "npm ci" tries to rmdir this mounted volume = EBUSY error.

The fix: buildCommand should NOT be "npm ci" - it should be the actual build step
OR should be empty/omitted so Railway doesn't run a second npm install.

## WHAT THE CORRECT FIX IS

Option 1 (BEST): Change Railway root directory back to repo root or DFP-NEO-V2-fresh
- This restores the March 9 working configuration
- Requires Railway UI change

Option 2: Make dfp-neo-platform self-contained BUT fix the buildCommand
- Don't run "npm ci" as the buildCommand (causes EBUSY)
- The buildCommand should be omitted OR set to something that doesn't reinstall

## THE EBUSY FIX NEEDED RIGHT NOW
In dfp-neo-platform/railway.json, buildCommand "npm ci" is wrong because:
- Nixpacks already runs "npm ci" in the install phase
- Running it again in build phase causes EBUSY on the mounted cache volume
- Fix: Set buildCommand to something non-destructive or remove it entirely
