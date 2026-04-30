with open('dfp-neo-platform/server.js', 'r') as f:
    content = f.read()

old = """// POST /api/alerts/register-device - Register device token for APNs push notifications
app.post('/api/alerts/register-device', async (req, res) => {
  try {"""

new = """// POST /api/alerts/clear - Clear alert for an event (allows re-sending)
app.post('/api/alerts/clear', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId, date, clearedBy } = req.body;

    if (!eventId || !date) {
      return res.status(400).json({ error: 'eventId and date are required' });
    }

    const rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }

    const alertsData = rows[0].alertsData || {};

    if (!alertsData[eventId]) {
      return res.status(404).json({ error: `No alert found for event ${eventId}` });
    }

    // Archive the alert in audit trail before clearing
    const clearedAlert = alertsData[eventId];
    if (!alertsData._auditTrail) alertsData._auditTrail = [];
    alertsData._auditTrail.push({
      type: 'cleared',
      clearedBy: clearedBy || 'unknown',
      clearedAt: new Date().toISOString(),
      originalAlert: clearedAlert
    });

    // Remove the event alert
    delete alertsData[eventId];

    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      date
    );

    console.log(`✅ POST /api/alerts/clear - Alert cleared for event ${eventId} on ${date} by ${clearedBy}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/alerts/clear error:', error);
    res.status(500).json({ error: 'Failed to clear alert', details: error.message });
  }
});

// POST /api/alerts/register-device - Register device token for APNs push notifications
app.post('/api/alerts/register-device', async (req, res) => {
  try {"""

if old in content:
    content = content.replace(old, new, 1)
    print("Added /api/alerts/clear endpoint: OK")
else:
    print("ERROR: old string not found!")

# Also update the send endpoint to save description field
old2 = """    alertsData[eventId] = {
      alertId,
      sentAt,
      sentBy,
      recipients,
      eventDetails: eventDetails || {},
      responses
    };"""

new2 = """    alertsData[eventId] = {
      alertId,
      sentAt,
      sentBy,
      recipients,
      description: description || '',
      eventDetails: eventDetails || {},
      responses
    };"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Added description to alert data structure: OK")
else:
    print("ERROR: alert data structure old string not found!")

# Also update the request body extraction to include description
old3 = '    const { eventId, date, sentBy, recipients, eventDetails } = req.body;'
new3 = '    const { eventId, date, sentBy, recipients, description, eventDetails } = req.body;'
if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Added description to req.body extraction: OK")
else:
    print("ERROR: req.body extraction old string not found!")

with open('dfp-neo-platform/server.js', 'w') as f:
    f.write(content)

print("All server.js changes done!")