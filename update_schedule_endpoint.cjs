const fs = require('fs');

// Read the file
let content = fs.readFileSync('server.js', 'utf8');

// Find the old schedule endpoint and replace it
const oldStart = '// GET /api/mobile/schedule - Get user\'s schedule';
const startIndex = content.indexOf(oldStart);
if (startIndex === -1) {
  console.log('❌ Could not find start of schedule endpoint');
  process.exit(1);
}

const nextClosing = content.indexOf('});', startIndex);
if (nextClosing === -1) {
  console.log('❌ Could not find end of schedule endpoint');
  process.exit(1);
}

const endIndex = content.indexOf('});', nextClosing + 3);
if (endIndex === -1) {
  console.log('❌ Could not find proper end of schedule endpoint');
  process.exit(1);
}

const newEndpoint = '// Helper function to format time from database to HH:mm format\nfunction formatTime(timeValue) {\n  if (!timeValue) return "00:00";\n  \n  // Handle both TIME type and string formats\n  if (typeof timeValue === "string") {\n    // Already in string format, just return if valid\n    return timeValue;\n  }\n  \n  // Handle Date object\n  if (timeValue instanceof Date) {\n    const hours = String(timeValue.getHours()).padStart(2, "0");\n    const minutes = String(timeValue.getMinutes()).padStart(2, "0");\n    return hours + ":" + minutes;\n  }\n  \n  return "00:00";\n}\n\n// GET /api/mobile/schedule - Get user\'s schedule (authenticated)\napp.get(\'/api/mobile/schedule\', authenticateMobileJWT, async (req, res) => {\n  try {\n    const db = await getPrisma();\n    const userId = req.userId;\n    const { date, startDate, endDate } = req.query;\n\n    console.log("📅 Fetching schedule for userId=" + userId + ", params: " + JSON.stringify(req.query));\n\n    // Support single date query (iOS format) and date range query\n    let query = `SELECT id, "userId", date, "isPublished", "serverTime", data FROM "Schedule" WHERE "userId" = $1`;\n    let params = [userId];\n\n    // Handle single date parameter (iOS app format)\n    if (date) {\n      query += ` AND date = $2`;\n      params.push(date);\n    } else {\n      // Handle date range parameters\n      if (startDate) {\n        query += ` AND date >= $${params.length + 1}`;\n        params.push(startDate);\n      }\n\n      if (endDate) {\n        query += ` AND date <= $${params.length + 1}`;\n        params.push(endDate);\n      }\n    }\n\n    query += ` ORDER BY date ASC`;\n\n    const schedules = await db.$queryRawUnsafe(query, ...params);\n\n    if (!schedules || schedules.length === 0) {\n      console.log("❌ No schedule found for userId=" + userId);\n      return res.json({\n        schedule: null,\n        message: date ? "Schedule not published for this date" : "No schedules found"\n      });\n    }\n\n    // Get events for all schedules\n    const scheduleIds = schedules.map(s => s.id);\n    const eventsQuery = `SELECT "scheduleId", id, "startTime", "endTime", "eventType", location, role, status, notes, aircraft, instructor FROM "ScheduleEvent" WHERE "scheduleId" = ANY($1) ORDER BY "scheduleId", "startTime" ASC`;\n    \n    const allEvents = await db.$queryRawUnsafe(eventsQuery, scheduleIds);\n\n    // Group events by scheduleId\n    const eventsBySchedule = {};\n    allEvents.forEach(event => {\n      if (!eventsBySchedule[event.scheduleId]) {\n        eventsBySchedule[event.scheduleId] = [];\n      }\n      eventsBySchedule[event.scheduleId].push({\n        id: String(event.id),\n        startTime: formatTime(event.startTime),\n        endTime: formatTime(event.endTime),\n        eventType: event.eventType || "Other",\n        location: event.location,\n        role: event.role,\n        status: event.status || "Tentative",\n        notes: event.notes,\n        aircraft: event.aircraft,\n        instructor: event.instructor\n      });\n    });\n\n    // Transform schedules to match iOS expected format\n    const transformedSchedules = schedules.map(schedule => {\n      const events = eventsBySchedule[schedule.id] || [];\n      \n      return {\n        id: String(schedule.id),\n        date: schedule.date,\n        isPublished: schedule.isPublished,\n        events: events,\n        serverTime: schedule.serverTime\n      };\n    });\n\n    // If single date was requested, return single schedule object (iOS format)\n    if (date && transformedSchedules.length > 0) {\n      console.log("✅ GET /api/mobile/schedule successful for userId=" + userId + " - Single date: " + date + ", events: " + transformedSchedules[0].events.length);\n      return res.json({\n        schedule: transformedSchedules[0]\n      });\n    }\n\n    console.log("✅ GET /api/mobile/schedule successful for userId=" + userId + " - Found " + transformedSchedules.length + " schedules");\n\n    // Return multiple schedules for date range query\n    res.json({\n      success: true,\n      schedules: transformedSchedules\n    });\n\n  } catch (error) {\n    console.error("❌ GET /api/mobile/schedule error:", error);\n    res.status(500).json({ \n      error: "Internal server error", \n      details: error.message \n    });\n  }\n});';

// Replace the old endpoint with new one
const newContent = content.substring(0, startIndex) + newEndpoint + content.substring(endIndex + 4);

// Write back
fs.writeFileSync('server.js', newContent, 'utf8');
console.log('✅ Schedule endpoint updated successfully');