# User and Personnel Linkage Analysis

## Current State

### How Linkage Currently Works

**1. Personnel Creation Flow (via /api/personnel POST):**
```
User (e.g., admin) → Adds Staff via DFP-NEO App → /api/personnel POST
→ Personnel record created with userId = session.user.id (the admin's user ID)
```

**Problem:** This links the Personnel to the **creator**, not the **staff member**.

**2. User Creation Flow (via /api/admin/users/create POST):**
```
Admin → Creates User via Administrator Panel → /api/admin/users/create POST
→ User record created with userId (PMKEYS) and role
→ NO linkage to Personnel record created
```

**Problem:** Users created in Administrator Panel are not linked to any Personnel record.

### Current Linkage Structure

**Database Schema:**
```prisma
model User {
  id       String      @id @default(cuid())
  userId   String      @unique  // PMKEYS/ID (e.g., "8207938")
  username String      @unique
  // ... other fields
  personnel Personnel?  // Relation: One User can have one Personnel record
}

model Personnel {
  id       String   @id @default(cuid())
  userId   String?  // Links to User.id (NOT PMKEYS)
  // ... other fields
  user     User?    @relation("Personnel")
}
```

**Current Linkage:**
- `Personnel.userId` → `User.id` (Prisma cuid)
- This is correct for the schema
- BUT the current implementation sets it to the creator's User.id, not the staff member's User.id

## Required Linkage for iOS App

### iOS App Login Flow
```
1. User logs in with username/password (or PMKEYS)
2. App gets User record from /api/auth/... 
3. App needs to find Personnel record for this User
4. App displays schedule from Personnel record
```

### Required Linkage Direction
```
User.userId (PMKEYS) → Personnel.idNumber (PMKEYS)
OR
Personnel.userId → User.id (where User.userId matches Personnel.idNumber)
```

## Solution Options

### Option 1: Link by PMKEYS/idNumber (RECOMMENDED)
**Approach:** Link User to Personnel using the PMKEYS/ID number

**Changes Needed:**

1. **When creating a User in Administrator Panel:**
   - Check if Personnel record exists with matching `idNumber`
   - If yes, set `Personnel.userId = User.id`

2. **When creating a Personnel record:**
   - Check if User record exists with matching `userId` (PMKEYS)
   - If yes, set `Personnel.userId = User.id`

**Implementation:**
```typescript
// In /api/admin/users/create/route.ts
const user = await prisma.user.create({...});

// Link to existing Personnel by PMKEYS
const existingPersonnel = await prisma.personnel.findFirst({
  where: { idNumber: user.userId }
});

if (existingPersonnel) {
  await prisma.personnel.update({
    where: { id: existingPersonnel.id },
    data: { userId: user.id }
  });
}
```

**Pros:**
- Uses existing unique identifiers (PMKEYS)
- No schema changes needed
- Automatic linking when either record is created
- Works for iOS app login flow

**Cons:**
- None significant

### Option 2: Link via Manual Association
**Approach:** Add UI to manually link Users to Personnel

**Changes Needed:**
- Add "Link Personnel" button in User edit page
- Add dropdown to select Personnel record
- Update Personnel.userId field

**Pros:**
- Explicit control over linkage
- Can handle edge cases

**Cons:**
- Manual process
- User error prone
- Additional UI development

### Option 3: Create User when Adding Staff
**Approach:** When adding Staff via DFP-NEO App, automatically create User record

**Changes Needed:**
- Modify /api/personnel POST to also create User record
- Generate temporary password
- Set User.userId = Personnel.idNumber
- Link Personnel.userId = User.id

**Pros:**
- Automated process
- One-step creation

**Cons:**
- May create duplicate User records
- Complex error handling
- May not want all Staff to have app access

## Recommended Implementation

**Use Option 1 (Link by PMKEYS) with enhancements:**

1. **Update User Creation API:**
   - Automatically link to existing Personnel by PMKEYS
   - Add console tracking for debugging

2. **Update Personnel Creation API:**
   - Automatically link to existing User by PMKEYS
   - Already implemented (partially), but need to fix

3. **Add API Endpoint for Manual Linking:**
   - POST /api/admin/users/[id]/link-personnel
   - Allow admin to manually link User to Personnel

4. **Add Debug Endpoints:**
   - /api/debug/user-linkage (already created)
   - Shows current linkage status

5. **Add iOS App Endpoint:**
   - GET /api/user/[userId]/personnel
   - Returns Personnel record for logged-in User

## Next Steps

1. **Test Current Linkage:**
   - Access /api/debug/user-linkage
   - Check if Alexander Burns User and Personnel are linked

2. **Implement Option 1:**
   - Update /api/admin/users/create to auto-link
   - Update /api/personnel to auto-link correctly

3. **Create Manual Linking API:**
   - Allow admins to fix broken linkages

4. **Test iOS App Flow:**
   - Create User for Alexander Burns
   - Verify linkage to Personnel
   - Test API endpoint for iOS app

## Example Use Case: Alexander Burns

**Scenario:**
- Alexander Burns added as Staff via DFP-NEO App
- Personnel record created: idNumber = 8207938
- Admin creates User account: userId = 8207938

**Expected Linkage:**
```
User.id = "clm123..." (Prisma cuid)
User.userId = "8207938" (PMKEYS)
User.username = "8207938"
User.firstName = "Alexander"
User.lastName = "Burns"

Personnel.id = "clm456..." (Prisma cuid)
Personnel.idNumber = 8207938 (PMKEYS)
Personnel.name = "Burns, Alexander"
Personnel.userId = "clm123..." (links to User.id)
```

**iOS App Flow:**
1. User logs in with username "8207938" or email
2. App receives User.id = "clm123..."
3. App queries: GET /api/user/clm123.../personnel
4. Returns Personnel record with userId = "clm123..."
5. App displays schedule from Personnel record