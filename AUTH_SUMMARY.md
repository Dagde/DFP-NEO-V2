# Authentication Design - Executive Summary

## Key Finding: Two Separate Entities

**CRITICAL DISTINCTION:**

### Users (Application Access)
- People who can LOG IN to the app
- Stored in `User` table
- Have userId, password, permissions
- Can be: ADMIN, Instructor, Trainee, etc.
- **Example**: FLTLT Alexander Burns (User) → Logs in as "burns.alexander"

### Schedule Personnel (Data in Flight Schedules)
- People who APPEAR in schedules
- Stored in `Personnel` table
- Have rank, name, PMKEYS, unit, flight, etc.
- Do NOT necessarily have login access
- **Example**: FLTLT Alexander Burns (Personnel) → Appears on training schedule

**The two are LINKED but SEPARATE:**
- `Personnel.userId` field can reference a User
- Many Personnel have userId = null (they're just schedule data, not app users)
- Authentication happens against `User` table, NOT `Personnel` table

---

## Initial Users to Create

### 1. ADMIN User
```
Login ID: admin
Password: [You will provide]
Role: Administrator
Capabilities: Full system access (reset any password, manage users, etc.)
```

### 2. FLTLT Alexander Burns
```
Login ID: burns.alexander
Password: [You will provide]
Role: Instructor
Capabilities: Access to flight school app, manage schedules, view personnel
Linked to: Personnel record for FLTLT Alexander Burns
```

---

## Password Reset Options

### Option 1: ADMIN Resets User Password
1. Admin logs in
2. Goes to admin panel → users
3. Clicks "Reset Password" on any user
4. Enters new password OR generates temporary password
5. User must login with new password
6. **Optional**: Force user to change password on next login

### Option 2: User Resets Own Password (Self-Service)
1. User clicks "Forgot Password" on login screen
2. Enters their userId or email
3. System generates reset token (valid 30 minutes)
4. Token sent via email (TODO) OR admin provides token
5. User enters new password
6. All sessions revoked, user logs in with new password

---

## Implementation Approach

### Recommended: Keep Vite App, Add Authentication

**Why not migrate to Next.js?**
- The Vite app is fully functional and deployed
- Next.js migration would be massive work and high risk
- Can add lightweight authentication to Vite relatively quickly

**What will be added:**
1. Prisma database with User table and auth-related tables
2. Backend API server for auth endpoints (login, password reset, etc.)
3. Login modal/page in Vite app
4. Update App.tsx to use real authentication (remove hardcoded "Bloggs, Joe")
5. Password change and reset UI components

---

## Security Features

- **Passwords**: bcrypt hashed, 12+ chars required, complexity enforced
- **Login**: Rate limited (10 failed attempts = 15 min lockout)
- **Tokens**: Hashed before storage, single-use, expiry times (30 min for reset, 72 hours for invite)
- **Sessions**: JWT-based, 30-day expiry, all revoked on password change
- **Audit Logging**: All auth events logged (login, logout, password changes)
- **Permissions**: Role-based (Administrator, Instructor, Trainee, Programmer, Maintenance)

---

## Database Tables Needed

```
User (Authentication)
- userId (login identifier)
- passwordHash
- displayName
- email (optional, for password reset only)
- status (ACTIVE/DISABLED/PENDING)
- mustChangePassword
- permissionsRoleId

Personnel (Schedule Data) - ALREADY EXISTS
- pmkeys
- name
- rank
- userId (links to User table - optional)

PermissionsRole
- name (Administrator, Instructor, etc.)
- capabilities

PasswordResetToken
- token (hashed)
- userId
- expiresAt
- used

+ AuditLog tables
```

---

## Implementation Plan

### Phase 1: Database Setup
- ✅ Create User table and auth-related tables (Prisma migration)
- ✅ Create ADMIN user (set your password)
- ✅ Create FLTLT Alexander Burns user (set your password)
- ✅ Assign permissions roles

### Phase 2: Backend API
- ✅ Create auth API server
- ✅ Login endpoint
- ✅ Password change endpoint
- ✅ Password reset endpoints (forgot, reset)
- ✅ Admin password reset endpoint

### Phase 3: Frontend Integration
- ✅ Create Login component for Vite app
- ✅ Update App.tsx to use real authentication
- ✅ Remove hardcoded "Bloggs, Joe"
- ✅ Add password change modal
- ✅ Add forgot password page

### Phase 4: Admin Panel
- ✅ Add user management to existing admin routes
- ✅ Add "Reset Password" option for admins
- ✅ Add "Create User" option
- ✅ Add temporary password generation

### Phase 5: Testing & Deployment
- ✅ Test all authentication flows
- ✅ Test password reset (admin and self-service)
- ✅ Deploy to production

---

## What You Need to Provide

When you're ready to implement:

1. **ADMIN password**: What should the admin password be?
2. **FLTLT Alexander Burns password**: What should his password be?
3. **Email domain**: What email domain to use for users? (e.g., "defence.gov.au")

---

## Current Status

**Analysis Complete** ✅

- Comprehensive design document created: `AUTH_DESIGN_ANALYSIS.md`
- Executive summary created: `AUTH_SUMMARY.md`
- Architecture defined: Users vs Personnel separation clear
- Implementation plan ready

**Awaiting Your Approval** ⏳
- Review the design
- Confirm the approach
- Provide passwords for initial users
- I will NOT make any changes until you approve

---

## Key Questions for You

1. **Approach**: Do you agree with keeping Vite app and adding lightweight authentication, or would you prefer migrating to Next.js?

2. **Passwords**: What passwords should I use for:
   - ADMIN user (login ID: "admin")
   - FLTLT Alexander Burns (login ID: "burns.alexander")

3. **Email**: What email domain should I use for user accounts? (e.g., "defence.gov.au", "raaf.gov.au")

4. **Email Integration**: Should I implement automatic email sending for password resets, or will you handle that manually for now?

5. **Timeline**: When would you like me to start implementing?

---

**Status**: READY FOR YOUR REVIEW - NO CHANGES MADE YET
</create_file>