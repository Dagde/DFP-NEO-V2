# Login Architecture - Multiple Tables Analysis

## Executive Summary

**YES, having 2 separate tables (Personnel + Trainee) will work with login information.** However, we need to ensure the architecture is properly designed to handle authentication correctly.

---

## 1. Understanding the Current Login System

### Current Authentication Flow

```
User logs in → User table (userId + password)
    ↓
Authentication successful → Get User.role
    ↓
Determine if user is Staff or Trainee → Check Personnel/Trainee tables
    ↓
Load profile data → Display appropriate dashboard
```

### Key Principle: **Separation of Concerns**

| Table | Purpose | Fields |
|-------|---------|--------|
| **User** | Authentication only | `userId`, `password`, `role`, `firstName`, `lastName`, `email`, `isActive` |
| **Personnel** | Staff profile data | PMKeys, qualifications, unavailability, logbook, etc. |
| **Trainee** | Trainee profile data | PMKeys, course, progress, instructors, logbook, etc. |

---

## 2. Proposed Login Architecture

### Option 1: Single User Table + Profile Tables (RECOMMENDED)

```prisma
// USER TABLE - Authentication only
model User {
  id              String     @id @default(cuid())
  userId          String     @unique  // PMKeys/ID (e.g., "12345678")
  username        String     @unique  // Alternative login identifier
  email           String?    @unique
  password        String     // Hashed password
  role            Role       @default(USER)  // Determines login access level
  firstName       String?
  lastName        String?
  isActive        Boolean    @default(true)
  lastLogin       DateTime?
  
  // Relations to profile tables
  personnel       Personnel? @relation("UserPersonnel")
  trainee         Trainee?   @relation("UserTrainee")
  
  // ... other metadata
}

// PERSONNEL TABLE - Staff profile data
model Personnel {
  id              String   @id @default(cuid())
  userId          String   @unique  // Links to User.userId (PMKeys)
  
  // Profile fields...
  idNumber        Int      @unique  // PMKeys/ID (same as userId)
  name            String
  rank            String?
  
  // ... all other staff fields
  
  user            User     @relation("UserPersonnel", fields: [userId], references: [id])
}

// TRAINEE TABLE - Trainee profile data
model Trainee {
  id              String   @id @default(cuid())
  userId          String?  @unique  // Links to User.userId (optional - trainees may not have login)
  
  // Profile fields...
  idNumber        Int      @unique  // PMKeys/ID
  name            String
  fullName        String
  rank            String?
  course          String?
  
  // ... all other trainee fields
  
  user            User?    @relation("UserTrainee", fields: [userId], references: [id])
}
```

### How This Works:

#### Scenario 1: Staff Member with Login
```typescript
// 1. User logs in with userId + password
const user = await prisma.user.findUnique({
  where: { userId: "12345678", password: "hashed_password" }
});

// 2. Check if user has Personnel profile
const personnel = await prisma.personnel.findUnique({
  where: { userId: user.userId }
});

if (personnel) {
  // This is a staff member
  return { 
    type: 'staff', 
    user, 
    profile: personnel 
  };
}
```

#### Scenario 2: Trainee with Login
```typescript
// 1. User logs in with userId + password
const user = await prisma.user.findUnique({
  where: { userId: "87654321", password: "hashed_password" }
});

// 2. Check if user has Trainee profile
const trainee = await prisma.trainee.findUnique({
  where: { userId: user.userId }
});

if (trainee) {
  // This is a trainee
  return { 
    type: 'trainee', 
    user, 
    profile: trainee 
  };
}
```

#### Scenario 3: Trainee without Login (Managed by Instructor)
```typescript
// 1. Trainee exists in Trainee table but NO User record
const trainee = await prisma.trainee.findUnique({
  where: { idNumber: 87654321 }
});

// 2. Check if trainee has a User account
const user = await prisma.user.findUnique({
  where: { userId: String(trainee.idNumber) }
});

if (!user) {
  // Trainee has no login - managed by instructor
  return { 
    type: 'trainee_no_login', 
    profile: trainee 
  };
}
```

---

