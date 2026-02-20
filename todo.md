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
- [ ] Create Login component (LoginModal.tsx)
- [ ] Create ChangePassword component
- [ ] Create ForgotPassword component
- [ ] Update App.tsx to implement authentication state
- [ ] Remove hardcoded "Bloggs, Joe" default user
- [ ] Add session check on app load
- [ ] Update RightSidebar to display authenticated user info

## Phase 3: Admin Panel
- [ ] Create AdminPanel component
- [ ] User list display
- [ ] Reset user password functionality
- [ ] Create new user functionality

## Phase 4: Build & Deploy
- [ ] Build application with Vite
- [ ] Deploy to both directories
- [ ] Update index-v2.html files
- [ ] Commit and push all changes

## Phase 5: Testing & Verification
- [ ] Test SuperAdmin login
- [ ] Test Alexander Burns login
- [ ] Test password reset
- [ ] Test admin panel
- [ ] Verify logout works