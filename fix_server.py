with open('server.js', 'r') as f:
    content = f.read()

# 1. Add ALTER TABLE after the CREATE TABLE block in ensureDailySnapshotTable
old_create = '''    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailySnapshot_date_key"
      ON "DailySnapshot"("date");
    `);'''

new_create = '''    // Add baselineEvents column if it doesn't exist (for existing tables)
    await db.$executeRawUnsafe(`
      ALTER TABLE "DailySnapshot" ADD COLUMN IF NOT EXISTS "baselineEvents" JSONB DEFAULT NULL;
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailySnapshot_date_key"
      ON "DailySnapshot"("date");
    `);'''

if old_create in content:
    content = content.replace(old_create, new_create, 1)
    print("✅ Added ALTER TABLE for baselineEvents column")
else:
    print("❌ Could not find CREATE UNIQUE INDEX block")

# 2. Update save endpoint to accept baselineEvents
old_destructure = '''    const {
      date,
      scheduleEvents,
      staffEvents,
      traineeEvents,
      pt051Assessments,
      traineeProfiles,
      lmpCompletedIds,
      staffCurrency,
      staffLogbook,
      savedBy
    } = req.body;'''

new_destructure = '''    const {
      date,
      scheduleEvents,
      staffEvents,
      traineeEvents,
      pt051Assessments,
      traineeProfiles,
      lmpCompletedIds,
      staffCurrency,
      staffLogbook,
      savedBy,
      baselineEvents
    } = req.body;'''

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure, 1)
    print("✅ Added baselineEvents to destructure")
else:
    print("❌ Could not find destructure block")

# 3. Update the UPDATE SQL to include baselineEvents (only if provided)
old_update = '''      await db.$executeRawUnsafe(`
        UPDATE "DailySnapshot"
        SET
          "scheduleEvents" = $1::jsonb,
          "staffEvents" = $2::jsonb,
          "traineeEvents" = $3::jsonb,
          "pt051Assessments" = $4::jsonb,
          "traineeProfiles" = $5::jsonb,
          "lmpCompletedIds" = $6::jsonb,
          "staffCurrency" = $7::jsonb,
          "staffLogbook" = $8::jsonb,
          "savedAt" = NOW(),
          "savedBy" = $9::text
        WHERE date = $10::text
      `,
        JSON.stringify(scheduleEvents || []),
        JSON.stringify(staffEvents || []),
        JSON.stringify(traineeEvents || []),
        JSON.stringify(pt051Assessments || {}),
        JSON.stringify(traineeProfiles || []),
        JSON.stringify(lmpCompletedIds || {}),
        JSON.stringify(staffCurrency || {}),
        JSON.stringify(staffLogbook || {}),
        savedBy || null,
        date
      );
      console.log(`✅ POST /api/daily-snapshot/save - Updated snapshot for ${date}, ${(scheduleEvents||[]).length} events`);'''

