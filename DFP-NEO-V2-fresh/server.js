import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// Lazy-load Prisma to avoid issues at startup
let prisma = null;
async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
    console.log('✅ Prisma connected to database');
    // Ensure AircraftAvailabilityHistory table exists (create if missing)
    await ensureAircraftAvailabilityTable(prisma);
    // Ensure AircraftAvailabilityEvent table exists (create if missing)
    await ensureAircraftAvailabilityEventTable(prisma);
    // Ensure SctRequest table exists (create if missing)
    await ensureSctRequestTable(prisma);
  }
  return prisma;
}

// Create AircraftAvailabilityHistory table if it doesn't exist
async function ensureAircraftAvailabilityTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityHistory" (
        "id"                TEXT NOT NULL,
        "date"              TEXT NOT NULL,
        "dailyAverage"      DOUBLE PRECISION NOT NULL,
        "plannedCount"      INTEGER NOT NULL,
        "actualCount"       INTEGER,
        "totalAircraft"     INTEGER NOT NULL,
        "availabilityPct"   DOUBLE PRECISION NOT NULL,
        "flyingWindowStart" TEXT,
        "flyingWindowEnd"   TEXT,
        "recordedBy"        TEXT,
        "notes"             TEXT,
        "lastCalculatedAt"  TIMESTAMP(3),
        "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AircraftAvailabilityHistory_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_date_key"
      ON "AircraftAvailabilityHistory"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_date_idx"
      ON "AircraftAvailabilityHistory"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AircraftAvailabilityHistory_createdAt_idx"
      ON "AircraftAvailabilityHistory"("createdAt");
    `);
    
    // Add missing columns if table already exists
    const addColumnIfMissing = async (columnName, columnType) => {
      try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "AircraftAvailabilityHistory" 
          ADD COLUMN IF NOT EXISTS "${columnName}" ${columnType}
        `);
      } catch (err) {
        // Column might already exist, ignore error
      }
    };
    
    await addColumnIfMissing('flyingWindowStart', 'TEXT');
    await addColumnIfMissing('flyingWindowEnd', 'TEXT');
    await addColumnIfMissing('lastCalculatedAt', 'TIMESTAMP(3)');
    await addColumnIfMissing('effectiveEndTime', 'TEXT'); // The time used for calculation (e.g., "13:00")
    
    console.log('✅ AircraftAvailabilityHistory table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityHistory table:', err.message);
  }
}

