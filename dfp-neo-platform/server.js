import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_VERSION = '2026-04-28-v1'; // fix UUID generation + missing routes
const DEFAULT_ALLOWED_ORIGINS = [];
const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

app.set('trust proxy', true);

function parseOrigins(value) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const configured = parseOrigins(process.env.DFP_NEO_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS);
  const origins = configured.length > 0 ? [...configured] : [...DEFAULT_ALLOWED_ORIGINS];
  if (process.env.NODE_ENV !== 'production') {
    origins.push(...DEVELOPMENT_ALLOWED_ORIGINS);
  }
  return new Set(origins);
}

function getRequestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function isOriginAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === getRequestOrigin(req)) return true;
  return getAllowedOrigins().has(origin);
}

function isExplicitlyEnabled(value) {
  return value === 'true';
}

function getSuppliedSecret(req, headerName, queryName) {
  return req.get(headerName) || req.query?.[queryName] || '';
}

function secretsMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(String(expected));
  const suppliedBuffer = Buffer.from(String(supplied));
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function rejectAvailabilityDebugRequest(req, res) {
  if (process.env.NODE_ENV === 'production' && !isExplicitlyEnabled(process.env.DFP_ENABLE_DEBUG_ROUTES)) {
    res.status(404).json({ error: 'Not found' });
    return true;
  }

  const debugSecret = process.env.DFP_DEBUG_ROUTE_SECRET?.trim() || '';
  if (process.env.NODE_ENV === 'production' && !debugSecret) {
    res.status(503).json({ error: 'Debug route secret is not configured' });
    return true;
  }

  if (debugSecret) {
    const suppliedSecret = getSuppliedSecret(req, 'x-dfp-debug-secret', 'debugSecret');
    if (!secretsMatch(debugSecret, suppliedSecret)) {
      res.status(403).json({ error: 'Debug route secret is required' });
      return true;
    }
  }

  return false;
}

function isAdminSetupEnabled() {
  return isExplicitlyEnabled(process.env.DFP_ENABLE_ADMIN_SETUP);
}

function rejectAdminSetupRequest(req, res) {
  if (!isAdminSetupEnabled()) {
    res.status(404).json({ error: 'Admin setup is not enabled for this deployment' });
    return true;
  }

  const setupSecret = process.env.DFP_ADMIN_SETUP_SECRET?.trim() || '';
  if (!setupSecret) {
    res.status(503).json({ error: 'Admin setup secret is not configured' });
    return true;
  }

  const suppliedSecret = getSuppliedSecret(req, 'x-dfp-admin-setup-secret', 'setupSecret');
  if (!secretsMatch(setupSecret, suppliedSecret)) {
    res.status(403).json({ error: 'Admin setup secret is required' });
    return true;
  }

  return false;
}

// Robust UUID generator - works on all Node versions
import crypto from 'crypto';
function generateUUID() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4 via randomBytes
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits
  return [
    bytes.slice(0, 4).toString('hex'),
    bytes.slice(4, 6).toString('hex'),
    bytes.slice(6, 8).toString('hex'),
    bytes.slice(8, 10).toString('hex'),
    bytes.slice(10, 16).toString('hex')
  ].join('-');
}

// Parse JSON bodies
app.use(express.json());

// CORS headers for all requests. Never use a wildcard origin; browser callers
// must be same-origin or listed in DFP_NEO_ALLOWED_ORIGINS / ALLOWED_ORIGINS.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(req)) {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }

  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, Cookie, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
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
    // Ensure CancellationCode table exists; starter codes are opt-in for commercial deployments.
    await ensureCancellationCodesTable(prisma);
    await seedCancellationCodesIfEmpty(prisma);
    // Ensure SystemConfig table exists and seed defaults
    await ensureSystemConfigTable(prisma);
    await seedDefaultConfigIfEmpty(prisma);
    // Migrate old history records to use correct fleet size
    await migrateFleetSizeInHistory(prisma);
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
        "eventCode"      TEXT DEFAULT '',
        "flightType"     TEXT NOT NULL DEFAULT 'Dual',
        "currency"       TEXT NOT NULL DEFAULT '',
        "currencyExpire" TEXT NOT NULL DEFAULT '',
        "priority"       TEXT NOT NULL DEFAULT 'Medium',
        "notes"          TEXT,
        "dateRequested"  TEXT,
        "requestedTime"  TEXT,
        "dayNight"       TEXT DEFAULT 'Day',
        "submitted"      BOOLEAN NOT NULL DEFAULT false,
        "includeInBuild" BOOLEAN NOT NULL DEFAULT false,
        "aircraftConfigId" TEXT DEFAULT 'CONFIG-0',
        "acceptableAircraftConfigs" JSONB DEFAULT '[]'::jsonb,
        "crewMember"     TEXT DEFAULT '',
        "crewGroup"      TEXT DEFAULT '',
        "crewGroupKey"   TEXT DEFAULT '',
        "crewUnitCode"   TEXT DEFAULT '',
        "crewDisplayLabel" TEXT DEFAULT '',
        "crewIndividual" TEXT DEFAULT '',
        "aircraftCount"  INTEGER NOT NULL DEFAULT 1,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SctRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "SctRequest"
      ADD COLUMN IF NOT EXISTS "aircraftConfigId" TEXT DEFAULT 'CONFIG-0';
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "SctRequest"
      ADD COLUMN IF NOT EXISTS "dayNight" TEXT DEFAULT 'Day',
      ADD COLUMN IF NOT EXISTS "acceptableAircraftConfigs" JSONB DEFAULT '[]'::jsonb;
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE "SctRequest"
      ADD COLUMN IF NOT EXISTS "eventCode" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewMember" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewGroup" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewGroupKey" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewUnitCode" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewDisplayLabel" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "crewIndividual" TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS "aircraftCount" INTEGER NOT NULL DEFAULT 1;
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

    // Auto-link to existing User by Personnel ID
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

    const preferences = {
      ...(body.preferences && typeof body.preferences === 'object' && !Array.isArray(body.preferences) ? body.preferences : {}),
      ...(body.callsign !== undefined ? { callsign: body.callsign || null } : {}),
      ...(body.secondaryCallsign !== undefined ? { secondaryCallsign: body.secondaryCallsign || null } : {}),
      ...(body.crew !== undefined ? { crew: body.crew || null } : {}),
    };

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
        preferences,
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

// POST /api/scores - create a single score record
app.post('/api/scores', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId, traineeFullName, event, score, date, instructor, notes, details } = req.body;

    let resolvedTraineeId = traineeId;
    if (!resolvedTraineeId && traineeFullName) {
      const trainee = await db.trainee.findFirst({ where: { fullName: traineeFullName } });
      if (!trainee) return res.status(404).json({ error: `Trainee not found: ${traineeFullName}` });
      resolvedTraineeId = trainee.id;
    }
    if (!resolvedTraineeId) return res.status(400).json({ error: 'traineeId or traineeFullName required' });
    if (!event) return res.status(400).json({ error: 'event is required' });
    if (score === undefined || score === null) return res.status(400).json({ error: 'score is required' });

    const scoreRecord = await db.score.create({
      data: {
        traineeId: resolvedTraineeId,
        event,
        score: parseInt(score),
        date: date ? new Date(date) : new Date(),
        instructor: instructor || 'DCO',
        notes: notes || '',
        details: details || null,
      },
    });
    res.json({ success: true, score: scoreRecord });
  } catch (error) {
    console.error('❌ POST /api/scores error:', error);
    res.status(500).json({ error: 'Failed to create score', details: error.message });
  }
});

// POST /api/scores/bulk - create multiple score records at once
app.post('/api/scores/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { scores } = req.body;
    if (!scores || !Array.isArray(scores)) return res.status(400).json({ error: 'scores array required' });

    const results = { created: 0, errors: [] };

    for (const s of scores) {
      try {
        let resolvedTraineeId = s.traineeId;
        if (!resolvedTraineeId && s.traineeFullName) {
          const trainee = await db.trainee.findFirst({ where: { fullName: s.traineeFullName } });
          if (!trainee) {
            results.errors.push(`Trainee not found: ${s.traineeFullName}`);
            continue;
          }
          resolvedTraineeId = trainee.id;
        }
        if (!resolvedTraineeId) { results.errors.push('Missing traineeId/traineeFullName'); continue; }

        await db.score.create({
          data: {
            traineeId: resolvedTraineeId,
            event: s.event,
            score: parseInt(s.score),
            date: s.date ? new Date(s.date) : new Date(),
            instructor: s.instructor || 'DCO',
            notes: s.notes || '',
            details: s.details || null,
          },
        });
        results.created++;
      } catch (err) {
        results.errors.push(`${s.traineeFullName}/${s.event}: ${err.message}`);
      }
    }

    res.json({ success: true, ...results });
  } catch (error) {
    console.error('❌ POST /api/scores/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk create scores', details: error.message });
  }
});

