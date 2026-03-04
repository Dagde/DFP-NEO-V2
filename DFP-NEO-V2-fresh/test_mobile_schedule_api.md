# How to Verify Mobile Schedule API Change is Active

## Method 1: Test API Endpoint Directly (Recommended)

### Step 1: Get a Valid Access Token
1. Login to the mobile app or use the login endpoint:
```bash
curl -X POST https://your-app-url.com/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "password": "YOUR_PASSWORD"
  }'
```
2. Copy the `accessToken` from the response

### Step 2: Test the Schedule Endpoint
```bash
curl -X GET "https://your-app-url.com/api/mobile/schedule?date=2026-01-18" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 3: Check Server Logs (Railway Dashboard)
- Go to Railway dashboard
- Navigate to your app
- Click on "Logs" tab
- Look for the API request
- **Expected behavior**: No errors, query uses `findUnique`

### Step 4: Add Debug Logging (Optional)
Add this log before the query in `/workspace/dfp-neo-platform/app/api/mobile/schedule/route.ts`:
```typescript
console.log('🔍 [MOBILE SCHEDULE] Querying with findUnique:', {
  userId: user!.id,
  date: dateParam,
  version: "flight-school"
});
```

---

## Method 2: Check Railway Deployment Status

### Step 1: Go to Railway Dashboard
1. Visit https://railway.app
2. Navigate to your DFP-NEO project
3. Check the deployment status

### Step 2: Verify Latest Deployment
- Look for commit hash: `9367333`
- Message: "fix: Update mobile schedule API query to use findUnique with version filtering"
- Status should be: "Deployed" or "Active"

### Step 3: Check Build Logs
- Click on the deployment
- Review build logs for any errors
- Verify the route file was built successfully

---

## Method 3: Add API Response Version Tracking

### Step 1: Add Version Field to Response
Modify `/workspace/dfp-neo-platform/app/api/mobile/schedule/route.ts`:
```typescript
return NextResponse.json({
  schedule: {
    id: schedule.id,
    date: dateParam,
    isPublished: true,
    serverTime: new Date().toISOString(),
    events,
  },
  apiVersion: "v2-findUnique",  // Add this line
  message: null,
});
```

### Step 2: Test the Endpoint
```bash
curl -X GET "https://your-app-url.com/api/mobile/schedule?date=2026-01-18" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Step 3: Check Response
If response contains `"apiVersion": "v2-findUnique"`, the new code is active.

---

## Method 4: Database Query Analysis (Advanced)

### Step 1: Enable Query Logging
In Railway environment variables, add:
```
DATABASE_URL="postgresql://user:pass@host:5432/db?statement_cache_size=0&log_queries=true"
```

### Step 2: Check Logs for Query
After making an API request, check Railway logs for the SQL query:

**Old Query (findFirst):**
```sql
SELECT ... FROM "Schedule" WHERE "userId" = ? AND "date" = ? LIMIT 1;
```

**New Query (findUnique):**
```sql
SELECT ... FROM "Schedule" WHERE "userId" = ? AND "date" = ? AND "version" = ? LIMIT 1;
```

### Step 3: Verify Version Filter
Look for `AND "version" = 'flight-school'` in the query

---

## Method 5: Browser DevTools (Web App)

### Step 1: Open Browser DevTools
- Press F12 or Right-click → Inspect
- Go to Network tab

### Step 2: Make API Request
- Use the web app to trigger the mobile schedule endpoint
- Or use Postman/curl to call the endpoint

### Step 3: Check Response
- Look for the schedule API request
- Check the response time (findUnique should be faster)
- Verify the response structure

---

## Method 6: Add Timestamp Verification

### Step 1: Add Deployment Timestamp
Create a file `/workspace/dfp-neo-platform/app/api/version/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: "2.0.0",
    deploymentDate: new Date().toISOString(),
    scheduleQuery: "findUnique",
  });
}
```

### Step 2: Test Version Endpoint
```bash
curl https://your-app-url.com/api/version
```

### Step 3: Verify Response
```json
{
  "version": "2.0.0",
  "deploymentDate": "2025-01-17T14:45:00.000Z",
  "scheduleQuery": "findUnique"
}
```

---

## Quick Verification Checklist

- [ ] Commit `9367333` is pushed to GitHub
- [ ] Railway deployment shows "Deployed" status
- [ ] Railway deployment log shows commit `9367333`
- [ ] API endpoint responds without errors
- [ ] Server logs show the API request
- [ ] Response contains expected data
- [ ] (Optional) Debug logs show version filtering

---

## Current Status

✅ **Source Code**: Updated with `findUnique` and version filtering  
✅ **Commit**: `9367333` - "fix: Update mobile schedule API query to use findUnique with version filtering"  
✅ **Pushed**: To `feature/comprehensive-build-algorithm` branch  
⏳ **Deployment**: Railway is deploying the changes  

**Next Step**: Wait for Railway deployment to complete, then test using Method 1 or 2 above.

---

## Common Issues

### Issue 1: Railway Still Shows Old Deployment
**Solution**: Check if Railway auto-deploy is enabled. If not, manually redeploy.

### Issue 2: API Returns 500 Error
**Solution**: Check Railway logs for error messages. May need to add debug logging.

### Issue 3: Query Still Uses Old Code
**Solution**: Clear Railway cache or force redeploy by pushing a dummy commit.

### Issue 4: Can't Access Production Database
**Solution**: Use API response verification (Method 3) instead of query logging.