// Create SctRequest table if it doesn't exist
async function ensureSctRequestTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SctRequest" (
        "id"             TEXT NOT NULL,
        "userId"         TEXT NOT NULL,
        "requestType"    TEXT NOT NULL DEFAULT 'flight',
        "name"           TEXT NOT NULL DEFAULT '',
        "event"          TEXT NOT NULL DEFAULT '',
        "flightType"     TEXT NOT NULL DEFAULT 'Dual',
        "currency"       TEXT NOT NULL DEFAULT '',
        "currencyExpire" TEXT NOT NULL DEFAULT '',
        "priority"       TEXT NOT NULL DEFAULT 'Medium',
        "notes"          TEXT,
        "dateRequested"  TEXT,
        "requestedTime"  TEXT,
        "submitted"      BOOLEAN NOT NULL DEFAULT false,
        "includeInBuild" BOOLEAN NOT NULL DEFAULT false,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SctRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SctRequest_userId_idx"
      ON "SctRequest"("userId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SctRequest_priority_idx"
      ON "SctRequest"("priority");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SctRequest_requestType_idx"
      ON "SctRequest"("requestType");
    `);
    console.log('✅ SctRequest table ready');
  } catch (err) {
    console.error('❌ Failed to ensure SctRequest table:', err.message);
  }
}

// ============================================================
// API ROUTES
// ============================================================

// GET /api/personnel
app.get('/api/personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { role, available, search } = req.query;

    const where = {};
    if (role) where.role = role;
    if (available === 'true') where.isAvailable = true;
    if (available === 'false') where.isAvailable = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }

    const personnel = await db.personnel.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    console.log(`✅ GET /api/personnel - returning ${personnel.length} records`);
    res.json({ personnel });
  } catch (error) {
    console.error('❌ GET /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to fetch personnel', details: error.message });
  }
});

// GET /api/trainees
app.get('/api/trainees', async (req, res) => {
  try {
    const db = await getPrisma();
    const { search } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
        { course: { contains: search, mode: 'insensitive' } },
      ];
    }

    const trainees = await db.trainee.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    console.log(`✅ GET /api/trainees - returning ${trainees.length} records`);
    res.json({ trainees });
  } catch (error) {
    console.error('❌ GET /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to fetch trainees', details: error.message });
  }
});

// POST /api/personnel
app.post('/api/personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;

    // Auto-link to existing User by PMKEYS
    let linkedUserId = null;
    if (body.idNumber) {
      const existingUser = await db.user.findFirst({
        where: { userId: body.idNumber.toString() }
      });
      if (existingUser) {
        linkedUserId = existingUser.id;
        console.log(`✅ Auto-linked to user: ${existingUser.username}`);
      }
    }

    const newPersonnel = await db.personnel.create({
      data: {
        name: body.name || '',
        rank: body.rank || null,
        role: body.role || null,
        category: body.category || null,
        unit: body.unit || null,
        location: body.location || null,
        idNumber: body.idNumber || null,
        callsignNumber: body.callsignNumber || null,
        email: body.email || null,
        phoneNumber: body.phoneNumber || null,
        seatConfig: body.seatConfig || null,
        isQFI: body.isQFI || false,
        isOFI: body.isOFI || false,
        isCFI: body.isCFI || false,
        isExecutive: body.isExecutive || false,
        isFlyingSupervisor: body.isFlyingSupervisor || false,
        isIRE: body.isIRE || false,
        isCommandingOfficer: body.isCommandingOfficer || false,
        isTestingOfficer: body.isTestingOfficer || false,
        isContractor: body.isContractor || false,
        isAdminStaff: body.isAdminStaff || false,
        isActive: true,
        userId: linkedUserId,
      }
    });

    console.log(`✅ POST /api/personnel - created: ${newPersonnel.name}`);
    res.json({ success: true, personnel: newPersonnel });
  } catch (error) {
    console.error('❌ POST /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to create personnel', details: error.message });
  }
});

// GET /api/aircraft
app.get('/api/aircraft', async (req, res) => {
  try {
    const db = await getPrisma();
    const { type, status } = req.query;

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const aircraft = await db.aircraft.findMany({
      where,
      orderBy: { aircraftNumber: 'asc' },
    });

    console.log(`✅ GET /api/aircraft - returning ${aircraft.length} records`);
    res.json({ aircraft });
  } catch (error) {
    console.error('❌ GET /api/aircraft error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft', details: error.message });
  }
});

// GET /api/scores
app.get('/api/scores', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId, traineeFullName } = req.query;

    const where = {};
    if (traineeId) {
      where.traineeId = traineeId;
    } else if (traineeFullName) {
      const trainee = await db.trainee.findFirst({ where: { fullName: traineeFullName } });
      if (trainee) {
        where.traineeId = trainee.id;
      } else {
        return res.json({ scores: [], count: 0 });
      }
    }

    const scores = await db.score.findMany({
      where,
      include: {
        trainee: { select: { id: true, fullName: true, course: true } }
      },
      orderBy: [{ trainee: { fullName: 'asc' } }, { date: 'asc' }]
    });

    const scoresByTrainee = new Map();
    scores.forEach(score => {
      const fullName = score.trainee.fullName;
      if (!scoresByTrainee.has(fullName)) scoresByTrainee.set(fullName, []);
      scoresByTrainee.get(fullName).push({
        event: score.event,
        score: score.score,
        date: score.date.toISOString().split('T')[0]
      });
    });

    res.json({ scores: Array.from(scoresByTrainee.entries()), count: scores.length });
  } catch (error) {
    console.error('❌ GET /api/scores error:', error);
    res.status(500).json({ error: 'Failed to fetch scores', details: error.message });
  }
});

// GET /api/schedule
app.get('/api/schedule', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, startDate, endDate } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const schedules = await db.schedule.findMany({
      where,
      include: {
        user: { select: { userId: true, firstName: true, lastName: true, role: true } }
      },
      orderBy: { date: 'asc' },
    });

    res.json({ schedules });
  } catch (error) {
    console.error('❌ GET /api/schedule error:', error);
    res.status(500).json({ error: 'Failed to fetch schedules', details: error.message });
  }
});

// POST /api/schedule
app.post('/api/schedule', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId, date, data } = req.body;

    if (!userId || !date || !data) {
      return res.status(400).json({ error: 'userId, date, and data are required' });
    }

    const existingSchedule = await db.schedule.findFirst({ where: { userId, date } });

    let schedule;
    if (existingSchedule) {
      schedule = await db.schedule.update({
        where: { id: existingSchedule.id },
        data: { data, updatedAt: new Date() },
      });
    } else {
      schedule = await db.schedule.create({ data: { userId, date, data } });
    }

    res.json({ success: true, schedule });
  } catch (error) {
    console.error('❌ POST /api/schedule error:', error);
    res.status(500).json({ error: 'Failed to save schedule', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// COURSES API
// ============================================================

// GET /api/courses - Fetch all courses
app.get('/api/courses', async (req, res) => {
  try {
    console.log(`📡 GET /api/courses called - query:`, req.query);
    const db = await getPrisma();
    const { school } = req.query;

    const courses = await db.course.findMany({
      where: school ? { location: school } : undefined,
      orderBy: { name: 'asc' }
    });

    console.log(`✅ GET /api/courses - found ${courses.length} courses in database`);
    courses.forEach(c => {
      console.log(`   - ${c.name} (${c.code}): start=${c.startDate}, end=${c.endDate}, color=${c.color}`);
    });
    res.json({ courses });
  } catch (error) {
    console.error('❌ GET /api/courses error:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to fetch courses', details: error.message });
  }
});

// PUT /api/courses - Update or create a course (upsert)
app.put('/api/courses', async (req, res) => {
  try {
    console.log(`📡 PUT /api/courses called - body:`, req.body);
    console.log(`📡 PUT /api/courses - query:`, req.query);
    const db = await getPrisma();
    const { name, startDate, endDate, color, raafCount, navyCount, armyCount, unit } = req.body;

    if (!name) {
      console.error('❌ PUT /api/courses - missing course name');
      return res.status(400).json({ error: 'Course name is required' });
    }

    console.log(`🔍 PUT /api/courses - searching for course: ${name}`);

    // Find existing course by name (or code)
    const existingCourse = await db.course.findFirst({
      where: {
        OR: [
          { name },
          { code: name }
        ]
      }
    });

    let updatedCourse;

    if (existingCourse) {
      console.log(`🔍 PUT /api/courses - found existing course: ${existingCourse.name} (id: ${existingCourse.id})`);
      console.log(`   Current dates: start=${existingCourse.startDate}, end=${existingCourse.endDate}`);
      console.log(`   New dates: start=${startDate}, end=${endDate}`);

      // Update existing course
      updatedCourse = await db.course.update({
        where: { id: existingCourse.id },
        data: {
          ...(startDate && { startDate }),
          ...(endDate && { endDate }),
          ...(color && { color }),
          ...(raafCount !== undefined && { raafCount }),
          ...(navyCount !== undefined && { navyCount }),
          ...(armyCount !== undefined && { armyCount }),
          ...(unit && { unit })
        }
      });
      console.log(`✅ PUT /api/courses - updated course: ${updatedCourse.name}`);
      console.log(`   Updated dates: start=${updatedCourse.startDate}, end=${updatedCourse.endDate}`);
    } else {
      console.log(`🔍 PUT /api/courses - course not found, creating new course: ${name}`);
      // Create new course (use school from query or default to ESL)
      const { school } = req.query;
      console.log(`   Creating with school: ${school}`);
      updatedCourse = await db.course.create({
        data: {
          name,
          code: name, // Use name as code for simplicity
          startDate: startDate || '2025-01-01',
          endDate: endDate || '2025-12-31',
          color: color || null,
          raafCount: raafCount || 0,
          navyCount: navyCount || 0,
          armyCount: armyCount || 0,
          unit: unit || 'ESL',
          location: school === 'PEA' ? 'PEA' : 'ESL',
          status: 'ACTIVE'
        }
      });
      console.log(`✅ PUT /api/courses - created course: ${updatedCourse.name} (id: ${updatedCourse.id})`);
    }

    res.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.error('❌ PUT /api/courses error:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to save course', details: error.message, stack: error.stack });
  }
});

// ============================================================
// AIRCRAFT AVAILABILITY HISTORY ENDPOINTS
// ============================================================

// GET /api/aircraft-availability-history
// Uses raw SQL to avoid Prisma client model dependency
app.get('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { startDate, endDate, limit } = req.query;

    let query = `SELECT * FROM "AircraftAvailabilityHistory"`;
    const conditions = [];
    const params = [];

    if (startDate) {
      params.push(startDate);
      conditions.push(`"date" >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`"date" <= $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY "date" ASC`;
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }

    const records = await db.$queryRawUnsafe(query, ...params);
    console.log(`✅ GET /api/aircraft-availability-history - returning ${records.length} records`);
    res.json({ records });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft availability history', details: error.message });
  }
});

