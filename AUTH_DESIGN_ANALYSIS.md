# Authentication System Design Analysis

## Executive Summary

This document provides a comprehensive analysis and design plan for implementing a production-ready authentication system for the DFP-NEO (Daily Flying Program) application.

## Current State Analysis

### Existing Infrastructure
Based on `AUTH_IMPLEMENTATION_STATUS.md` (dated Jan 5, 2026), there is a **documented** NextAuth v5 authentication system with:
- Prisma database schema
- User, PermissionsRole, and audit models
- Authentication library with credential provider
- Password management utilities
- Login/forgot-password/reset-password pages
- Audit logging
- Middleware protection

### Critical Observation: Documentation vs Reality
**IMPORTANT**: The documented authentication system exists ONLY in documentation files. The actual Vite-based DFP-NEO app (`/workspace`) operates in "demo mode" with:
- No real authentication
- Hardcoded default user: "Bloggs, Joe"
- Commented out authentication code
- All users appear as FLTLT Bloggs

The Next.js platform (`/workspace/dfp-neo-platform`) has the authentication infrastructure but is **separate** from the main Vite app that users actually use.

---

## Core Concept: Users vs Schedule Personnel

### Distinction is Critical

**1. USERS (Application Access)**
- People who can log in and use the application
- Stored in `User` table with authentication credentials
- Have passwords, login IDs (userId), and permission roles
- Can be ADMIN, Instructor, Trainee, Programmer, Maintenance
- Example: FLTLT Alexander Burns (User) → Logs in as "burns.alexander" or similar

**2. SCHEDULE PERSONNEL (Data in Schedule)**
- People who appear in flight schedules (Staff, Trainees, Sim IPs)
- Stored in `Personnel` table with operational data
- Have rank, name, PMKEYS, unit, flight, etc.
- Do NOT necessarily have application access
- Example: FLTLT Alexander Burns (Personnel) → Appears on training schedule

