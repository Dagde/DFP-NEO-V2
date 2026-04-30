with open('server.js', 'r') as f:
    content = f.read()

old = """// POST /api/alerts/clear - Clear alert for an event (allows re-sending)"""

new = """// POST /api/alerts/:alertId/dismiss - iOS user dismisses/deletes alert notification
app.post('/api/alerts/:alertId/dismiss', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    // Store dismissal in a lightweight way - just track in alertsData responses with 'dismissed' status
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData"::text LIKE $1
       ORDER BY date DESC LIMIT 1`,
      `%${alertId}%`
    );
    if (!rows || rows.length === 0) {
      // Alert not found - that's OK, just acknowledge
      return res.json({ success: true });
    }
    const row = rows[0];
    const alertsData = row.alertsData || {};
    // Find the event containing this alert
    for (const [eventId, alert] of Object.entries(alertsData)) {
      if (alert.alertId === alertId) {
        // Add to dismissed list for this user
        if (!alert.dismissed) alert.dismissed = [];
        if (!alert.dismissed.includes(userId)) {
          alert.dismissed.push(userId);
          await db.$executeRawUnsafe(
            `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
            JSON.stringify(alertsData),
            row.date
          );
        }
        break;
      }
    }
    console.log(`\u2705 POST /api/alerts/${alertId}/dismiss - ${userId} dismissed alert`);
    res.json({ success: true });
  } catch (error) {
    console.error('\u274c POST /api/alerts/:alertId/dismiss error:', error);
    res.status(500).json({ error: 'Failed to dismiss alert', details: error.message });
  }
});

// POST /api/alerts/clear - Clear alert for an event (allows re-sending)"""

if old in content:
    content = content.replace(old, new, 1)
    print("Added /api/alerts/:alertId/dismiss endpoint: OK")
else:
    print("ERROR: clear comment not found!")

# Also update GET /api/alerts/:userId to filter out dismissed alerts
old2 = """          alerts.push({
            alertId: alert.alertId,"""

new2 = """          // Skip if user has dismissed this alert
          if (alert.dismissed && alert.dismissed.includes(userId)) {
            continue;
          }
          if (alert.dismissed && userFullNameReversed && alert.dismissed.includes(userFullNameReversed)) {
            continue;
          }

          alerts.push({
            alertId: alert.alertId,"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Added dismissed filter in GET /api/alerts/:userId: OK")
else:
    print("ERROR: alerts.push not found!")
    idx = content.find('alerts.push({')
    print(f"Found at {idx}: {content[idx-100:idx+200]}")

with open('server.js', 'w') as f:
    f.write(content)

print("All done!")