// POST /api/aircraft-availability-history
// Uses raw SQL INSERT ... ON CONFLICT to upsert without Prisma model
app.post('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date, dailyAverage, plannedCount, actualCount, totalAircraft, availabilityPct, recordedBy, notes } = req.body;
    if (!date || dailyAverage === undefined || plannedCount === undefined || totalAircraft === undefined) {
      return res.status(400).json({ error: 'Missing required fields: date, dailyAverage, plannedCount, totalAircraft' });
    }

    const id = `aah_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const avgPct = parseFloat(availabilityPct || ((parseFloat(dailyAverage) / parseInt(totalAircraft)) * 100));
    const now = new Date().toISOString();

    await db.$executeRawUnsafe(`
      INSERT INTO "AircraftAvailabilityHistory"
        ("id", "date", "dailyAverage", "plannedCount", "actualCount", "totalAircraft", "availabilityPct", "recordedBy", "notes", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT ("date") DO UPDATE SET
        "dailyAverage"    = EXCLUDED."dailyAverage",
        "plannedCount"    = EXCLUDED."plannedCount",
        "actualCount"     = EXCLUDED."actualCount",
        "totalAircraft"   = EXCLUDED."totalAircraft",
        "availabilityPct" = EXCLUDED."availabilityPct",
        "recordedBy"      = EXCLUDED."recordedBy",
        "notes"           = EXCLUDED."notes",
        "updatedAt"       = EXCLUDED."updatedAt"
    `,
      id,
      date,
      parseFloat(dailyAverage),
      parseInt(plannedCount),
      actualCount !== undefined && actualCount !== null ? parseInt(actualCount) : null,
      parseInt(totalAircraft),
      avgPct,
      recordedBy || null,
      notes || null,
      now,
      now
    );

    // Fetch the upserted record to return it
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1`, date
    );
    const record = rows[0] || null;
    console.log(`✅ POST /api/aircraft-availability-history - upserted record for date: ${date}`);
    res.json({ success: true, record });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to save aircraft availability history', details: error.message });
  }
});

