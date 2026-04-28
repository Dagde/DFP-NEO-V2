# DFP-NEO-V2 Repository Snapshot
## Branch: feature/comprehensive-build-algorithm

**Snapshot Date:** 2025-01-20
**Repository:** Dagde/DFP-NEO-V2
**Branch:** feature/comprehensive-build-algorithm

---

## Git Status
- **Current Branch:** feature/comprehensive-build-algorithm
- **Working Tree Status:** Clean (nothing to commit)
- **Sync Status:** Up to date with origin/feature/comprehensive-build-algorithm

---

## Recent Commits (Last 5)
1. `f0eb3c56` - feat: My Dashboard Today's Schedule - show STBY badge beside standby events
2. `722a2b54` - fix: apply timezoneOffset to currentTime in TraineeSchedule, InstructorSchedule, NextDayTraineeSchedule - tile border colors now use correct local time
3. `fe6363c8` - fix: TraineeColumn convertTailwindToHex now handles /80 opacity variants (course tile colors)
4. `1b4a44a1` - fix: TraineeColumn course color lookup from traineesData for DB trainees without course suffix in fullName
5. `49037c49` - fix: use PATCH+id to update instructors, fix name corruption bug in App.tsx (was using POST+idNumber)

---

## Available Branches
- **main** - Main production branch
- **master** - Master branch
- **feature/comprehensive-build-algorithm** - Current active branch (focus on comprehensive build algorithm)
- **feature/restore-pause-flight-ops** - Feature branch for pause flight ops
- Multiple copilot branches for various UI fixes and redesigns
- Multiple snapshot branches for mock data removal tracking

---

## Repository Structure Overview

### Root Level
- **Main Application:** `App.tsx` (with multiple backup versions)
- **Configuration:** `vite.config.ts`, `tsconfig.json`, `nixpacks.toml`, `railway.json`
- **Documentation:** Extensive Markdown files covering various features and fixes (60+ documentation files)
- **Database:** `prisma/` directory with schema.prisma and seed.ts
- **Public Assets:** `public/` with HTML templates, images, and static resources
- **Components:** `components/` directory with 150+ React components
- **Utilities:** `utils/` directory with helper functions
- **Types:** `types/` directory with TypeScript type definitions
- **Context:** `context/` directory for React contexts
- **Hooks:** `hooks/` directory for custom React hooks
- **Data:** `data/` directory with static data files
- **Scripts:** Various JavaScript/TypeScript scripts for automation and maintenance
- **Migration Scripts:** `migration-scripts/` directory for database migrations
- **Outputs:** `outputs/` directory with historical workspace outputs

### Key Build Algorithm Files
- `buildAlgorithmV2.ts` - Main build algorithm implementation
- `current_build_algorithm.ts` - Current algorithm reference
- `new_algorithm_section.ts` - New algorithm section code
- `buildAlgorithmUtils.ts` - Utility functions for build algorithm

---

## Technology Stack
- **Frontend:** React with TypeScript
- **Build Tool:** Vite
- **Database:** Prisma ORM (supports PostgreSQL)
- **Deployment:** Railway
- **CSS:** Custom theme.css + Tailwind CSS (partial)
- **State Management:** React Context API
- **Styling:** CSS modules and Tailwind classes

---

## Key Features (Based on Documentation)
1. **Build Algorithm** - Comprehensive build scheduling system
2. **Aircraft Availability** - Availability tracking and management
3. **Flight Scheduling** - Event scheduling and management
4. **Trainee Management** - Trainee profiles, progress tracking, scheduling
5. **Instructor Management** - Instructor profiles, assignments, scheduling
6. **Course Management** - Course creation, editing, progress tracking
7. **Audit System** - Comprehensive audit logging and tracking
8. **Currency Management** - Currency status and tracking
9. **Priorities System** - Priority-based scheduling
10. **Unavailability Management** - Personnel unavailability tracking
11. **Syllabus Management** - Syllabus creation and tracking
12. **Training Records** - Training record management

---

## Documentation Files
### Build Algorithm Related
- BUILD_ALGORITHM_ANALYSIS.md
- BUILD_ANALYSIS_ENHANCEMENT.md
- BUILD_ANALYSIS_IMPLEMENTATION_PLAN.md
- BUILD_ANALYSIS_INTEGRATION_COMPLETE.md
- BUILD_RESULTS_ANALYSIS_COMPLETE.md
- DFP-Build-Algorithm-Flow.md

