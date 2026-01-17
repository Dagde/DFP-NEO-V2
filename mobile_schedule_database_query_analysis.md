# Mobile Schedule API Database Query Analysis

## GET /api/mobile/schedule

### Request Details
**Endpoint**: `GET /api/mobile/schedule?date=YYYY-MM-DD`

**Authentication**: Bearer token in Authorization header
- Extracts user from JWT token's `userId` field (internal User ID)

---

## Database Query Analysis

### Query Location
**File**: `/workspace/dfp-neo-platform/app/api/mobile/schedule/route.ts` (lines 24-28)

### Exact Prisma Query Used
```typescript
const schedule = await prisma.schedule.findFirst({
  where: {
    userId: user!.id,
    date: dateParam,
  },
});
```

---

## Query Details

### 1. **Table/Model Queried**
- **Model**: `Schedule`
- **Table**: `Schedule` (PostgreSQL)

### 2. **User Matching**
- **Field**: `userId` (in Schedule table)
- **Matches**: `user.id` from authenticated user object
- **Source**: JWT token payload contains `userId` (internal User ID in CUID format)
- **Flow**:
  1. JWT token decoded → `payload.userId` (internal User.id)
  2. `getUserFromToken(token)` → fetches User from database
  3. Returns `user` object with `user.id` (CUID)
  4. Query uses `userId: user!.id` to match Schedule records

### 3. **Version Filtering**
- **Status**: ❌ **NO version filtering**
- **Default Version**: `"flight-school"` (but not used in query)
- **Implication**: Query returns first match regardless of version
- **Risk**: If multiple versions exist for same user+date, returns arbitrary one

### 4. **Date Matching**
- **Field**: `date` (String type in database)
- **Match Type**: **Exact string match**
- **Format**: `YYYY-MM-DD` (e.g., "2026-01-18")
- **Timezone**: ❌ **No timezone consideration**
- **Range**: ❌ No start/end of day logic (exact match only)
- **Comparison**: `Schedule.date === dateParam` (string equality)

---

## Example Query for 2026-01-18

### Prisma Query (TypeScript)
```typescript
const schedule = await prisma.schedule.findFirst({
  where: {
    userId: "clxmabc123def456ghi789jkl",  // From JWT token
    date: "2026-01-18",                  // Exact string match
  },
});
```

### Generated SQL (PostgreSQL)
```sql
SELECT 
  "Schedule"."id",
  "Schedule"."userId",
  "Schedule"."date",
  "Schedule"."data",
  "Schedule"."version",
  "Schedule"."createdAt",
  "Schedule"."updatedAt"
FROM "Schedule"
WHERE 
  "Schedule"."userId" = 'clxmabc123def456ghi789jkl'
  AND "Schedule"."date" = '2026-01-18'
LIMIT 1;
```

---

## Database Schema

### Schedule Model
```prisma
model Schedule {
  id        String   @id @default(cuid())
  userId    String
  date      String
  data      Json
  version   String   @default("flight-school")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date, version])
  @@index([userId])
  @@index([date])
}
```

### Key Constraints
- **Unique Constraint**: `@@unique([userId, date, version])`
  - Means: One schedule per user per date per version
  - Query doesn't enforce version, so first match wins
  
- **Indexes**:
  - `@@index([userId])` - Optimizes user lookups
  - `@@index([date])` - Optimizes date lookups

---

## Authentication Flow

### Step 1: Extract JWT from Request
```typescript
const authHeader = request.headers.get('authorization');
const token = authHeader.substring(7); // Remove 'Bearer ' prefix
```

### Step 2: Decode JWT Token
```typescript
// JWT Payload
{
  "userId": "clxmabc123def456ghi789jkl",  // Internal User.id
  "type": "access",
  "iat": 1734241200,
  "exp": 1734244800
}
```

### Step 3: Fetch User from Database
```typescript
const user = await getUserFromToken(token);
// Returns User object with user.id = "clxmabc123def456ghi789jkl"
```

### Step 4: Execute Query
```typescript
const schedule = await prisma.schedule.findFirst({
  where: {
    userId: user.id,      // Uses internal User.id
    date: "2026-01-18",   // Exact string match
  },
});
```

---

## Critical Issues and Limitations

### 1. ❌ No Version Filtering
**Problem**: Query doesn't specify `version` field in WHERE clause