// DELETE /api/aircraft-availability-history/:id
app.delete('/api/aircraft-availability-history/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    await db.$executeRawUnsafe(`DELETE FROM "AircraftAvailabilityHistory" WHERE "id" = $1`, id);
    console.log(`✅ DELETE /api/aircraft-availability-history/${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to delete aircraft availability history record', details: error.message });
  }
});

// ============================================================
// SERVE STATIC VITE BUILD
// ============================================================

// Serve the flight-school-app static files
const staticPath = path.join(__dirname, 'dfp-neo-platform/public/flight-school-app');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  console.log(`✅ Serving static files from: ${staticPath}`);
}

// ============================================================
// SCT REQUESTS API
// ============================================================

// GET all SCT requests (diagnostic - no userId filter) - for debugging only
app.get('/api/sct-requests-all', async (req, res) => {
  try {
    const db = await getPrisma();
    const requests = await db.$queryRawUnsafe(`SELECT "id", "userId", "name", "event", "requestType", "createdAt" FROM "SctRequest" ORDER BY "createdAt" DESC LIMIT 50`);
    console.log(`✅ GET /api/sct-requests-all - found ${requests.length} total records`);
    res.json(requests);
  } catch (err) {
    console.error('❌ Error fetching all SCT requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET all SCT requests for a user
app.get('/api/sct-requests', async (req, res) => {
  try {
    const db = await getPrisma();
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const requests = await db.$queryRawUnsafe(
      `SELECT * FROM "SctRequest" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
      String(userId)
    );
    // Also log all distinct userIds in the table for debugging
    const allUserIds = await db.$queryRawUnsafe(`SELECT DISTINCT "userId", COUNT(*)::int as count FROM "SctRequest" GROUP BY "userId"`);
    console.log(`✅ GET /api/sct-requests - found ${requests.length} records for userId: "${userId}"`);
    console.log(`📊 All userIds in SctRequest table:`, JSON.stringify(allUserIds));
    // Serialize BigInt values to regular numbers/booleans
    const safeRequests = requests.map(r => ({
      ...r,
      submitted: Boolean(r.submitted),
      includeInBuild: Boolean(r.includeInBuild),
    }));
    res.json(safeRequests);
  } catch (err) {
    console.error('❌ Error fetching SCT requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create a new SCT request
app.post('/api/sct-requests', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id, userId, requestType, name, event, flightType, currency, currencyExpire, priority, notes, dateRequested, requestedTime } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const newId = id || require('crypto').randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO "SctRequest" ("id","userId","requestType","name","event","flightType","currency","currencyExpire","priority","notes","dateRequested","requestedTime","submitted","includeInBuild","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())`,
      newId,
      String(userId),
      requestType || 'flight',
      name || '',
      event || '',
      flightType || 'Dual',
      currency || '',
      currencyExpire || '',
      priority || 'Medium',
      notes || null,
      dateRequested || new Date().toISOString().split('T')[0],
      requestedTime || '15:00',
      false,
      false
    );
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SctRequest" WHERE "id" = $1`, newId);
    console.log(`✅ POST /api/sct-requests - created record id: ${newId} for userId: ${userId}`);
    const row = rows[0];
    res.json({ ...row, submitted: Boolean(row.submitted), includeInBuild: Boolean(row.includeInBuild) });
  } catch (err) {
    console.error('❌ Error creating SCT request:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update an SCT request
app.put('/api/sct-requests/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;
    delete updates.createdAt;
    // Build dynamic SET clause
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClauses = fields.map((f, i) => `"${f}" = $${i + 2}`).join(', ');
    const values = fields.map(f => updates[f]);
    await db.$executeRawUnsafe(
      `UPDATE "SctRequest" SET ${setClauses}, "updatedAt" = NOW() WHERE "id" = $1`,
      id, ...values
    );
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "SctRequest" WHERE "id" = $1`, id);
    console.log(`✅ PUT /api/sct-requests/${id} - updated fields: ${fields.join(', ')}`);
    const row = rows[0];
    res.json(row ? { ...row, submitted: Boolean(row.submitted), includeInBuild: Boolean(row.includeInBuild) } : { id });
  } catch (err) {
    console.error('❌ Error updating SCT request:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE an SCT request
app.delete('/api/sct-requests/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    await db.$executeRawUnsafe(`DELETE FROM "SctRequest" WHERE "id" = $1`, id);
    console.log(`✅ DELETE /api/sct-requests/${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error deleting SCT request:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AIRCRAFT AVAILABILITY EVENTS API
// ============================================================

// Ensure AircraftAvailabilityEvent table exists
async function ensureAircraftAvailabilityEventTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityEvent" (
        "id"             TEXT NOT NULL PRIMARY KEY,
        "timestamp"      TIMESTAMP NOT NULL,
        "date"           TEXT NOT NULL,
        "availableCount" INTEGER NOT NULL,
        "totalAircraft"  INTEGER NOT NULL,
        "changeType"     TEXT NOT NULL,
        "recordedBy"     TEXT,
        "notes"          TEXT,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Create indexes
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_date ON "AircraftAvailabilityEvent"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_timestamp ON "AircraftAvailabilityEvent"("timestamp")`);
    console.log('✅ AircraftAvailabilityEvent table ensured');
  } catch (err) {
    console.error('❌ Error creating AircraftAvailabilityEvent table:', err);
  }
}

// GET /api/aircraft-availability-events - Get events for a date
app.get('/api/aircraft-availability-events', async (req, res) => {
  const requestId = `get_${Date.now()}`;
  console.log(`\n[AV-EVENTS] 📥 GET request ${requestId}`);
  
  try {
    const db = await getPrisma();
    await ensureAircraftAvailabilityEventTable(db);
    
    const { date, startDate, endDate } = req.query;
    let whereClause = '';
    const params = [];
    
    if (date) {
      whereClause = 'WHERE "date" = $1';
      params.push(date);
    } else if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        params.push(startDate);
        conditions.push(`"date" >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        conditions.push(`"date" <= $${params.length}`);
      }
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" ${whereClause} ORDER BY "timestamp" ASC`,
      ...params
    );
    
    console.log(`[AV-EVENTS] ✅ Returning ${events.length} events`);
    res.json({ events });
  } catch (error) {
    console.error('[AV-EVENTS] ❌ GET error:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message, requestId });
  }
});

// POST /api/aircraft-availability-events - Create a new event
app.post('/api/aircraft-availability-events', async (req, res) => {
  const requestId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-EVENTS] 📨 POST request ${requestId}`);
  
  try {
    const db = await getPrisma();
    await ensureAircraftAvailabilityEventTable(db);
    
    const { timestamp, date, availableCount, totalAircraft, changeType, recordedBy, notes, flyingWindowStart, flyingWindowEnd, clientLocalHour, clientLocalMinute } = req.body;
    
    console.log(`[AV-EVENTS] 📋 Parsed body:`, { timestamp, date, availableCount, totalAircraft, changeType, recordedBy, clientLocalHour, clientLocalMinute });
    
    if (!date || availableCount === undefined || availableCount === null) {
      console.error(`[AV-EVENTS] ❌ Validation failed: missing date or availableCount`);
      return res.status(400).json({ error: 'date and availableCount are required', received: { date, availableCount }, requestId });
    }
    
    const BOUNDARY_TYPES = ['window_start', 'window_end', 'startup', 'reset', 'shutdown'];
    const isBoundary = BOUNDARY_TYPES.includes(changeType);
    
    // Check if we should skip recalculation (after flying window AND today)
    // Do this check early to avoid unnecessary processing
    const parseWindowTime = (s, defaultHour) => {
      if (!s) return defaultHour * 60;
      const clean = String(s).replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10) || defaultHour;
      const m = parseInt(clean.slice(-2), 10) || 0;
      return h * 60 + m;
    };
    
    // Use the client's local time (if provided) to determine if it's after the flying window
    // This fixes a timezone mismatch issue where server time != user's local time
    // The clientLocalHour and clientLocalMinute are in the user's timezone
    const eventMin = (clientLocalHour !== undefined && clientLocalMinute !== undefined)
      ? clientLocalHour * 60 + clientLocalMinute
      : (timestamp ? new Date(timestamp).getHours() * 60 + new Date(timestamp).getMinutes() : new Date().getHours() * 60 + new Date().getMinutes());
    const windowEndMin = parseWindowTime(flyingWindowEnd, 17);
    const todayStr = new Date().toISOString().split('T')[0];
    const isAfterWindow = eventMin >= windowEndMin;
    const isToday = date === todayStr;
    
    console.log(`[AV-EVENTS] 🕐 Time check: clientLocalTime=${clientLocalHour}:${clientLocalMinute} (${eventMin}min), windowEnd=${windowEndMin}min, isAfterWindow=${isAfterWindow}, isToday=${isToday}`);
    
    // Deduplication: skip if last event has same count (unless boundary event)
    if (!isBoundary) {
      const lastEvent = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" DESC LIMIT 1`,
        date
      );
      
      if (lastEvent.length > 0 && lastEvent[0].availableCount === availableCount) {
        console.log(`[AV-EVENTS] ⏭️ Skipping duplicate event for ${date}: availableCount=${availableCount} unchanged`);
        
        // Only recalculate if not after window
        let summary = null;
        if (isAfterWindow && isToday) {
          console.log(`[AV-EVENTS] ⏭️ Also skipping recalculation - after flying window`);
        } else {
          const clientCurrentTimeMinutes = (clientLocalHour !== undefined && clientLocalMinute !== undefined) 
            ? clientLocalHour * 60 + clientLocalMinute 
            : null;
          summary = await recalculateDailySummary(db, date, flyingWindowStart, flyingWindowEnd, recordedBy, clientCurrentTimeMinutes);
        }
        return res.json({ skipped: true, reason: 'no_change', summary, requestId });
      }
    }
    
    // If after flying window and today, just record the event but don't recalculate
    if (isAfterWindow && isToday) {
      console.log(`[AV-EVENTS] ⏰ Event is after flying window (${eventMin}min >= ${windowEndMin}min), recording event only`);
      
      // Insert the event
      const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
      const eventId = require('crypto').randomUUID();
      
      await db.$executeRawUnsafe(
        `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        eventId,
        eventTimestamp,
        date,
        parseInt(availableCount),
        parseInt(totalAircraft) || 15,
        changeType || 'change',
        recordedBy || null,
        notes || null
      );
      
      console.log(`[AV-EVENTS] ✅ Event recorded (no recalculation) with ID: ${eventId}`);
      console.log(`${'='.repeat(80)}\n`);
      
      return res.json({ 
        success: true, 
        event: { id: eventId, timestamp: eventTimestamp, date, availableCount }, 
        skippedRecalculation: true, 
        reason: 'after_flying_window',
        requestId 
      });
    }
    
    // Insert the event
    const eventTimestamp = timestamp ? new Date(timestamp) : new Date();
    const eventId = require('crypto').randomUUID();
    
    await db.$executeRawUnsafe(
      `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      eventId,
      eventTimestamp,
      date,
      parseInt(availableCount),
      parseInt(totalAircraft) || 15,
      changeType || 'change',
      recordedBy || null,
      notes || null
    );
    
    console.log(`[AV-EVENTS] ✅ Event created with ID: ${eventId}`);
    
    // Recalculate daily summary (we only reach here if we're NOT after the flying window)
    // Pass the client's current time for accurate elapsed time calculation
    const clientCurrentTimeMinutes = (clientLocalHour !== undefined && clientLocalMinute !== undefined) 
      ? clientLocalHour * 60 + clientLocalMinute 
      : null;
    const summary = await recalculateDailySummary(db, date, flyingWindowStart, flyingWindowEnd, recordedBy, clientCurrentTimeMinutes);
    
    console.log(`[AV-EVENTS] ✅ POST completed successfully ${requestId}`);
    console.log(`${'='.repeat(80)}\n`);
    
    res.json({ success: true, event: { id: eventId, timestamp: eventTimestamp, date, availableCount, totalAircraft, changeType }, summary, requestId });
  } catch (error) {
    console.error(`[AV-EVENTS] ❌ POST error ${requestId}:`, error);
    console.log(`${'='.repeat(80)}\n`);
    res.status(500).json({ error: 'Failed to insert event', details: error.message, requestId });
  }
});