new_update = '''      // Only update baselineEvents if explicitly provided (preserves original published baseline)
      if (baselineEvents !== undefined && baselineEvents !== null) {
        await db.$executeRawUnsafe(`
          UPDATE "DailySnapshot"
          SET
            "scheduleEvents" = $1::jsonb,
            "staffEvents" = $2::jsonb,
            "traineeEvents" = $3::jsonb,
            "pt051Assessments" = $4::jsonb,
            "traineeProfiles" = $5::jsonb,
            "lmpCompletedIds" = $6::jsonb,
            "staffCurrency" = $7::jsonb,
            "staffLogbook" = $8::jsonb,
            "savedAt" = NOW(),
            "savedBy" = $9::text,
            "baselineEvents" = $10::jsonb
          WHERE date = $11::text
        `,
          JSON.stringify(scheduleEvents || []),
          JSON.stringify(staffEvents || []),
          JSON.stringify(traineeEvents || []),
          JSON.stringify(pt051Assessments || {}),
          JSON.stringify(traineeProfiles || []),
          JSON.stringify(lmpCompletedIds || {}),
          JSON.stringify(staffCurrency || {}),
          JSON.stringify(staffLogbook || {}),
          savedBy || null,
          JSON.stringify(baselineEvents),
          date
        );
      } else {
        await db.$executeRawUnsafe(`
          UPDATE "DailySnapshot"
          SET
            "scheduleEvents" = $1::jsonb,
            "staffEvents" = $2::jsonb,
            "traineeEvents" = $3::jsonb,
            "pt051Assessments" = $4::jsonb,
            "traineeProfiles" = $5::jsonb,
            "lmpCompletedIds" = $6::jsonb,
            "staffCurrency" = $7::jsonb,
            "staffLogbook" = $8::jsonb,
            "savedAt" = NOW(),
            "savedBy" = $9::text
          WHERE date = $10::text
        `,
          JSON.stringify(scheduleEvents || []),
          JSON.stringify(staffEvents || []),
          JSON.stringify(traineeEvents || []),
          JSON.stringify(pt051Assessments || {}),
          JSON.stringify(traineeProfiles || []),
          JSON.stringify(lmpCompletedIds || {}),
          JSON.stringify(staffCurrency || {}),
          JSON.stringify(staffLogbook || {}),
          savedBy || null,
          date
        );
      }
      console.log(`✅ POST /api/daily-snapshot/save - Updated snapshot for ${date}, ${(scheduleEvents||[]).length} events`);'''

if old_update in content:
    content = content.replace(old_update, new_update, 1)
    print("✅ Updated UPDATE SQL with baselineEvents support")
else:
    print("❌ Could not find UPDATE SQL block")

# 4. Update the INSERT SQL to include baselineEvents
old_insert = '''      await db.$executeRawUnsafe(`
        INSERT INTO "DailySnapshot"
          ("id", "date", "scheduleEvents", "staffEvents", "traineeEvents",
           "pt051Assessments", "traineeProfiles", "lmpCompletedIds",
           "staffCurrency", "staffLogbook", "savedAt", "savedBy")
        VALUES ($1::text, $2::text, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, NOW(), $11::text)
      `,
        id, date,
        JSON.stringify(scheduleEvents || []),
        JSON.stringify(staffEvents || []),
        JSON.stringify(traineeEvents || []),
        JSON.stringify(pt051Assessments || {}),
        JSON.stringify(traineeProfiles || []),
        JSON.stringify(lmpCompletedIds || {}),
        JSON.stringify(staffCurrency || {}),
        JSON.stringify(staffLogbook || {}),
        savedBy || null
      );
      console.log(`✅ POST /api/daily-snapshot/save - Created snapshot for ${date}, ${(scheduleEvents||[]).length} events`);'''

new_insert = '''      await db.$executeRawUnsafe(`
        INSERT INTO "DailySnapshot"
          ("id", "date", "scheduleEvents", "staffEvents", "traineeEvents",
           "pt051Assessments", "traineeProfiles", "lmpCompletedIds",
           "staffCurrency", "staffLogbook", "savedAt", "savedBy", "baselineEvents")
        VALUES ($1::text, $2::text, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, NOW(), $11::text, $12::jsonb)
      `,
        id, date,
        JSON.stringify(scheduleEvents || []),
        JSON.stringify(staffEvents || []),
        JSON.stringify(traineeEvents || []),
        JSON.stringify(pt051Assessments || {}),
        JSON.stringify(traineeProfiles || []),
        JSON.stringify(lmpCompletedIds || {}),
        JSON.stringify(staffCurrency || {}),
        JSON.stringify(staffLogbook || {}),
        savedBy || null,
        JSON.stringify(baselineEvents !== undefined && baselineEvents !== null ? baselineEvents : (scheduleEvents || []))
      );
      console.log(`✅ POST /api/daily-snapshot/save - Created snapshot for ${date}, ${(scheduleEvents||[]).length} events`);'''

if old_insert in content:
    content = content.replace(old_insert, new_insert, 1)
    print("✅ Updated INSERT SQL with baselineEvents")
else:
    print("❌ Could not find INSERT SQL block")

with open('server.js', 'w') as f:
    f.write(content)

print("Done!")