## 3. Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     LOGIN REQUEST                            │
│              (userId: "12345678", password)                  │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   CHECK USER TABLE                          │
│  SELECT * FROM User WHERE userId = "12345678"                │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
                   ┌──────┴──────┐
                   │ User Found? │
                   └──────┬──────┘
                          ↓
              ┌───────────┴───────────┐
              │ NO                     │ YES
              ↓                        ↓
      ┌───────────────┐      ┌─────────────────────┐
      │ Return Error  │      │ Validate Password   │
      │ (Invalid      │      │                     │
      │  credentials) │      └──────────┬──────────┘
      └───────────────┘                 ↓
                             ┌──────────┴──────────┐
                             │ Password Correct?   │
                             └──────────┬──────────┘
                                        ↓
                            ┌───────────┴───────────┐
                            │ NO                     │ YES
                            ↓                        ↓
                    ┌───────────────┐      ┌─────────────────────┐
                    │ Return Error  │      │ Check User.role     │
                    │ (Invalid      │      │                     │
                    │  password)    │      └──────────┬──────────┘
                    └───────────────┘                 ↓
                                        ┌──────────┴──────────┐
                                        │ Determine Profile   │
                                        │ Type                │
                                        └──────────┬──────────┘
                                                   ↓
                              ┌──────────────────────┼──────────────────────┐
                              ↓                      ↓                      ↓
                     ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
                     │ Check        │      │ Check        │      │ User Only    │
                     │ Personnel    │      │ Trainee      │      │ (Admin, etc) │
                     │ Table        │      │ Table        │      │              │
                     └──────┬───────┘      └──────┬───────┘      └──────────────┘
                            ↓                      ↓
                    ┌───────┴───────┐      ┌───────┴───────┐
                    │ Personnel     │      │ Trainee       │
                    │ Found?        │      │ Found?        │
                    └───────┬───────┘      └───────┬───────┘
                            ↓                      ↓
                    ┌───────┴───────┐      ┌───────┴───────┐
                    │ YES           │      │ YES           │
                    ↓               ↓      ↓               ↓
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │ Return Staff  │  │ Return       │  │ Return User  │
            │ Profile +    │  │ Trainee      │  │ Profile Only │
            │ Auth Token   │  │ Profile +    │  │ + Auth Token │
            └──────────────┘  │ Auth Token   │  └──────────────┘
                              └──────────────┘
```

---

## 4. Field Naming Clarification

### PMKeys/ID = userId

You're correct! The PMKeys/ID (e.g., "12345678") should be the `userId` field.

**Recommended Naming Convention:**

| Concept | Database Field | UI Display |
|---------|----------------|------------|
| Login Identifier | `userId` | "PMKeys/ID" or "Service Number" |
| Database Primary Key | `id` (auto-generated CUID) | Hidden (internal use) |
| Profile ID Number | `idNumber` (in Personnel/Trainee) | "PMKeys/ID" (same as userId) |

### Updated Schema with Consistent Naming

```prisma
model User {
  id              String     @id @default(cuid())  // Internal ID (hidden)
  userId          String     @unique              // PMKeys/ID (login identifier)
  username        String     @unique              // Alternative (e.g., "john.smith")
  email           String?    @unique
  password        String                          // Hashed
  role            Role       @default(USER)
  firstName       String?
  lastName        String?
  isActive        Boolean    @default(true)
  
  // Relations
  personnel       Personnel? @relation("UserPersonnel")
  trainee         Trainee?   @relation("UserTrainee")
}

model Personnel {
  id              String   @id @default(cuid())  // Internal ID
  userId          String   @unique              // Links to User.userId (PMKeys)
  idNumber        Int      @unique              // PMKeys/ID (same value)
  
  // ... other fields
  name            String
  rank            String?
  // ...
}

