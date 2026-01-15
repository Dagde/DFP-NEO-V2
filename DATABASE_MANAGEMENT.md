# Database Management Guide

## Viewing the Railway Database

### Option 1: Railway Dashboard (Recommended)

1. **Access Railway Dashboard**
   - Go to: https://railway.app
   - Login to your account
   - Select your **DFP-NEO** project

2. **Navigate to Database**
   - Click on the **PostgreSQL** service (database icon)
   - You'll see three main tabs:
     - **Query**: Run SQL queries directly
     - **Data**: Browse tables and data
     - **Schema**: View database structure

3. **Common SQL Queries**
   ```sql
   -- View all personnel
   SELECT id, name, rank, idNumber, userId, createdAt FROM "Personnel";
   
   -- Find duplicates by idNumber
   SELECT idNumber, COUNT(*) as count 
   FROM "Personnel" 
   WHERE idNumber IS NOT NULL 
   GROUP BY idNumber 
   HAVING COUNT(*) > 1;
   
   -- View specific person
   SELECT * FROM "Personnel" WHERE idNumber = 8201112;
   
   -- View all users
   SELECT id, userId, firstName, lastName, role FROM "User";
   ```

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Connect to project
cd dfp-neo-platform
railway link

# Open database console
railway db
```

### Option 3: Admin Dashboard (Recommended) ⭐

I've created a comprehensive admin dashboard accessible through the app!

**Access:**
1. Log in as an **ADMIN** user
2. Go to: `https://dfp-neo.com/admin/database`

**Features:**
- **Overview Tab:**
  - Database statistics (users, personnel, trainees, schedules, aircraft, scores)
  - Count of unlinked Personnel records
  - Recent users and Personnel records
  - Duplicate record alerts

- **SQL Query Tab:**
  - Execute READ-ONLY SQL queries directly
  - View query results in formatted JSON
  - Perfect for quick data lookups

- **Duplicates Tab:**
  - View all duplicate Personnel records
  - One-click cleanup button
  - Detailed cleanup report
  - Keeps properly linked records (with userId set)

**Security:**
- Only accessible to users with ADMIN or SUPER_ADMIN role
- All SQL queries are READ-ONLY (only SELECT allowed)
- All actions are logged for audit trail

---

## Personnel Deletion & Cleanup

### Problem Identified

The app had no DELETE endpoint for Personnel records. When you "deleted" staff from the UI, it only hid the record locally but didn't remove it from the database, resulting in duplicate records.

### Solution Implemented

#### 1. DELETE API Endpoint

**Endpoint:** `DELETE /api/personnel/[id]`

**Features:**
- Fully deletes Personnel records from the database
- Requires authentication
- Logs all deletions for audit trail
- Returns confirmation with deleted record details