### Relationship Between User and Personnel
A User can be associated with a Personnel record, but they are **separate entities**:
- `Personnel.userId` field links Personnel to User
- A Personnel record MAY have a userId (if they're also a User)
- Many Personnel records have userId = null (not Users)
- User authentication happens against the `User` table, NOT the `Personnel` table

---

## Database Schema Design

### User Table (Authentication)
```prisma
model User {
  id                Int      @id @default(autoincrement())
  userId            String   @unique  // Login identifier (e.g., "admin", "burns.alexander")
  displayName       String   // Full name: "Alexander Burns"
  email             String?  // Optional, for password reset only
  passwordHash      String   // bcrypt hash
  status            UserStatus @default(ACTIVE) // ACTIVE, DISABLED, PENDING
  mustChangePassword Boolean @default(false)
  permissionsRoleId Int?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Relations
  permissionsRole   PermissionsRole? @relation(fields: [permissionsRoleId], references: [id])
  personnel         Personnel? // Link to Personnel record
  sessions          Session[]
  auditLogs         AuditLog[]
  passwordResetTokens PasswordResetToken[]
  inviteTokens      InviteToken[]
}

enum UserStatus {
  ACTIVE
  DISABLED
  PENDING
}
```

### Personnel Table (Schedule Data)
```prisma
model Personnel {
  id          Int      @id @default(autoincrement())
  pmkeys      Int      @unique  // PMKEYS number
  name        String   // "Burns, Alexander" or "Alexander Burns"
  rank        String?  // "FLTLT"
  userId      String?  @unique // Links to User.userId if they're also a User
  unit        String?
  flight      String?
  role        String?  // "QFI", "Trainee", "Sim IP"
  // ... other operational fields
  
  // Relations
  user        User?    @relation(fields: [userId], references: [userId])
}
```

### Permissions System
```prisma
model PermissionsRole {
  id          Int      @id @default(autoincrement())
  name        String   @unique // "Administrator", "Instructor", etc.
  description String?
  
  // Relations
  users       User[]
  capabilities PermissionsRoleCapability[]
}

model PermissionCapability {
  id          Int      @id @default(autoincrement())
  key         String   @unique // "admin:access_panel", "users:manage", etc.
  name        String
  description String?
  
  // Relations
  roles       PermissionsRoleCapability[]
}

model PermissionsRoleCapability {
  id                Int      @id @default(autoincrement())
  permissionsRoleId Int
  capabilityId      Int
  permissionsRole   PermissionsRole @relation(fields: [permissionsRoleId], references: [id])
  capability        PermissionCapability @relation(fields: [capabilityId], references: [id])
  
  @@unique([permissionsRoleId, capabilityId])
}
```

### Password Reset & Invite Tokens
```prisma
model PasswordResetToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique // SHA-256 hash
  userId    Int
  expiresAt DateTime
  used      Boolean  @default(false)
  
  user      User     @relation(fields: [userId], references: [id])
}

model InviteToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique // SHA-256 hash
  userId    Int
  expiresAt DateTime
  used      Boolean  @default(false)
  
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## Initial Users to Create

### 1. ADMIN User (Super Administrator)
```json
{
  "userId": "admin",
  "displayName": "System Administrator",
  "email": "admin@dfp-neo.raaf.gov.au",
  "password": "Provided by user (secure)",
  "permissionsRole": "Administrator",
  "status": "ACTIVE"
}
```

**Capabilities**: All permissions (full system access)

### 2. FLTLT Alexander Burns (Instructor/User)
```json
{
  "userId": "burns.alexander",
  "displayName": "Alexander Burns",
  "email": "alexander.burns@defence.gov.au",
  "password": "Provided by user (secure)",
  "permissionsRole": "Instructor",
  "status": "ACTIVE"
}
```

**Capabilities**: 
- launch:access
- training:manage
- schedule:create
- schedule:edit
- personnel:manage

**Note**: This User should be linked to the Personnel record for FLTLT Alexander Burns via `Personnel.userId`

---

## Authentication Flow Design

### Login Flow
```
1. User enters userId + password on login page
2. POST /api/auth/signin
3. Validate credentials:
   - Find User by userId
   - Check status is ACTIVE
   - Verify password hash matches
4. Create session (JWT via NextAuth)
5. Set httpOnly cookie
6. Redirect to dashboard or callback URL
7. If mustChangePassword = true, redirect to change-password page
```

### ADMIN Password Reset (Reset Other Users)
```
ADMIN Flow:
1. Admin logs in with admin:access_panel capability
2. Navigate to /admin/users
3. Click "Reset Password" on user
4. Enter new password or generate temporary password
5. POST /api/admin/users/[id]/reset-password
6. Password is updated
7. All user sessions are revoked
8. User must login with new password
9. Optional: Set mustChangePassword = true

Temporary Password Option:
1. Admin generates temporary password
2. Communicate to user via secure channel (email, phone)
3. User logs in, is forced to change password immediately
```

### User Self-Service Password Reset
```
Forgot Password Flow:
1. User clicks "Forgot Password"
2. Enter userId or email
3. POST /api/auth/forgot-password
4. System creates PasswordResetToken (30 min expiry)
5. Send email with reset link: /reset-password?token=xxx
   (Email integration TODO - currently manual)
6. User clicks link or admin provides token
7. Enter new password + confirm
8. POST /api/auth/reset-password
9. Token validated (not expired, not used)
10. Password updated, token marked used
11. All sessions revoked
12. User redirected to login with success message
```

---

## Vite App Integration (The Critical Part)

### Problem
The Vite app currently runs in "demo mode" with no authentication. We need to:
1. Connect to the real database
2. Implement login UI
3. Store session state
4. Protect routes
5. Load authenticated user data

### Proposed Solution

#### Option A: Keep Vite, Add Lightweight Auth
**Approach**: Add authentication to existing Vite app without switching to Next.js

**Changes Required**:
1. Add Prisma client to Vite app
2. Create login modal/page in Vite
3. Implement session management (localStorage or cookie)
4. Create auth API endpoints (in separate server or as Vite proxy)
5. Update App.tsx to:
   - Check authentication state on load
   - Show login screen if not authenticated
   - Store authenticated user in state
   - Pass user data to components
6. Replace hardcoded "Bloggs, Joe" with actual user

**Pros**:
- Minimal architecture change
- Keep existing Vite build process
- Faster to implement

**Cons**:
- Need to build authentication from scratch
- No NextAuth integration
- Need to build session management

#### Option B: Migrate to Next.js Platform
**Approach**: Move all Vite app code to Next.js platform and use existing auth

**Changes Required**:
1. Port all React components from Vite to Next.js
2. Convert to Next.js routing
3. Use existing NextAuth v5 setup
4. Prisma already configured

**Pros**:
- Full authentication infrastructure exists
- NextAuth handles sessions, JWT, etc.
- Security features built-in
- Audit logging already implemented

**Cons**:
- Major migration effort
- Need to convert all components to Next.js
- Risk of breaking existing functionality

### Recommended Approach: Option A (Vite + Lightweight Auth)

**Rationale**:
1. The Vite app is fully functional and deployed
2. Migrating to Next.js is high-risk and time-consuming
3. Can implement basic authentication relatively quickly
4. Can add advanced features incrementally

---

## Implementation Plan (Option A)

### Phase 1: Database & Backend Setup
1. **Ensure Prisma schema matches AUTH_IMPLEMENTATION_STATUS.md**
   - Add User, PermissionsRole, PermissionCapability tables
   - Add password reset tokens, invite tokens, audit logs
   - Ensure Personnel table has userId field

2. **Create initial users in database**
   - Create ADMIN user (set secure password)
   - Create FLTLT Alexander Burns user (set secure password)
   - Assign proper permissions roles

3. **Create backend API endpoints** (separate Node.js server)
   - POST /api/auth/signin - Login
   - POST /api/auth/signout - Logout
   - POST /api/auth/change-password - Change password
   - POST /api/auth/forgot-password - Request reset
   - POST /api/auth/reset-password - Reset with token
   - POST /api/admin/users/:id/reset-password - Admin reset
   - GET /api/auth/session - Get current session

### Phase 2: Frontend Authentication UI
1. **Create Login Component**
   - Simple modal or page
   - User ID + Password fields
   - Error handling
   - Remember me checkbox

2. **Update App.tsx**
   - Remove hardcoded "Bloggs, Joe"
   - Add authentication state
   - Check for valid session on load
   - Show login if not authenticated
   - Store user info in state
   - Pass to RightSidebar

3. **Create Password Change Modal**
   - Show when mustChangePassword = true
   - Current password + new password + confirm
   - Password strength validation

### Phase 3: Password Reset UI
1. **Forgot Password Page**
   - Enter userId or email
   - Generic success message (security)

2. **Reset Password Page**
   - Token validation
   - New password + confirm
   - Handle expired/invalid tokens

3. **Admin Panel Integration**
   - Add to existing admin routes
   - User list with reset password option
   - Temporary password generation

### Phase 4: Testing & Deployment
1. Test all authentication flows
2. Test password reset (self and admin)
3. Test session management
4. Test permission-based access
5. Deploy to production

---

## Security Considerations

### Password Requirements
- Minimum 12 characters
- Must contain: uppercase, lowercase, number, special character
- Block common passwords (e.g., "password123")
- Rate limit login attempts (10 = 15 min lockout)

### Token Security
- All tokens hashed before storage (SHA-256)
- Tokens have expiry (30 min reset, 72 hour invite)
- Tokens are single-use
- All sessions revoked on password change

### Audit Logging
- Log all authentication events (login, logout, password changes)
- Log IP address and user agent
- Log password reset actions
- Non-blocking (don't break app if logging fails)

### Session Management
- JWT-based sessions
- 30-day session expiry
- Revoke all sessions on password change
- Must-change-password enforcement

---

## Data Migration Strategy

### Existing Personnel with userId
- Real database staff have userId field populated
- These should have corresponding User records created

### Existing Personnel without userId
- These are NOT Users yet
- They only exist in schedule data
- Admin can create User accounts for them as needed

### New User Creation Process
1. Admin creates User record (with userId, email, etc.)
2. Admin sets temporary password (mustChangePassword = true)
3. Admin communicates password securely
4. User logs in and changes password
5. Admin links User to Personnel record (if applicable)

---

## Email Integration (Future)

### Current State
Email sending is documented as TODO in AUTH_IMPLEMENTATION_STATUS.md

### Future Implementation
1. Integrate email service (SendGrid, AWS SES, etc.)
2. Send password reset links automatically
3. Send invite links for new users
4. Send password change confirmations

### Manual Workaround
Until email is integrated:
- Admin provides reset tokens manually
- Admin communicates passwords via secure channel
- Use secure messaging or phone

---

## Summary of Recommended Design

### Core Architecture
- **Separate concerns**: User table for auth, Personnel table for schedule data
- **Optional email**: Email field in User is optional and only for recovery
- ** userId-based login**: Login with userId, not email
- **Role-based permissions**: Users have roles with specific capabilities
- **Two-way link**: User ↔ Personnel via userId

### Initial Users
1. **ADMIN** (userId: "admin") - Full system access
2. **FLTLT Alexander Burns** (userId: "burns.alexander") - Instructor permissions

### Password Reset Options
1. **Admin Reset**: Admin can reset any user's password with admin:access_panel capability
2. **Self-Service**: Users can reset their own password via forgot-password flow
3. **Temporary Password**: Admin can generate temporary passwords (forces change on first login)

### Implementation Approach
- Keep Vite app (Option A)
- Add lightweight authentication to Vite
- Create separate backend API server for auth
- Avoid major migration to Next.js

### Security Features
- bcrypt password hashing (cost factor 12)
- Rate limiting on login
- Token-based password reset
- Session revocation on password change
- Comprehensive audit logging
- Permission-based access control

---

## Next Steps (When User Approves)

1. Create Prisma migration for User and auth-related tables
2. Create database seed script for initial users (ADMIN, FLTLT Burns)
3. Create backend API server with auth endpoints
4. Create Login component for Vite app
5. Update App.tsx to use authentication
6. Create password reset UI components
7. Create admin panel for user management
8. Test all flows end-to-end
9. Deploy to production

---

**Status**: ANALYSIS COMPLETE - AWAITING USER APPROVAL TO IMPLEMENT