// Recalculate daily summary helper
// clientCurrentTimeMinutes: Optional - the client's current local time in minutes since midnight
//                              If provided, this is used to calculate effective end time
async function recalculateDailySummary(db, date, flyingWindowStart, flyingWindowEnd, recordedBy, clientCurrentTimeMinutes = null) {
  console.log(`[AV-EVENTS] 🔄 recalculateDailySummary for ${date}`);
  
  try {
    // Parse flying window (default 0800-1700)
    const parseWindowTime = (s, defaultHour) => {
      if (!s) return defaultHour * 60;
      const clean = String(s).replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10) || defaultHour;
      const m = parseInt(clean.slice(-2), 10) || 0;
      return h * 60 + m;
    };
    
    const windowStartMin = parseWindowTime(flyingWindowStart, 8);
    const windowEndMin = parseWindowTime(flyingWindowEnd, 17);
    
    // Calculate effective end time: min(current time, window end)
    // If clientCurrentTimeMinutes is provided, use it; otherwise use window end
    const effectiveEndMin = clientCurrentTimeMinutes !== null 
      ? Math.min(Math.max(clientCurrentTimeMinutes, windowStartMin), windowEndMin)
      : windowEndMin;
    
    // Calculate elapsed time in the window (not total window duration)
    const elapsedMinutes = effectiveEndMin - windowStartMin;
    
    console.log(`[AV-EVENTS] 🔄 Window: ${windowStartMin}min - ${windowEndMin}min, effectiveEnd: ${effectiveEndMin}min, elapsed: ${elapsedMinutes}min`);
    
    if (elapsedMinutes <= 0) {
      console.warn(`[AV-EVENTS] ⚠️ Invalid flying window or current time before window start`);
      return null;
    }
    
    // Get all events for the date
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" ASC`,
      date
    );
    
    console.log(`[AV-EVENTS] 🔄 Found ${events.length} events for ${date}`);
    console.log(`[AV-EVENTS] 📋 Events:`, JSON.stringify(events.map(e => ({
      id: e.id.slice(0, 8),
      timestamp: e.timestamp,
      availableCount: e.availableCount
    }))));
    
    if (events.length === 0) {
      console.log(`[AV-EVENTS] ⚠️ No events for ${date}, checking for last known availability from previous days`);
      
      // Get the most recent event from any previous date
      const lastKnownEvent = await db.$queryRawUnsafe(
        `SELECT * FROM "AircraftAvailabilityEvent" ORDER BY "timestamp" DESC LIMIT 1`
      );
      
      if (lastKnownEvent.length > 0) {
        // Use the last known availability for today's calculation
        const lastAvailability = lastKnownEvent[0].availableCount;
        const lastTotalAircraft = lastKnownEvent[0].totalAircraft;
        console.log(`[AV-EVENTS] 📋 Using last known availability: ${lastAvailability} from ${lastKnownEvent[0].date}`);
        
        // Calculate average using last known availability for the elapsed time
        const dailyAverage = lastAvailability;
        const availabilityPct = lastTotalAircraft > 0 ? (lastAvailability / lastTotalAircraft) * 100 : 0;
        
        // Format effective end time
        const effectiveEndTimeStr = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(effectiveEndMin % 60).padStart(2, '0')}`;
        
        return {
          date,
          dailyAverage,
          plannedCount: lastAvailability,
          actualCount: lastAvailability,
          totalAircraft: lastTotalAircraft,
          availabilityPct,
          flyingWindowStart,
          flyingWindowEnd,
          effectiveEndTime: effectiveEndTimeStr,
          isProjected: true // Flag to indicate this is projected from previous data
        };
      }
      
      console.log(`[AV-EVENTS] ⚠️ No events found at all, skipping summary`);
      return null;
    }
    
    // Convert timestamp to minutes-since-midnight in CLIENT'S LOCAL TIME
    // Timestamps are stored in UTC, but we need to compare them to local flying window times
    // We calculate the timezone offset from the client's current local time vs UTC
    const getClientLocalMinutes = (ts) => {
      const d = new Date(ts);
      const now = new Date();
      // Calculate offset: client's local time - UTC time (in minutes)
      // clientCurrentTimeMinutes is the client's local time in minutes
      // Current UTC time in minutes
      const currentUTCMonth = now.getUTCHours() * 60 + now.getUTCMinutes();
      // If we have client time, we can calculate offset
      // For now, use a simpler approach: assume timestamps in DB are in local time
      // This works if the server and client are in the same timezone
      // OR we use the date string which is already in local format
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    };
    
    // Alternative: Use the date string's time portion if available
    const toMinutes = (ts) => {
      const d = new Date(ts);
      // Use local time methods since we want to compare to local flying window
      return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    };
    
    // Calculate time-weighted average
    // Key insight: Events can occur before, during, or after the flying window.
    // We need to track the "current" availability as of any point in time.
    
    let weightedSum = 0;
    let coveredMinutes = 0;
    
    // Find the last event before the window starts - this is our starting availability
    let lastKnownAvailability = events.length > 0 ? events[0].availableCount : 0;
    let lastKnownTime = events.length > 0 ? toMinutes(events[0].timestamp) : 0;
    
    // If first event is after window start, we have no data for the start of window
    // In this case, we'll use the first event's value for the beginning
    
    console.log(`[AV-EVENTS] Starting calculation with ${events.length} events`);
    console.log(`[AV-EVENTS] Window: ${windowStartMin}min (${Math.floor(windowStartMin/60)}:${String(windowStartMin%60).padStart(2,'0')}) to ${windowEndMin}min (${Math.floor(windowEndMin/60)}:${String(windowEndMin%60).padStart(2,'0')})`);
    console.log(`[AV-EVENTS] Effective end: ${effectiveEndMin}min (${Math.floor(effectiveEndMin/60)}:${String(effectiveEndMin%60).padStart(2,'0')}), Elapsed: ${elapsedMinutes}min`);
    
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const evMinutes = toMinutes(ev.timestamp);
      console.log(`[AV-EVENTS] Event ${i}: time=${evMinutes}min (${Math.floor(evMinutes/60)}:${String(Math.floor(evMinutes%60)).padStart(2,'0')}), available=${ev.availableCount}`);
      
      // Skip events after the effective end time
      if (evMinutes >= effectiveEndMin) {
        console.log(`[AV-EVENTS]   Skipping - after effective end time`);
        continue;
      }
      
      // If event is before window start, just update last known availability
      if (evMinutes < windowStartMin) {
        lastKnownAvailability = ev.availableCount;
        lastKnownTime = evMinutes;
        continue;
      }
      
      // Event is within the window (windowStartMin <= evMinutes < windowEndMin)
      // Calculate the segment from lastKnownTime to this event
      const segStart = Math.max(lastKnownTime, windowStartMin);
      const segEnd = evMinutes;
      
      if (segEnd > segStart) {
        const duration = segEnd - segStart;
        weightedSum += lastKnownAvailability * duration;
        coveredMinutes += duration;
      }
      
      // Update last known
      lastKnownAvailability = ev.availableCount;
      lastKnownTime = evMinutes;
    }
    
    console.log(`[AV-EVENTS] After loop: weightedSum=${weightedSum}, coveredMinutes=${coveredMinutes}, lastKnownAvailability=${lastKnownAvailability}, lastKnownTime=${lastKnownTime}`);
    
    // Fill remaining time from last known availability to window end
    // BUT: Only if we have actual events within or before the window
    // Events AFTER the window ends should NOT affect the average
    const remainingStart = Math.max(lastKnownTime, windowStartMin);
    
    // Only fill remaining time if the last known event was BEFORE or WITHIN the effective end time
    // If the last event was after effective end time, don't use it
    const lastEventWithinOrBeforeEffective = events.filter(e => toMinutes(e.timestamp) <= effectiveEndMin);
    const validLastKnown = lastEventWithinOrBeforeEffective.length > 0 
      ? lastEventWithinOrBeforeEffective[lastEventWithinOrBeforeEffective.length - 1].availableCount 
      : lastKnownAvailability;
    
    // Fill remaining time up to effective end time (not window end)
    // This ensures we only count time that has actually elapsed
    const effectiveRemainingEnd = Math.min(remainingStart + (elapsedMinutes - coveredMinutes), effectiveEndMin);
    if (remainingStart < effectiveRemainingEnd && coveredMinutes < elapsedMinutes && lastKnownTime < effectiveEndMin) {
      const remainingDuration = effectiveRemainingEnd - remainingStart;
      weightedSum += validLastKnown * remainingDuration;
      coveredMinutes += remainingDuration;
    }
    
    // If no events within the window, use the last known availability for elapsed time
    if (coveredMinutes === 0 && events.length > 0) {
      // Find the last event before or at window start
      const eventsBeforeWindow = events.filter(e => toMinutes(e.timestamp) <= windowStartMin);
      if (eventsBeforeWindow.length > 0) {
        const lastBeforeWindow = eventsBeforeWindow[eventsBeforeWindow.length - 1];
        weightedSum = lastBeforeWindow.availableCount * elapsedMinutes;
        coveredMinutes = elapsedMinutes;
      } else {
        // No events before window, use first event's value
        weightedSum = events[0].availableCount * elapsedMinutes;
        coveredMinutes = elapsedMinutes;
      }
    }
    
    console.log(`[AV-EVENTS] 📊 Calculation complete: weightedSum=${weightedSum}, coveredMinutes=${coveredMinutes}, elapsedMinutes=${elapsedMinutes}`);
    console.log(`[AV-EVENTS] 📊 Final: dailyAverage=${dailyAverage.toFixed(2)}, plannedCount=${plannedCount}, actualCount=${actualCount}`);
    
    // Divide by elapsed time, not total window duration
    const dailyAverage = elapsedMinutes > 0 ? weightedSum / elapsedMinutes : 0;
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const totalAircraft = Math.max(...events.map(e => e.totalAircraft));
    const plannedCount = firstEvent.availableCount;
    const actualCount = lastEvent.availableCount;
    const availabilityPct = totalAircraft > 0 ? (dailyAverage / totalAircraft) * 100 : 0;
    
    console.log(`[AV-EVENTS] 📊 Daily summary: dailyAverage=${dailyAverage.toFixed(2)}, plannedCount=${plannedCount}, actualCount=${actualCount}`);
    
    // Upsert to AircraftAvailabilityHistory
    const existingRecord = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1 LIMIT 1`,
      date
    );
    
    if (existingRecord.length > 0) {
      // Format effective end time as HH:MM
      const effectiveEndTimeStr = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(effectiveEndMin % 60).padStart(2, '0')}`;
      
      await db.$executeRawUnsafe(
        `UPDATE "AircraftAvailabilityHistory" SET 
         "dailyAverage" = $2, "plannedCount" = $3, "actualCount" = $4, "totalAircraft" = $5,
         "availabilityPct" = $6, "flyingWindowStart" = $7, "flyingWindowEnd" = $8,
         "recordedBy" = $9, "effectiveEndTime" = $10, "lastCalculatedAt" = NOW(), "updatedAt" = NOW()
         WHERE "date" = $1`,
        date, dailyAverage, plannedCount, actualCount, totalAircraft, availabilityPct,
        flyingWindowStart || null, flyingWindowEnd || null, recordedBy || null, effectiveEndTimeStr
      );
      console.log(`[AV-EVENTS] ✅ Updated history for ${date}`);
    } else {
      const historyId = require('crypto').randomUUID();
      // Format effective end time as HH:MM
      const effectiveEndTimeStr = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(effectiveEndMin % 60).padStart(2, '0')}`;
      
      await db.$executeRawUnsafe(
        `INSERT INTO "AircraftAvailabilityHistory" 
         ("id", "date", "dailyAverage", "plannedCount", "actualCount", "totalAircraft", "availabilityPct", "flyingWindowStart", "flyingWindowEnd", "recordedBy", "effectiveEndTime", "lastCalculatedAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())`,
        historyId, date, dailyAverage, plannedCount, actualCount, totalAircraft, availabilityPct,
        flyingWindowStart || null, flyingWindowEnd || null, recordedBy || null, effectiveEndTimeStr
      );
      console.log(`[AV-EVENTS] ✅ Inserted history for ${date}`);
    }
    
    // Format effective end time for return value
    const effectiveEndTimeStr = `${String(Math.floor(effectiveEndMin / 60)).padStart(2, '0')}:${String(effectiveEndMin % 60).padStart(2, '0')}`;
    return { 
      date, 
      dailyAverage, 
      plannedCount, 
      actualCount, 
      totalAircraft, 
      availabilityPct,
      flyingWindowStart,
      flyingWindowEnd,
      effectiveEndTime: effectiveEndTimeStr
    };
  } catch (err) {
    console.error(`[AV-EVENTS] ❌ Failed to recalculate summary:`, err);
    // Throw the error so caller can see it
    throw err;
  }
}