// DELETE /api/scores/trainee/:traineeId - delete all FIC scores for a trainee
app.delete('/api/scores/trainee/:traineeId', async (req, res) => {
  try {
    const db = await getPrisma();
    const { traineeId } = req.params;
    const { eventPrefix } = req.query;

    const where = { traineeId };
    if (eventPrefix) {
      where.event = { startsWith: eventPrefix };
    }

    const result = await db.score.deleteMany({ where });
    res.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error('❌ DELETE /api/scores/trainee error:', error);
    res.status(500).json({ error: 'Failed to delete scores', details: error.message });
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
// GET /api/users-with-personnel - Check user-personnel linking status
app.get('/api/users-with-personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { search } = req.query;
    
    // Build where clause for user search
    const userWhere = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get all users with their linked personnel
    const users = await db.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        userId: true,
        personnel: {
          select: {
            id: true,
            name: true,
            idNumber: true,
            rank: true,
            role: true,
            unit: true,
            flight: true
          }
        }
      },
      orderBy: { username: 'asc' }
    });
    
    // Get all personnel records (to see which have users linked)
    const parsedId = search ? parseInt(search) : NaN;
    const personnelWhere = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        ...(!isNaN(parsedId) ? [{ idNumber: { equals: parsedId } }] : [])
      ]
    } : {};
    
    const allPersonnel = await db.personnel.findMany({
      where: personnelWhere,
      select: {
        id: true,
        name: true,
        idNumber: true,
        rank: true,
        role: true,
        unit: true,
        flight: true,
        userId: true
      },
      orderBy: { name: 'asc' }
    });
    
    // Personnel not linked to any user
    const unlinkedPersonnel = allPersonnel.filter(p => !p.userId);
    
    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        userId: u.userId,
        linkedPersonnel: u.personnel ? {
          id: u.personnel.id,
          name: u.personnel.name,
          idNumber: u.personnel.idNumber,
          rank: u.personnel.rank,
          role: u.personnel.role,
          unit: u.personnel.unit,
          flight: u.personnel.flight
        } : null
      })),
      unlinkedPersonnel: unlinkedPersonnel.map(p => ({
        id: p.id,
        name: p.name,
        idNumber: p.idNumber,
        rank: p.rank,
        role: p.role,
        unit: p.unit,
        flight: p.flight
      })),
      summary: {
        totalUsers: users.length,
        usersWithPersonnel: users.filter(u => u.personnel).length,
        usersWithoutPersonnel: users.filter(u => !u.personnel).length,
        totalPersonnel: allPersonnel.length,
        unlinkedPersonnelCount: unlinkedPersonnel.length
      }
    });
  } catch (error) {
    console.error('Error fetching users with personnel:', error);
    res.status(500).json({ error: 'Failed to fetch users with personnel', details: error.message });
  }
});