**Example Usage:**
```javascript
const response = await fetch(`/api/personnel/${personnelId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
// { success: true, message: 'Personnel deleted successfully', deleted: {...} }
```

#### 2. PATCH API Endpoint

**Endpoint:** `PATCH /api/personnel/[id]`

**Features:**
- Updates Personnel records
- Requires authentication
- Logs all updates for audit trail

**Example Usage:**
```javascript
const response = await fetch(`/api/personnel/${personnelId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    rank: 'SQNLDR',
    unit: '1FTS'
  })
});
```

#### 3. Cleanup Duplicate Records Endpoint

**Endpoint:** `POST /api/debug/cleanup-duplicates`

**Features:**
- Automatically finds and removes duplicate Personnel records
- Prioritizes records with `userId` set (properly linked)
- Falls back to most recently created record
- Deletes obsolete duplicates
- Provides detailed cleanup report

**How It Works:**
1. Groups Personnel records by `idNumber`
2. Identifies duplicates (more than 1 record with same `idNumber`)
3. For each duplicate set:
   - Keeps the record with `userId` set (if any)
   - Otherwise keeps the most recently created record
   - Deletes all other duplicates
4. Returns detailed report of what was kept and deleted

**Example Usage:**
```javascript
const response = await fetch('/api/debug/cleanup-duplicates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
// {
//   success: true,
//   message: "Successfully cleaned up 4 duplicate Personnel records",
//   totalDuplicatesFound: 1,
//   totalDeleted: 4,
//   cleanupResults: [...]
// }
```

---

## Cleaning Up Alexander Burns' Duplicates

### Current State

Alexander Burns (PMKEYS: 8201112) has 5 duplicate records:
- 2 records with rank FLTLT (userId: null)
- 2 records with rank SQNLDR (userId: null)
- 1 record with rank SQNLDR (userId: "cmk3m3d8w0000kymjmsdlxsy9") ✅

### Cleanup Process

**Option 1: Automatic Cleanup (Recommended)**

1. Go to this URL in your browser (while logged in):
   ```
   https://dfp-neo.com/api/debug/cleanup-duplicates
   ```
2. Use the **POST** method (you'll need a tool like Postman or curl)
   ```bash
   curl -X POST https://dfp-neo.com/api/debug/cleanup-duplicates \
     -H "Content-Type: application/json" \
     -b "your-session-cookie"
   ```

**Option 2: Manual Cleanup via Railway**

1. Go to Railway Dashboard → PostgreSQL → Query
2. Run this SQL to see all duplicates:
   ```sql
   SELECT id, name, rank, userId, idNumber, createdAt 
   FROM "Personnel" 
   WHERE idNumber = 8201112 
   ORDER BY createdAt;
   ```
3. Delete the unwanted records:
   ```sql
   -- Delete the 4 old duplicates (keep the one with userId set)
   DELETE FROM "Personnel" 
   WHERE idNumber = 8201112 
   AND userId IS NULL;
   ```
4. Verify cleanup:
   ```sql
   SELECT * FROM "Personnel" WHERE idNumber = 8201112;
   ```

---

## Best Practices

### When Deleting Personnel

1. **Use the DELETE API endpoint** - This ensures complete removal
2. **Check for duplicates** - Before deleting, verify no duplicates exist
3. **Audit trail** - All deletions are logged in the console
4. **Backup important data** - Consider exporting data before bulk deletions

### Preventing Duplicates

1. **Always check for existing records** before creating new ones
2. **Use the proper linkage** - Set `userId` when creating Personnel records
3. **Regular cleanup** - Run the cleanup endpoint periodically
4. **Unique constraints** - The database should have unique constraints on `idNumber`

### Monitoring Duplicate Records

**SQL Query to Find All Duplicates:**
```sql
SELECT idNumber, COUNT(*) as count, 
       STRING_AGG(name, ', ') as names
FROM "Personnel" 
WHERE idNumber IS NOT NULL 
GROUP BY idNumber 
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

This will show all Personnel records that have duplicates.

---

## API Endpoints Summary

### Personnel Management
| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/api/personnel/[id]` | GET | Get specific personnel record | Authenticated |
| `/api/personnel/[id]` | DELETE | Delete personnel record | Authenticated |
| `/api/personnel/[id]` | PATCH | Update personnel record | Authenticated |

### Admin & Debug
| Endpoint | Method | Description | Access |
|----------|--------|-------------|--------|
| `/api/admin/database` | GET | Get database stats and execute queries | ADMIN only |
| `/api/debug/cleanup-duplicates` | POST | Clean up duplicate Personnel records | Authenticated |
| `/api/debug/database-connection` | GET | Check database connection and data | Authenticated |
| `/api/debug/user-personnel-linkage` | GET | Check User-Personnel linkage | Authenticated |

### Admin Dashboard
| Endpoint | Description | Access |
|----------|-------------|--------|
| `/admin/database` | Full database admin interface | ADMIN only |

---

## Security Notes

- All API endpoints require authentication
- Delete operations are logged for audit trails
- Consider adding admin role requirements for cleanup operations
- Never expose database credentials in client-side code
- Use Railway's environment variables for sensitive data