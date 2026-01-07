# TODO: Option 1 Migration - Create New Structure

## Current Status
- ✅ Phase 1: Database Connection - Complete
- ✅ Phase 2: Data Migration (Users, Personnel, Aircraft) - Complete
- ✅ Admin Dashboard Build Errors - Fixed
- ✅ Permissions & Architecture Analysis - Complete
- ✅ Profile Field Analysis - Complete
- ✅ **USER DECISION: Option 1 Selected** - Create New Structure (Preserve Data)

## Option 1 Implementation Tasks

### 1. Schema Updates
- [x] Create comprehensive Staff model with all 32 fields (already exists as Personnel)
- [x] Create comprehensive Trainee model with all 24 fields (already exists)
- [x] Make User relations optional initially (userId now optional in Personnel)
- [x] Add proper indexes and constraints (already in place)
- [x] Add default values for array fields (permissions)
- [x] Document schema changes (OPTION1_MIGRATION_COMPLETE.md)

### 2. Database Migration
- [x] Run `prisma db push` to apply schema changes
- [x] Verify all tables created correctly
- [x] Check existing data preserved (209 Personnel records intact)

### 3. Data Migration Scripts
- [x] Create script to migrate Personnel → Staff
- [x] Create script to import Trainees from mockData.ts
- [x] Handle userId assignments properly (set to NULL for now)
- [x] Verify data integrity (82 Personnel + 127 Trainees = 209 total)

### 4. Testing & Verification
- [x] Test database queries
- [x] Verify all fields accessible
- [x] Check relationships work correctly
- [x] Validate data completeness (82 Personnel + 127 Trainees)

### 5. Deployment
- [x] Commit schema changes
- [x] Push to GitHub (commit ead8e0e)
- [x] Fix admin page AuditLog relation (commit 75c2d90)
- [x] Deploy to Railway (automatic on push)
- [ ] Verify production deployment (awaiting Railway build)

### 6. Deployment Error Fixes (CURRENT - In Progress)
- [x] Identify all files with permissionsRole references (11 files found)
- [x] User approved Option A (remove all permissionsRole references)
- [x] Automated sed fix attempted and reverted (broke syntax)
- [ ] Manually fix app/admin/page.tsx (remove permissionsRole.count() references)
- [ ] Fix app/admin/permissions/page.tsx.disabled (remove permissionsRole queries)
- [ ] Fix lib/actions/user-actions.ts (remove permissionsRole imports/usage)
- [ ] Fix any other files with permissionsRole references
- [ ] Test TypeScript compilation locally
- [ ] Commit changes to git
- [ ] Push to GitHub
- [ ] Verify Railway deployment succeeds
- [ ] Verify app loads correctly at dfp-neo.com

### 7. Future Phases (After Deployment Fixes Complete)
- [ ] Verify Railway deployment successful
- [ ] Test application at dfp-neo.com
- [ ] Phase 3: Create API routes (requires user approval)
- [ ] Phase 4: Frontend integration (requires user approval)