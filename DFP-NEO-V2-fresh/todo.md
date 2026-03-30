# Training Intelligence Engine - Integration & Frontend

## Phase 1: Server.js - TIE API Routes
- [ ] Add TIE require/import at top of server.js (ESM createRequire)
- [ ] Add ensureTIETables + seedTIEDefaults call in getPrisma() startup
- [ ] Add POST /api/tie/run route
- [ ] Add GET /api/tie/courses route
- [ ] Add GET /api/tie/summary/:course route
- [ ] Add GET /api/tie/trainees/:course route
- [ ] Add GET /api/tie/trainee/:name route
- [ ] Add GET /api/tie/events/:course route
- [ ] Add GET /api/tie/findings/:course route
- [ ] Add GET /api/tie/settings route
- [ ] Add PUT /api/tie/settings route
- [ ] Add GET /api/tie/runs route (list recent runs)

## Phase 2: Frontend - TrainingIntelligenceTab Component
- [ ] Create components/tabs/TrainingIntelligenceTab.tsx
- [ ] Course selector + Run Analytics button + last run status
- [ ] Overview panel: trainee risk distribution, event effectiveness summary
- [ ] Trainee table: at-risk list with drill-down
- [ ] Event heatmap: skill family scores per event
- [ ] Findings panel: bottlenecks, weak spots, over-service alerts
- [ ] Course summary narrative section
- [ ] Settings panel (thresholds)

## Phase 3: Wire into BuildIntelligenceView
- [ ] Import TrainingIntelligenceTab in BuildIntelligenceView.tsx
- [ ] Replace "coming soon" placeholder with component

## Phase 4: Build & Deploy
- [ ] npm run build
- [ ] Commit and push to GitHub