# 🚀 DFP-NEO Authentication System - Setup Guide

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Git repository access

## 🔧 Installation Steps

### Step 1: Install Dependencies

```bash
cd dfp-neo-platform
npm install
```

This will install all required packages including:
- NextAuth v5
- Prisma 6.1
- bcryptjs
- tsx (for running TypeScript seed script)

### Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update the following:

```env
# Database - Update with your PostgreSQL credentials
DATABASE_URL="postgresql://user:password@localhost:5432/dfp_neo"

# NextAuth - Generate a secure secret
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run: openssl rand -base64 32"

# Initial Admin User - Change these!
INITIAL_ADMIN_USERID="admin"
INITIAL_ADMIN_PASSWORD="YourSecurePassword123!"
INITIAL_ADMIN_EMAIL="admin@yourdomain.com"

# Optional: Create sample users for testing
CREATE_SAMPLE_USERS="false"
```

**⚠️ IMPORTANT:** Generate a secure NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### Step 3: Generate Prisma Client

```bash
npx prisma generate
```

This generates the TypeScript types and Prisma Client based on your schema.

### Step 4: Create Database Migration

```bash
npx prisma migrate dev --name add_auth_system
```

This will:
- Create the migration files
- Apply the migration to your database
- Create all tables (User, PermissionsRole, PermissionCapability, etc.)

### Step 5: Seed the Database

```bash
npm run db:seed
```

This will:
- Create 12 permission capabilities
- Create 5 roles (Administrator, Instructor, Trainee, Programmer, Maintenance)
- Map capabilities to roles
- Create the initial administrator user
- (Optional) Create sample users if CREATE_SAMPLE_USERS=true

**Expected Output:**
```
🌱 Starting database seed...
📋 Creating permission capabilities...
  ✓ Created capability: launch:access
  ✓ Created capability: admin:access_panel
  ... (10 more)

👥 Creating permissions roles...
  ✓ Created role: Administrator with 12 capabilities
  ✓ Created role: Instructor with 5 capabilities
  ... (3 more)

👤 Creating initial administrator user...
  ✓ Created admin user: admin
  ⚠️  IMPORTANT: Default password is 'YourSecurePassword123!'
  ⚠️  User MUST change password on first login

✅ Database seed completed successfully!
```

### Step 6: Start Development Server

```bash
npm run dev
```

Server will start on http://localhost:3000

### Step 7: First Login

1. Navigate to http://localhost:3000/login
2. Login with:
   - **User ID:** `admin` (or your INITIAL_ADMIN_USERID)
   - **Password:** Your INITIAL_ADMIN_PASSWORD
3. You will be **forced to change your password** on first login
4. Set a strong new password (12+ characters, uppercase, lowercase, number, special char)
5. You'll be logged out and need to login again with your new password

### Step 8: Access Administrator Panel

1. After logging in, navigate to http://localhost:3000/admin
2. You should see the Administrator Panel dashboard
3. Explore:
   - **Dashboard** - System statistics
   - **Users** - Manage users
   - **Permissions** - View roles and capabilities
   - **Audit Logs** - Review system activity

---

## 🎯 Quick Start Commands

```bash
# Full setup from scratch
cd dfp-neo-platform
npm install
cp .env.example .env
# Edit .env with your settings
npx prisma generate
npx prisma migrate dev --name add_auth_system
npm run db:seed
npm run dev
```

---

## 👥 Creating Your First User

### Method A: Invite Link (Recommended)

1. Go to http://localhost:3000/admin/users
2. Click "Create User"
3. Fill in:
   - User ID (e.g., "PILOT001")
   - Display Name (e.g., "John Pilot")
   - Email (optional but recommended)
   - Permissions Role (e.g., "Instructor")
4. Select "Send Invite Link"
5. Click "Create User"
6. Copy the generated invite link
7. Share the link with the user (via email, Slack, etc.)
8. User clicks the link and sets their password
9. User can now login

### Method B: Temporary Password

1. Go to http://localhost:3000/admin/users
2. Click "Create User"
3. Fill in user details
4. Select "Set Temporary Password"
5. Enter a temporary password (must meet strength requirements)
6. Click "Create User"
7. Share the User ID and temporary password with the user
8. User logs in and is forced to change password

---

## 🔐 Security Best Practices