### Audit System
- AUDIT_BUTTONS_COMPLETE.md
- AUDIT_BUTTONS_SIDEBAR_FIX.md
- AUDIT_BUTTON_IMPLEMENTATION_PLAN.md
- AUDIT_DEBOUNCE_IMPLEMENTATION.md
- AUDIT_DEBOUNCING.md
- AUDIT_DETAILED_FIELD_TRACKING.md
- AUDIT_FIXES_SUMMARY.md
- AUDIT_IMPLEMENTATION_COMPLETE.md
- AUDIT_IMPLEMENTATION_SUMMARY.md
- AUDIT_LOGGING_IMPLEMENTATION_SUMMARY.md
- AUDIT_LOGGING_TODO.md
- AUDIT_PHASE1_IMPLEMENTATION.md
- AUDIT_PRIORITIES_PAGE.md
- AUDIT_SYSTEM_IMPROVEMENTS.md
- AUDIT_SYSTEM_INTEGRATION_GUIDE.md
- AUDIT_TODO.md

### Other Key Documentation
- DAY_NIGHT_SCHEDULING_ISSUE.md
- DEPLOYMENT_RESOURCE_LINE_IMPLEMENTATION.md
- DEPLOYMENT_CHECKLIST.md
- DEPLOYMENT_FIX_SUMMARY.md
- DEPLOYMENT_LEGS_REMOVAL.md
- FLIGHT_DETAILS_COMPLETE.md
- FLIGHT_DETAILS_REDESIGN.md
- LMP_CURRENCY_IMPLEMENTATION.md
- NEO_BUILD_INDIVIDUAL_LMP_ISSUE.md
- ORACLE_BUTTON_ANALYSIS.md
- ORACLE_FIX_SUMMARY.md
- PROGRESS_GRAPH_REWORK.md
- TASK_COMPLETE_SCT_STAFF_CAT_DROPDOWNS.md
- TRAINEE_ROSTER_COLOR_CODING.md
- UNAVAILABILITY_VALIDATION_SYSTEM.md
- USER_IDENTITY_FIX_DEPLOYMENT.md
- WEIGHTED_PRIORITY_IMPLEMENTATION_PLAN.md
- WEIGHTED_PRIORITY_IMPLEMENTATION_SUMMARY.md

---

## Component Count
- **Total Components:** 150+ React components
- **Main Views:** 30+ view components
- **Modals/Flyouts:** 40+ modal and flyout components
- **Specialized Components:** 80+ specialized UI components

---

## Database Schema
- **Prisma Schema:** `prisma/schema.prisma`
- **Seed File:** `prisma/seed.ts`
- **Migration Scripts:** Located in `migration-scripts/`

---

## Deployment Configuration
- **Railway:** `railway.json` configuration
- **Nixpacks:** `nixpacks.toml` for build configuration
- **Vite:** Production-optimized build configuration

---

## Recent Focus Areas (Based on Git History)
1. My Dashboard Today's Schedule improvements (STBY badge)
2. Timezone offset corrections for schedule views
3. Course tile color handling improvements
4. Instructor profile fixes and updates
5. Build algorithm comprehensive development

---

## File Statistics
- **Total Files:** 744 files
- **Total Directories:** 66 directories
- **Documentation Files:** 60+ markdown files
- **Component Files:** 150+ TypeScript/React files
- **Utility Files:** 20+ utility modules
- **Script Files:** 30+ automation scripts

---

## Environment Setup
- **Node.js Version:** (specified in package.json)
- **Package Manager:** npm
- **Dependencies:** Listed in package.json
- **Development Dependencies:** Including TypeScript, Vite, React, Prisma

---

## Notes
- Repository is in a clean state with no uncommitted changes
- Currently on feature branch focused on comprehensive build algorithm
- Extensive documentation suggests active development and feature implementation
- Multiple backup and snapshot files indicate careful development practices
- Large number of components suggests a complex, feature-rich application

---

## Next Steps Recommendations
1. Review build algorithm implementation (buildAlgorithmV2.ts)
2. Examine current build algorithm documentation
3. Check integration status of new features
4. Review recent changes and their impact
5. Validate database schema and seed data