// ============================================================
// AIRCRAFT AVAILABILITY DEBUG API
// ============================================================

// GET /api/aircraft-availability-debug - Diagnostic endpoint
app.get('/api/aircraft-availability-debug', async (req, res) => {
  const requestId = `debug_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-DEBUG] 🔍 Diagnostic request ${requestId}`);
  
  const results = {
    requestId,
    timestamp: new Date().toISOString(),
    checks: {},
    errors: []
  };
  
  try {
    const db = await getPrisma();
    
    // Check database URL
    results.checks.databaseUrl = {
      configured: !!process.env.DATABASE_URL,
      prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'not set'
    };
    
    // Ensure tables exist
    await ensureAircraftAvailabilityTable(db);
    await ensureAircraftAvailabilityEventTable(db);
    
    // Count events
    try {
      const eventCount = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "AircraftAvailabilityEvent"`);
      results.checks.eventTable = { accessible: true, count: eventCount[0].count };
    } catch (e) {
      results.checks.eventTable = { accessible: false };
      results.errors.push({ check: 'eventTable', error: e.message });
    }
    
    // Count history
    try {
      const historyCount = await db.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "AircraftAvailabilityHistory"`);
      results.checks.historyTable = { accessible: true, count: historyCount[0].count };
    } catch (e) {
      results.checks.historyTable = { accessible: false };
      results.errors.push({ check: 'historyTable', error: e.message });
    }
    
    // Latest event
    try {
      const latestEvent = await db.$queryRawUnsafe(`SELECT * FROM "AircraftAvailabilityEvent" ORDER BY "createdAt" DESC LIMIT 1`);
      results.checks.latestEvent = latestEvent.length > 0 ? {
        exists: true,
        id: latestEvent[0].id,
        date: latestEvent[0].date,
        availableCount: latestEvent[0].availableCount,
        changeType: latestEvent[0].changeType
      } : { exists: false };
    } catch (e) {
      results.errors.push({ check: 'latestEvent', error: e.message });
    }
    
    // Latest history
    try {
      const latestHistory = await db.$queryRawUnsafe(`SELECT * FROM "AircraftAvailabilityHistory" ORDER BY "createdAt" DESC LIMIT 1`);
      results.checks.latestHistory = latestHistory.length > 0 ? {
        exists: true,
        id: latestHistory[0].id,
        date: latestHistory[0].date,
        dailyAverage: latestHistory[0].dailyAverage
      } : { exists: false };
    } catch (e) {
      results.errors.push({ check: 'latestHistory', error: e.message });
    }
    
    // Test write
    try {
      const testDate = `TEST-${Date.now()}`;
      const testId = require('crypto').randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
         VALUES ($1, NOW(), $2, 999, 999, 'debug_test', 'debug', 'test', NOW())`,
        testId, testDate
      );
      await db.$executeRawUnsafe(`DELETE FROM "AircraftAvailabilityEvent" WHERE "id" = $1`, testId);
      results.checks.writeTest = { success: true };
    } catch (e) {
      results.checks.writeTest = { success: false };
      results.errors.push({ check: 'writeTest', error: e.message });
    }
    
    console.log(`[AV-DEBUG] ✅ Diagnostic complete ${requestId}`);
    console.log(`${'='.repeat(80)}\n`);
    
    res.json(results);
  } catch (error) {
    console.error(`[AV-DEBUG] ❌ Error:`, error);
    results.errors.push({ check: 'general', error: error.message });
    res.status(500).json(results);
  }
});

// POST /api/aircraft-availability-debug - Force insert test record
app.post('/api/aircraft-availability-debug', async (req, res) => {
  const requestId = `debug_post_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-DEBUG] 🧪 Force insert test ${requestId}`);
  
  try {
    const db = await getPrisma();
    await ensureAircraftAvailabilityEventTable(db);
    await ensureAircraftAvailabilityTable(db);
    
    const testDate = req.body.date || new Date().toISOString().split('T')[0];
    const availableCount = req.body.availableCount || 15;
    const flyingWindowStart = req.body.flyingWindowStart || '0800';
    const flyingWindowEnd = req.body.flyingWindowEnd || '1700';
    
    // Insert event
    const eventId = require('crypto').randomUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
       VALUES ($1, NOW(), $2, $3, $4, 'debug_force_insert', 'debug_endpoint', 'Force insert test', NOW())`,
      eventId, testDate, availableCount, availableCount
    );
    
    console.log(`[AV-DEBUG] ✅ Event inserted: ${eventId}`);
    
    // Recalculate summary using the proper function (this handles events before window start)
    const summary = await recalculateDailySummary(db, testDate, flyingWindowStart, flyingWindowEnd, 'debug_endpoint');
    
    console.log(`[AV-DEBUG] ✅ Summary calculated:`, summary);
    console.log(`${'='.repeat(80)}\n`);
    
    res.json({
      success: true,
      requestId,
      event: { id: eventId, date: testDate, availableCount },
      summary
    });
  } catch (error) {
    console.error(`[AV-DEBUG] ❌ Force insert failed:`, error);
    res.status(500).json({ success: false, requestId, error: error.message });
  }
});