// POST /api/cleanup-duplicate-personnel - Remove specific duplicate personnel records
// This endpoint safely deletes only the confirmed duplicate Burns records
app.post('/api/cleanup-duplicate-personnel', async (req, res) => {
  try {
    const db = await getPrisma();
    const { confirmToken } = req.body;

    // Safety check - require a confirmation token
    if (confirmToken !== 'CONFIRM_DELETE_BURNS_DUPLICATES') {
      return res.status(400).json({ error: 'Invalid confirmation token. Send { confirmToken: "CONFIRM_DELETE_BURNS_DUPLICATES" }' });
    }

    // These are the confirmed duplicate Personnel IDs to delete
    // Keeping: cmkivhycv0001k30fbih64ptl (FLTLT, linked to active user cmkdynoqv0000o30fwtqqwkzw)
    const personnelToDelete = [
      'cmkdj92gx0001p10ffa85av90',  // FLTLT, no user
      'cmkdj9co60003p10flx1glphw',  // SQNLDR, no user
      'cmkdhs9cv0003pn0frh9ql1yj',  // FLTLT, no user
      'cmkdhghjs0001pn0fwek3zkx2',  // SQNLDR, no user
      'cmkdkjq610001mq0f5v72mj56',  // SQNLDR, linked to duplicate user cmk3m3d8w0000kymjmsdlxsy9
    ];

    // The duplicate User account linked to the SQNLDR personnel record
    const duplicateUserId = 'cmk3m3d8w0000kymjmsdlxsy9';

    const results = [];

    // First unlink the SQNLDR personnel from its user (set userId to null) before deleting
    await db.personnel.update({
      where: { id: 'cmkdkjq610001mq0f5v72mj56' },
      data: { userId: null }
    });
    results.push('Unlinked SQNLDR personnel from duplicate user account');

    // Delete the 5 duplicate personnel records
    for (const id of personnelToDelete) {
      try {
        await db.personnel.delete({ where: { id } });
        results.push(`Deleted personnel: ${id}`);
      } catch (e) {
        results.push(`Failed to delete personnel ${id}: ${e.message}`);
      }
    }

    // Delete the duplicate SQNLDR User account
    try {
      await db.user.delete({ where: { id: duplicateUserId } });
      results.push(`Deleted duplicate user account: ${duplicateUserId}`);
    } catch (e) {
      results.push(`Failed to delete duplicate user ${duplicateUserId}: ${e.message}`);
    }

    // Verify the cleanup
    const remaining = await db.personnel.findMany({
      where: { name: { contains: 'Burns', mode: 'insensitive' } },
      select: { id: true, name: true, rank: true, userId: true }
    });

    const remainingUsers = await db.user.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Burns', mode: 'insensitive' } },
          { lastName: { contains: 'Burns', mode: 'insensitive' } },
          { username: { contains: 'burns', mode: 'insensitive' } }
        ]
      },
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });

    console.log('✅ Cleanup complete:', results);
    res.json({
      success: true,
      actions: results,
      remainingPersonnel: remaining,
      remainingUsers: remainingUsers
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Version endpoint - returns the actual running commit SHA from Railway's env var at runtime
// This is the definitive source of truth for which commit is active in the deployed app
app.get('/api/version', (req, res) => {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || 'unknown';
  const shortHash = commitSha !== 'unknown' ? commitSha.substring(0, 8) : 'unknown';
  res.json({
    commit: shortHash,
    commitFull: commitSha,
    timestamp: new Date().toISOString(),
  });
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

    // Sort courses by code numerically (FIC210 before FIC211)
    courses.sort((a, b) => {
      const aCode = a.code || a.name;
      const bCode = b.code || b.name;
      
      // Extract numeric part from course codes (e.g., "FIC210" -> 210)
      const aNum = parseInt(aCode.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(bCode.replace(/\D/g, ''), 10) || 0;
      
      // If both have numeric parts, sort by them
      if (aNum && bNum) {
        return aNum - bNum;
      }
      
      // Otherwise, fall back to alphabetical sort
      return aCode.localeCompare(bCode);
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

// DELETE /api/courses/:name - Delete a course by name
app.delete('/api/courses/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    console.log(`📡 DELETE /api/courses/${name} called`);
    const db = await getPrisma();
    const existing = await db.course.findFirst({ where: { name } });
    if (!existing) {
      console.log(`⚠️ DELETE /api/courses - course not found: ${name}`);
      return res.json({ success: true, message: 'Course not found (already deleted)' });
    }
    await db.course.delete({ where: { id: existing.id } });
    console.log(`✅ DELETE /api/courses - deleted course: ${name}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/courses error:', error);
    res.status(500).json({ error: 'Failed to delete course', details: error.message });
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
const staticPath = path.join(__dirname, 'public/flight-school-app');
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
    const { id, userId, requestType, name, event, eventCode, flightType, currency, currencyExpire, priority, notes, dateRequested, requestedTime, dayNight, aircraftConfigId, acceptableAircraftConfigs, crewMember, crewGroup, crewGroupKey, crewUnitCode, crewDisplayLabel, crewIndividual, aircraftCount } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const newId = id || generateUUID();
    const acceptableConfigJson = JSON.stringify(Array.isArray(acceptableAircraftConfigs) ? acceptableAircraftConfigs : []);
    await db.$executeRawUnsafe(
      `INSERT INTO "SctRequest" ("id","userId","requestType","name","event","eventCode","flightType","currency","currencyExpire","priority","notes","dateRequested","requestedTime","dayNight","submitted","includeInBuild","aircraftConfigId","acceptableAircraftConfigs","crewMember","crewGroup","crewGroupKey","crewUnitCode","crewDisplayLabel","crewIndividual","aircraftCount","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,NOW(),NOW())`,
      newId,
      String(userId),
      requestType || 'flight',
      name || '',
      event || '',
      eventCode || '',
      flightType || 'Dual',
      currency || '',
      currencyExpire || '',
      priority || 'Medium',
      notes || null,
      dateRequested ?? new Date().toISOString().split('T')[0],
      requestedTime || '15:00',
      dayNight || 'Day',
      false,
      false,
      aircraftConfigId || 'CONFIG-0',
      acceptableConfigJson,
      crewMember || '',
      crewGroup || '',
      crewGroupKey || '',
      crewUnitCode || '',
      crewDisplayLabel || '',
      crewIndividual || '',
      Math.max(1, Math.min(24, Math.floor(Number(aircraftCount) || 1)))
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
    if (Array.isArray(updates.acceptableAircraftConfigs)) {
      updates.acceptableAircraftConfigs = JSON.stringify(updates.acceptableAircraftConfigs);
    }
    // Build dynamic SET clause
    const fields = Object.keys(updates);
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const setClauses = fields.map((f, i) => f === 'acceptableAircraftConfigs' ? `"${f}" = $${i + 2}::jsonb` : `"${f}" = $${i + 2}`).join(', ');
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
    await ensureSystemConfigTable(db); // Ensure config table exists

    const { timestamp, date, availableCount, totalAircraft, changeType, recordedBy, notes, flyingWindowStart, flyingWindowEnd, clientLocalHour, clientLocalMinute } = req.body;

    // Get the configured fleet size from database (ignore client's totalAircraft - it was buggy)
    const configuredFleetSize = await getFleetSize(db);

    console.log(`[AV-EVENTS] 📋 Parsed body:`, { timestamp, date, availableCount, totalAircraft, changeType, recordedBy, clientLocalHour, clientLocalMinute });
    console.log(`[AV-EVENTS] ✈️ Using configured fleet size: ${configuredFleetSize} (client sent: ${totalAircraft})`);

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
    // Use the `date` from request body (client's local date) rather than server UTC date
    // This prevents incorrect isToday=false when server UTC is still the previous day
    // (e.g., Australia UTC+10: local 10:57 AM = UTC 00:57 AM = still yesterday in UTC)
    const isAfterWindow = eventMin >= windowEndMin;
    // isToday: the event date matches today's local date (sent by client using local time methods)
    // We trust the client's date since it was constructed using local getFullYear/getMonth/getDate
    const isToday = true; // The date field IS today's local date, sent by client
    
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
      const eventId = generateUUID();
      
      await db.$executeRawUnsafe(
        `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        eventId,
        eventTimestamp,
        date,
        parseInt(availableCount),
        configuredFleetSize,
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
    const eventId = generateUUID();
    
    await db.$executeRawUnsafe(
      `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      eventId,
      eventTimestamp,
      date,
      parseInt(availableCount),
      configuredFleetSize,
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
    
    res.json({ success: true, event: { id: eventId, timestamp: eventTimestamp, date, availableCount, totalAircraft: configuredFleetSize, changeType }, summary, requestId });
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
    // Timestamps are stored in UTC, but flying window times (08:00-17:00) are in the client's local timezone.
    // We must apply the client's timezone offset to convert UTC timestamps to local time.
    //
    // Strategy: If clientCurrentTimeMinutes is provided, calculate the offset as:
    //   offset = clientCurrentTimeMinutes - currentUTCMinutes
    // Then apply this offset to every event timestamp.
    // If clientCurrentTimeMinutes is NOT provided, fall back to UTC (no conversion).
    
    let timezoneOffsetMinutes = 0;
    if (clientCurrentTimeMinutes !== null) {
      const now = new Date();
      const serverUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      // offset = local - UTC (e.g. UTC+10 gives offset = +600 minutes)
      timezoneOffsetMinutes = clientCurrentTimeMinutes - serverUTCMinutes;
      // Normalize to [-720, 840] range to handle midnight crossings
      if (timezoneOffsetMinutes > 840) timezoneOffsetMinutes -= 1440;
      if (timezoneOffsetMinutes < -720) timezoneOffsetMinutes += 1440;
      console.log(`[AV-EVENTS] 🌏 Timezone: clientTime=${clientCurrentTimeMinutes}min, serverUTC=${serverUTCMinutes}min, offset=${timezoneOffsetMinutes}min (${(timezoneOffsetMinutes/60).toFixed(1)}hrs)`);
    }
    
    const toMinutes = (ts) => {
      const d = new Date(ts);
      // Get UTC minutes-since-midnight, then apply client timezone offset
      const utcMinutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
      let localMinutes = utcMinutes + timezoneOffsetMinutes;
      // Normalize to [0, 1440) range
      if (localMinutes < 0) localMinutes += 1440;
      if (localMinutes >= 1440) localMinutes -= 1440;
      return localMinutes;
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
    
    // Divide by elapsed time, not total window duration
    const dailyAverage = elapsedMinutes > 0 ? weightedSum / elapsedMinutes : 0;
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    // Always use configured fleet size from database (not stored event values which may be stale/incorrect)
    const totalAircraft = await getFleetSize(db);
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
      const historyId = generateUUID();
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
  if (rejectAvailabilityDebugRequest(req, res)) return;

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
      const testId = generateUUID();
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
  if (rejectAvailabilityDebugRequest(req, res)) return;

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

    // Get configured fleet size
    await ensureSystemConfigTable(db);
    const configuredFleetSize = await getFleetSize(db);

    // Insert event
    const eventId = generateUUID();
    await db.$executeRawUnsafe(
      `INSERT INTO "AircraftAvailabilityEvent" ("id", "timestamp", "date", "availableCount", "totalAircraft", "changeType", "recordedBy", "notes", "createdAt")
       VALUES ($1, NOW(), $2, $3, $4, 'debug_force_insert', 'debug_endpoint', 'Force insert test', NOW())`,
      eventId, testDate, availableCount, configuredFleetSize
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
    
    // Convert timestamp to minutes in CLIENT's local time
    // Apply timezone offset: offset = clientTime - serverUTC
    let recalcTimezoneOffset = 0;
    if (clientLocalHour !== undefined && clientLocalMinute !== undefined) {
      const now = new Date();
      const serverUTCMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const clientCurrentTimeMinutesLocal = clientLocalHour * 60 + clientLocalMinute;
      recalcTimezoneOffset = clientCurrentTimeMinutesLocal - serverUTCMinutes;
      if (recalcTimezoneOffset > 840) recalcTimezoneOffset -= 1440;
      if (recalcTimezoneOffset < -720) recalcTimezoneOffset += 1440;
      console.log(`[AV-RECALC] Timezone offset: ${recalcTimezoneOffset}min (${(recalcTimezoneOffset/60).toFixed(1)}hrs)`);
    }
    
    const toMinutes = (ts) => {
      const d = new Date(ts);
      const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
      let localMin = utcMin + recalcTimezoneOffset;
      if (localMin < 0) localMin += 1440;
      if (localMin >= 1440) localMin -= 1440;
      return localMin;
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
    
    await ensureSystemConfigTable(db);
    const configuredFleetSize = await getFleetSize(db);

    // Get the most recent event (any date, ordered by timestamp desc)
    const latestEvent = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" ORDER BY "timestamp" DESC LIMIT 1`
    );

    if (latestEvent.length > 0) {
      res.json({
        success: true,
        availableCount: latestEvent[0].availableCount,
        totalAircraft: configuredFleetSize, // Use configured fleet size, not stored value
        timestamp: latestEvent[0].timestamp,
        date: latestEvent[0].date
      });
    } else {
      // No events yet, return default
      res.json({
        success: true,
        availableCount: 15,
        totalAircraft: configuredFleetSize, // Use configured fleet size
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

// ============================================================
// CANCELLATION CODES API
// ============================================================

async function ensureCancellationCodesTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CancellationCode" (
        "code"        TEXT PRIMARY KEY,
        "category"    TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "appliesTo"   TEXT NOT NULL DEFAULT 'Both',
        "isActive"    BOOLEAN NOT NULL DEFAULT true,
        "createdBy"   TEXT,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ CancellationCode table ensured');
  } catch (err) {
    console.error('❌ Error creating CancellationCode table:', err);
  }
}

// ── System Configuration Table ───────────────────────────────────────────────
async function ensureSystemConfigTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemConfig" (
        "key"         VARCHAR(50) PRIMARY KEY,
        "value"       TEXT NOT NULL,
        "description" TEXT,
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedBy"   VARCHAR(50)
      )
    `);
    console.log('✅ SystemConfig table ensured');
  } catch (err) {
    console.error('❌ Error creating SystemConfig table:', err);
  }
}

async function seedDefaultConfigIfEmpty(db) {
  try {
    // Check if fleet_size exists
    const existing = await db.$queryRawUnsafe(
      `SELECT * FROM "SystemConfig" WHERE "key" = 'fleet_size'`
    );
    if (existing.length === 0) {
      await db.$executeRawUnsafe(`
        INSERT INTO "SystemConfig" ("key", "value", "description")
        VALUES ('fleet_size', '24', 'Total number of aircraft in the fleet')
      `);
      console.log('✅ Seeded default fleet_size = 24');
    }
  } catch (err) {
    console.error('❌ Error seeding SystemConfig defaults:', err);
  }
}

async function getFleetSize(db) {
  try {
    const result = await db.$queryRawUnsafe(
      `SELECT "value" FROM "SystemConfig" WHERE "key" = 'fleet_size'`
    );
    if (result.length > 0) {
      return parseInt(result[0].value, 10);
    }
    return 24; // Default fallback
  } catch (err) {
    console.error('❌ Error getting fleet_size:', err);
    return 24;
  }
}

// Migrate old AircraftAvailabilityHistory records that have incorrect totalAircraft values
// (previously stored available aircraft count instead of fleet size)
async function migrateFleetSizeInHistory(db) {
  try {
    const fleetSize = await getFleetSize(db);
    // Update all history records where totalAircraft != configured fleet size
    const result = await db.$executeRawUnsafe(
      `UPDATE "AircraftAvailabilityHistory" SET 
       "totalAircraft" = $1,
       "availabilityPct" = CASE WHEN $1 > 0 THEN ("dailyAverage" / $1) * 100 ELSE "availabilityPct" END,
       "updatedAt" = NOW()
       WHERE "totalAircraft" != $1`,
      fleetSize
    );
    console.log(`✅ Migrated AircraftAvailabilityHistory: updated records to fleet_size=${fleetSize}`);

    // Also fix AircraftAvailabilityEvent records with wrong totalAircraft
    await db.$executeRawUnsafe(
      `UPDATE "AircraftAvailabilityEvent" SET "totalAircraft" = $1 WHERE "totalAircraft" != $1`,
      fleetSize
    );
    console.log(`✅ Migrated AircraftAvailabilityEvent: updated records to fleet_size=${fleetSize}`);
  } catch (err) {
    console.error('❌ Error migrating fleet size in history:', err);
  }
}

// Seed starter codes only when explicitly enabled. Deleted customer codes must stay deleted.
async function seedCancellationCodesIfEmpty(db) {
  const existing = await db.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM "CancellationCode"`);
  const count = parseInt(existing[0].cnt);
  if (count > 0) return;
  if (process.env.DFP_SEED_STARTER_CANCELLATION_CODES !== 'true') {
    console.log('ℹ️  CancellationCode table is empty - setup cancellation code seed disabled');
    return;
  }

  const defaults = [
    { code: 'AD', category: 'Aircraft', description: 'On deployment',           appliesTo: 'Both' },
    { code: 'AT', category: 'Aircraft', description: 'Time constraint',          appliesTo: 'Both' },
    { code: 'AU', category: 'Aircraft', description: 'Unavailable',              appliesTo: 'Both' },
    { code: 'CI', category: 'Crew',     description: 'Instructor',               appliesTo: 'Both' },
    { code: 'CO', category: 'Crew',     description: 'Other crew',               appliesTo: 'Both' },
    { code: 'CP', category: 'Crew',     description: 'Pilot',                    appliesTo: 'Both' },
    { code: 'CS', category: 'Crew',     description: 'Student',                  appliesTo: 'Both' },
    { code: 'PA', category: 'Program',  description: 'Admin',                    appliesTo: 'Both' },
    { code: 'PO', category: 'Program',  description: 'Other program',            appliesTo: 'Both' },
    { code: 'PT', category: 'Program',  description: 'Training requirement',     appliesTo: 'Both' },
    { code: 'WC', category: 'Weather',  description: 'Crosswind',                appliesTo: 'Flight' },
    { code: 'WF', category: 'Weather',  description: 'Fog',                      appliesTo: 'Flight' },
    { code: 'WR', category: 'Weather',  description: 'Rain',                     appliesTo: 'Flight' },
    { code: 'WT', category: 'Weather',  description: 'Thunderstorm',             appliesTo: 'Flight' },
    { code: 'WV', category: 'Weather',  description: 'Visibility',               appliesTo: 'Flight' },
    { code: 'WW', category: 'Weather',  description: 'Wind',                     appliesTo: 'Flight' },
  ];

  for (const c of defaults) {
    await db.$executeRawUnsafe(`
      INSERT INTO "CancellationCode" ("code","category","description","appliesTo","isActive","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,true,NOW(),NOW())
      ON CONFLICT ("code") DO NOTHING
    `, c.code, c.category, c.description, c.appliesTo);
  }
  console.log(`✅ Seeded ${defaults.length} default cancellation codes`);
}

// GET /api/cancellation-codes - Return all codes
app.get('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureCancellationCodesTable(db);
    await seedCancellationCodesIfEmpty(db);
    const codes = await db.$queryRawUnsafe(
      `SELECT * FROM "CancellationCode" ORDER BY "category" ASC, "code" ASC`
    );
    res.json({ success: true, codes });
  } catch (error) {
    console.error('❌ GET /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/cancellation-codes - Create or update a code (upsert)
app.post('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureCancellationCodesTable(db);
    const { code, category, description, appliesTo, isActive, createdBy } = req.body;
    if (!code || !category || !description) {
      return res.status(400).json({ success: false, error: 'code, category, and description are required' });
    }
    await db.$executeRawUnsafe(`
      INSERT INTO "CancellationCode" ("code","category","description","appliesTo","isActive","createdBy","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
      ON CONFLICT ("code") DO UPDATE SET
        "category"    = EXCLUDED."category",
        "description" = EXCLUDED."description",
        "appliesTo"   = EXCLUDED."appliesTo",
        "isActive"    = EXCLUDED."isActive",
        "updatedAt"   = NOW()
    `, code.toUpperCase(), category, description, appliesTo || 'Both', isActive !== false, createdBy || null);

    const rows = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1`, code.toUpperCase());
    res.json({ success: true, code: rows[0] });
  } catch (error) {
    console.error('❌ POST /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/cancellation-codes/:code/toggle - Toggle active status
app.patch('/api/cancellation-codes/:code/toggle', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureCancellationCodesTable(db);
    const { code } = req.params;
    await db.$executeRawUnsafe(`
      UPDATE "CancellationCode" SET "isActive" = NOT "isActive", "updatedAt" = NOW() WHERE "code" = $1
    `, code);
    const rows = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1`, code);
    res.json({ success: true, code: rows[0] });
  } catch (error) {
    console.error('❌ PATCH /api/cancellation-codes toggle error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/cancellation-codes/:code
app.delete('/api/cancellation-codes/:code', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureCancellationCodesTable(db);
    const { code } = req.params;
    await db.$executeRawUnsafe(`DELETE FROM "CancellationCode" WHERE "code" = $1`, code);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── System Configuration Endpoints ───────────────────────────────────────────

// GET /api/system-config - Get all config values
app.get('/api/system-config', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureSystemConfigTable(db);
    const config = await db.$queryRawUnsafe(`SELECT * FROM "SystemConfig"`);
    // Return as key-value object for easy consumption
    const configObj = {};
    config.forEach(row => {
      configObj[row.key] = row.value;
    });
    res.json({ success: true, config: configObj });
  } catch (error) {
    console.error('❌ GET /api/system-config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/system-config/:key - Get a specific config value
app.get('/api/system-config/:key', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureSystemConfigTable(db);
    const { key } = req.params;
    const result = await db.$queryRawUnsafe(
      `SELECT * FROM "SystemConfig" WHERE "key" = $1`,
      key
    );
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Config key not found' });
    }
    res.json({ success: true, key, value: result[0].value, description: result[0].description });
  } catch (error) {
    console.error('❌ GET /api/system-config/:key error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/system-config - Update a config value
app.post('/api/system-config', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureSystemConfigTable(db);
    const { key, value, description, updatedBy } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'Missing key or value' });
    }

    await db.$executeRawUnsafe(`
      INSERT INTO "SystemConfig" ("key", "value", "description", "updatedAt", "updatedBy")
      VALUES ($1, $2, $3, NOW(), $4)
      ON CONFLICT ("key") DO UPDATE SET
        "value" = EXCLUDED.value,
        "description" = COALESCE(EXCLUDED.description, "SystemConfig"."description"),
        "updatedAt" = NOW(),
        "updatedBy" = EXCLUDED.updatedBy
    `, key, String(value), description || null, updatedBy || null);

    res.json({ success: true, key, value });
  } catch (error) {
    console.error('❌ POST /api/system-config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ━━ User Permissions Endpoints ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// PATCH /api/user/permissions - Update user permissions by name
app.patch('/api/user/permissions', async (req, res) => {
  try {
    const db = await getPrisma();
    const { name, permissions, role } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Find the personnel record by name (case-insensitive search)
    const personnel = await db.personnel.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' }
      },
      include: { user: true }
    });

    if (!personnel) {
      return res.status(404).json({ success: false, error: `Personnel not found with name: ${name}` });
    }

    // Update personnel permissions
    if (permissions && Array.isArray(permissions)) {
      await db.personnel.update({
        where: { id: personnel.id },
        data: { permissions }
      });
    }

    // Update user role if provided and user exists
    if (role && personnel.userId) {
      await db.user.update({
        where: { id: personnel.userId },
        data: { role }
      });
    }

    // Return updated record
    const updated = await db.personnel.findFirst({
      where: { id: personnel.id },
      include: { user: true }
    });

    console.log(`✅ PATCH /api/user/permissions - Updated: ${personnel.name}`);
    res.json({
      success: true,
      personnel: {
        id: updated.id,
        name: updated.name,
        rank: updated.rank,
        permissions: updated.permissions
      },
      user: updated.user ? {
        id: updated.user.id,
        username: updated.user.username,
        role: updated.user.role
      } : null
    });
  } catch (error) {
    console.error('❌ PATCH /api/user/permissions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/user/search - Find user by name
app.get('/api/user/search', async (req, res) => {
  try {
    const db = await getPrisma();
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name query parameter is required' });
    }

    const personnel = await db.personnel.findFirst({
      where: {
        name: { contains: name, mode: 'insensitive' }
      },
      include: { user: true }
    });

    if (!personnel) {
      return res.status(404).json({ success: false, error: `Personnel not found with name: ${name}` });
    }

    res.json({
      success: true,
      personnel: {
        id: personnel.id,
        name: personnel.name,
        rank: personnel.rank,
        permissions: personnel.permissions
      },
      user: personnel.user ? {
        id: personnel.user.id,
        username: personnel.user.username,
        role: personnel.user.role
      } : null
    });
  } catch (error) {
    console.error('❌ GET /api/user/search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ━━ Admin Setup Endpoint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/admin/setup - Create or reset admin user
app.post('/api/admin/setup', async (req, res) => {
  try {
    if (rejectAdminSetupRequest(req, res)) return;

    const db = await getPrisma();
    const bcrypt = require('bcryptjs');

    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@dfpneo.com';

    if (!adminPassword) {
      return res.status(503).json({ error: 'Initial admin password is not configured' });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Check if admin user already exists
    const existingAdmin = await db.user.findUnique({ where: { userId: adminUserId } });

    if (existingAdmin) {
      await db.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword, isActive: true },
      });
      return res.json({
        message: 'Admin password reset successfully',
        userId: adminUserId,
        note: 'Initial admin password was read from deployment configuration and is not returned by this endpoint',
      });
    }

    // Create admin user
    await db.user.create({
      data: {
        userId: adminUserId,
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        email: adminEmail,
        password: hashedPassword,
        isActive: true,
        role: 'ADMIN',
      },
    });

    res.json({
      message: 'Admin user created successfully',
      userId: adminUserId,
      note: 'Initial admin password was read from deployment configuration and is not returned by this endpoint',
    });
  } catch (error) {
    console.error('❌ POST /api/admin/setup error:', error);
    res.status(500).json({ error: 'Failed to setup admin user' });
  }
});

// GET /api/admin/setup - Check admin user status
app.get('/api/admin/setup', async (req, res) => {
  try {
    const db = await getPrisma();
    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';

    const admin = await db.user.findUnique({
      where: { userId: adminUserId },
      select: { userId: true, username: true, firstName: true, lastName: true, email: true, isActive: true },
    });

    if (!admin) {
      return res.json({
        exists: false,
        setupEnabled: isAdminSetupEnabled(),
        message: isAdminSetupEnabled()
          ? 'Admin user does not exist. Admin setup requires the deployment setup secret.'
          : 'Admin user does not exist. Admin setup is not enabled for this deployment.',
      });
    }

    res.json({
      exists: true,
      admin,
      setupEnabled: isAdminSetupEnabled(),
      message: isAdminSetupEnabled()
        ? 'Admin user exists. Password reset requires the deployment setup secret.'
        : 'Admin user exists. Admin setup is not enabled for this deployment.',
    });
  } catch (error) {
    console.error('❌ GET /api/admin/setup error:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

// ============================================================
// FLIGHT LOG, EVENT COMPLETIONS, SETTINGS, TRAINEE/PERSONNEL CRUD
// ============================================================

// ── Ensure snapshot columns exist on FlightLogEntry ──────────────────────────
async function ensureFlightLogSnapshotColumns(db) {
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "FlightLogEntry"
        ADD COLUMN IF NOT EXISTS "captainLogSnapshot" JSONB,
        ADD COLUMN IF NOT EXISTS "crewLogSnapshot" JSONB
    `);
  } catch (err) {
    console.log('[FlightLog] snapshot column ensure:', err.message);
  }
}

// Ensure AppSettings table exists
async function ensureAppSettingsTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AppSettings" (
        "id"        TEXT NOT NULL,
        "orgId"     TEXT NOT NULL DEFAULT 'default',
        "data"      JSONB NOT NULL DEFAULT '{}',
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "AppSettings_orgId_key" ON "AppSettings"("orgId")
    `);
  } catch (err) {
    console.log('[Settings] table ensure:', err.message);
  }
}

// ── GET /api/flight-log?scheduleEventId=... ───────────────────────────────────
app.get('/api/flight-log', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    const { scheduleEventId } = req.query;
    if (!scheduleEventId) {
      return res.status(400).json({ error: 'scheduleEventId query param required' });
    }
    const entries = await db.flightLogEntry.findMany({
      where: { scheduleEventId },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`✅ GET /api/flight-log scheduleEventId=${scheduleEventId} → ${entries.length} rows`);
    res.json({ entries });
  } catch (error) {
    console.error('❌ GET /api/flight-log error:', error);
    res.status(500).json({ error: 'Failed to fetch flight log entries', details: error.message });
  }
});

// ── POST /api/flight-log (upsert by scheduleEventId + personRole) ─────────────
app.post('/api/flight-log', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureFlightLogSnapshotColumns(db);
    const body = req.body;
    const {
      scheduleEventId, eventCode, eventDate, eventType,
      traineeId, personnelId, personName, personRole,
      aircraftNumber, fromIcao, toIcao, duty,
      isSolo, isDual, isFlightLog, isFtdLog,
      takeoffTime, landTime, totalTime, captainTime, instructorTime,
      nightTime, ifActualTime, ifSimTime, ineffectiveTime,
      ilsCount, rnpCount, tacanCount, vorCount,
      captainLogSnapshot, crewLogSnapshot,
      recordedBy, notes,
    } = body;

    if (!scheduleEventId || !personRole || !personName) {
      return res.status(400).json({ error: 'scheduleEventId, personName, personRole are required' });
    }

    // Upsert: match on scheduleEventId + personRole (one row per sortie per role)
    const existing = await db.flightLogEntry.findFirst({
      where: { scheduleEventId, personRole },
    });

    const data = {
      scheduleEventId,
      eventCode:      eventCode || scheduleEventId,
      eventDate:      eventDate || new Date().toISOString().slice(0, 10),
      eventType:      eventType || 'flight',
      traineeId:      traineeId  || null,
      personnelId:    personnelId || null,
      personName,
      personRole,
      aircraftNumber: aircraftNumber || null,
      fromIcao:       fromIcao || null,
      toIcao:         toIcao   || null,
      duty:           duty     || null,
      isSolo:         !!isSolo,
      isDual:         !!isDual,
      isFlightLog:    isFlightLog !== undefined ? !!isFlightLog : true,
      isFtdLog:       !!isFtdLog,
      takeoffTime:    takeoffTime || null,
      landTime:       landTime   || null,
      totalTime:      totalTime       != null ? parseFloat(totalTime)       : null,
      captainTime:    captainTime     != null ? parseFloat(captainTime)     : null,
      instructorTime: instructorTime  != null ? parseFloat(instructorTime)  : null,
      nightTime:      nightTime       != null ? parseFloat(nightTime)       : null,
      ifActualTime:   ifActualTime    != null ? parseFloat(ifActualTime)    : null,
      ifSimTime:      ifSimTime       != null ? parseFloat(ifSimTime)       : null,
      ineffectiveTime:ineffectiveTime != null ? parseFloat(ineffectiveTime) : null,
      ilsCount:       parseInt(ilsCount)   || 0,
      rnpCount:       parseInt(rnpCount)   || 0,
      tacanCount:     parseInt(tacanCount) || 0,
      vorCount:       parseInt(vorCount)   || 0,
      captainLogSnapshot: captainLogSnapshot || null,
      crewLogSnapshot:    crewLogSnapshot   || null,
      recordedBy:     recordedBy || null,
      notes:          notes      || null,
    };

    let entry, created;
    if (existing) {
      entry = await db.flightLogEntry.update({
        where: { id: existing.id },
        data,
      });
      created = false;
    } else {
      entry = await db.flightLogEntry.create({ data });
      created = true;
    }

    console.log(`✅ POST /api/flight-log ${created ? 'created' : 'updated'} id=${entry.id} scheduleEventId=${scheduleEventId} role=${personRole}`);
    res.json({ success: true, entry, created });
  } catch (error) {
    console.error('❌ POST /api/flight-log error:', error);
    res.status(500).json({ error: 'Failed to save flight log entry', details: error.message });
  }
});

// ── GET /api/event-completions?scheduleEventId=... ────────────────────────────
app.get('/api/event-completions', async (req, res) => {
  try {
    const db = await getPrisma();
    const { scheduleEventId, traineeId, eventDate, eventCode, instructorName, dcoResult } = req.query;

    const where = {};
    if (scheduleEventId) where.scheduleEventId = scheduleEventId;
    if (traineeId)       where.traineeId       = traineeId;
    if (eventDate)       where.eventDate       = eventDate;
    if (eventCode)       where.eventCode       = eventCode;
    if (instructorName)  where.instructorName  = instructorName;
    if (dcoResult)       where.dcoResult       = dcoResult;

    const completions = await db.eventCompletion.findMany({
      where,
      orderBy: [
        { eventDate: 'asc' },
        { startTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });
    console.log(`✅ GET /api/event-completions → ${completions.length} rows`);
    res.json({ completions });
  } catch (error) {
    console.error('❌ GET /api/event-completions error:', error);
    res.status(500).json({ error: 'Failed to fetch event completions', details: error.message });
  }
});

// ── POST /api/event-completions (upsert by scheduleEventId) ──────────────────
app.post('/api/event-completions', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;
    const {
      scheduleEventId, eventCode, eventDate, eventType,
      startTime, duration,
      traineeId, traineeFullName, instructorName,
      dcoResult, overallGrade, overallResult,
      aircraftNumber, takeoffTime, landTime, totalFlightTime,
      isSolo, isDual, isCountedAsElce,
      recordedBy, source, notes,
    } = body;

    if (!scheduleEventId || !dcoResult) {
      return res.status(400).json({ error: 'scheduleEventId and dcoResult are required' });
    }

    const data = {
      scheduleEventId,
      eventCode:       eventCode  || scheduleEventId,
      eventDate:       eventDate  || new Date().toISOString().slice(0, 10),
      eventType:       eventType  || 'flight',
      startTime:       startTime  != null ? parseFloat(startTime)  : 0,
      duration:        duration   != null ? parseFloat(duration)   : 0,
      traineeId:       traineeId  || null,
      traineeFullName: traineeFullName || 'Unknown',
      instructorName:  instructorName || null,
      dcoResult,
      overallGrade:    overallGrade != null ? parseInt(overallGrade) : null,
      overallResult:   overallResult || null,
      aircraftNumber:  aircraftNumber || null,
      takeoffTime:     takeoffTime   || null,
      landTime:        landTime      || null,
      totalFlightTime: totalFlightTime != null ? parseFloat(totalFlightTime) : null,
      isSolo:          !!isSolo,
      isDual:          !!isDual,
      isCountedAsElce: isCountedAsElce !== undefined ? !!isCountedAsElce : dcoResult !== 'DNCO',
      recordedBy:      recordedBy || null,
      source:          source     || 'post_flight',
      notes:           notes      || null,
    };

    const completion = await db.eventCompletion.upsert({
      where:  { scheduleEventId },
      create: data,
      update: data,
    });

    console.log(`✅ POST /api/event-completions upserted id=${completion.id} scheduleEventId=${scheduleEventId} result=${dcoResult}`);
    res.json({ success: true, completion, created: false });
  } catch (error) {
    console.error('❌ POST /api/event-completions error:', error);
    res.status(500).json({ error: 'Failed to save event completion', details: error.message });
  }
});

// ── GET /api/settings?orgId=... ───────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureAppSettingsTable(db);
    const orgId = req.query.orgId || 'default';
    const record = await db.appSettings.findUnique({ where: { orgId } });
    if (!record) {
      console.log(`[Settings] No settings found for orgId=${orgId}`);
      return res.json({ settings: null });
    }
    console.log(`✅ GET /api/settings orgId=${orgId}`);
    res.json({ settings: record.data });
  } catch (error) {
    console.error('❌ GET /api/settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings', details: error.message });
  }
});

// ── POST /api/settings ────────────────────────────────────────────────────────
app.post('/api/settings', async (req, res) => {
  try {
    const db = await getPrisma();
    await ensureAppSettingsTable(db);
    const { orgId = 'default', settings, updatedBy } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'settings body is required' });
    }
    const record = await db.appSettings.upsert({
      where:  { orgId },
      create: { id: generateUUID(), orgId, data: settings, updatedBy: updatedBy || null },
      update: { data: settings, updatedBy: updatedBy || null },
    });
    console.log(`✅ POST /api/settings saved orgId=${orgId}`);
    res.json({ success: true, settings: record.data });
  } catch (error) {
    console.error('❌ POST /api/settings error:', error);
    res.status(500).json({ error: 'Failed to save settings', details: error.message });
  }
});

// ── GET /api/trainees/:id ─────────────────────────────────────────────────────
app.get('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const trainee = await db.trainee.findUnique({ where: { id: req.params.id } });
    if (!trainee) return res.status(404).json({ error: 'Trainee not found' });
    res.json({ trainee });
  } catch (error) {
    console.error('❌ GET /api/trainees/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch trainee', details: error.message });
  }
});

// ── PATCH /api/trainees/:id ───────────────────────────────────────────────────
app.patch('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;
    const updateData = {};

    const allowedFields = [
      'name', 'fullName', 'rank', 'course', 'lmpType', 'unit', 'flight',
      'location', 'service', 'seatConfig', 'isPaused', 'traineeCallsign',
      'primaryInstructor', 'secondaryInstructor', 'phoneNumber', 'email',
      'currencyStatus', 'priorExperience', 'unavailability', 'isActive',
      'lastEventDate', 'lastFlightDate',
    ];

    for (const field of allowedFields) {
      if (field in body) updateData[field] = body[field];
    }

    const trainee = await db.trainee.update({
      where: { id: req.params.id },
      data:  updateData,
    });
    console.log(`✅ PATCH /api/trainees/${req.params.id}`);
    res.json({ success: true, trainee });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/:id error:', error);
    res.status(500).json({ error: 'Failed to update trainee', details: error.message });
  }
});

// ── TRAINEE REALLOCATION ─────────────────────────────────────────────────────
function normaliseInstructorListForReallocation(value) {
  if (Array.isArray(value)) {
    return value.flatMap(item => normaliseInstructorListForReallocation(item));
  }
  if (value === null || value === undefined) return [];
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[]') return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normaliseInstructorListForReallocation(parsed);
    } catch {
      // Fall through for legacy malformed strings.
    }
  }
  return trimmed.split(/[;|]/).map(name => name.trim()).filter(Boolean);
}

function normaliseReallocationToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normaliseReallocationUnit(value) {
  return normaliseReallocationToken(value).toUpperCase();
}

function getReallocationQualificationIds(person) {
  const values = [];
  const add = (value) => {
    const token = normaliseReallocationToken(value);
    if (token && !values.includes(token)) values.push(token);
  };
  const collect = (source) => {
    if (Array.isArray(source)) {
      source.forEach(collect);
      return;
    }
    if (source && typeof source === 'object') {
      add(source.id || source.code || source.name || source.label);
      return;
    }
    String(source || '').split(/[,;|\n]/).forEach(add);
  };
  collect(person?.preferences?.qualifications);
  collect(person?.qualifications);
  if (person?.isQFI) add('qfi');
  if (person?.isCFI) add('cfi');
  if (person?.isOFI) add('ofi');
  if (person?.isIRE) add('ire');
  if (person?.isTestingOfficer) add('testing-officer');
  return values;
}

function isAssignableTraineeInstructor(person, options = {}) {
  if (!person || person.isActive === false) return false;
  if (person.isExecutive && !options.includeExecutives) return false;
  const role = String(person.role || '').toUpperCase();
  const category = String(person.category || '').toUpperCase();
  const qualificationIds = getReallocationQualificationIds(person);
  return Boolean(
    person.isQFI ||
    person.isCFI ||
    person.isOFI ||
    person.isIRE ||
    person.isTestingOfficer ||
    qualificationIds.some(id => ['qfi', 'cfi', 'ofi', 'ire', 'testingofficer', 'testing-officer', 'instructor'].includes(id)) ||
    ['A', 'B', 'C', 'D'].includes(category) ||
    role.includes('QFI') ||
    role.includes('IP') ||
    role.includes('INSTRUCTOR')
  );
}

async function getTraineeInstructorColumnModes(db) {
  const modes = { primaryInstructor: 'text', secondaryInstructor: 'text' };
  try {
    const rows = await db.$queryRawUnsafe(`
      SELECT a.attname AS column_name, pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      WHERE c.relname = 'Trainee'
        AND a.attname IN ('primaryInstructor', 'secondaryInstructor')
        AND a.attnum > 0
        AND NOT a.attisdropped
    `);
    rows.forEach(row => {
      modes[row.column_name] = String(row.data_type || '').includes('[]') ? 'array' : 'text';
    });
  } catch (error) {
    console.warn('[TraineeReallocation] Could not detect instructor column modes:', error.message);
  }
  return modes;
}

function buildReallocation(trainees, personnel, options = {}) {
  const mode = options.mode === 'missingOnly' ? 'missingOnly' : 'all';
  const minSecondaryPerTrainee = Number.isFinite(Number(options.minSecondaryPerTrainee))
    ? Math.max(0, Number(options.minSecondaryPerTrainee))
    : 2;
  const includeExecutives = options.includeExecutives === true;
  const units = Array.from(new Set((trainees || [])
    .map(t => String(t.unit || '').trim())
    .filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  const allResults = [];
  const untouched = [];
  const diagnostics = {
    mode,
    minSecondaryPerTrainee,
    includeExecutives,
    skippedExecutives: (personnel || []).filter(p => p.isExecutive && !includeExecutives).map(p => ({
      id: p.id,
      name: p.name,
      unit: p.unit || null,
      role: p.role || null
    })),
    units: {}
  };
  const primaryLoad = {};
  const secondaryLoad = {};
  if (mode === 'missingOnly') {
    (trainees || []).forEach(trainee => {
      normaliseInstructorListForReallocation(trainee.primaryInstructor).forEach(name => {
        primaryLoad[name] = (primaryLoad[name] || 0) + 1;
      });
      normaliseInstructorListForReallocation(trainee.secondaryInstructor).forEach(name => {
        secondaryLoad[name] = (secondaryLoad[name] || 0) + 1;
      });
    });
  }

  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  };

  for (const unit of units) {
    const normalisedUnit = normaliseReallocationUnit(unit);
    const unitAllTrainees = trainees.filter(t => normaliseReallocationUnit(t.unit) === normalisedUnit);
    const unitTrainees = mode === 'missingOnly'
      ? unitAllTrainees.filter(t => (
        normaliseInstructorListForReallocation(t.primaryInstructor).length === 0 ||
        normaliseInstructorListForReallocation(t.secondaryInstructor).length < minSecondaryPerTrainee
      ))
      : unitAllTrainees;
    let unitStaff = personnel.filter(p => normaliseReallocationUnit(p.unit) === normalisedUnit && isAssignableTraineeInstructor(p, { includeExecutives }));
    const usedFallbackStaffPool = unitStaff.length === 0;
    if (usedFallbackStaffPool) {
      unitStaff = personnel.filter(p => isAssignableTraineeInstructor(p, { includeExecutives }));
    }
    const unitDiag = diagnostics.units[unit] = {
      activeTrainees: unitAllTrainees.length,
      targetTrainees: unitTrainees.length,
      assignableStaff: unitStaff.length,
      usedFallbackStaffPool,
      skippedExecutiveStaff: (personnel || []).filter(p => p.unit === unit && p.isExecutive && !includeExecutives).map(p => p.name),
      skippedNonInstructorStaff: (personnel || []).filter(p => p.unit === unit && !p.isExecutive && !isAssignableTraineeInstructor(p, { includeExecutives })).map(p => p.name),
      primaryBefore: {},
      secondaryBefore: {},
      primaryAfter: {},
      secondaryAfter: {},
      warnings: []
    };
    unitStaff.forEach(staff => {
      unitDiag.primaryBefore[staff.name] = primaryLoad[staff.name] || 0;
      unitDiag.secondaryBefore[staff.name] = secondaryLoad[staff.name] || 0;
    });
    if (mode === 'missingOnly') {
      unitAllTrainees
        .filter(t => !unitTrainees.some(target => target.id === t.id))
        .forEach(trainee => {
          untouched.push({
            id: trainee.id,
            name: trainee.name,
            fullName: trainee.fullName || trainee.name,
            course: trainee.course || '',
            unit: trainee.unit,
            primaryInstructors: normaliseInstructorListForReallocation(trainee.primaryInstructor),
            secondaryInstructors: normaliseInstructorListForReallocation(trainee.secondaryInstructor),
            untouched: true
          });
        });
    }
    if (unitTrainees.length === 0) {
      unitStaff.forEach(staff => {
        unitDiag.primaryAfter[staff.name] = primaryLoad[staff.name] || 0;
        unitDiag.secondaryAfter[staff.name] = secondaryLoad[staff.name] || 0;
      });
      continue;
    }
    if (unitStaff.length === 0) {
      unitTrainees.forEach(trainee => {
        allResults.push({
          id: trainee.id,
          name: trainee.name,
          fullName: trainee.fullName || trainee.name,
          course: trainee.course || '',
          unit: trainee.unit,
          primaryInstructors: [],
          secondaryInstructors: [],
          warning: 'NO_ASSIGNABLE_UNIT_INSTRUCTORS',
          untouched: false
        });
      });
      unitDiag.warnings.push('NO_ASSIGNABLE_UNIT_INSTRUCTORS');
      continue;
    }

    const randFn = seededRandom(42);
    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(randFn() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const shuffledTrainees = shuffle(unitTrainees);
    const shuffledStaff = shuffle(unitStaff);
    const primaryMap = {};
    shuffledTrainees.forEach(t => {
      const existing = normaliseInstructorListForReallocation(t.primaryInstructor);
      primaryMap[t.id] = mode === 'missingOnly' && existing.length > 0 ? existing[0] : null;
    });
    for (const trainee of shuffledTrainees) {
      if (primaryMap[trainee.id]) continue;
      const eligible = shuffledStaff.slice().sort((a, b) => {
        const diff = (primaryLoad[a.name] || 0) - (primaryLoad[b.name] || 0);
        return diff !== 0 ? diff : shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
      });
      if (eligible.length > 0) {
        primaryMap[trainee.id] = eligible[0].name;
        primaryLoad[eligible[0].name] = (primaryLoad[eligible[0].name] || 0) + 1;
      }
    }
    const secondaryMap = {};
    shuffledTrainees.forEach(t => {
      secondaryMap[t.id] = mode === 'missingOnly'
        ? normaliseInstructorListForReallocation(t.secondaryInstructor).slice(0, minSecondaryPerTrainee)
        : [];
    });
    const pickSecondary = (excludeSet) => {
      const candidates = shuffledStaff
        .filter(s => !excludeSet.has(s.name))
        .sort((a, b) => {
          const loadDiff = (secondaryLoad[a.name] || 0) - (secondaryLoad[b.name] || 0);
          if (loadDiff !== 0) return loadDiff;
          return shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      return candidates.length > 0 ? candidates[0] : null;
    };
    for (const trainee of shuffledTrainees) {
      while (secondaryMap[trainee.id].length < minSecondaryPerTrainee) {
        const primaryName = primaryMap[trainee.id];
        const alreadyAssigned = new Set(secondaryMap[trainee.id]);
        let pick = pickSecondary(new Set([...alreadyAssigned, primaryName].filter(Boolean)));
        if (!pick) pick = pickSecondary(alreadyAssigned);
        if (!pick) {
          unitDiag.warnings.push(`NO_SECONDARY_AVAILABLE:${trainee.name}`);
          break;
        }
        secondaryMap[trainee.id].push(pick.name);
        secondaryLoad[pick.name] = (secondaryLoad[pick.name] || 0) + 1;
      }
    }
    unitStaff.forEach(staff => {
      unitDiag.primaryAfter[staff.name] = primaryLoad[staff.name] || 0;
      unitDiag.secondaryAfter[staff.name] = secondaryLoad[staff.name] || 0;
    });
    for (const trainee of shuffledTrainees) {
      allResults.push({
        id: trainee.id,
        name: trainee.name,
        fullName: trainee.fullName || trainee.name,
        course: trainee.course || '',
        unit: trainee.unit,
        primaryInstructors: primaryMap[trainee.id] ? [primaryMap[trainee.id]] : [],
        secondaryInstructors: secondaryMap[trainee.id],
        untouched: false
      });
    }
  }

  return {
    allocations: mode === 'missingOnly' ? [...untouched, ...allResults] : allResults,
    targetAllocations: allResults,
    diagnostics
  };
}

app.get('/api/trainee-reallocation/preview', async (req, res) => {
  try {
    const db = await getPrisma();
    const mode = req.query.mode === 'missingOnly' ? 'missingOnly' : 'all';
    const includeExecutives = req.query.includeExecutives === 'true';
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        course: true,
        unit: true,
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });
    const personnel = await db.personnel.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        role: true,
        isActive: true,
        qualifications: true,
        category: true,
        isExecutive: true,
        isQFI: true,
        isCFI: true,
        isOFI: true,
        isIRE: true,
        isTestingOfficer: true
      }
    });
    const allocationResult = buildReallocation(trainees, personnel, { mode, includeExecutives, minSecondaryPerTrainee: 2 });
    const targetResults = allocationResult.targetAllocations;
    res.json({
      success: true,
      summary: {
        total: allocationResult.allocations.length,
        target: targetResults.length,
        mode,
        includeExecutives,
        primary: {
          with1: targetResults.filter(r => r.primaryInstructors.length === 1).length,
          with0: targetResults.filter(r => r.primaryInstructors.length === 0).length,
        },
        secondary: {
          with3: targetResults.filter(r => r.secondaryInstructors.length === 3).length,
          with2: targetResults.filter(r => r.secondaryInstructors.length === 2).length,
          with1: targetResults.filter(r => r.secondaryInstructors.length === 1).length,
          with0: targetResults.filter(r => r.secondaryInstructors.length === 0).length,
        }
      },
      allocations: allocationResult.allocations,
      targetAllocations: targetResults,
      diagnostics: allocationResult.diagnostics
    });
  } catch (error) {
    console.error('Error in trainee-reallocation preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/trainee-reallocation/apply', async (req, res) => {
  try {
    const db = await getPrisma();
    const mode = req.body?.mode === 'missingOnly' ? 'missingOnly' : 'all';
    const includeExecutives = req.body?.includeExecutives === true;
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        fullName: true,
        course: true,
        unit: true,
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });
    const personnel = await db.personnel.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        role: true,
        isActive: true,
        qualifications: true,
        category: true,
        isExecutive: true,
        isQFI: true,
        isCFI: true,
        isOFI: true,
        isIRE: true,
        isTestingOfficer: true
      }
    });
    const columnModes = await getTraineeInstructorColumnModes(db);
    const allocationResult = buildReallocation(trainees, personnel, { mode, includeExecutives, minSecondaryPerTrainee: 2 });
    const targetResults = allocationResult.targetAllocations;
    let updated = 0;
    const errors = [];
    const writeAttempts = [];

    for (const result of targetResults) {
      try {
        if (columnModes.primaryInstructor === 'array' && columnModes.secondaryInstructor === 'array') {
          await db.$executeRawUnsafe(`
            UPDATE "Trainee"
            SET "primaryInstructor" = $1::TEXT[],
                "secondaryInstructor" = $2::TEXT[],
                "updatedAt" = NOW()
            WHERE id = $3::text
          `, result.primaryInstructors, result.secondaryInstructors, result.id);
        } else {
          await db.$executeRawUnsafe(`
            UPDATE "Trainee"
            SET "primaryInstructor" = $1::TEXT,
                "secondaryInstructor" = $2::TEXT,
                "updatedAt" = NOW()
            WHERE id = $3::text
          `, result.primaryInstructors.join('; '), result.secondaryInstructors.join('; '), result.id);
        }
        updated++;
        writeAttempts.push({
          traineeId: result.id,
          name: result.fullName || result.name,
          course: result.course || '',
          unit: result.unit || '',
          attemptedPrimary: result.primaryInstructors,
          attemptedSecondary: result.secondaryInstructors,
          status: 'updated'
        });
      } catch (error) {
        errors.push({ traineeId: result.id, name: result.name, error: error.message });
        writeAttempts.push({
          traineeId: result.id,
          name: result.fullName || result.name,
          course: result.course || '',
          unit: result.unit || '',
          attemptedPrimary: result.primaryInstructors,
          attemptedSecondary: result.secondaryInstructors,
          status: 'error',
          error: error.message
        });
      }
    }
    const readBackRows = targetResults.length > 0
      ? await db.trainee.findMany({
        where: { id: { in: targetResults.map(result => result.id) } },
        select: {
          id: true,
          name: true,
          fullName: true,
          course: true,
          unit: true,
          primaryInstructor: true,
          secondaryInstructor: true,
          updatedAt: true
        }
      })
      : [];
    const readBackById = new Map(readBackRows.map(row => [row.id, row]));
    const readBack = targetResults.map(result => {
      const row = readBackById.get(result.id);
      const primaryReadBack = normaliseInstructorListForReallocation(row?.primaryInstructor);
      const secondaryReadBack = normaliseInstructorListForReallocation(row?.secondaryInstructor);
      return {
        traineeId: result.id,
        name: row?.fullName || row?.name || result.fullName || result.name,
        course: row?.course || result.course || '',
        unit: row?.unit || result.unit || '',
        attemptedPrimary: result.primaryInstructors,
        attemptedSecondary: result.secondaryInstructors,
        readBackPrimary: primaryReadBack,
        readBackSecondary: secondaryReadBack,
        rawPrimary: row?.primaryInstructor ?? null,
        rawSecondary: row?.secondaryInstructor ?? null,
        updatedAt: row?.updatedAt || null,
        primaryPersisted: primaryReadBack.length > 0,
        secondaryPersisted: secondaryReadBack.length >= 2
      };
    });
    const readBackSummary = {
      checked: readBack.length,
      primaryPersisted: readBack.filter(row => row.primaryPersisted).length,
      secondaryPersisted: readBack.filter(row => row.secondaryPersisted).length,
      stillMissingPrimary: readBack.filter(row => !row.primaryPersisted).length,
      stillMissingTwoSecondary: readBack.filter(row => !row.secondaryPersisted).length
    };
    console.log('[TraineeReallocation] readback summary:', JSON.stringify(readBackSummary));

    res.json({
      success: true,
      summary: {
        total: targetResults.length,
        updated,
        errors: errors.length,
        mode,
        includeExecutives,
        columnModes,
        primary: {
          with1: targetResults.filter(r => r.primaryInstructors.length === 1).length,
          with0: targetResults.filter(r => r.primaryInstructors.length === 0).length,
        },
        secondary: {
          with3: targetResults.filter(r => r.secondaryInstructors.length === 3).length,
          with2: targetResults.filter(r => r.secondaryInstructors.length === 2).length,
          with1: targetResults.filter(r => r.secondaryInstructors.length === 1).length,
          with0: targetResults.filter(r => r.secondaryInstructors.length === 0).length,
        }
      },
      allocations: targetResults,
      diagnostics: allocationResult.diagnostics,
      writeAttempts,
      readBackSummary,
      readBack,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Error in trainee-reallocation apply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── DELETE /api/trainees/:id ──────────────────────────────────────────────────
app.delete('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    await db.trainee.delete({ where: { id: req.params.id } });
    console.log(`✅ DELETE /api/trainees/${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/trainees/:id error:', error);
    res.status(500).json({ error: 'Failed to delete trainee', details: error.message });
  }
});

// ── GET /api/trainees/:id/currencies ─────────────────────────────────────────
app.get('/api/trainees/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const trainee = await db.trainee.findUnique({
      where:  { id: req.params.id },
      select: { id: true, currencyStatus: true },
    });
    if (!trainee) return res.status(404).json({ error: 'Trainee not found' });
    const currencyStatus = Array.isArray(trainee.currencyStatus)
      ? trainee.currencyStatus
      : (trainee.currencyStatus || []);
    res.json({ currencyStatus });
  } catch (error) {
    console.error('❌ GET /api/trainees/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch trainee currencies', details: error.message });
  }
});

// ── PATCH /api/trainees/:id/currencies ───────────────────────────────────────
app.patch('/api/trainees/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { currencyStatus } = req.body;
    const trainee = await db.trainee.update({
      where: { id: req.params.id },
      data:  { currencyStatus },
    });
    res.json({ success: true, currencyStatus: trainee.currencyStatus });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to update trainee currencies', details: error.message });
  }
});

// ── GET /api/personnel/:id ────────────────────────────────────────────────────
app.get('/api/personnel/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const personnel = await db.personnel.findUnique({ where: { id: req.params.id } });
    if (!personnel) return res.status(404).json({ error: 'Personnel not found' });
    res.json({ personnel });
  } catch (error) {
    console.error('❌ GET /api/personnel/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch personnel', details: error.message });
  }
});

// ── PATCH /api/personnel/:id ──────────────────────────────────────────────────
app.patch('/api/personnel/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const body = req.body;
    const updateData = {};

    const allowedFields = [
      'name', 'rank', 'role', 'category', 'unit', 'flight', 'location',
      'service', 'seatConfig', 'email', 'phoneNumber', 'callsignNumber',
      'isQFI', 'isOFI', 'isCFI', 'isExecutive', 'isFlyingSupervisor',
      'isIRE', 'isCommandingOfficer', 'isTestingOfficer', 'isContractor',
      'isAdminStaff', 'isDeputyFlightCommander', 'isActive',
      'qualifications', 'availability', 'preferences',
      'unavailability', 'priorExperience', 'permissions',
    ];

    for (const field of allowedFields) {
      if (field in body) updateData[field] = body[field];
    }

    if ('crew' in body) {
      const incomingPreferences = body.preferences && typeof body.preferences === 'object' && !Array.isArray(body.preferences)
        ? body.preferences
        : {};
      updateData.preferences = {
        ...incomingPreferences,
        crew: body.crew || null,
      };
    }

    const personnel = await db.personnel.update({
      where: { id: req.params.id },
      data:  updateData,
    });
    console.log(`✅ PATCH /api/personnel/${req.params.id}`);
    res.json({ success: true, personnel });
  } catch (error) {
    console.error('❌ PATCH /api/personnel/:id error:', error);
    res.status(500).json({ error: 'Failed to update personnel', details: error.message });
  }
});

// ── GET /api/personnel/:id/currencies ────────────────────────────────────────
app.get('/api/personnel/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const personnel = await db.personnel.findUnique({
      where:  { id: req.params.id },
      select: { id: true, qualifications: true },
    });
    if (!personnel) return res.status(404).json({ error: 'Personnel not found' });
    const qual = personnel.qualifications || {};
    const currencyStatus = Array.isArray(qual.currencyStatus) ? qual.currencyStatus : [];
    res.json({ currencyStatus });
  } catch (error) {
    console.error('❌ GET /api/personnel/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to fetch personnel currencies', details: error.message });
  }
});

// ── PATCH /api/personnel/:id/currencies ──────────────────────────────────────
app.patch('/api/personnel/:id/currencies', async (req, res) => {
  try {
    const db = await getPrisma();
    const { currencyStatus } = req.body;
    const existing = await db.personnel.findUnique({
      where:  { id: req.params.id },
      select: { qualifications: true },
    });
    if (!existing) return res.status(404).json({ error: 'Personnel not found' });
    const qual = existing.qualifications || {};
    qual.currencyStatus = currencyStatus;
    await db.personnel.update({
      where: { id: req.params.id },
      data:  { qualifications: qual },
    });
    res.json({ success: true, currencyStatus });
  } catch (error) {
    console.error('❌ PATCH /api/personnel/:id/currencies error:', error);
    res.status(500).json({ error: 'Failed to update personnel currencies', details: error.message });
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
