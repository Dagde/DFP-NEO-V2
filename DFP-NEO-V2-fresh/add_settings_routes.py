with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The settings routes to insert
settings_routes = '''
// ━━ App Settings Endpoints ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/settings - Load app settings
app.get('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureAppSettingsTable(db);
    const orgId = req.query.orgId || 'default';

    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );

    if (!rows || rows.length === 0) {
      return res.json({ settings: null });
    }

    return res.json({ settings: rows[0].data });
  } catch (error) {
    console.error('❌ GET /api/settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// POST /api/settings - Save app settings
app.post('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureAppSettingsTable(db);
    const { orgId = 'default', settings, updatedBy } = req.body;

    if (!settings) {
      return res.status(400).json({ error: 'Missing settings data' });
    }

    const settingsJson = JSON.stringify(settings);
    const now = new Date().toISOString();

    // Upsert: try update first, then insert
    const existing = await db.$queryRawUnsafe(
      `SELECT id FROM "AppSettings" WHERE "orgId" = $1 LIMIT 1`,
      orgId
    );

    if (existing && existing.length > 0) {
      await db.$executeRawUnsafe(
        `UPDATE "AppSettings" SET "data" = $1::jsonb, "updatedBy" = $2, "updatedAt" = $3 WHERE "orgId" = $4`,
        settingsJson, updatedBy || null, now, orgId
      );
      return res.json({ success: true, id: existing[0].id });
    } else {
      // Generate a cuid-like id using crypto
      const { randomBytes } = await import('crypto');
      const id = randomBytes(12).toString('base64url');
      await db.$executeRawUnsafe(
        `INSERT INTO "AppSettings" ("id", "orgId", "data", "updatedBy", "createdAt", "updatedAt") VALUES ($1, $2, $3::jsonb, $4, $5, $5)`,
        id, orgId, settingsJson, updatedBy || null, now
      );
      return res.json({ success: true, id });
    }
  } catch (error) {
    console.error('❌ POST /api/settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

'''

# Find the line number of "// PATCH /api/user/permissions"
target = '// PATCH /api/user/permissions - Update user permissions by name'
idx = content.find(target)
if idx == -1:
    print("ERROR: Target string not found!")
else:
    new_content = content[:idx] + settings_routes + content[idx:]
    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("✅ Settings routes added successfully!")
    # Verify
    if '/api/settings' in new_content:
        print("✅ Verified: /api/settings routes present in server.js")