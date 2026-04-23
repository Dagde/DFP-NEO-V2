# TraineePerformance - Deploy & Seed Instructions

## What Was Done (Already on GitHub)
- `server.js` - 6 new API routes + `ensureTraineePerformanceTable()` auto-runs on startup
- `App.tsx` - Every PT-051 save now also persists to TraineePerformance table
- `migration-scripts/seed_trainee_performance.js` - Seed script for 7,801 historical records

---

## Step 1: Deploy to Railway

Railway will auto-deploy when you merge or push to your production branch.

1. Go to your Railway project dashboard
2. The new code will deploy automatically (or trigger manually)
3. When the server starts, **the TraineePerformance table is created automatically** via `ensureTraineePerformanceTable()` - no manual SQL needed

**Verify the table was created:**
In Railway's database shell or any PostgreSQL client:
```sql
SELECT COUNT(*) FROM "TraineePerformance";
-- Should return 0 (empty, not yet seeded)
```

---

## Step 2: Seed Historical Data (7,801 Records)

### Option A: Railway CLI (Recommended)

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link` (select your project)
4. Generate the JSON data locally first:
   ```bash
   pip install openpyxl
   python3 migration-scripts/import_trainee_performance.py
   ```
   This creates `migration-scripts/trainee_performance_import.json` (35MB)

5. Run the seed script against Railway's database:
   ```bash
   railway run node migration-scripts/seed_trainee_performance.js
   ```
   This connects using Railway's `DATABASE_URL` automatically.

6. Expected output:
   ```
   ✅ Loaded .env file
   📊 Total records to seed: 7801
   ✅ TraineePerformance table ready
   Progress: 1000/7801 (13%) | inserted: 1000 | skipped: 0
   Progress: 2000/7801 (26%) | inserted: 2000 | skipped: 0
   ...
   ✅ SEED COMPLETE
     Records inserted this run: 7801
     Per-course breakdown:
       ADF301    : 1850 records
       ADF302    : 1850 records
       ADF303    : 1850 records
       ADF306    : 1998 records
       FIC210    : 44 records
       FIC211    : 209 records
   ```

### Option B: Direct psql (if you have the connection string)

1. Generate the SQL file:
   ```bash
   python3 migration-scripts/import_trainee_performance.py
   ```
2. Execute it:
   ```bash
   psql $DATABASE_URL -f migration-scripts/trainee_performance_data.sql
   ```

### Option C: Railway Database Shell

1. In Railway dashboard → Database → Connect → Shell
2. Run the migration SQL directly by pasting the contents of `add_trainee_performance_table.sql`
3. Then use Option A or B for the data

---

## Step 3: Verify the Import

Run these queries in Railway's database shell:

```sql
-- Check total count
SELECT COUNT(*) as total FROM "TraineePerformance";
-- Expected: 7801

-- Check per-course breakdown
SELECT course, COUNT(*) as records 
FROM "TraineePerformance" 
GROUP BY course 
ORDER BY course;
-- Expected:
-- ADF301 | 1850
-- ADF302 | 1850
-- ADF303 | 1850
-- ADF306 | 1998
-- FIC210 | 44
-- FIC211 | 209

-- Check a sample record
SELECT "traineeFullName", "flightNumber", "date", "overallGrade", "instructorName"
FROM "TraineePerformance"
LIMIT 5;
```

---

## Step 4: Verify API Routes Work

Once deployed, test these endpoints:

```bash
# Get all incomplete PT-051s for an instructor
curl https://your-railway-url/api/trainee-performance?instructorName=SQNLDR%20Mitchell%2C%20Ashley&isCompleted=false

# Get all assessments for a course
curl https://your-railway-url/api/trainee-performance?course=ADF301&limit=10

# Get stats
curl https://your-railway-url/api/trainee-performance/stats
```

---

## How the Live System Works Going Forward

### New PT-051 Saves
Every time an instructor saves a PT-051 in the app:
1. The existing in-memory state is updated (as before)
2. **NEW**: A POST fires to `/api/trainee-performance` which upserts to the database
3. If the API call fails, it's non-fatal - the in-memory state is still correct

### Historical Data
The 7,801 seeded records provide the full training history for all trainees across:
- ADF301, ADF302, ADF303, ADF306 (74 events each, 25-27 trainees)
- FIC210, FIC211 (11 events each, 4-19 trainees)

### Querying
The API supports filtering by:
- `traineeId` or `traineeFullName`
- `instructorName`
- `course`
- `isCompleted` (true/false)
- `dateFrom` / `dateTo`
- `limit` / `offset` for pagination

---

## Seed Script is Idempotent
The seed uses `ON CONFLICT (eventId) DO NOTHING` - safe to run multiple times without duplicating data.