# V2 App Database Setup Guide

## Problem
The V2 app's PostgreSQL database is empty (no tables), which is why:
- No 1FTS staff appear in the staff profile
- No database staff are used in NEO Build
- The app is only using mockdata

## Solution: Run Database Migrations

### Step 1: Get the Database URL from Railway

1. Go to Railway dashboard for the V2 app
2. Click on the **Postgres** service
3. Go to **Variables** tab
4. Copy the `DATABASE_URL` value (it should look like: `postgresql://postgres:password@host:5432/railway`)

### Step 2: Update Local Environment

In the V2 app directory, create/update `.env` file:

```bash
cd /workspace/dfp-neo-v2
echo "DATABASE_URL=<paste_the_railway_database_url_here>" > .env
```

### Step 3: Run Prisma Migrations

This will create all the tables in the V2 database:

```bash
cd /workspace/dfp-neo-v2
npx prisma migrate deploy
```

This command will:
- Connect to the V2 app's PostgreSQL database on Railway
- Create all tables (Personnel, User, Schedule, Aircraft, etc.)
- Set up the database schema

### Step 4: Verify Tables Were Created

Go back to Railway dashboard:
1. Click on Postgres service
2. Go to Database → Data tab
3. You should now see all the tables (Personnel, User, Schedule, etc.)

### Step 5: Add Data (Choose One Option)

**Option A: Manual Data Entry**
- Use the V2 app's admin interface to add staff manually
- This is good for testing but time-consuming for production

**Option B: Copy Data from Original Database** (Recommended)
- Export data from the original app's database
- Import into V2 app's database
- This preserves all existing staff, schedules, etc.

**Option C: Use Seed Script**
- The V2 app has a seed script at `prisma/seed.ts.disabled`
- Rename it to `seed.ts` and run: `npx prisma db seed`
- This will populate with sample data

## After Setup

Once the database has tables and data:
1. The V2 app will fetch staff from the database
2. The location filtering will work correctly
3. 1FTS staff will appear in ESL staff profile
4. NEO Build will use database staff

## Important Notes

- The V2 app and original app can share the same database OR have separate databases
- If using separate databases, you'll need to keep them in sync
- The location filtering code is already in place and working - it just needs database data to filter!

## Troubleshooting

If migrations fail:
1. Check that DATABASE_URL is correct
2. Ensure the PostgreSQL service is running on Railway
3. Check Railway logs for any errors
4. Verify network connectivity to the database