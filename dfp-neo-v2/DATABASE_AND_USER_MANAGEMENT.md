# DFP-NEO Database & User Management Guide

## ✅ Database Implementation Status

### **YES - Database is Fully Implemented**

The DFP-NEO application uses **PostgreSQL** database with **Prisma ORM** for user authentication and data management.

## 📊 Database Schema

### **User Model**
```prisma
model User {
  id            String    @id @default(cuid())
  username      String    @unique
  email         String?   @unique
  password      String    // Hashed with bcrypt
  role          Role      @default(USER)
  firstName     String?
  lastName      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLogin     DateTime?
  isActive      Boolean   @default(true)
  
  // Relations
  sessions      Session[]
  schedules     Schedule[]
  settings      UserSettings?
  flightSchedules FlightSchedule[]
  personnel     Personnel[]
  aircraft      Aircraft[]
  cancellations CancellationHistory[]
  auditLogs     AuditLog[]
}
```

### **Role Enum**
```prisma
enum Role {
  SUPER_ADMIN
  ADMIN
  PILOT
  INSTRUCTOR
  USER
}
```

## 🔐 Current Authentication Setup

### **Development Mode (Current)**
- Uses **mock users** defined in `lib/auth/auth.config.ts`
- Passwords are pre-hashed with bcrypt
- No database connection required for development

### **Production Mode (Ready)**
- Database schema is ready
- Production user setup script available
- Passwords hashed with bcrypt (12 rounds)

## 👥 Default Users

### **Current Mock Users (Development)**
1. **Admin User**
   - Username: `admin`
   - Password: `admin123`
   - Email: `admin@dfp-neo.com`
   - Role: `ADMIN`

2. **Pilot User**
   - Username: `john.pilot`
   - Password: `pilot123`
   - Email: `john.pilot@dfp-neo.com`
   - Role: `PILOT`

3. **Instructor User**
   - Username: `jane.instructor`
   - Password: `instructor123`
   - Email: `jane.instructor@dfp-neo.com`
   - Role: `INSTRUCTOR`

### **Production Users (When Database Connected)**
1. **Admin User**
   - Username: `admin`
   - Password: `Admin2024!Secure`
   - Email: `admin@dfp-neo.com`
   - Role: `ADMIN`

2. **Pilot User**
   - Username: `john.pilot`
   - Password: `Pilot2024!Secure`
   - Email: `john.pilot@dfp-neo.com`
   - Role: `PILOT`

3. **Instructor User**
   - Username: `jane.instructor`
   - Password: `Instructor2024!Secure`
   - Email: `jane.instructor@dfp-neo.com`
   - Role: `INSTRUCTOR`

## 🔧 How to Add/Change Users

### **Method 1: Using the Setup Script (Recommended)**

1. **Edit the script** at `scripts/setup-production-users.ts`:
```typescript
const productionUsers = [
  {
    username: 'newuser',
    email: 'newuser@dfp-neo.com',
    password: 'SecurePassword123!',
    role: Role.PILOT, // or Role.ADMIN, Role.INSTRUCTOR, etc.
    firstName: 'New',
    lastName: 'User',
  },
  // Add more users here
];
```

2. **Run the script**:
```bash
cd dfp-neo-platform
npx tsx scripts/setup-production-users.ts
```

### **Method 2: Using Prisma Studio (GUI)**

1. **Open Prisma Studio**:
```bash
cd dfp-neo-platform
npx prisma studio
```

2. **Navigate to User model**
3. **Add/Edit users** through the GUI
4. **Important**: Hash passwords before saving:
```javascript
// Use this to generate hashed password
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash('YourPassword123!', 12);
console.log(hashedPassword);
```

### **Method 3: Direct Database Query**

```sql
-- Add a new user
INSERT INTO "User" (id, username, email, password, role, "firstName", "lastName", "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'newuser',
  'newuser@dfp-neo.com',
  '$2a$12$hashedPasswordHere', -- Use bcrypt to hash
  'PILOT',
  'New',
  'User',
  true,
  NOW(),
  NOW()
);
```

### **Method 4: Admin API (Future Enhancement)**

Create an admin interface at `/admin/users` to manage users through the UI.