// POST /api/aircraft-availability-recalculate - Recalculate summary for a date
app.post('/api/aircraft-availability-recalculate', async (req, res) => {
  const requestId = `recalc_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-RECALC] 🔄 Recalculate summary ${requestId}`);
  
  try {
    const db = await getPrisma();
    await ensureAircraftAvailabilityEventTable(db);
    await ensureAircraftAvailabilityTable(db);
    
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const flyingWindowStart = req.body.flyingWindowStart || '0800';
    const flyingWindowEnd = req.body.flyingWindowEnd || '1700';
    const clientLocalHour = req.body.clientLocalHour;
    const clientLocalMinute = req.body.clientLocalMinute;
    const clientCurrentTimeMinutes = (clientLocalHour !== undefined && clientLocalMinute !== undefined)
      ? clientLocalHour * 60 + clientLocalMinute
      : null;
    
    console.log(`[AV-RECALC] 📅 Date: ${date}, Window: ${flyingWindowStart}-${flyingWindowEnd}, ClientTime: ${clientLocalHour}:${clientLocalMinute}`);
    
    // Get events with details
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" ASC`,
      date
    );
    console.log(`[AV-RECALC] 📊 Events for ${date}: ${events.length}`);
    
    // Parse window times
    const parseWindowTime = (s, defaultHour) => {
      if (!s) return defaultHour * 60;
      const clean = String(s).replace(':', '');
      const h = parseInt(clean.slice(0, -2), 10) || defaultHour;
      const m = parseInt(clean.slice(-2), 10) || 0;
      return h * 60 + m;
    };
    
    const windowStartMin = parseWindowTime(flyingWindowStart, 8);
    const windowEndMin = parseWindowTime(flyingWindowEnd, 17);
    
    // Convert timestamp to minutes
    const toMinutes = (ts) => {
      const d = new Date(ts);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };
    
    // Categorize events
    const eventsBeforeWindow = events.filter(e => toMinutes(e.timestamp) < windowStartMin);
    const eventsInWindow = events.filter(e => {
      const m = toMinutes(e.timestamp);
      return m >= windowStartMin && m < windowEndMin;
    });
    const eventsAfterWindow = events.filter(e => toMinutes(e.timestamp) >= windowEndMin);
    
    console.log(`[AV-RECALC] 📊 Events before window: ${eventsBeforeWindow.length}`);
    console.log(`[AV-RECALC] 📊 Events in window: ${eventsInWindow.length}`);
    console.log(`[AV-RECALC] 📊 Events after window: ${eventsAfterWindow.length}`);
    
    // Recalculate summary with detailed error capture
    let summary = null;
    let summaryError = null;
    
    try {
      summary = await recalculateDailySummary(db, date, flyingWindowStart, flyingWindowEnd, 'recalc_endpoint', clientCurrentTimeMinutes);
    } catch (err) {
      summaryError = {
        message: err.message,
        stack: err.stack,
        name: err.name
      };
      console.error(`[AV-RECALC] ❌ Summary calculation error:`, err);
    }
    
    if (summary) {
      console.log(`[AV-RECALC] ✅ Summary calculated:`, summary);
    } else {
      console.log(`[AV-RECALC] ⚠️ No summary generated`);
    }
    
    console.log(`${'='.repeat(80)}\n`);
    
    res.json({
      success: true,
      requestId,
      date,
      flyingWindow: { start: flyingWindowStart, end: flyingWindowEnd, startMin: windowStartMin, endMin: windowEndMin },
      events: {
        total: events.length,
        beforeWindow: eventsBeforeWindow.length,
        inWindow: eventsInWindow.length,
        afterWindow: eventsAfterWindow.length
      },
      summary,
      summaryError
    });
  } catch (error) {
    console.error(`[AV-RECALC] ❌ Recalculate failed:`, error);
    res.status(500).json({ success: false, requestId, error: error.message, stack: error.stack });
  }
});

// GET /api/aircraft-availability-current - Get the current aircraft availability
// Returns the most recent availability from the events table
app.get('/api/aircraft-availability-current', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureAircraftAvailabilityEventTable(db);
    
    // Get the most recent event (any date, ordered by timestamp desc)
    const latestEvent = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" ORDER BY "timestamp" DESC LIMIT 1`
    );
    
    if (latestEvent.length > 0) {
      res.json({
        success: true,
        availableCount: latestEvent[0].availableCount,
        totalAircraft: latestEvent[0].totalAircraft,
        timestamp: latestEvent[0].timestamp,
        date: latestEvent[0].date
      });
    } else {
      // No events yet, return default
      res.json({
        success: true,
        availableCount: 15,
        totalAircraft: 15,
        timestamp: null,
        date: null,
        isDefault: true
      });
    }
  } catch (error) {
    console.error('[AV-CURRENT] ❌ Error getting current availability:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback: serve index-v2.html for all non-API routes
app.get('*', (req, res) => {
  const indexPath = path.join(staticPath, 'index-v2.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DFP-NEO V2 Server running on port ${PORT}`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
});