### Password Requirements
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Cannot be a common password

### Rate Limiting
- 10 failed login attempts = 15 minute lockout
- Applies per User ID + IP address combination
- Automatically resets after successful login

### Token Security
- Invite tokens expire after 72 hours
- Password reset tokens expire after 30 minutes
- All tokens are single-use
- Tokens are hashed before storage (SHA-256)

### Session Security
- Sessions last 30 days
- JWT-based sessions
- Sessions revoked on password change
- Secure cookies in production (HTTPS)

---

## 🧪 Testing the System

### Test Authentication
```bash
# Test login
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"userId":"admin","password":"YourPassword"}'
```

### Test User Creation
1. Login as admin
2. Create a test user with invite link
3. Open invite link in incognito window
4. Set password
5. Login with new credentials

### Test Password Reset
1. Go to /forgot-password
2. Enter User ID or email
3. Check console for reset link (email not integrated yet)
4. Use reset link to change password

### Test Permissions
1. Create a user with "Trainee" role
2. Login as that user
3. Try to access /admin - should be redirected
4. Verify they can access /launch

---

## 📊 Database Schema Overview

### Core Tables
- **User** - User accounts with userId (login), email (optional), passwordHash
- **PermissionsRole** - Roles (Administrator, Instructor, etc.)
- **PermissionCapability** - Capabilities (admin:access_panel, users:manage, etc.)
- **PermissionsRoleCapability** - Maps roles to capabilities
- **InviteToken** - Invite links for password setup
- **PasswordResetToken** - Password reset links
- **AuditLog** - Comprehensive activity logging
- **Session** - NextAuth sessions
- **Account** - NextAuth accounts (for future OAuth)

### Key Relationships
- User → PermissionsRole (many-to-one)
- PermissionsRole → PermissionCapability (many-to-many via join table)
- User → InviteToken (one-to-many)
- User → PasswordResetToken (one-to-many)
- User → AuditLog (one-to-many, as actor and target)
- User → Session (one-to-many)

---

## 🔍 Troubleshooting

### "Prisma Client not found"
```bash
npx prisma generate
```

### "Database connection error"
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists
- Check credentials

### "Cannot find module '@/lib/auth'"
- Ensure tsconfig.json has path aliases configured
- Run `npm install` again

### "Rate limit error on login"
- Wait 15 minutes for lockout to expire
- Or restart the server (in-memory rate limiting)

### "Middleware redirect loop"
- Check that /login is in publicRoutes
- Verify session is being created correctly
- Check browser cookies

### Seed script fails
```bash
# Reset database and try again
npx prisma migrate reset --force
npm run db:seed
```

---

## 🚀 Production Deployment

### Before Deploying to Production:

1. **Change Default Passwords**
   - Login and change admin password immediately
   - Use strong, unique passwords

2. **Update Environment Variables**
   - Use production DATABASE_URL
   - Set NEXTAUTH_URL to your production domain
   - Generate new NEXTAUTH_SECRET (never reuse dev secret)
   - Enable HTTPS

3. **Security Hardening**
   - Use Redis for rate limiting (not in-memory)
   - Enable CSRF protection
   - Set secure cookie flags
   - Configure CORS properly
   - Add Helmet.js for security headers

4. **Email Integration**
   - Integrate email service (SendGrid, AWS SES, etc.)
   - Update forgot-password and invite flows
   - Test email delivery

5. **Monitoring**
   - Set up error tracking (Sentry, etc.)
   - Monitor failed login attempts
   - Set up alerts for suspicious activity
   - Review audit logs regularly

6. **Database**
   - Use connection pooling
   - Set up backups
   - Monitor performance
   - Consider read replicas for scaling

### Deployment Commands

```bash
# Build for production
npm run build

# Run migrations on production database
npx prisma migrate deploy

# Start production server
npm start
```

---

## 📚 Additional Resources

- **NextAuth Documentation:** https://next-auth.js.org/
- **Prisma Documentation:** https://www.prisma.io/docs
- **Security Best Practices:** See IMPLEMENTATION_COMPLETE.md

---

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review AUTH_IMPLEMENTATION_STATUS.md for technical details
3. Check audit logs for security events
4. Contact your system administrator

---

**Last Updated:** January 5, 2026
**Version:** 1.0.0