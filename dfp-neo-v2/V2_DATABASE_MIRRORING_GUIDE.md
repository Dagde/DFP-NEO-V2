# V2 Database Mirroring Guide

## Overview

This guide explains how to mirror the original DFP-NEO database to the V2 app database, creating an independent copy that V2 can use for development and testing.

## Architecture

```
Original App Database (PostgreSQL)
    ↓
[Copy Operation]
    ↓
V2 App Database (PostgreSQL) - Independent, writable
```

## Prerequisites

1. **Original Database URL** - You need the DATABASE_URL from the original app
2. **V2 Database URL** - Already configured in Railway
3. **ts-node installed** - For running TypeScript seed scripts

## Step-by-Step Instructions

### Step 1: Get Original Database URL

1. Go to Railway dashboard
2. Navigate to your **original** DFP-NEO project
3. Click on the PostgreSQL service
4. Copy the `DATABASE_URL` (it looks like: `postgresql://user:password@host:port/database`)

### Step 2: Set Up Environment Variables

Create or update the `.env` file in `/workspace/dfp-neo-v2/`:

```bash
# V2 Database (automatic from Railway)
DATABASE_URL="postgresql://postgres:azuWoBZbZMZwaambfUOKxTEoOFPmEOQe@postgres.railway.internal:5432/railway"

# Original Database (add this line)
ORIGINAL_DATABASE_URL="postgresql://user:password@original-host:port/database"
```

**IMPORTANT:** Replace the ORIGINAL_DATABASE_URL with the actual URL from Step 1.

### Step 3: Run Database Migrations

Before mirroring data, ensure V2 database has the correct schema:

```bash
cd /workspace/dfp-neo-v2
npm run db:push
```

This creates all the tables in V2 database.

### Step 4: Run the Mirror Script

Execute the seed script to copy all data:

```bash
cd /workspace/dfp-neo-v2
npm run db:mirror
```

### Step 5: Verify the Copy

Check that the data was copied successfully:

```bash
cd /workspace/dfp-neo-v2
npx prisma studio
```

This opens Prisma Studio where you can browse the V2 database and verify the data.

## What Gets Copied

The mirror script copies ALL tables from the original database:

1. **Users** - All user accounts
2. **Personnel** - 90+ staff members
3. **Trainees** - All trainee records
4. **Aircraft** - Fleet information
5. **Schedules** - Daily schedules
6. **FlightSchedules** - Historical flight data
7. **Scores** - Trainee performance scores
8. **Courses** - Course information
9. **Sessions** - User sessions
10. **UserSettings** - User preferences
11. **CancellationHistory** - Cancellation records
12. **AuditLogs** - Last 1000 audit log entries

## Re-Running the Mirror

You can re-run the mirror script at any time to re-sync the databases:

```bash
npm run db:mirror
```

The script uses `upsert` operations, so:
- Existing records will be **updated** if they changed
- New records will be **inserted**
- No records will be **deleted** (unless you manually reset the database)

## Resetting V2 Database

If you want to completely reset V2 database and start fresh:

```bash
cd /workspace/dfp-neo-v2
npm run db:reset
```

This deletes ALL data in V2 database, then re-runs migrations.

**WARNING:** This will delete all V2-specific changes!

## Differences Between Databases After Mirroring

After the initial mirror, the two databases will be **identical**. However, going forward:

- **Original Database**: Continues to be used by the original app
- **V2 Database**: Independent and separate
- **No connection**: Changes in one database do NOT affect the other
- **No sync**: The mirror is a one-time operation unless you re-run it

## Common Issues and Solutions

### Issue: "Database connection failed"

**Solution:** Check that ORIGINAL_DATABASE_URL is correct and accessible

### Issue: "Table doesn't exist"

**Solution:** Run `npm run db:push` to create the schema first

### Issue: "Permission denied"

**Solution:** Ensure the database user has read permissions on original database

### Issue: "ts-node not found"

**Solution:** Run `npm install --save-dev ts-node typescript`

## Script Details

The mirror script (`prisma/seed-mirror-database.ts`):

- **Copies in dependency order** - Ensures foreign key relationships are maintained
- **Uses upsert** - Can be run multiple times without duplicates
- **Handles large datasets** - Processes each table individually
- **Provides progress feedback** - Shows what's being copied and counts
- **Limit audit logs** - Only copies last 1000 to avoid overwhelming data

## Next Steps After Mirroring

Once the database is mirrored, V2 will have:

1. ✅ All staff members available
2. ✅ All trainees with their data
3. ✅ Aircraft fleet information
4. ✅ Historical schedules
5. ✅ All course information

V2 can now be used for:
- **Development** - Test new features without affecting production
- **Testing** - Try out changes safely
- **Demonstration** - Show WIP features to stakeholders

## Support

If you encounter any issues:

1. Check the console output for error messages
2. Verify both DATABASE_URLs are correct
3. Ensure both databases are accessible
4. Run `npm run db:push` to ensure schema is up to date