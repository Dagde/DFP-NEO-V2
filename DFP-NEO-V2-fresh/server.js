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

// DELETE /api/personnel/:id - Delete a personnel record
app.delete('/api/personnel/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Personnel ID is required' });
    }

    // Check if the personnel exists
    const existing = await db.personnel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Personnel not found' });
    }

    // Delete the personnel record
    await db.personnel.delete({ where: { id } });

    console.log(`✅ DELETE /api/personnel/${id} - deleted: ${existing.name}`);
    res.json({ success: true, deleted: { id, name: existing.name } });
  } catch (error) {
    console.error('❌ DELETE /api/personnel error:', error);
    res.status(500).json({ error: 'Failed to delete personnel', details: error.message });
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

// ============================================================
// TRAINEE API ROUTES
// ============================================================

// GET /api/trainees
app.get('/api/trainees', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course, isActive, search } = req.query;

    const where = {};
    if (course) where.course = course;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
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

// DELETE /api/trainees/:id - Delete a trainee record
app.delete('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Trainee ID is required' });
    }

    // Check if the trainee exists
    const existing = await db.trainee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Trainee not found' });
    }

    // Delete the trainee record
    await db.trainee.delete({ where: { id } });

    console.log(`✅ DELETE /api/trainees/${id} - deleted: ${existing.name}`);
    res.json({ success: true, deleted: { id, name: existing.name } });
  } catch (error) {
    console.error('❌ DELETE /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to delete trainee', details: error.message });
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
    const personnelWhere = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { idNumber: { contains: search, mode: 'insensitive' } }
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

    // First unlink the SQNLDR personnel from the duplicate user account
    await db.personnel.update({
      where: { id: 'cmkdkjq610001mq0f5v72mj56' },
      data: { userId: null }
    });
    results.push('Unlinked SQNLDR personnel from duplicate user account');

    // Delete all duplicate personnel records
    for (const id of personnelToDelete) {
      try {
        await db.personnel.delete({ where: { id } });
        results.push(`Deleted personnel: ${id}`);
      } catch (e) {
        results.push(`Failed to delete personnel ${id}: ${e.message}`);
      }
    }

    // Delete the duplicate user account
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
      where: { OR: [
        { firstName: { contains: 'Burns', mode: 'insensitive' } },
        { lastName: { contains: 'Burns', mode: 'insensitive' } },
        { username: { contains: 'burns', mode: 'insensitive' } }
      ]},
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });

    res.json({ success: true, actions: results, remainingPersonnel: remaining, remainingUsers: remainingUsers });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

// POST /api/merge-burns-accounts - Consolidate Burns user accounts
// Links Personnel to alexander.burns, deletes 8201112 user, sets role to INSTRUCTOR + ADMIN
app.post('/api/merge-burns-accounts', async (req, res) => {
  try {
    const db = await getPrisma();
    const { confirmToken } = req.body;

    if (confirmToken !== 'CONFIRM_MERGE_BURNS_ACCOUNTS') {
      return res.status(400).json({ error: 'Invalid confirmation token. Send { confirmToken: "CONFIRM_MERGE_BURNS_ACCOUNTS" }' });
    }

    const results = [];

    // Target user account (alexander.burns) - will be the primary account
    const targetUserId = 'cmlw89air0001ml3apfk5l1sz';
    // Source user account (8201112) - will be deleted
    const sourceUserId = 'cmkdynoqv0000o30fwtqqwkzw';
    // Personnel record to re-link
    const personnelId = 'cmkivhycv0001k30fbih64ptl';

    // Step 1: Update Personnel to link to alexander.burns account
    await db.personnel.update({
      where: { id: personnelId },
      data: { userId: targetUserId }
    });
    results.push(`Linked Personnel ${personnelId} to User ${targetUserId} (alexander.burns)`);

    // Step 2: Update alexander.burns user to have both INSTRUCTOR and ADMIN roles
    // Check if there's a single role field or if we need to handle multiple roles
    await db.user.update({
      where: { id: targetUserId },
      data: { role: 'ADMIN' } // Keep ADMIN as primary, INSTRUCTOR implied by Personnel link
    });
    results.push(`Updated User ${targetUserId} role to ADMIN (INSTRUCTOR via Personnel link)`);

    // Step 3: Delete the 8201112 user account
    try {
      await db.user.delete({ where: { id: sourceUserId } });
      results.push(`Deleted User ${sourceUserId} (8201112)`);
    } catch (e) {
      results.push(`Failed to delete User ${sourceUserId}: ${e.message}`);
    }

    // Verify the merge
    const personnel = await db.personnel.findUnique({
      where: { id: personnelId },
      select: { id: true, name: true, rank: true, userId: true }
    });
    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });
    const remainingUsers = await db.user.findMany({
      where: { OR: [
        { firstName: { contains: 'Burns', mode: 'insensitive' } },
        { lastName: { contains: 'Burns', mode: 'insensitive' } },
        { username: { contains: 'burns', mode: 'insensitive' } }
      ]},
      select: { id: true, username: true, firstName: true, lastName: true, role: true }
    });

    res.json({
      success: true,
      actions: results,
      linkedPersonnel: personnel,
      primaryUser: user,
      allBurnsUsers: remainingUsers
    });
  } catch (error) {
    console.error('Merge error:', error);
    res.status(500).json({ error: 'Merge failed', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/version - returns the active git commit hash from Railway environment
app.get('/api/version', (req, res) => {
  const commit = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || process.env.COMMIT_SHA || 'unknown';
  const shortCommit = commit.length > 7 ? commit.substring(0, 7) : commit;
  res.json({ commit: shortCommit, full: commit });
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