# 🚨 Immediate Action Required: Schedule API Fix Deployment

## Problem
iOS app users can login successfully but get HTTP 404 error when loading schedule data.

## Solution
The schedule API endpoint needs to be updated to support iOS date parameter format.

## Files to Update in Railway
You need to update **ONE file** in your Railway deployment:

### File: `server.js`

**Find these lines (around line 7110):**
```javascript
app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    const userId = req.userId;
    const { date, startDate, endDate } = req.query;
```

**Replace the ENTIRE endpoint with this enhanced version:**

```javascript
// Helper function to format time values
function formatTime(timeValue) {
  if (!timeValue) return "00:00";
  
  // Handle both TIME type and string formats
  if (typeof timeValue === "string") {
    // Already in string format, just return if valid
    return timeValue;
  }
  
  // Handle Date object
  if (timeValue instanceof Date) {
    const hours = String(timeValue.getHours()).padStart(2, "0");
    const minutes = String(timeValue.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }
  
  return "00:00";
}

// GET /api/mobile/schedule - Get user's schedule (authenticated)
app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
  try {
    const db = await getPrisma();
    const userId = req.userId;
    const { date, startDate, endDate } = req.query;

    console.log("📅 Fetching schedule for userId=" + userId + ", params: " + JSON.stringify(req.query));

    // Support single date query (iOS format) and date range query
    let query = `SELECT id, "userId", date, "isPublished", "serverTime", data FROM "Schedule" WHERE "userId" = $1`;
    let params = [userId];

    // Handle single date parameter (iOS app format)
    if (date) {
      query += ` AND date = $2`;
      params.push(date);
    } else {
      // Handle date range parameters
      if (startDate) {
        query += ` AND date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND date <= $${params.length + 1}`;
        params.push(endDate);
      }
    }

    query += ` ORDER BY date ASC`;

    const schedules = await db.$queryRawUnsafe(query, ...params);

    if (!schedules || schedules.length === 0) {
      console.log("❌ No schedule found for userId=" + userId);
      return res.json({
        schedule: null,
        message: date ? "Schedule not published for this date" : "No schedules found"
      });
    }

    // Get events for all schedules
    const scheduleIds = schedules.map(s => s.id);
    const eventsQuery = `SELECT "scheduleId", id, "startTime", "endTime", "eventType", location, role, status, notes, aircraft, instructor FROM "ScheduleEvent" WHERE "scheduleId" = ANY($1) ORDER BY "scheduleId", "startTime" ASC`;
    
    const allEvents = await db.$queryRawUnsafe(eventsQuery, scheduleIds);

    // Group events by scheduleId
    const eventsBySchedule = {};
    allEvents.forEach(event => {
      if (!eventsBySchedule[event.scheduleId]) {
        eventsBySchedule[event.scheduleId] = [];
      }
      eventsBySchedule[event.scheduleId].push({
        id: String(event.id),
        startTime: formatTime(event.startTime),
        endTime: formatTime(event.endTime),
        eventType: event.eventType || "Other",
        location: event.location,
        role: event.role,
        status: event.status || "Tentative",
        notes: event.notes,
        aircraft: event.aircraft,
        instructor: event.instructor
      });
    });

    // Transform schedules to match iOS expected format
    const transformedSchedules = schedules.map(schedule => {
      const events = eventsBySchedule[schedule.id] || [];
      
      return {
        id: String(schedule.id),
        date: schedule.date,
        isPublished: schedule.isPublished,
        events: events,
        serverTime: schedule.serverTime
      };
    });

    // If single date was requested, return single schedule object (iOS format)
    if (date && transformedSchedules.length > 0) {
      console.log("✅ GET /api/mobile/schedule successful for userId=" + userId + " - Single date: " + date + ", events: " + transformedSchedules[0].events.length);
      return res.json({
        schedule: transformedSchedules[0]
      });
    }

    console.log("✅ GET /api/mobile/schedule successful for userId=" + userId + " - Found " + transformedSchedules.length + " schedules");

    // Return multiple schedules for date range query
    res.json({
      success: true,
      schedules: transformedSchedules
    });

  } catch (error) {
    console.error("❌ GET /api/mobile/schedule error:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error.message 
    });
  }
});
```

## Railway Deployment Steps

### Option 1: Manual Update via Railway Dashboard
1. Go to your Railway project
2. Open the service that runs DFP-NEO-V2
3. Click on the "Files" tab
4. Find `server.js` file
5. Edit it and replace the schedule endpoint with the code above
6. Railway will automatically redeploy

### Option 2: Push with Different GitHub Token
The current GitHub token lacks `workflow` scope. You need a token with:
- `repo` scope (full control)
- `workflow` scope (to update GitHub actions)

## Testing After Deployment
1. Open iOS app
2. Login with: alexander.burns / Burns8201112
3. Navigate to Schedule page
4. Should see schedule events without 404 error
5. Try navigating to previous/next days

## Expected API Response
```bash
# Test endpoint after deployment
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-railway-url.railway.app/api/mobile/schedule?date=2026-04-27"

# Should return:
{
  "schedule": {
    "id": "123",
    "date": "2026-04-27", 
    "isPublished": true,
    "events": [...],
    "serverTime": "..."
  }
}
```

## Summary
- **Files to change**: 1 (server.js)
- **Lines to change**: ~110 lines (schedule endpoint)
- **Impact**: Fixes iOS app schedule loading after login
- **Risk**: Low (only affects mobile API)
- **Deployment time**: ~2-3 minutes