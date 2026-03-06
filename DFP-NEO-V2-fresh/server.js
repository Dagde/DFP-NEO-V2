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
  }
  return prisma;
}

// Create AircraftAvailabilityHistory table if it doesn't exist
async function ensureAircraftAvailabilityTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityHistory" (
        "id"              TEXT NOT NULL,
        "date"            TEXT NOT NULL,
        "dailyAverage"    DOUBLE PRECISION NOT NULL,
        "plannedCount"    INTEGER NOT NULL,
        "actualCount"     INTEGER,
        "totalAircraft"   INTEGER NOT NULL,
        "availabilityPct" DOUBLE PRECISION NOT NULL,
        "recordedBy"      TEXT,
        "notes"           TEXT,
        "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    console.log('✅ AircraftAvailabilityHistory table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityHistory table:', err.message);
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