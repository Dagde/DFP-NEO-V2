# V2 Database Setup Quick Start

## What I've Set Up For You

✅ Created mirror script: `prisma/seed-mirror-database.ts`  
✅ Added npm script: `npm run db:mirror`  
✅ Installed dependencies: ts-node, typescript  
✅ Created .env template with both database URLs  
✅ Created detailed guide: `V2_DATABASE_MIRRORING_GUIDE.md`

## What You Need To Do (3 Simple Steps)

### Step 1: Get Original Database URL
1. Go to Railway dashboard
2. Navigate to your **original** DFP-NEO project
3. Click on PostgreSQL service
4. Copy the `DATABASE_URL`

### Step 2: Update .env File
Open `/workspace/dfp-neo-v2/.env` and replace:

```bash
ORIGINAL_DATABASE_URL="postgresql://username:password@original-host:5432/database-name"
```

With the actual URL from Step 1.

### Step 3: Run the Mirror
```bash
cd /workspace/dfp-neo-v2
npm run db:push        # First, create schema
npm run db:mirror      # Then, copy all data
```

That's it! V2 will now have its own independent database with all the original data.

## Verify It Worked

Open Prisma Studio to check the data:
```bash
cd /workspace/dfp-neo-v2
npx prisma studio
```

You should see all the tables populated with data from the original app.

## What Gets Copied

- ✅ All 90+ staff members
- ✅ All trainees
- ✅ Aircraft fleet
- ✅ Schedules
- ✅ All other data

## Important Notes

1. **V2 has its OWN database** - Not connected to original, just a copy
2. **Changes in V2 won't affect original** - They're completely independent
3. **You can re-run the mirror** - Use `npm run db:mirror` anytime to re-sync
4. **No automatic syncing** - Mirror only runs when you execute the command

## Need Help?

Read the full guide: `V2_DATABASE_MIRRORING_GUIDE.md`

Or check the mirror script: `prisma/seed-mirror-database.ts`