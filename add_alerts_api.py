with open('server.js', 'r') as f:
    content = f.read()

# 1. Add alertsData column in ensureDailySnapshotTable
old_baseline_alter = '''    // Add baselineEvents column if it doesn't exist (for existing tables)
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "baselineEvents" JSONB DEFAULT NULL;
    `);'''

new_baseline_alter = '''    // Add baselineEvents column if it doesn't exist (for existing tables)
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "baselineEvents" JSONB DEFAULT NULL;
    `);
    // Add alertsData column for change-alert workflow
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "alertsData" JSONB DEFAULT '{}';
    `);
    // Add device tokens table for APNs push notifications
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DeviceToken" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "platform" TEXT NOT NULL DEFAULT 'ios',
        "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");
    `);'''

if old_baseline_alter in content:
    content = content.replace(old_baseline_alter, new_baseline_alter, 1)
    print("✅ Added alertsData column and DeviceToken table to ensureDailySnapshotTable")
else:
    print("❌ Could not find baseline alter block")

# 2. Add alert API endpoints before the scores/bulk endpoint
alert_endpoints = '''
// ============================================================
// ALERTS API - Change notification workflow
// ============================================================

// POST /api/alerts/send - Send an alert to pilots about a changed event
app.post('/api/alerts/send', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId, date, sentBy, recipients, eventDetails } = req.body;

    if (!eventId || !date || !sentBy || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'eventId, date, sentBy, and recipients are required' });
    }

    // Load existing snapshot for this date
    const rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }

    const alertsData = rows[0].alertsData || {};

    // Check if alert already sent for this event
    if (alertsData[eventId]) {
      return res.status(409).json({ 
        error: 'Alert already sent for this event',
        sentAt: alertsData[eventId].sentAt
      });
    }

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const sentAt = new Date().toISOString();

    // Build responses map - all pending initially
    const responses = {};
    recipients.forEach(r => {
      responses[r] = { status: 'pending', respondedAt: null };
    });

    alertsData[eventId] = {
      alertId,
      sentAt,
      sentBy,
      recipients,
      eventDetails: eventDetails || {},
      responses
    };

    // Save updated alertsData back to snapshot
    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      date
    );

    console.log(`✅ POST /api/alerts/send - Alert ${alertId} sent for event ${eventId} on ${date} to ${recipients.join(', ')}`);

    // TODO: Send APNs push notification here when credentials are available
    // For now, pilots poll GET /api/alerts/:userId

    res.json({ success: true, alertId, sentAt });
  } catch (error) {
    console.error('❌ POST /api/alerts/send error:', error);
    res.status(500).json({ error: 'Failed to send alert', details: error.message });
  }
});

// GET /api/alerts/:userId - Get all alerts for a specific pilot (iPhone polling)
app.get('/api/alerts/:userId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Load last 14 days of snapshots to find alerts
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData" IS NOT NULL AND "alertsData" != '{}'::jsonb
       ORDER BY date DESC LIMIT 14`
    );

    const alerts = [];
    for (const row of rows || []) {
      const alertsData = row.alertsData || {};
      for (const [eventId, alert] of Object.entries(alertsData)) {
        if (alert.recipients && alert.recipients.includes(userId)) {
          const myResponse = alert.responses?.[userId];
          // Only include if not yet responded (pending) OR include all for history
          alerts.push({
            alertId: alert.alertId,
            eventId,
            date: row.date,
            sentAt: alert.sentAt,
            sentBy: alert.sentBy,
            eventDetails: alert.eventDetails || {},
            myStatus: myResponse?.status || 'pending',
            respondedAt: myResponse?.respondedAt || null
          });
        }
      }
    }

    // Sort: pending first, then by date desc
    alerts.sort((a, b) => {
      if (a.myStatus === 'pending' && b.myStatus !== 'pending') return -1;
      if (a.myStatus !== 'pending' && b.myStatus === 'pending') return 1;
      return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime();
    });

    console.log(`✅ GET /api/alerts/${userId} - ${alerts.length} alerts found`);
    res.json({ alerts });
  } catch (error) {
    console.error('❌ GET /api/alerts/:userId error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
  }
});

// POST /api/alerts/:alertId/respond - Pilot submits ACCEPT or REJECT
app.post('/api/alerts/:alertId/respond', async (req, res) => {
  try {
    const db = await getPrisma();
    const { alertId } = req.params;
    const { userId, status } = req.body; // status: 'accepted' | 'rejected'

    if (!userId || !status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'userId and status (accepted|rejected) are required' });
    }

    // Find the snapshot containing this alertId
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "alertsData" FROM "DailySnapshot" 
       WHERE "alertsData"::text LIKE $1
       ORDER BY date DESC LIMIT 1`,
      `%${alertId}%`
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `Alert ${alertId} not found` });
    }

    const row = rows[0];
    const alertsData = row.alertsData || {};

    // Find the event that contains this alertId
    let targetEventId = null;
    for (const [eventId, alert] of Object.entries(alertsData)) {
      if (alert.alertId === alertId) {
        targetEventId = eventId;
        break;
      }
    }

    if (!targetEventId) {
      return res.status(404).json({ error: `Alert ${alertId} not found in snapshot` });
    }

    const alert = alertsData[targetEventId];

    // Verify this pilot is a recipient
    if (!alert.recipients.includes(userId)) {
      return res.status(403).json({ error: 'User is not a recipient of this alert' });
    }

    // Check if already responded
    if (alert.responses[userId]?.status !== 'pending') {
      return res.status(409).json({ 
        error: 'Already responded to this alert',
        status: alert.responses[userId].status
      });
    }

    // Record the response
    alert.responses[userId] = {
      status,
      respondedAt: new Date().toISOString()
    };

    // Save updated alertsData
    await db.$executeRawUnsafe(
      `UPDATE "DailySnapshot" SET "alertsData" = $1::jsonb WHERE date = $2::text`,
      JSON.stringify(alertsData),
      row.date
    );

    console.log(`✅ POST /api/alerts/${alertId}/respond - ${userId} responded: ${status}`);
    res.json({ success: true, alertId, userId, status });
  } catch (error) {
    console.error('❌ POST /api/alerts/:alertId/respond error:', error);
    res.status(500).json({ error: 'Failed to record response', details: error.message });
  }
});

// GET /api/alerts/event/:eventId - Browser polls for alert status on a specific event
app.get('/api/alerts/event/:eventId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { eventId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date query param is required' });
    }

    const rows = await db.$queryRawUnsafe(
      `SELECT "alertsData" FROM "DailySnapshot" WHERE date = $1::text LIMIT 1`,
      date
    );

    if (!rows || rows.length === 0) {
      return res.json({ alert: null });
    }

    const alertsData = rows[0].alertsData || {};
    const alert = alertsData[eventId] || null;

    if (!alert) {
      return res.json({ alert: null });
    }

    // Compute aggregate status
    let overallStatus = 'pending';
    const responses = Object.values(alert.responses || {});
    if (responses.length > 0) {
      const allResponded = responses.every(r => r.status !== 'pending');
      if (allResponded) {
        const anyRejected = responses.some(r => r.status === 'rejected');
        overallStatus = anyRejected ? 'rejected' : 'accepted';
      }
    }

    res.json({ 
      alert: {
        alertId: alert.alertId,
        sentAt: alert.sentAt,
        sentBy: alert.sentBy,
        recipients: alert.recipients,
        responses: alert.responses,
        overallStatus
      }
    });
  } catch (error) {
    console.error('❌ GET /api/alerts/event/:eventId error:', error);
    res.status(500).json({ error: 'Failed to fetch alert status', details: error.message });
  }
});

// POST /api/alerts/register-device - Register device token for APNs push notifications
app.post('/api/alerts/register-device', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, token, platform = 'ios' } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: 'userId and token are required' });
    }

    const id = `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    await db.$executeRawUnsafe(`
      INSERT INTO "DeviceToken" ("id", "userId", "token", "platform", "registeredAt")
      VALUES ($1::text, $2::text, $3::text, $4::text, NOW())
      ON CONFLICT ("userId", "token") DO UPDATE SET "registeredAt" = NOW()
    `, id, userId, token, platform);

    console.log(`✅ POST /api/alerts/register-device - Registered ${platform} token for ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ POST /api/alerts/register-device error:', error);
    res.status(500).json({ error: 'Failed to register device token', details: error.message });
  }
});

'''

# Insert before the scores/bulk endpoint
insert_before = "app.post('/api/scores/bulk', async (req, res) => {"
if insert_before in content:
    content = content.replace(insert_before, alert_endpoints + insert_before, 1)
    print("✅ Added all alert API endpoints")
else:
    print("❌ Could not find insertion point for alert endpoints")

with open('server.js', 'w') as f:
    f.write(content)

print("Done!")