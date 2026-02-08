# How to Mirror Database from Original to V2

## Overview
The database mirroring API endpoint is now deployed to Railway. This endpoint will copy all data from the original DFP-NEO database to the new V2 database, giving V2 its own independent copy of the production data.

## Step-by-Step Instructions

### 1. Wait for Railway Deployment
- Railway is now deploying your changes
- Wait 2-3 minutes for the deployment to complete
- Check Railway dashboard to ensure deployment is successful
- The URL will be something like: `https://dfp-neo-v2.up.railway.app`

### 2. Get Your Railway V2 URL
- Go to your Railway V2 project dashboard
- Copy the deployment URL from the top of the page
- It should look like: `https://dfp-neo-v2-xxxx.up.railway.app`

### 3. Trigger the Database Mirroring

#### Option A: Using curl (Recommended for Testing)
```bash
curl -X POST https://YOUR_RAILWAY_URL/api/admin/database/mirror
```

Example:
```bash
curl -X POST https://dfp-neo-v2-production.up.railway.app/api/admin/database/mirror
```

#### Option B: Using Postman/Thunder Client
1. Create a new POST request
2. URL: `https://YOUR_RAILWAY_URL/api/admin/database/mirror`
3. Send request
4. View the response with summary

#### Option C: Using Browser (GET Request for Testing)
You can also test via browser (though POST is preferred):
```
https://YOUR_RAILWAY_URL/api/admin/database/mirror
```

### 4. Expected Response

Success response will look like:
```json
{
  "success": true,
  "message": "Database mirroring completed successfully",
  "summary": {
    "users": 45,
    "personnel": 32,
    "trainees": 28,
    "aircraft": 6,
    "schedules": 15,
    "flightSchedules": 12,
    "scores": 156,
    "courses": 3,
    "sessions": 45,
    "userSettings": 45,
    "cancellations": 8,
    "auditLogs": 500
  }
}
```

### 5. Verify the Data

Check Railway V2 database to confirm data was copied:

```bash
# Connect to V2 database using Railway CLI or any PostgreSQL client
# Check counts for each table
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Personnel";
SELECT COUNT(*) FROM "Trainee";
SELECT COUNT(*) FROM "Aircraft";
```

### 6. Next Steps

Once the database is mirrored:

1. **V2 is now independent**: V2 has its own copy of the data
2. **Original app continues**: Original database remains unchanged
3. **Test V2 thoroughly**: Log in and test all features
4. **Gradual migration**: Start moving users to V2 one at a time

## Troubleshooting

### Error: Can't reach database server
- Make sure both databases are running on Railway
- Check that `ORIGINAL_DATABASE_URL` is set correctly in V2 Railway environment variables
- The original database URL should be set in Railway dashboard, not in .env file

### Error: Connection timeout
- The mirroring may take 30-60 seconds depending on data size
- Increase timeout in your HTTP client

### No data copied
- Check Railway logs for detailed error messages
- Verify the original database has data
- Ensure Prisma schema matches between both databases

## Important Notes

⚠️ **Security**: This endpoint has no authentication yet. Only use for testing.

⚠️ **One-time operation**: You only need to run this once. The V2 database will have its own independent copy.

⚠️ **Data Independence**: After mirroring, V2 and original databases are completely independent. Changes to one won't affect the other.

## Support

If you encounter any issues:
1. Check Railway deployment logs
2. Check browser console for errors
3. Verify database URLs in Railway environment variables
4. Review the mirroring endpoint logs

## What Gets Mirrored?

The following tables are copied from original to V2:
- ✅ Users (accounts and authentication)
- ✅ Personnel (instructor/staff data)
- ✅ Trainees (student data)
- ✅ Aircraft (aircraft inventory)
- ✅ Schedules (flight schedules)
- ✅ FlightSchedules (detailed schedule data)
- ✅ Scores (training scores)
- ✅ Courses (course information)
- ✅ Sessions (authentication sessions)
- ✅ UserSettings (user preferences)
- ✅ CancellationHistory (cancellation records)
- ✅ AuditLogs (last 1000 entries)

## After Mirroring

Your V2 application now has:
- Complete copy of production data
- Independent database for testing
- Safe environment to test new features
- Ready for gradual user migration