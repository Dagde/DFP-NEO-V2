# PIN and Password Management System

## Current State

### PIN System
- **Current Default**: All users have PIN = `1111`
- **Usage**: PINs are used throughout the app for:
  - Authorizing flights
  - Signing off on events
  - Accessing certain features
  - Instructor verification

### Password System
- **Current State**: Passwords are stored in the database with bcrypt hashing
- **Test Users**: Have hardcoded passwords (admin123, pilot123, instructor123)
- **No Reset Mechanism**: Currently no way for users to reset passwords

## Recommended Production Setup

### Phase 1: Immediate Deployment (Current State)
**Keep default PIN = 1111 for now, but add these features:**

1. **First Login Flow**
   - Detect if user is logging in for the first time
   - Force PIN change on first login
   - Force password change on first login
   - Store `hasChangedDefaultCredentials` flag in database

2. **User Profile Settings Page**
   - Add "Change PIN" option
   - Add "Change Password" option
   - Show last changed dates
   - Validate new PIN (4 digits, not 1111, not sequential)

### Phase 2: Enhanced Security (Recommended)
1. **PIN Requirements**
   - Must be 4 digits
   - Cannot be 1111, 0000, 1234, etc.
   - Must be different from previous PIN
   - Expires every 90 days (optional)

2. **Password Requirements**
   - Minimum 8 characters
   - Must contain uppercase, lowercase, number
   - Cannot be same as username
   - Expires every 90 days (optional)

3. **Password Reset Flow**
   - "Forgot Password" link on login page
   - Email verification (requires email setup)
   - Or admin-initiated reset
   - Temporary password sent via email

4. **PIN Reset Flow**
   - User can reset via profile settings
   - Or admin can reset for user
   - Requires password verification

## Implementation Plan

### 1. Database Schema Updates
Add to User model in Prisma schema:
```prisma
model User {
  id                          String   @id @default(cuid())
  username                    String   @unique
  password                    String
  pin                         String   @default("1111")
  hasChangedDefaultPin        Boolean  @default(false)
  hasChangedDefaultPassword   Boolean  @default(false)
  pinLastChanged              DateTime?
  passwordLastChanged         DateTime?
  lastLogin                   DateTime?
  role                        Role     @default(PILOT)
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
}
```

### 2. First Login Detection
Create middleware to check on login:
```typescript
// lib/auth/first-login-check.ts
export function isFirstLogin(user: User): boolean {
  return !user.hasChangedDefaultPin || !user.hasChangedDefaultPassword;
}
```

### 3. Force Change on First Login
Redirect to settings page if first login:
```typescript
// In login callback
if (isFirstLogin(user)) {
  return { redirect: '/settings/change-credentials?firstLogin=true' };
}
```

### 4. Settings Page Components
Create new pages:
- `/app/settings/change-pin/page.tsx`
- `/app/settings/change-password/page.tsx`
- `/app/settings/reset-password/page.tsx` (for admins)

### 5. API Endpoints
Create new API routes:
- `/app/api/user/change-pin/route.ts`
- `/app/api/user/change-password/route.ts`
- `/app/api/admin/reset-user-credentials/route.ts`

## Quick Implementation (Minimal Viable)

### Option A: Keep 1111 Default (Simplest)
**Pros:**
- No immediate changes needed
- Users can continue using app
- Can add change functionality later

**Cons:**
- Security risk if users don't change PIN
- No enforcement of strong credentials

**Recommendation:** Only for internal/testing environments

### Option B: Force Change on First Login (Recommended)
**Pros:**
- Ensures all users have unique credentials
- Better security from day one
- Users aware of credential management

**Cons:**
- Requires implementation before deployment
- All users must change credentials on first login

**Recommendation:** Best for production deployment

### Option C: Admin Sets Initial Credentials (Most Secure)
**Pros:**
- Admin controls initial credentials
- Can enforce strong password/PIN policies
- Users receive unique credentials from start

**Cons:**
- More admin overhead
- Requires secure credential distribution

**Recommendation:** Best for high-security environments

## Immediate Action Items

### For Current Deployment:
1. ✅ Keep default PIN = 1111
2. ✅ Document that users should change PIN
3. ⚠️ Add warning banner: "Please change your default PIN in settings"
4. 📋 Plan to implement proper credential management

### For Next Update (Priority):
1. Add User Settings page with:
   - Change PIN form
   - Change Password form
   - Last changed dates display
2. Add validation for new PINs/passwords
3. Add first-login detection and forced change
4. Add admin credential reset functionality

### For Future Enhancement:
1. Email-based password reset
2. PIN/Password expiration policies
3. Password history (prevent reuse)
4. Account lockout after failed attempts
5. Two-factor authentication (2FA)

## Code Examples

### Change PIN API Route
```typescript
// app/api/user/change-pin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPin, newPin } = await req.json();

  // Validate new PIN
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 });
  }

  if (newPin === '1111' || newPin === '0000' || newPin === '1234') {
    return NextResponse.json({ error: 'PIN too simple' }, { status: 400 });
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { username: session.user.name }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current PIN
  if (user.pin !== currentPin) {
    return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 400 });
  }

  // Update PIN
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pin: newPin,
      hasChangedDefaultPin: true,
      pinLastChanged: new Date()
    }
  });

  return NextResponse.json({ success: true });
}
```

### Change Password API Route
```typescript
// app/api/user/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  // Validate new password
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { username: session.user.name }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      hasChangedDefaultPassword: true,
      passwordLastChanged: new Date()
    }
  });

  return NextResponse.json({ success: true });
}
```

## Summary

### For Immediate Deployment:
- ✅ **Keep PIN = 1111** as default
- ✅ **Document** that users should change it
- ⚠️ **Add warning** in app about default credentials
- 📋 **Plan** proper credential management for next update

### For Next Sprint:
- 🔨 **Implement** Change PIN/Password in settings
- 🔨 **Add** first-login forced change
- 🔨 **Create** admin reset functionality
- 🔨 **Add** validation and security policies

### Long-term:
- 🚀 Email-based password reset
- 🚀 Credential expiration policies
- 🚀 Two-factor authentication
- 🚀 Audit logging for credential changes