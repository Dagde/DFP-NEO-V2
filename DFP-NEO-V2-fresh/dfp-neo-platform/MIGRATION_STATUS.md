# Database Schema Migration Status & Recommendations

## Current Situation

### Problem Identified
The database has **209 Personnel records** all pointing to the **same User record** (`userId: cmk3m3d8w0000kymjmsdlxsy9`). This is causing issues when trying to:
1. Add unique constraints to userId
2. Update the schema to support individual PMKeys/ID for each person

### Root Cause
The current Personnel table was created with:
- All 209 personnel records linked to a single dummy user
- No individual userIds (PMKeys/ID) for each person
- A foreign key constraint preventing userId changes without corresponding User records

### Database Coverage Analysis
- **Staff Profile**: 12.5% coverage (4/32 fields in database)
- **Trainee Profile**: 0% coverage (NO Trainee table exists)

## Recommended Migration Strategy

### Option 1: Create New Structure (RECOMMENDED - CLEANEST)

Instead of trying to fix the existing data, create a new clean structure:

```prisma
// Keep existing User table for authentication
model User {
  id              String     @id @default(cuid())
  userId          String     @unique  // PMKeys/ID for login
  username        String     @unique
  email           String?    @unique
  password        String
  role            Role       @default(USER)
  firstName       String?
  lastName        String?
  isActive        Boolean    @default(true)
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  
  // Relations - make them optional
  personnel       Personnel?
  trainee         Trainee?
}

// Personnel table - make userId optional initially
model Personnel {
  id                       String   @id @default(cuid())
  userId                   String?  @unique  // Make optional for migration
  
  // All 32 fields from Staff profile...
  idNumber                 Int      @unique
  name                     String
  rank                     String?
  // ... rest of fields
  
  // Remove foreign key constraint temporarily
  user                     User?    @relation("PersonnelUser", fields: [userId], references: [id])
}

// New Trainee table
model Trainee {
  id                       String   @id @default(cuid())
  userId                   String?  @unique  // Optional for migration
  
  // All 24 fields from Trainee profile...
  idNumber                 Int      @unique
  name                     String
  fullName                 String
  // ... rest of fields
  
  user                     User?    @relation("TraineeUser", fields: [userId], references: [id])
}
```

**Advantages:**
- No data loss
- Clean migration path
- Can keep existing data while building new structure
- Gradual migration possible

### Option 2: Reset and Rebuild (QUICKEST BUT LOSES DATA)

Use `npx prisma db push --force-reset` to:
1. Drop all tables
2. Apply new schema with proper structure
3. Re-import data from mockData.ts files

**Advantages:**
- Clean slate
- Proper constraints from the start
- No legacy issues

**Disadvantages:**
- Loses all existing data
- Need to re-import everything

### Option 3: Incremental Migration (MOST COMPLEX)

Step-by-step fix the existing data:
1. Drop foreign key constraint
2. Update all userIds to be unique
3. Re-add foreign key constraint
4. Create missing User records
5. Add new fields to Personnel
6. Create Trainee table
7. Import trainee data

**Disadvantages:**
- Complex multi-step process
- High risk of errors
- Time-consuming

## Immediate Recommendation

**I recommend Option 1 (Create New Structure)** with these steps:

### Phase 1: Schema Update
1. ✅ Create updated schema with optional relations
2. ✅ Add all missing fields to Personnel table
3. ✅ Create new Trainee table
4. Run `npx prisma db push` (should work without data loss)

### Phase 2: Data Migration
1. Export existing Personnel data
2. Create new User records for each person (with PMKeys/ID)
3. Update Personnel records to link to correct User records
4. Import trainee data from mockData.ts

### Phase 3: API Updates
1. Update authentication to handle optional profile relations
2. Create Personnel CRUD endpoints
3. Create Trainee CRUD endpoints
4. Update profile loading logic

### Phase 4: Frontend Integration
1. Update components to use new API endpoints
2. Remove dependency on mockData.ts
3. Add error handling

## Next Steps

Would you like me to:

1. **Implement Option 1** - Create new clean structure with optional relations (preserves data)
2. **Implement Option 2** - Reset database and rebuild from scratch (loses data but is faster)
3. **Implement Option 3** - Attempt complex incremental migration (highest risk)

Please let me know which approach you prefer, and I'll proceed accordingly.