model Trainee {
  id              String   @id @default(cuid())  // Internal ID
  userId          String?  @unique              // Links to User.userId (optional)
  idNumber        Int      @unique              // PMKeys/ID
  
  // ... other fields
  name            String
  fullName        String
  rank            String?
  course          String?
  // ...
}
```

---

## 5. API Implementation Example

### Login Route (app/api/auth/login/route.ts)

```typescript
export async function POST(request: Request) {
  const { userId, password } = await request.json();
  
  // 1. Find user by userId
  const user = await prisma.user.findUnique({
    where: { userId }
  });
  
  if (!user) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  // 2. Verify password
  const isValid = await bcrypt.compare(password, user.password);
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  // 3. Check if user is active
  if (!user.isActive) {
    return NextResponse.json(
      { error: 'Account is inactive' },
      { status: 403 }
    );
  }
  
  // 4. Determine profile type and load profile
  let profile = null;
  let profileType = 'user';
  
  // Check for Personnel profile
  if (['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR'].includes(user.role)) {
    const personnel = await prisma.personnel.findUnique({
      where: { userId: user.userId }
    });
    
    if (personnel) {
      profile = personnel;
      profileType = 'staff';
    }
  }
  
  // Check for Trainee profile
  if (!profile && user.role === 'USER') {
    const trainee = await prisma.trainee.findUnique({
      where: { userId: user.userId }
    });
    
    if (trainee) {
      profile = trainee;
      profileType = 'trainee';
    }
  }
  
  // 5. Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.userId, 
      role: user.role, 
      profileType 
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // 6. Return response
  return NextResponse.json({
    success: true,
    token,
    user: {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    profileType,
    profile
  });
}
```

### Get Profile Route (app/api/profile/route.ts)

```typescript
export async function GET(request: Request) {
  // 1. Authenticate user
  const { userId, profileType } = await authenticateRequest(request);
  
  // 2. Load appropriate profile
  if (profileType === 'staff') {
    const profile = await prisma.personnel.findUnique({
      where: { userId }
    });
    return NextResponse.json({ type: 'staff', profile });
  }
  
  if (profileType === 'trainee') {
    const profile = await prisma.trainee.findUnique({
      where: { userId }
    });
    return NextResponse.json({ type: 'trainee', profile });
  }
  
  // User only (no profile)
  return NextResponse.json({ type: 'user' });
}
```

---

## 6. Benefits of This Architecture

### ✅ Advantages:

1. **Single Source of Truth for Authentication**
   - All login credentials in User table
   - One place to manage passwords, roles, activation

2. **Clear Separation of Concerns**
   - User table: Authentication
   - Personnel table: Staff profile data
   - Trainee table: Trainee profile data

3. **Flexible User Types**
   - Staff with login (User + Personnel)
   - Trainee with login (User + Trainee)
   - Trainee without login (Trainee only)
   - Admin with login only (User only)

4. **Efficient Queries**
   - Login only queries User table
   - Profile queries only query relevant table
   - No need to check multiple tables for authentication

5. **Scalable**
   - Easy to add new profile types (e.g., Contractor, Visitor)
   - Easy to add new user roles
   - Clear data relationships

6. **Security**
   - Passwords only in User table
   - Profile data isolated
   - Role-based access control centralized

---

## 7. Potential Issues & Solutions

### Issue 1: User has both Personnel and Trainee profiles

**Solution:** Use User.role to determine which profile to load
```typescript
if (['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR'].includes(user.role)) {
  // Load Personnel profile
  profile = await prisma.personnel.findUnique({ where: { userId } });
} else if (user.role === 'USER') {
  // Load Trainee profile
  profile = await prisma.trainee.findUnique({ where: { userId } });
}
```

### Issue 2: Trainee transitions to Instructor

**Solution:** 
1. Update User.role from 'USER' to 'INSTRUCTOR'
2. Move/create data in Personnel table
3. Optionally keep Trainee record for history

```typescript
// Promote trainee to instructor
await prisma.user.update({
  where: { userId },
  data: { role: 'INSTRUCTOR' }
});

await prisma.personnel.create({
  data: {
    userId,
    idNumber: trainee.idNumber,
    name: trainee.name,
    rank: 'PLTOFF',
    // ... other fields
  }
});
```

### Issue 3: What if userId doesn't match idNumber?

**Solution:** They should always match. Enforce this constraint:
- User.userId = Personnel.idNumber = Trainee.idNumber
- All represent the same PMKeys/ID

---

## 8. Summary

### Question: "Will having 2 separate trainee and staff tables still work with log in information?"

**Answer: YES - Absolutely.** This is actually a **recommended architecture**.

### Key Points:

1. ✅ **Single User table** handles all authentication
2. ✅ **Separate profile tables** (Personnel, Trainee) store profile data
3. ✅ **User.userId** links to profile tables
4. ✅ **No need to check multiple tables** for login
5. ✅ **Role-based routing** determines which profile to load

### Login Flow:
1. User logs in → Check User table (1 query)
2. Determine profile type → Check User.role
3. Load profile → Query Personnel OR Trainee table (1 query)
4. Return data → User + Profile

### Field Naming:
- **userId** = PMKeys/ID (login identifier)
- **idNumber** = PMKeys/ID (in profile tables, same value)
- **id** = Internal database ID (CUID, hidden)

This architecture is **clean, secure, and scalable**. It will work perfectly for your use case.