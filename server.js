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
  }
  return prisma;
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

// POST /api/personnel/bulk - Bulk insert personnel (for mock data migration)
app.post('/api/personnel/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { personnel: personnelList } = req.body;

    if (!Array.isArray(personnelList) || personnelList.length === 0) {
      return res.status(400).json({ error: 'personnel array is required' });
    }

    console.log(`📦 POST /api/personnel/bulk - attempting to insert ${personnelList.length} records`);

    // Fetch existing idNumbers to avoid duplicates
    const existingRecords = await db.personnel.findMany({
      select: { idNumber: true, name: true },
    });
    const existingIdNumbers = new Set(existingRecords.map(r => r.idNumber).filter(Boolean));
    const existingNames = new Set(existingRecords.map(r => r.name));

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const body of personnelList) {
      // Skip if already exists by idNumber or name
      if (body.idNumber && existingIdNumbers.has(body.idNumber)) {
        skipped++;
        continue;
      }
      if (!body.idNumber && existingNames.has(body.name)) {
        skipped++;
        continue;
      }

      try {
        // Auto-link to existing User by PMKEYS
        let linkedUserId = null;
        if (body.idNumber) {
          const existingUser = await db.user.findFirst({
            where: { userId: body.idNumber.toString() }
          });
          if (existingUser) {
            linkedUserId = existingUser.id;
          }
        }

        await db.personnel.create({
          data: {
            name: body.name || '',
            rank: body.rank || null,
            role: body.role || null,
            category: body.category || null,
            unit: body.unit || null,
            flight: body.flight || null,
            location: body.location || null,
            idNumber: body.idNumber || null,
            callsignNumber: body.callsignNumber || null,
            email: body.email || null,
            phoneNumber: body.phoneNumber || null,
            seatConfig: body.seatConfig || null,
            service: body.service || null,
            isQFI: body.isQFI || false,
            isOFI: body.isOFI || false,
            isCFI: body.isCFI || false,
            isExecutive: body.isExecutive || false,
            isFlyingSupervisor: body.isFlyingSupervisor || false,
            isIRE: body.isIRE || false,
            isCommandingOfficer: body.isCommandingOfficer || false,
            isDeputyFlightCommander: body.isDeputyFlightCommander || false,
            isTestingOfficer: body.isTestingOfficer || false,
            isContractor: body.isContractor || false,
            isAdminStaff: body.isAdminStaff || false,
            permissions: body.permissions || [],
            unavailability: body.unavailability || [],
            priorExperience: body.priorExperience || null,
            isActive: true,
            userId: linkedUserId,
          }
        });

        existingIdNumbers.add(body.idNumber);
        existingNames.add(body.name);
        inserted++;
      } catch (err) {
        console.error(`❌ Failed to insert ${body.name}:`, err.message);
        errors.push({ name: body.name, error: err.message });
      }
    }

    console.log(`✅ POST /api/personnel/bulk - inserted: ${inserted}, skipped: ${skipped}, errors: ${errors.length}`);
    res.json({
      success: true,
      inserted,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ POST /api/personnel/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk insert personnel', details: error.message });
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
// SERVE STATIC VITE BUILD
// ============================================================

// Serve the flight-school-app static files
const staticPath = path.join(__dirname, 'dfp-neo-platform/public/flight-school-app');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  console.log(`✅ Serving static files from: ${staticPath}`);
}

// ========================================================================
// UPDATE EVENT DURATIONS ENDPOINT
// ========================================================================

app.put('/api/update-event-durations', async (req, res) => {
  try {
    const { courses } = req.body; // Array of course names, e.g., ['BPC+IPC', 'FIC']
    
    if (!courses || !Array.isArray(courses)) {
      return res.status(400).json({ error: 'courses array is required' });
    }

    console.log('[Update Durations] Starting duration updates for courses:', courses);
    
    const db = await getPrisma();
    
    // Get all trainees in specified courses
    const trainees = await db.trainee.findMany({
      where: {
        course: {
          in: courses
        }
      },
      select: {
        idNumber: true,
        name: true,
        course: true
      }
    });
    
    console.log(`[Update Durations] Found ${trainees.length} trainees in specified courses`);
    
    let totalFlightUpdates = 0;
    let totalFtdUpdates = 0;
    const details = [];
    
    // Update events for each course
    for (const trainee of trainees) {
      const traineeId = trainee.idNumber;
      
      // Update flight events (type: 'flight') to 1.2hrs
      const flightUpdate = await db.scheduleEvent.updateMany({
        where: {
          traineeId: traineeId,
          type: 'flight'
        },
        data: {
          duration: 1.2
        }
      });
      
      // Update FTD events (type: 'ftd') to 2.0hrs
      const ftdUpdate = await db.scheduleEvent.updateMany({
        where: {
          traineeId: traineeId,
          type: 'ftd'
        },
        data: {
          duration: 2.0
        }
      });
      
      totalFlightUpdates += flightUpdate.count;
      totalFtdUpdates += ftdUpdate.count;
      
      if (flightUpdate.count > 0 || ftdUpdate.count > 0) {
        details.push({
          traineeName: trainee.name,
          course: trainee.course,
          flightUpdates: flightUpdate.count,
          ftdUpdates: ftdUpdate.count
        });
        console.log(`[Update Durations] [Trainee ${trainee.name} (${trainee.course})]: Updated ${flightUpdate.count} flight events to 1.2hrs and ${ftdUpdate.count} FTD events to 2.0hrs`);
      }
    }
    
    console.log(`[Update Durations] ✅ Completed: ${totalFlightUpdates} flight events updated to 1.2hrs, ${totalFtdUpdates} FTD events updated to 2.0hrs`);
    
    res.json({
      success: true,
      message: `Updated ${totalFlightUpdates} flight events to 1.2hrs and ${totalFtdUpdates} FTD events to 2.0hrs`,
      totalFlightUpdates,
      totalFtdUpdates,
      details
    });
    
  } catch (error) {
    console.error('[Update Durations] Error:', error);
    res.status(500).json({ error: 'Failed to update event durations', details: error.message });
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