**Code**:
```typescript
where: {
  userId: user!.id,
  date: dateParam,
  // Missing: version: "flight-school"
}
```

**Impact**:
- If multiple versions exist for same user+date, returns arbitrary one
- Could return wrong version if data migration occurred
- Violates the unique constraint intent

**Fix**:
```typescript
where: {
  userId: user!.id,
  date: dateParam,
  version: "flight-school",  // Add this
}
```

### 2. ❌ No Timezone Handling
**Problem**: Date is stored as string `YYYY-MM-DD` with no timezone context

**Impact**:
- Client and server may interpret date differently
- Users in different timezones see same date string
- Potential off-by-one-day errors

**Recommendation**:
- Store dates as `DateTime` with timezone
- Or explicitly document timezone assumptions
- Consider client timezone in API

### 3. ❌ Uses findFirst Instead of findUnique
**Problem**: `findFirst` returns first match, not guaranteed unique

**Impact**:
- If multiple records exist (shouldn't happen), returns arbitrary one
- Less efficient than `findUnique` (doesn't leverage unique constraint)

**Better Approach**:
```typescript
const schedule = await prisma.schedule.findUnique({
  where: {
    userId_date_version: {
      userId: user!.id,
      date: dateParam,
      version: "flight-school",
    },
  },
});
```

---

## Query Parameters

### Required Parameters
- `date` (string, format: `YYYY-MM-DD`)

### Example Requests
```
GET /api/mobile/schedule?date=2026-01-18
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Date Format Validation
```typescript
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRegex.test(dateParam)) {
  return NextResponse.json({
    error: 'Bad Request',
    message: 'Invalid date format. Use YYYY-MM-DD'
  }, { status: 400 });
}
```

---

## Response Structure

### Success (Schedule Found)
```json
{
  "schedule": {
    "id": "clpmabc123def456ghi789jkl",
    "date": "2026-01-18",
    "isPublished": true,
    "serverTime": "2026-01-18T10:30:00.000Z",
    "events": [
      {
        "id": "evt-001",
        "startTime": "08:00",
        "endTime": "10:00",
        "eventType": "Flight",
        "location": "Hangar 1",
        "role": "Instructor",
        "status": "Published",
        "aircraft": "PC-21",
        "instructor": "John Doe",
        "notes": "Standard flight"
      }
    ]
  },
  "message": null
}
```

### Success (No Schedule Found)
```json
{
  "schedule": null,
  "message": "No schedule found for 2026-01-18"
}
```

### Success (Schedule Not Published)
```json
{
  "schedule": null,
  "message": "Schedule for 2026-01-18 has not been published yet"
}
```

---

## Performance Considerations

### Query Execution Plan
```sql
-- Uses indexes efficiently
-- 1. Filter by userId (index on userId)
-- 2. Filter by date (index on date)
-- 3. Return first match (LIMIT 1)
```

### Index Utilization
- `@@index([userId])` - Used for user filtering
- `@@index([date])` - Used for date filtering
- Composite index on `(userId, date, version)` would be more efficient

### Recommended Optimization
```prisma
model Schedule {
  // ... other fields
  @@unique([userId, date, version])
  @@index([userId, date])  // Add composite index
}
```

---

## Summary

| Aspect | Details |
|--------|---------|
| **Table/Model** | `Schedule` |
| **User Matching** | `Schedule.userId` = `user.id` (from JWT) |
| **Version Filtering** | ❌ None (should add `version: "flight-school"`) |
| **Date Matching** | Exact string match (`Schedule.date === "YYYY-MM-DD"`) |
| **Timezone** | ❌ None (date is plain string) |
| **Query Method** | `findFirst()` (should use `findUnique()`) |
| **SQL Generated** | `SELECT ... WHERE userId = ? AND date = ? LIMIT 1` |

---

## Recommended Fixes

### Fix 1: Add Version Filtering
```typescript
const schedule = await prisma.schedule.findFirst({
  where: {
    userId: user!.id,
    date: dateParam,
    version: "flight-school",  // Add this
  },
});
```

### Fix 2: Use findUnique with Composite Key
```typescript
const schedule = await prisma.schedule.findUnique({
  where: {
    userId_date_version: {
      userId: user!.id,
      date: dateParam,
      version: "flight-school",
    },
  },
});
```

### Fix 3: Add Timezone Support (Optional)
- Store dates as `DateTime` type
- Accept timezone parameter
- Convert to server timezone before query