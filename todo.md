# Authentication Implementation Plan

## Phase 1: Database & Backend Setup
- [x] Add PasswordResetToken model to Prisma schema
- [x] Run database migration (using existing SQLite dev.db)
- [x] Create initial users in database (SuperAdmin & Alexander Burns)
- [x] Create backend auth server (Express.js)
  - POST /api/auth/login ✅
  - POST /api/auth/logout ✅
  - POST /api/auth/change-password ✅
  - POST /api/auth/forgot-password ✅
  - POST /api/auth/reset-password ✅
  - POST /api/admin/reset-user-password ✅
  - GET /api/admin/users ✅

## Phase 2: Frontend Authentication UI
- [x] Create Login component (LoginModal.tsx)
- [x] Create ChangePassword component (ChangePasswordModal.tsx)
- [x] Update App.tsx to implement authentication state
- [x] Add session check on app load
- [x] Add logout button and user menu to Header
- [x] Fix auth server URL to use relative paths via Vite proxy

## Phase 3: Admin Panel
- [x] Create AdminPanel component
- [x] User list display
- [x] Reset user password functionality
- [x] Create new user functionality

## Phase 4: Build & Deploy
- [x] Build application with Vite
- [x] Deploy to both directories
- [x] Update index-v2.html files
- [x] Commit and push all changes

## Phase 5: Testing & Verification
- [x] Test SuperAdmin login via proxy (✅ working)
- [x] Test Alexander Burns login via proxy (✅ working)
- [ ] Test in browser - verify login modal appears
- [ ] Test password change
- [ ] Test admin panel
- [ ] Test logout