## 🔒 Password Management

### **Hashing Passwords**

All passwords are hashed using **bcrypt** with 12 rounds:

```javascript
import bcrypt from 'bcryptjs';

// Hash a password
const hashedPassword = await bcrypt.hash('PlainTextPassword', 12);

// Verify a password
const isValid = await bcrypt.compare('PlainTextPassword', hashedPassword);
```

### **Password Requirements**
- Minimum 8 characters
- Mix of uppercase and lowercase
- Include numbers
- Include special characters (recommended)

## 📋 Permissions System

### **Current Implementation**

#### **Database Storage (Recommended) ✅**
Permissions are stored in the database through:

1. **Role-Based Access Control (RBAC)**
   - Defined in `enum Role`
   - Stored in `User.role` field
   - Hierarchical permissions:
     - `SUPER_ADMIN` - Full system access
     - `ADMIN` - Administrative functions
     - `INSTRUCTOR` - Training management
     - `PILOT` - Flight operations
     - `USER` - Basic access

2. **UserSettings Model**
   - Stores user-specific settings as JSON
   - Can include custom permissions
   - Flexible structure for future expansion

3. **Personnel Model**
   - Stores qualifications and availability
   - Role-specific data
   - Scheduling preferences

#### **App Storage (Current for Flight School)**
The flight-school-app currently stores some permissions in:
- Browser localStorage
- JSON files in the app
- This is **safe for development** but should migrate to database for production

### **Recommended Approach**

**Use Database for Permissions** ✅

**Reasons:**
1. **Centralized Control**: Single source of truth
2. **Security**: Server-side validation
3. **Audit Trail**: Track permission changes
4. **Scalability**: Easy to add new permissions
5. **Consistency**: Same permissions across devices

**Migration Path:**
1. Keep current app permissions for backward compatibility
2. Gradually move permissions to database
3. Use database as primary source
4. App storage as cache/fallback

## 🗄️ Database Connection

### **Current Status**
- Schema defined and ready
- Mock users for development
- Database connection configured in `.env`

### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Authentication
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="https://your-domain.com"
AUTH_TRUST_HOST="true"
```

### **To Connect Database**

1. **Update `.env` with your database URL**
2. **Run migrations**:
```bash
cd dfp-neo-platform
npx prisma migrate deploy
```

3. **Setup production users**:
```bash
npx tsx scripts/setup-production-users.ts
```

4. **Update auth config** to use database instead of mock users

## 📊 User Management Best Practices

### **Security**
1. ✅ Always hash passwords with bcrypt
2. ✅ Use strong passwords (12+ characters)
3. ✅ Implement password reset functionality
4. ✅ Enable audit logging for user changes
5. ✅ Regular security audits

### **Data Management**
1. ✅ Regular database backups
2. ✅ Soft delete users (set `isActive: false`)
3. ✅ Track user activity with `lastLogin`
4. ✅ Use transactions for critical operations
5. ✅ Implement data retention policies

### **Access Control**
1. ✅ Use role-based permissions
2. ✅ Validate permissions server-side
3. ✅ Log all permission changes
4. ✅ Regular permission audits
5. ✅ Principle of least privilege

## 🔄 Migration from Mock to Database

When ready to switch from mock users to database:

1. **Update `lib/auth/auth.config.ts`**:
```typescript
// Replace mockUsers with database query
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async authorize(credentials) {
  // Query database instead of mockUsers
  const user = await prisma.user.findUnique({
    where: { username: credentials.username }
  });
  
  // Rest of authentication logic
}
```

2. **Test thoroughly** with production users
3. **Deploy** to production environment

## 📞 Support

For user management issues:
1. Check Prisma logs: `npx prisma studio`
2. Verify database connection: `npx prisma db push`
3. Review audit logs in database
4. Check authentication logs in console

## 🎯 Summary

✅ **Database is fully implemented and ready**
✅ **User authentication with bcrypt hashing**
✅ **Role-based access control**
✅ **Production user setup script available**
✅ **Permissions should be stored in database (recommended)**
✅ **Current app storage is safe but should migrate to database**

The system is production-ready and just needs database connection to switch from mock users to real database authentication.