# Historical Data Seeding - Fixes & Integration

## Fixes needed in server.js seed endpoint
- [x] Review current state
- [ ] Fix ADF302 centre event: '1 BNF FTD1' → 'BNF FTD1'
- [ ] Fix PT-051 scores: replace generic elements with ALL_ELEMENTS (22 exact strings from PT051_STRUCTURE)
- [ ] Fix marginal grade logic: per-course per-day (not per-trainee)
- [ ] Add logbook record generation for flying events
- [ ] Verify FIC_SYLLABUS order

## Integration
- [ ] Add 'historical-data' section to SettingsViewWithMenu.tsx
- [ ] Import HistoricalDataSeeder in SettingsViewWithMenu

## Build & Deploy
- [ ] npm run build
- [ ] git commit & push