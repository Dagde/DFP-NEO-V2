# Training Intelligence Engine - Integration & Frontend

## Phase 1: Server.js - TIE API Routes
- [x] Add TIE require/import at top of server.js (ESM createRequire)
- [x] Add ensureTIETables + seedTIEDefaults call in getPrisma() startup
- [x] Add POST /api/tie/run route
- [x] Add GET /api/tie/courses route
- [x] Add GET /api/tie/summary/:course route
- [x] Add GET /api/tie/trainees/:course route
- [x] Add GET /api/tie/trainee/:name route
- [x] Add GET /api/tie/events/:course route
- [x] Add GET /api/tie/findings/:course route
- [x] Add GET /api/tie/settings route
- [x] Add PUT /api/tie/settings route
- [x] Add GET /api/tie/runs route (list recent runs)

## Phase 2: Frontend - TrainingIntelligenceTab Component
- [x] Create components/tabs/TrainingIntelligenceTab.tsx
- [x] Course selector + Run Analytics button + last run status
- [x] Overview panel: trainee risk distribution, event effectiveness summary
- [x] Trainee table: at-risk list with drill-down
- [x] Event heatmap: skill family scores per event
- [x] Findings panel: bottlenecks, weak spots, over-service alerts
- [x] Course summary narrative section
- [x] Settings panel (thresholds)

## Phase 3: Wire into BuildIntelligenceView
- [x] Import TrainingIntelligenceTab in BuildIntelligenceView.tsx
- [x] Replace "coming soon" placeholder with component

## Phase 4: Build & Deploy
- [x] npm run build (784 modules, success)
- [x] Commit 460fcca6 and push to GitHub