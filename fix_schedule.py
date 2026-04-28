#!/usr/bin/env python3
import re

# Read the file
with open('/workspace/dfp-neo-deployment/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The old broken code (without emojis for matching)
old_pattern = r"""    app\.get\('/api/mobile/schedule', authenticateMobileJWT, async \(req, res\) => \{
      try \{
        const db = await getPrisma\(\);
        const userId = req\.mobileUserId;
        const \{ date \} = req\.query;

        if \(!date\) \{
          return res\.status\(400\)\.json\(\{ 
            error: 'Date parameter is required \(format: YYYY-MM-DD\)' 
          \}\);
        \}

        // Find schedule for this user and date
        const schedules = await db\.schedule\.findMany\(\{
          where: \{
            userId: userId,
            date: date
          \},
          orderBy: \{
            updatedAt: 'desc'
          \}
        \}\);

        if \(!schedules \|\| schedules\.length === 0\) \{
          console\.log\(`.*?No schedule found for userId=\$\{userId\}, date=\$\{date\}`\);
          return res\.json\(\{
            events: \[\],
            message: `No schedule found for this date\.` 
          \}\);
        \}

        // Get the most recent schedule for this date
        const schedule = schedules\[0\];

        // Extract events from schedule data
        const events = \(schedule\.data && schedule\.data\.events\) \? schedule\.data\.events : \[\];

        console\.log\(`.*?Mobile schedule retrieved for userId=\$\{userId\}, date=\$\{date\}, events=\$\{events\.length\}`\);"""

# The new fixed code
new_code = """    app.get('/api/mobile/schedule', authenticateMobileJWT, async (req, res) => {
      try {
        const db = await getPrisma();
        const jwtUserId = req.mobileUserId; // Human-readable userId (e.g., "alexander.burns")
        const { date } = req.query;

        if (!date) {
          return res.status(400).json({ 
            error: 'Date parameter is required (format: YYYY-MM-DD)' 
          });
        }

        console.log(`📅 Fetching schedule for jwtUserId=${jwtUserId}, date=${date}`);

        // Step 1: Look up the User record by userId to get the DB id (cuid)
        const users = await db.$queryRawUnsafe(
          `SELECT id, "userId", "firstName", "lastName" FROM "User" WHERE "userId" = $1 LIMIT 1`,
          jwtUserId
        );

        if (!users || users.length === 0) {
          console.log(`❌ No user found for jwtUserId=${jwtUserId}`);
          return res.status(404).json({ error: 'User not found' });
        }

        const dbUser = users[0];
        const dbUserId = dbUser.id; // cuid - used as FK in Schedule table
        const userFullName = ((dbUser.firstName || '') + ' ' + (dbUser.lastName || '')).trim();

        console.log(`👤 Resolved user: dbId=${dbUserId}, name=${userFullName}`);

        // Step 2: Find schedule for this user and date using the database ID
        const schedules = await db.schedule.findMany({
          where: {
            userId: dbUserId,
            date: date
          },
          orderBy: {
            updatedAt: 'desc'
          }
        });

        if (!schedules || schedules.length === 0) {
          console.log(`ℹ️ No schedule found for userId=${dbUserId}, date=${date}`);
          return res.json({
            events: [],
            message: `No schedule found for this date.`
          });
        }

        // Get the most recent schedule for this date
        const schedule = schedules[0];

        // Extract events from schedule data
        const events = (schedule.data && schedule.data.events) ? schedule.data.events : [];

        console.log(`✅ Mobile schedule retrieved for userId=${dbUserId}, date=${date}, events=${events.length}`);"""

# Replace
content_new = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

# Write back
with open('/workspace/dfp-neo-deployment/server.js', 'w', encoding='utf-8') as f:
    f.write(content_new)

print("Schedule API fixed successfully!")