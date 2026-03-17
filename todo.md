# Task: Make Settings Page Icons Same Color Within Each Line/Group

## Goal
Make icons within each line (System Configuration, Operations Rules, etc.) the same color. Each line can be a different color, but icons in the same line should match.

## Groups to Update
1. SYSTEM CONFIGURATION - scoring-matrix, currencies, sct-events
2. OPERATIONS RULES - event-limits, duty-turnaround, business-rules  
3. ACCESS & SECURITY - permissions, user-list
4. DATA MANAGEMENT - data-loaders, data-sources, staff-database, trainee-database, staff-combined-data, staff-mockdata, trainee-mockdata
5. HISTORICAL & ANALYSIS - validation
6. SYSTEM SETTINGS - timezone, location, units, organisation

## Plan
- [x] Examine current icon structure and color definitions
- [ ] Update sectionColors to use consistent colors per group
- [ ] Rebuild the bundle with npm run build
- [ ] Commit changes to git