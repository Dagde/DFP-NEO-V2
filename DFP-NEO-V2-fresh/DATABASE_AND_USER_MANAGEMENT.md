# Database and User Management - DFP-NEO

## Current Status

### ✅ Database Implementation
**Status**: FULLY IMPLEMENTED with PostgreSQL + Prisma ORM

The database schema is complete and ready for production use. Currently, the application is using **mock users** in development, but the database infrastructure is fully set up.

### 📊 Database Schema

#### User Model
```prisma
model User {
  id            String    @id @default(cuid())
  username      String    @unique
  email         String?   @unique
  password      String    // Bcrypt hashed
  role          Role      @default(USER)
  firstName     String?
  lastName      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLogin     DateTime?
  isActive      Boolean   @default(true)
}

enum Role {
  SUPER_ADMIN
  ADMIN
  PILOT
  INSTRUCTOR
  USER
}
```

#### UserSettings Model
```prisma
model UserSettings {
  id          String   @id @default(cuid())
  userId      String   @unique
  settings    Json     // Store all user settings as JSON
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## How to Add/Change Users

### Method 1: Using the Add User Script (Recommended)

**Command**:
```bash
cd dfp-neo-platform
npx tsx scripts/add-user.ts <username> <email> <password> <role> <firstName> <lastName>
```

**Example**:
```bash
npx tsx scripts/add-user.ts "mike.pilot" "mike@dfp-neo.com" "Pilot2024!Secure" "PILOT" "Mike" "Johnson"
```

**Available Roles**:
- `SUPER_ADMIN` - Full system access
- `ADMIN` - Administrative access
- `PILOT` - Pilot user
- `INSTRUCTOR` - Instructor user
- `USER` - Basic user

### Method 2: Using the Bulk Import Script

**From JSON File**:
```bash
cd dfp-neo-platform
npx tsx scripts/add-users-from-json.ts path/to/users.json
```

**JSON Format**:
```json
[
  {
    "username": "john.doe",
    "email": "john@dfp-neo.com",
    "password": "SecurePass123!",
    "role": "PILOT",
    "firstName": "John",
    "lastName": "Doe"
  },
  {
    "username": "jane.smith",
    "email": "jane@dfp-neo.com",
    "password": "SecurePass456!",
    "role": "INSTRUCTOR",
    "firstName": "Jane",
    "lastName": "Smith"
  }
]
```

### Method 3: Using the Setup Production Users Script

**Command**:
```bash
cd dfp-neo-platform
npx tsx scripts/setup-production-users.ts
```

This creates default users:
- **admin** / admin123 (ADMIN role)
- **pilot** / pilot123 (PILOT role)
- **instructor** / instructor123 (INSTRUCTOR role)

## Password Management

### Password Hashing
All passwords are automatically hashed using **bcrypt** with a salt rounds of 12:

```typescript
const hashedPassword = await bcrypt.hash(password, 12);
```

### Changing Passwords

**Option 1: Using Prisma Studio (GUI)**
```bash
cd dfp-neo-platform
npx prisma studio
```
Then navigate to the User model and update the password field with a new bcrypt hash.

**Option 2: Using a Script**
Create a password hash:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('NewPassword123!', 12).then(hash => console.log(hash));"
```

Then update in database:
```bash
npx prisma db execute --stdin <<EOF
UPDATE "User" SET password = '<hashed_password>' WHERE username = 'username';
EOF
```

## Current Authentication Setup

### Development Mode
**Location**: `lib/auth/auth.config.ts`

Currently using **mock users** defined in the auth config:
- admin / admin123
- john.pilot / pilot123
- jane.instructor / instructor123

### Production Mode
To switch to database authentication, the auth config needs to be updated to query the database instead of using mock users.

**Current Mock Setup**:
```typescript
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    password: '$2a$10$UQW34KIPs5Cmkg3Ni4.hUuVQInCsT1VVLKTIR78cgtrSqnrpkKvvS',
    role: 'ADMIN',
    // ...
  }
];
```

**Database Setup** (needs implementation):
```typescript
// Query database instead of mock users
const user = await prisma.user.findUnique({
  where: { username: credentials.username }
});
```

## Permissions Management

### Current Permissions Location

**Question**: Should permissions be in the database or remain in app storage?

#### Option 1: Database Storage (Recommended for Production)
**Pros**:
- ✅ Centralized management
- ✅ Consistent across sessions
- ✅ Easier to audit and backup
- ✅ Can be managed via admin interface
- ✅ Survives app updates

**Implementation**:
Store permissions in the `UserSettings` model's JSON field:
```json
{
  "permissions": {
    "canEditSchedule": true,
    "canDeleteEvents": false,
    "canManageUsers": true,
    "canViewReports": true
  }
}
```

#### Option 2: App Storage (Current)
**Pros**:
- ✅ Faster access (no database query)
- ✅ Works offline
- ✅ Simpler implementation

**Cons**:
- ❌ Lost on browser clear/different device
- ❌ Harder to manage centrally
- ❌ No audit trail

### Recommendation
**For Production**: Move permissions to database (UserSettings model)
**For Development**: App storage is acceptable

## Database Connection

### Environment Variables
Ensure these are set in `.env` or `.env.production`:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
AUTH_SECRET="your-secret-key-here"
AUTH_TRUST_HOST="true"
```

### Prisma Commands

**Generate Prisma Client**:
```bash
cd dfp-neo-platform
npx prisma generate
```

**Run Migrations**:
```bash
npx prisma migrate deploy
```

**View Database**:
```bash
npx prisma studio
```

**Reset Database** (⚠️ Deletes all data):
```bash
npx prisma migrate reset
```

## Migration Path: Mock Users → Database

### Step 1: Populate Database
```bash
cd dfp-neo-platform
npx tsx scripts/setup-production-users.ts
```

### Step 2: Update Auth Config
Modify `lib/auth/auth.config.ts` to query database instead of mock users.

### Step 3: Test Authentication
1. Try logging in with database users
2. Verify roles and permissions work
3. Test password changes

### Step 4: Remove Mock Users
Once database authentication is confirmed working, remove the `mockUsers` array from auth config.

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- Include uppercase and lowercase
- Include numbers
- Include special characters
- Example: `SecurePass123!`

### Password Hashing
- Always use bcrypt with salt rounds ≥ 12
- Never store plain text passwords
- Never log passwords

### User Management
- Regularly audit user accounts
- Disable inactive users (set `isActive: false`)
- Use strong passwords for admin accounts
- Rotate passwords periodically

## Troubleshooting

### "User not found" Error
- Check if user exists in database: `npx prisma studio`
- Verify username spelling
- Check if user is active (`isActive: true`)

### "Invalid password" Error
- Verify password is correct
- Check if password hash is valid bcrypt format
- Ensure bcrypt salt rounds match (12)

### Database Connection Error
- Verify `DATABASE_URL` in `.env`
- Check database is running
- Verify network connectivity
- Check database credentials

## Quick Reference

### Add a New User
```bash
npx tsx scripts/add-user.ts "username" "email@example.com" "Password123!" "ROLE" "FirstName" "LastName"
```

### View All Users
```bash
npx prisma studio
# Navigate to User model
```

### Change Password
1. Generate hash: `node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('NewPass123!', 12).then(console.log);"`
2. Update in Prisma Studio or via script

### Check Database Status
```bash
npx prisma db pull  # Pull current schema
npx prisma validate # Validate schema
```

---

**Summary**: The database is fully implemented and ready. Currently using mock users for development. For production, populate the database with real users and update the auth config to query the database. Permissions can remain in app storage for now, but moving to database is recommended for production.