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
    // Ensure CancellationCode table exists and seed defaults
    await ensureCancellationCodesTable(prisma);
    await seedCancellationCodesIfEmpty(prisma);
    // Ensure IndividualLMP table exists (create if missing)
    await ensureIndividualLMPTable(prisma);
    // Ensure DailySnapshot table exists (create if missing)
    await ensureDailySnapshotTable(prisma);
    // Ensure instructor fields are TEXT[] arrays (migrate from String if needed)
    try {
      await ensureInstructorArrayColumns(prisma);
    } catch (migrationErr) {
      console.error('Instructor column migration failed (non-fatal):', migrationErr.message);
    }
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
// STAFF-TRAINEE ANALYSIS API ROUTE
// ============================================================

// GET /api/staff-trainee-analysis
// Returns analysis of staff trainee assignments (supports array instructor fields)
app.get('/api/staff-trainee-analysis', async (req, res) => {
  try {
    const prisma = await getPrisma();

    // Get all trainees with their instructor assignments (now arrays)
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      select: {
        primaryInstructor: true,
        secondaryInstructor: true
      }
    });

    // Count primary trainees per instructor - each instructor in the array gets +1
    const primaryCounts = {};
    trainees.forEach(t => {
      const names = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : [];
      names.forEach(name => {
        if (name && name.trim()) {
          primaryCounts[name] = (primaryCounts[name] || 0) + 1;
        }
      });
    });

    // Count secondary trainees per instructor
    const secondaryCounts = {};
    trainees.forEach(t => {
      const names = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : [];
      names.forEach(name => {
        if (name && name.trim()) {
          secondaryCounts[name] = (secondaryCounts[name] || 0) + 1;
        }
      });
    });

    // Get all personnel to find staff with 0 trainees too
    const allPersonnel = await prisma.personnel.findMany({
      select: { name: true, unit: true, role: true }
    });

    // Build complete instructor set (all personnel + anyone referenced in trainee assignments)
    const instructorNames = new Set([
      ...allPersonnel.map(p => p.name),
      ...Object.keys(primaryCounts),
      ...Object.keys(secondaryCounts)
    ]);
    const totalStaff = instructorNames.size;

    // Build distribution: how many staff have 0, 1, 2, 3 primary trainees
    const primaryDistributionCounts = {};
    const secondaryDistributionCounts = {};

    instructorNames.forEach(name => {
      const pc = primaryCounts[name] || 0;
      const sc = secondaryCounts[name] || 0;
      primaryDistributionCounts[pc] = (primaryDistributionCounts[pc] || 0) + 1;
      secondaryDistributionCounts[sc] = (secondaryDistributionCounts[sc] || 0) + 1;
    });

    // Calculate summary statistics
    const totalPrimaryAssignments = Object.values(primaryCounts).reduce((sum, c) => sum + c, 0);
    const totalSecondaryAssignments = Object.values(secondaryCounts).reduce((sum, c) => sum + c, 0);
    const avgPrimary = totalStaff > 0 ? (totalPrimaryAssignments / totalStaff).toFixed(2) : '0';
    const avgSecondary = totalStaff > 0 ? (totalSecondaryAssignments / totalStaff).toFixed(2) : '0';

    // Build distribution arrays
    const maxPrimary = Math.max(...Object.keys(primaryDistributionCounts).map(Number), 0);
    const maxSecondary = Math.max(...Object.keys(secondaryDistributionCounts).map(Number), 0);

    const primaryDistribution = [];
    for (let i = 0; i <= maxPrimary; i++) {
      const count = primaryDistributionCounts[i] || 0;
      primaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: totalStaff > 0 ? ((count / totalStaff) * 100).toFixed(1) : '0'
      });
    }

    const secondaryDistribution = [];
    for (let i = 0; i <= maxSecondary; i++) {
      const count = secondaryDistributionCounts[i] || 0;
      secondaryDistribution.push({
        traineeCount: i,
        staffCount: count,
        percentage: totalStaff > 0 ? ((count / totalStaff) * 100).toFixed(1) : '0'
      });
    }

    // Also compute per-trainee stats: how many instructors does each trainee have?
    const traineesWith0Primary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length === 0; }).length;
    const traineesWith1Primary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length === 1; }).length;
    const traineesWith2PlusPrimary = trainees.filter(t => { const a = Array.isArray(t.primaryInstructor) ? t.primaryInstructor : t.primaryInstructor ? [t.primaryInstructor] : []; return a.length >= 2; }).length;
    const traineesWith0Secondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length === 0; }).length;
    const traineesWith1Secondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length === 1; }).length;
    const traineesWith2PlusSecondary = trainees.filter(t => { const a = Array.isArray(t.secondaryInstructor) ? t.secondaryInstructor : t.secondaryInstructor ? [t.secondaryInstructor] : []; return a.length >= 2; }).length;

    res.json({
      success: true,
      data: {
        totalStaff,
        totalTrainees: trainees.length,
        distinctRoles: [...new Set(allPersonnel.map(p => p.role).filter(Boolean))],
        summary: {
          averagePrimaryTrainees: avgPrimary,
          averageSecondaryTrainees: avgSecondary,
          totalPrimaryAssignments,
          totalSecondaryAssignments
        },
        traineeStats: {
          primaryInstructors: { with0: traineesWith0Primary, with1: traineesWith1Primary, with2Plus: traineesWith2PlusPrimary },
          secondaryInstructors: { with0: traineesWith0Secondary, with1: traineesWith1Secondary, with2Plus: traineesWith2PlusSecondary }
        },
        primaryDistribution,
        secondaryDistribution,
        instructorBreakdown: {
          primary: primaryCounts,
          secondary: secondaryCounts
        }
      }
    });
    
  } catch (error) {
    console.error('Error in staff-trainee-analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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

// PATCH /api/trainees/fix-location - Fix location for all trainees in a course
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-location', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course, correctLocation } = req.body;

    if (!course || !correctLocation) {
      return res.status(400).json({ error: 'course and correctLocation are required' });
    }

    const result = await db.trainee.updateMany({
      where: { course: course },
      data: { location: correctLocation }
    });

    console.log(`✅ Fixed location for ${result.count} trainees in course "${course}" to "${correctLocation}"`);
    res.json({ success: true, updated: result.count, course, correctLocation });
  } catch (error) {
    console.error('❌ Error fixing trainee locations:', error);
    res.status(500).json({ error: 'Failed to fix trainee locations', details: error.message });
  }
});

// PATCH /api/trainees/bulk-unit - Bulk update unit for trainees in a course
// NOTE: This must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/bulk-unit', async (req, res) => {
  try {
    const db = await getPrisma();
    const { courseNumber, newUnit } = req.body;

    if (!courseNumber || !newUnit) {
      return res.status(400).json({ error: 'courseNumber and newUnit are required' });
    }

    // Update all trainees in the course
    const result = await db.trainee.updateMany({
      where: { course: courseNumber },
      data: { unit: newUnit }
    });

    console.log(`✅ PATCH /api/trainees/bulk-unit - updated ${result.count} trainees in course "${courseNumber}" to unit "${newUnit}"`);
    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/bulk-unit error:', error);
    res.status(500).json({ error: 'Failed to update trainees', details: error.message });
  }
});

// PATCH /api/trainees/fix-lmp-type - Fix lmpType for FIC course trainees
// NOTE: Must be defined BEFORE /api/trainees/:id to avoid route conflict
app.patch('/api/trainees/fix-lmp-type', async (req, res) => {
  try {
    const db = await getPrisma();

    // Find all trainees whose course starts with 'FIC' but lmpType is not 'FIC'
    const ficTrainees = await db.trainee.findMany({
      where: {
        AND: [
          { course: { startsWith: 'FIC' } },
          { NOT: { lmpType: 'FIC' } }
        ]
      },
      select: { id: true, name: true, course: true, lmpType: true }
    });

    if (ficTrainees.length === 0) {
      console.log('✅ PATCH /api/trainees/fix-lmp-type - No FIC trainees need updating');
      return res.json({ success: true, count: 0, message: 'All FIC trainees already have correct lmpType' });
    }

    // Update all FIC trainees to have lmpType: 'FIC'
    const result = await db.trainee.updateMany({
      where: {
        AND: [
          { course: { startsWith: 'FIC' } },
          { NOT: { lmpType: 'FIC' } }
        ]
      },
      data: { lmpType: 'FIC' }
    });

    console.log(`✅ PATCH /api/trainees/fix-lmp-type - Updated ${result.count} FIC trainees: ${ficTrainees.map(t => t.name).join(', ')}`);
    res.json({ success: true, count: result.count, updated: ficTrainees.map(t => ({ name: t.name, course: t.course })) });
  } catch (error) {
    console.error('❌ PATCH /api/trainees/fix-lmp-type error:', error);
    res.status(500).json({ error: 'Failed to fix lmpType for FIC trainees', details: error.message });
  }
});

// ============================================================
// INDIVIDUAL LMP ROUTES
// MUST be defined BEFORE /api/trainees/:id to avoid route conflicts
// ============================================================

// POST /api/fix-bif-ftd-dependencies - Fix BIF FTD dependencies
// Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
// Rule 2: If BIF1 is complete, mark BIF FTD3 complete
// Rule 3: Remove asterisk versions (BIF FTD1*, BIF FTD3*) from completedEventIds
app.post('/api/fix-bif-ftd-dependencies', async (req, res) => {
  try {
    const db = await getPrisma();
    console.log('[BIF FTD Fix] Starting BIF FTD dependency fix...');

    // Get all trainees on ADF courses (BPC+IPC)
    const trainees = await db.trainee.findMany({
      where: {
        isActive: true,
        course: {
          startsWith: 'ADF'
        }
      },
      include: {
        individualLMP: true
      }
    });

    console.log(`[BIF FTD Fix] Found ${trainees.length} active trainees on ADF courses (BPC+IPC)`);

    let ftd1Fixed = 0;
    let ftd3Fixed = 0;
    let asterisksRemoved = 0;
    const details = [];

    for (const trainee of trainees) {
      if (!trainee.individualLMP) continue;

      const completedEventIds = trainee.individualLMP.completedEventIds || [];
      const newCompletedIds = [...completedEventIds];
      let changed = false;

      // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
      if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
        newCompletedIds.push('BIF FTD1');
        changed = true;
        ftd1Fixed++;
        details.push(`${trainee.fullName}: Marking BIF FTD1 complete (BIF FTD2 is complete)`);
      }

      // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
      if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
        newCompletedIds.push('BIF FTD3');
        changed = true;
        ftd3Fixed++;
        details.push(`${trainee.fullName}: Marking BIF FTD3 complete (BIF1 is complete)`);
      }

      // Rule 3: Remove asterisk versions if non-asterisk versions exist
      const originalLength = newCompletedIds.length;
      const filtered = newCompletedIds.filter(id => {
        // Remove BIF FTD1* if BIF FTD1 exists, remove BIF FTD3* if BIF FTD3 exists
        if (id === 'BIF FTD1*' && newCompletedIds.includes('BIF FTD1')) return false;
        if (id === 'BIF FTD3*' && newCompletedIds.includes('BIF FTD3')) return false;
        return true;
      });
      
      if (filtered.length !== originalLength) {
        newCompletedIds.splice(0, newCompletedIds.length, ...filtered);
        changed = true;
        asterisksRemoved++;
        details.push(`${trainee.fullName}: Removed asterisk versions from completedEventIds`);
      }

      if (changed) {
        await db.individualLMP.update({
          where: { traineeId: trainee.id },
          data: {
            completedEventIds: newCompletedIds,
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`[BIF FTD Fix] Complete: BIF FTD1=${ftd1Fixed}, BIF FTD3=${ftd3Fixed}, Asterisks removed=${asterisksRemoved}`);
    res.json({
      success: true,
      ftd1Fixed,
      ftd3Fixed,
      asterisksRemoved,
      totalTrainees: trainees.length,
      details
    });
  } catch (error) {
    console.error('[BIF FTD Fix] Error:', error);
    res.status(500).json({ error: 'Failed to fix BIF FTD dependencies', details: error.message });
  }
});

// POST /api/fix-pt051-scores - Remove asterisks from PT-051 Score records
// This fixes the display in the Performance History table
app.post('/api/fix-pt051-scores', async (req, res) => {
  try {
    const db = await getPrisma();
    console.log('[PT-051 Fix] Starting PT-051 Score fix...');

    // Get all Score records with BIF FTD1* or BIF FTD3*
    const scoresToFix = await db.score.findMany({
      where: {
        event: {
          in: ['BIF FTD1*', 'BIF FTD3*']
        }
      }
    });

    console.log(`[PT-051 Fix] Found ${scoresToFix.length} PT-051 Score records with asterisks`);

    let updatedCount = 0;
    const details = [];

    for (const score of scoresToFix) {
      const oldEvent = score.event;
      const newEvent = oldEvent.replace('*', '');
      
      await db.score.update({
        where: { id: score.id },
        data: { event: newEvent }
      });
      
      updatedCount++;
      details.push(`Updated score for ${score.traineeFullName}: ${oldEvent} → ${newEvent}`);
    }

    console.log(`[PT-051 Fix] Complete: Updated ${updatedCount} PT-051 Score records`);
    res.json({
      success: true,
      updatedCount,
      totalScores: scoresToFix.length,
      details
    });
  } catch (error) {
    console.error('[PT-051 Fix] Error:', error);
    res.status(500).json({ error: 'Failed to fix PT-051 Score records', details: error.message });
  }
});

// ============================================================

// GET /api/trainees/lmp-sync - Return all IndividualLMPs (traineeFullName + completedEventIds)
app.get('/api/trainees/lmp-sync', async (req, res) => {
  try {
    const db = await getPrisma();
    const lmps = await db.individualLMP.findMany({
      select: {
        traineeId: true,
        traineeFullName: true,
        lmpType: true,
        completedEventIds: true,
        updatedAt: true,
      },
      orderBy: { traineeFullName: 'asc' },
    });
    res.json({ lmps, count: lmps.length });
  } catch (error) {
    console.error('❌ GET /api/trainees/lmp-sync error:', error);
    res.status(500).json({ error: 'Failed to fetch LMP completions', details: error.message });
  }
});

// POST /api/trainees/lmp-sync - Sync all trainees' PT-051 Score records → IndividualLMP
// Body: { syllabusData: Record<lmpType, SyllabusItemDetail[]> }
app.post('/api/trainees/lmp-sync', async (req, res) => {
  try {
    const db = await getPrisma();
    const { syllabusData } = req.body;

    if (!syllabusData || Object.keys(syllabusData).length === 0) {
      return res.status(400).json({ error: 'Missing syllabusData in request body' });
    }

    // Fetch all active trainees with their scores and existing LMP
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      include: {
        scores: {
          select: { event: true, date: true, score: true },
          orderBy: { date: 'asc' },
        },
        individualLMP: true,
      },
    });

    console.log(`[LMP Sync] Processing ${trainees.length} trainees...`);

    const results = [];

    for (const trainee of trainees) {
      // Determine LMP type
      let lmpType = trainee.lmpType || 'BPC+IPC';
      if (lmpType === 'BPC+IPC' && trainee.course) {
        if (trainee.course.toUpperCase().startsWith('FIC')) {
          lmpType = 'FIC';
        }
      }

      // Get master syllabus for this LMP type
      let masterSyllabus = syllabusData[lmpType];
      if (!masterSyllabus || masterSyllabus.length === 0) {
        masterSyllabus = syllabusData['BPC+IPC'] || [];
      }
      if (!masterSyllabus || masterSyllabus.length === 0) {
        results.push({
          traineeFullName: trainee.fullName,
          lmpType,
          totalEvents: 0,
          completedCount: 0,
          newlyMarked: [],
          status: 'no_syllabus',
        });
        continue;
      }

      // Build set of completed event IDs from PT-051 Score records
      const scoreMap = {};
      trainee.scores.forEach(s => {
        // Strip asterisks from event codes for matching (e.g., 'BIF FTD1*' -> 'BIF FTD1')
        const normalizedEvent = (s.event || '').replace('*', '');
        scoreMap[normalizedEvent] = s.date ? s.date.toISOString() : null;
      });
      let completedEventIds = Object.keys(scoreMap);

      // Apply BIF FTD dependency rules:
      // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
      if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
        completedEventIds.push('BIF FTD1');
        scoreMap['BIF FTD1'] = scoreMap['BIF FTD2']; // use BIF FTD2's date
        console.log(`[LMP Sync] ${trainee.fullName}: Auto-marking BIF FTD1 complete (BIF FTD2 done)`);
      }
      // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
      if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
        completedEventIds.push('BIF FTD3');
        scoreMap['BIF FTD3'] = scoreMap['BIF1']; // use BIF1's date
        console.log(`[LMP Sync] ${trainee.fullName}: Auto-marking BIF FTD3 complete (BIF1 done)`);
      }

      // Build the full LMP events array with completion status
      const lmpEvents = masterSyllabus.map(item => ({
        ...item,
        completedAt: scoreMap[item.id || item.code] || null,
      }));

      // Check what was previously marked
      const existing = trainee.individualLMP;
      const existingCompleted = existing ? (existing.completedEventIds || []) : [];
      const newlyMarked = completedEventIds.filter(id => !existingCompleted.includes(id));

      // Upsert the IndividualLMP
      await db.individualLMP.upsert({
        where: { traineeId: trainee.id },
        update: {
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
          updatedAt: new Date(),
        },
        create: {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
        },
      });

      const status = !existing ? 'created' : newlyMarked.length > 0 ? 'updated' : 'unchanged';
      results.push({
        traineeFullName: trainee.fullName,
        lmpType,
        totalEvents: masterSyllabus.length,
        completedCount: completedEventIds.length,
        newlyMarked,
        status,
      });

      console.log(
        `[LMP Sync] ${trainee.fullName} (${lmpType}): ${completedEventIds.length}/${masterSyllabus.length} events complete` +
        (newlyMarked.length > 0 ? ` — newly marked: ${newlyMarked.join(', ')}` : '')
      );
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const noSyllabus = results.filter(r => r.status === 'no_syllabus').length;

    console.log(`[LMP Sync] ✅ Done — ${created} created, ${updated} updated, ${unchanged} unchanged, ${noSyllabus} skipped`);

    res.json({
      success: true,
      summary: { created, updated, unchanged, noSyllabus, total: trainees.length },
      results,
    });
  } catch (error) {
    console.error('❌ POST /api/trainees/lmp-sync error:', error);
    res.status(500).json({ error: 'Failed to sync LMPs', details: error.message });
  }
});

// GET /api/trainees/:id/lmp - Get IndividualLMP for a specific trainee
app.get('/api/trainees/:id/lmp', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;

    // Try by traineeId first, then by traineeFullName
    const lmp = await db.individualLMP.findFirst({
      where: {
        OR: [
          { traineeId: id },
          { traineeFullName: decodeURIComponent(id) },
        ],
      },
    });

    res.json({ lmp: lmp || null });
  } catch (error) {
    console.error('❌ GET /api/trainees/:id/lmp error:', error);
    res.status(500).json({ error: 'Failed to fetch LMP', details: error.message });
  }
});

// PUT /api/trainees/:id/lmp - Upsert IndividualLMP for a specific trainee
app.put('/api/trainees/:id/lmp', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const { traineeFullName, lmpType, events, completedEventIds } = req.body;

    if (!traineeFullName || !lmpType || !events) {
      return res.status(400).json({ error: 'Missing required fields: traineeFullName, lmpType, events' });
    }

    const lmp = await db.individualLMP.upsert({
      where: { traineeId: id },
      update: {
        traineeFullName,
        lmpType,
        events,
        completedEventIds: completedEventIds || [],
        updatedAt: new Date(),
      },
      create: {
        traineeId: id,
        traineeFullName,
        lmpType,
        events,
        completedEventIds: completedEventIds || [],
      },
    });

    console.log(`✅ PUT /api/trainees/${id}/lmp - ${traineeFullName}: ${(completedEventIds || []).length} events complete`);
    res.json({ success: true, lmp });
  } catch (error) {
    console.error('❌ PUT /api/trainees/:id/lmp error:', error);
    res.status(500).json({ error: 'Failed to save LMP', details: error.message });
  }
});

// PATCH /api/trainees/:id - Update a trainee record
app.patch('/api/trainees/:id', async (req, res) => {
  try {
    const db = await getPrisma();
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Trainee ID is required' });
    }

    // Check if the trainee exists
    const existing = await db.trainee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Trainee not found' });
    }

    // Update the trainee record
    const updated = await db.trainee.update({
      where: { id },
      data: updates
    });

    console.log(`✅ PATCH /api/trainees/${id} - updated: ${updated.name}`);
    res.json({ success: true, trainee: updated });
  } catch (error) {
    console.error('❌ PATCH /api/trainees error:', error);
    res.status(500).json({ error: 'Failed to update trainee', details: error.message });
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

// GET /api/debug/courses - Show distinct courses and their unit values in DB
app.get('/api/debug/courses', async (req, res) => {
  try {
    const db = await getPrisma();
    const trainees = await db.trainee.findMany({
      select: { course: true, unit: true, location: true, name: true },
      orderBy: { course: 'asc' }
    });
    // Group by course and show unit/location values
    const grouped = {};
    trainees.forEach((t) => {
      const c = t.course || '(null)';
      if (!grouped[c]) grouped[c] = { units: new Set(), locations: new Set(), count: 0, sample: [] };
      grouped[c].units.add(t.unit || '(null)');
      grouped[c].locations.add(t.location || '(null)');
      grouped[c].count++;
      if (grouped[c].sample.length < 3) grouped[c].sample.push(t.name);
    });
    const result = Object.entries(grouped).map(([course, data]) => ({
      course,
      count: data.count,
      units: [...data.units],
      locations: [...data.locations],
      sample: data.sample
    }));
    res.json({ courses: result, total: trainees.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/debug/trainees/:course - Show trainees for a specific course
app.get('/api/debug/trainees/:course', async (req, res) => {
  try {
    const db = await getPrisma();
    const { course } = req.params;
    const trainees = await db.trainee.findMany({
      where: { course: course },
      select: { idNumber: true, name: true, course: true, unit: true, location: true },
      orderBy: { name: 'asc' }
    });
    res.json({ course, count: trainees.length, trainees });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SERVE STATIC VITE BUILD
// ============================================================

// Serve the flight-school-app static files
// Serve at BOTH root and /flight-school-app/ prefix so relative asset paths work
// regardless of which URL the app is accessed from.
const staticPath = path.join(__dirname, 'dfp-neo-platform/public/flight-school-app');
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  app.use('/flight-school-app', express.static(staticPath));
  console.log(`✅ Serving static files from: ${staticPath} (at / and /flight-school-app/)`);
}

// ============================================================
// AIRCRAFT AVAILABILITY & CANCELLATION CODES ENDPOINTS
// ============================================================

// Create AircraftAvailabilityHistory table if it doesn't exist
async function ensureAircraftAvailabilityTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityHistory" (
        "id" SERIAL NOT NULL,
        "date" TEXT NOT NULL,
        "totalFleet" INTEGER NOT NULL DEFAULT 0,
        "dailyAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "flyingWindowStart" TEXT,
        "flyingWindowEnd" TEXT,
        "lastCalculatedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    // Add missing columns if they don't exist (migration)
    try {
      await db.$executeRawUnsafe(`
          ALTER TABLE "AircraftAvailabilityHistory" 
          ADD COLUMN IF NOT EXISTS "flyingWindowStart" TEXT,
          ADD COLUMN IF NOT EXISTS "flyingWindowEnd" TEXT,
          ADD COLUMN IF NOT EXISTS "lastCalculatedAt" TIMESTAMP(3);
      `);
    } catch (alterErr) {
      // Columns may already exist, ignore
    }
    console.log('✅ AircraftAvailabilityHistory table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityHistory table:', err.message);
  }
}

// Ensure AircraftAvailabilityEvent table exists
async function ensureAircraftAvailabilityEventTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AircraftAvailabilityEvent" (
        "id" SERIAL NOT NULL,
        "date" TEXT NOT NULL,
        "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "availableCount" INTEGER NOT NULL,
        "totalFleet" INTEGER NOT NULL,
        "notes" TEXT,
        CONSTRAINT "AircraftAvailabilityEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_date ON "AircraftAvailabilityEvent"("date")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_event_timestamp ON "AircraftAvailabilityEvent"("timestamp")`);
    console.log('✅ AircraftAvailabilityEvent table ready');
  } catch (err) {
    console.error('❌ Failed to ensure AircraftAvailabilityEvent table:', err.message);
  }
}

// GET /api/aircraft-availability-history
// Returns history records, optionally filtered by startDate and endDate
app.get('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { startDate, endDate } = req.query;
    let query = `SELECT * FROM "AircraftAvailabilityHistory"`;
    const params = [];
    if (startDate && endDate) {
      query += ` WHERE "date" >= $1 AND "date" <= $2`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` WHERE "date" >= $1`;
      params.push(startDate);
    } else if (endDate) {
      query += ` WHERE "date" <= $1`;
      params.push(endDate);
    }
    query += ` ORDER BY "date" ASC`;
    const records = await db.$queryRawUnsafe(query, ...params);
    console.log(`✅ GET /api/aircraft-availability-history - returning ${records.length} records`);
    res.json({ history: records });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-history error:', error);
    res.status(500).json({ error: 'Failed to fetch aircraft availability history', details: error.message });
  }
});

// POST /api/aircraft-availability-history
// Upserts (insert or update) a daily summary record
app.post('/api/aircraft-availability-history', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date, totalFleet, dailyAverage, flyingWindowStart, flyingWindowEnd } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    await db.$executeRawUnsafe(`
      INSERT INTO "AircraftAvailabilityHistory" ("date", "totalFleet", "dailyAverage", "flyingWindowStart", "flyingWindowEnd", "lastCalculatedAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("date") DO UPDATE SET
        "totalFleet" = EXCLUDED."totalFleet",
        "dailyAverage" = EXCLUDED."dailyAverage",
        "flyingWindowStart" = EXCLUDED."flyingWindowStart",
        "flyingWindowEnd" = EXCLUDED."flyingWindowEnd",
        "lastCalculatedAt" = NOW(),
        "updatedAt" = NOW()
    `, date, totalFleet || 0, dailyAverage || 0, flyingWindowStart || null, flyingWindowEnd || null);
    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1`, date
    );
    console.log(`✅ POST /api/aircraft-availability-history - upserted record for date: ${date}`);
    res.json({ record: updated[0] });
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

// GET /api/aircraft-availability-events - Get events for a date
app.get('/api/aircraft-availability-events', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" ASC`,
      date
    );
    // Convert BigInt ids to numbers
    const serialized = events.map(e => ({ ...e, id: Number(e.id) }));
    res.json({ events: serialized });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-events error:', error);
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
  }
});

// POST /api/aircraft-availability-events - Create a new event
app.post('/api/aircraft-availability-events', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date, availableCount, totalFleet, notes, timestamp } = req.body;
    if (!date || availableCount === undefined || !totalFleet) {
      return res.status(400).json({ error: 'date, availableCount, totalFleet required' });
    }
    const ts = timestamp ? new Date(timestamp) : new Date();
    await db.$executeRawUnsafe(
      `INSERT INTO "AircraftAvailabilityEvent" ("date", "timestamp", "availableCount", "totalFleet", "notes")
       VALUES ($1, $2, $3, $4, $5)`,
      date, ts, availableCount, totalFleet, notes || null
    );
    const inserted = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "id" DESC LIMIT 1`, date
    );
    const record = inserted[0];
    res.json({ event: { ...record, id: Number(record.id) } });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-events error:', error);
    res.status(500).json({ error: 'Failed to create event', details: error.message });
  }
});

// POST /api/aircraft-availability-recalculate - Recalculate summary for a date
app.post('/api/aircraft-availability-recalculate', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date, flyingWindowStart, flyingWindowEnd, totalFleet, clientTimezoneOffset } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });

    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" ASC`,
      date
    );

    if (!events || events.length === 0) {
      return res.json({ message: 'No events found for this date', dailyAverage: 0, date });
    }

    const toMinutes = (ts) => {
      const d = new Date(ts);
      // Adjust for client timezone: server is UTC, client is local time
      const offsetMinutes = clientTimezoneOffset !== undefined ? clientTimezoneOffset : 0;
      return (d.getUTCHours() + offsetMinutes / 60) * 60 + d.getUTCMinutes();
    };

    const parseWindowTime = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const windowStartMin = flyingWindowStart ? parseWindowTime(flyingWindowStart) : 8 * 60;
    const windowEndMin = flyingWindowEnd ? parseWindowTime(flyingWindowEnd) : 17 * 60;
    const windowDuration = windowEndMin - windowStartMin;

    // Calculate time-weighted average within flying window
    let weightedSum = 0;
    let totalTime = 0;
    const now = new Date();
    const nowMinutes = toMinutes(now);
    const effectiveEnd = Math.min(nowMinutes, windowEndMin);

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const eventMinutes = toMinutes(event.timestamp);
      const nextEventMinutes = i + 1 < events.length ? toMinutes(events[i + 1].timestamp) : effectiveEnd;

      // Clamp to flying window
      const segStart = Math.max(eventMinutes, windowStartMin);
      const segEnd = Math.min(nextEventMinutes, effectiveEnd);

      if (segEnd > segStart) {
        const duration = segEnd - segStart;
        weightedSum += event.availableCount * duration;
        totalTime += duration;
      }
    }

    const dailyAverage = totalTime > 0 ? weightedSum / totalTime : 0;

    // Upsert the summary
    await db.$executeRawUnsafe(`
      INSERT INTO "AircraftAvailabilityHistory" ("date", "totalFleet", "dailyAverage", "flyingWindowStart", "flyingWindowEnd", "lastCalculatedAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("date") DO UPDATE SET
        "totalFleet" = EXCLUDED."totalFleet",
        "dailyAverage" = EXCLUDED."dailyAverage",
        "flyingWindowStart" = EXCLUDED."flyingWindowStart",
        "flyingWindowEnd" = EXCLUDED."flyingWindowEnd",
        "lastCalculatedAt" = NOW(),
        "updatedAt" = NOW()
    `, date, totalFleet || 0, dailyAverage, flyingWindowStart || null, flyingWindowEnd || null);

    const updated = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityHistory" WHERE "date" = $1`, date
    );

    console.log(`✅ POST /api/aircraft-availability-recalculate - date: ${date}, average: ${dailyAverage.toFixed(2)}`);
    res.json({ record: updated[0], dailyAverage, date, eventCount: events.length });
  } catch (error) {
    console.error('❌ POST /api/aircraft-availability-recalculate error:', error);
    res.status(500).json({ error: 'Failed to recalculate', details: error.message });
  }
});

// GET /api/aircraft-availability-current - Get the current aircraft availability
app.get('/api/aircraft-availability-current', async (req, res) => {
  try {
    const db = await getPrisma();
    const today = new Date().toISOString().split('T')[0];
    const events = await db.$queryRawUnsafe(
      `SELECT * FROM "AircraftAvailabilityEvent" WHERE "date" = $1 ORDER BY "timestamp" DESC LIMIT 1`,
      today
    );
    if (events.length === 0) {
      return res.json({ current: null, date: today });
    }
    const latest = events[0];
    res.json({
      current: {
        availableCount: latest.availableCount,
        totalFleet: latest.totalFleet,
        timestamp: latest.timestamp,
        id: Number(latest.id)
      },
      date: today
    });
  } catch (error) {
    console.error('❌ GET /api/aircraft-availability-current error:', error);
    res.status(500).json({ error: 'Failed to get current availability', details: error.message });
  }
});

// ============================================================
// INDIVIDUAL LMP TABLE SETUP
// ============================================================

async function ensureIndividualLMPTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IndividualLMP" (
        "id" TEXT NOT NULL,
        "traineeId" TEXT NOT NULL,
        "traineeFullName" TEXT NOT NULL,
        "lmpType" TEXT NOT NULL,
        "events" JSONB NOT NULL DEFAULT '[]',
        "completedEventIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "IndividualLMP_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IndividualLMP_traineeId_key"
      ON "IndividualLMP"("traineeId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "IndividualLMP_traineeFullName_idx"
      ON "IndividualLMP"("traineeFullName");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "IndividualLMP_traineeId_idx"
      ON "IndividualLMP"("traineeId");
    `);
    console.log('✅ IndividualLMP table ready');
  } catch (err) {
    console.error('❌ Failed to ensure IndividualLMP table:', err.message);
  }
}

// ============================================================
// CANCELLATION CODES ENDPOINTS
// ============================================================

async function ensureCancellationCodesTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CancellationCode" (
        "id" SERIAL NOT NULL,
        "code" TEXT NOT NULL,
        "category" TEXT NOT NULL DEFAULT 'Other',
        "description" TEXT NOT NULL DEFAULT '',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CancellationCode_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CancellationCode_code_key" ON "CancellationCode"("code");
    `);
    console.log('✅ CancellationCode table ready');
  } catch (err) {
    console.error('❌ Failed to ensure CancellationCode table:', err.message);
  }
}

async function seedCancellationCodesIfEmpty(db) {
  try {
    const existing = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "CancellationCode"`);
    const count = Number(existing[0].count);
    if (count > 0) {
      console.log(`ℹ️  CancellationCode table already has ${count} codes - skipping seed`);
      return;
    }
    const defaults = [
      { code: 'WX', category: 'Weather', description: 'Weather - general adverse conditions' },
      { code: 'WX-CB', category: 'Weather', description: 'Weather - cumulonimbus / thunderstorm' },
      { code: 'WX-FOG', category: 'Weather', description: 'Weather - fog / low visibility' },
      { code: 'WX-WIND', category: 'Weather', description: 'Weather - wind above limits' },
      { code: 'AC-SVC', category: 'Aircraft', description: 'Aircraft unserviceable - scheduled maintenance' },
      { code: 'AC-UNSVC', category: 'Aircraft', description: 'Aircraft unserviceable - unscheduled defect' },
      { code: 'AC-INSUF', category: 'Aircraft', description: 'Aircraft insufficient - not enough available' },
      { code: 'STU-SIC', category: 'Student', description: 'Student sick / medically unfit' },
      { code: 'STU-GND', category: 'Student', description: 'Student grounded / suspended' },
      { code: 'STU-UNAV', category: 'Student', description: 'Student unavailable - other reason' },
      { code: 'IP-SIC', category: 'Instructor', description: 'Instructor sick / medically unfit' },
      { code: 'IP-UNAV', category: 'Instructor', description: 'Instructor unavailable - other reason' },
      { code: 'OPS-TEMPO', category: 'Operations', description: 'Operational tempo / tasking conflict' },
      { code: 'OPS-AIRSP', category: 'Operations', description: 'Airspace not available' },
      { code: 'ADMIN', category: 'Administrative', description: 'Administrative cancellation' },
      { code: 'OTHER', category: 'Other', description: 'Other reason (see notes)' },
    ];
    for (const d of defaults) {
      await db.$executeRawUnsafe(
        `INSERT INTO "CancellationCode" ("code", "category", "description") VALUES ($1, $2, $3) ON CONFLICT ("code") DO NOTHING`,
        d.code, d.category, d.description
      );
    }
    console.log(`✅ Seeded ${defaults.length} default cancellation codes`);
  } catch (err) {
    console.error('❌ Failed to seed cancellation codes:', err.message);
  }
}

// GET /api/cancellation-codes - Return all codes
app.get('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    const codes = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" ORDER BY "category" ASC, "code" ASC`);
    const serialized = codes.map(c => ({ ...c, id: Number(c.id) }));
    res.json({ success: true, codes: serialized });
  } catch (error) {
    console.error('❌ GET /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cancellation codes', details: error.message });
  }
});

// POST /api/cancellation-codes - Create or update a code (upsert)
app.post('/api/cancellation-codes', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code, category, description, isActive } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'code is required' });
    await db.$executeRawUnsafe(`
      INSERT INTO "CancellationCode" ("code", "category", "description", "isActive", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("code") DO UPDATE SET
        "category" = EXCLUDED."category",
        "description" = EXCLUDED."description",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = NOW()
    `, code, category || 'Other', description || '', isActive !== false);
    const updated = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1`, code);
    const record = updated[0];
    res.json({ success: true, code: { ...record, id: Number(record.id) } });
  } catch (error) {
    console.error('❌ POST /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to save cancellation code', details: error.message });
  }
});

// PATCH /api/cancellation-codes/:code/toggle - Toggle active status
app.patch('/api/cancellation-codes/:code/toggle', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code } = req.params;
    await db.$executeRawUnsafe(`
      UPDATE "CancellationCode" SET "isActive" = NOT "isActive", "updatedAt" = NOW() WHERE "code" = $1
    `, code);
    const updated = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1`, code);
    if (!updated.length) return res.status(404).json({ success: false, error: 'Code not found' });
    const record = updated[0];
    res.json({ success: true, code: { ...record, id: Number(record.id) } });
  } catch (error) {
    console.error('❌ PATCH /api/cancellation-codes toggle error:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle cancellation code', details: error.message });
  }
});

// DELETE /api/cancellation-codes/:code
app.delete('/api/cancellation-codes/:code', async (req, res) => {
  try {
    const db = await getPrisma();
    const { code } = req.params;
    const existing = await db.$queryRawUnsafe(`SELECT * FROM "CancellationCode" WHERE "code" = $1`, code);
    if (!existing.length) return res.status(404).json({ success: false, error: 'Code not found' });
    await db.$executeRawUnsafe(`DELETE FROM "CancellationCode" WHERE "code" = $1`, code);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE /api/cancellation-codes error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete cancellation code', details: error.message });
  }
});

// ============================================================
// HISTORICAL DATA PERSISTENCE ENDPOINTS
// ============================================================

// GET /api/historical-data - Load persisted publishedSchedules + pt051Assessments
app.get('/api/historical-data', async (req, res) => {
  try {
    const db = await getPrisma();

    // Load publishedSchedules backup
    const schedulesBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_published_schedules' },
      orderBy: { createdAt: 'desc' }
    });

    // Load pt051Assessments backup
    const pt051Backup = await db.dataBackup.findFirst({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' }
    });

    // Load seeding metadata
    const seedingMeta = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      publishedSchedules: schedulesBackup ? schedulesBackup.data : null,
      pt051Assessments: pt051Backup ? pt051Backup.data : null,
      seedingMetadata: seedingMeta ? seedingMeta.data : null,
    });
  } catch (error) {
    console.error('❌ GET /api/historical-data error:', error);
    res.status(500).json({ error: 'Failed to load historical data', details: error.message });
  }
});

// POST /api/historical-data/save - Save publishedSchedules + pt051Assessments
app.post('/api/historical-data/save', async (req, res) => {
  try {
    const db = await getPrisma();
    const { publishedSchedules, pt051Assessments, metadata } = req.body;

    const savedItems = [];

    if (publishedSchedules !== undefined) {
      // Delete old and insert new (upsert pattern via delete+create)
      await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
      await db.dataBackup.create({
        data: { type: 'historical_published_schedules', data: publishedSchedules }
      });
      savedItems.push('publishedSchedules');
    }

    if (pt051Assessments !== undefined) {
      await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
      await db.dataBackup.create({
        data: { type: 'historical_pt051_assessments', data: pt051Assessments }
      });
      savedItems.push('pt051Assessments');
    }

    if (metadata !== undefined) {
      await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });
      await db.dataBackup.create({
        data: { type: 'historical_seeding_metadata', data: metadata }
      });
      savedItems.push('seedingMetadata');
    }

    console.log(`✅ POST /api/historical-data/save - Saved: ${savedItems.join(', ')}`);
    res.json({ success: true, saved: savedItems });
  } catch (error) {
    console.error('❌ POST /api/historical-data/save error:', error);
    res.status(500).json({ error: 'Failed to save historical data', details: error.message });
  }
});

// POST /api/historical-data/seed - Generate and save historical training data
// This is the one-time seeding endpoint. It generates all training records
// from course start dates up to current progress point for each trainee.
app.post('/api/historical-data/seed', async (req, res) => {
  try {
    const db = await getPrisma();

    // Check if seeding has already been done
    const existingMeta = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    if (existingMeta && existingMeta.data && existingMeta.data.seededAt && !req.body.force) {
      return res.json({
        success: false,
        alreadySeeded: true,
        seededAt: existingMeta.data.seededAt,
        message: 'Historical data has already been seeded. Pass force:true to reseed.'
      });
    }

    // ----------------------------------------------------------------
    // RESET: Clear all existing historical data before reseeding
    // This ensures a clean slate for IndividualLMP, PT-051s, and scores
    // ----------------------------------------------------------------
    console.log('🧹 Resetting historical data before reseeding...');

    // Delete all historical seed scores from DB
    await db.score.deleteMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    // Clear all IndividualLMP completedEventIds for active trainees
    // (reset to empty so the new seed data is authoritative)
    await db.$executeRawUnsafe(`
      UPDATE "IndividualLMP"
      SET "completedEventIds" = ARRAY[]::TEXT[], "updatedAt" = NOW()
    `);

    // Clear DataBackup historical records
    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });

    console.log('✅ Reset complete. Starting fresh seed...');

    // Fetch all trainees and instructors
    const trainees = await db.trainee.findMany({
      where: { isActive: true },
      orderBy: { course: 'asc' }
    });

    const instructors = await db.personnel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, rank: true, role: true, unit: true, isQFI: true }
    });

    const qfiInstructors = instructors.filter(i => i.isQFI || i.role === 'QFI');

    if (trainees.length === 0) {
      return res.status(400).json({ error: 'No active trainees found in database' });
    }
    if (qfiInstructors.length === 0) {
      return res.status(400).json({ error: 'No QFI instructors found in database' });
    }

    console.log(`🌱 Seeding historical data for ${trainees.length} trainees with ${qfiInstructors.length} instructors`);

    // Course configuration
    // progressRange: [startEvent, endEvent] - trainee is randomly placed anywhere in this range
    // For FIC courses, centreEvent is still used (original ±3 logic retained)
    const courseConfig = {
      'ADF301': { startDate: '2023-04-01', lmpType: 'BPC+IPC', progressRange: ['BIF TUT2', 'BGF23'] },
      'ADF302': { startDate: '2025-08-01', lmpType: 'BPC+IPC', progressRange: ['BGF10', 'BGF19'] },
      'ADF303': { startDate: '2025-12-01', lmpType: 'BPC+IPC', progressRange: ['BGF1', 'BGF5'] },
      'FIC210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3' },
      'FIC211': { startDate: '2026-01-11', lmpType: 'FIC', centreEvent: 'FIC4' },
      'FIC 210': { startDate: '2025-10-01', lmpType: 'FIC', centreEvent: 'AIT3' },
    };

    // BPC+IPC syllabus ordered sequence
    const BPC_IPC_SYLLABUS = [
      'BGF MB1','BGF MB2','BGF CPT1','BGF TUT1A','BGF TUT1B','BGF TUT2',
      'BGF MB3','BGF MB4','BGF MB5','BGF MB6','BGF CPT2','BGF FTD1','BGF MB7',
      'BGF1','BGF FTD2','BGF2','BGF MB8','BGF CPT3','BGF MB9','BGF TUT3',
      'BGF FTD3','BGF3','BGF FTD4','BGF4','BGF5','BGF MB10','BGF MB11',
      'BGF MB12','BGF CPT4','BGF6','BGF MB13','BGF CPT5','PRE-SOLO QUIZ',
      'BGF7','BGF FTD5','BGF8','PERRT CPT1','BGF9','BGF MB14','BGF FTD6',
      'BGF10','BGF11','BGF MB15','BGF MB16','BGF FTD7','BGF12','BGF13',
      'BGF14','BGF FTD8','BGF15','AREA SOLO QUIZ','BGF16','BGF TUT4',
      'BGF FTD9','BGF17','BGF18','BGF19','BGF20',
      'BIF MB1','BIF MB2','BIF TUT1','BIF CPT1','BIF CPT2',
      'BIF FTD1*','BIF FTD2','BIF FTD3*','BIF1','BIF2',
      'BNF MB1','BNF FTD1','BNF1','BNF2','BNF3','BNF4',
      'BIF MB3','BIF MB4','BIF MB5','BIF TUT2','BIF CPT3',
      'BIF FTD4','BIF FTD5','BIF FTD6','BIF3','BIF4','BIF5',
      'BGF MB17','BGF FTD10','BGF21','BGF22','BGF23','BGF24',
      'BNAV MB1','BNAV TUT1','BNAV FTD1','BNAV1','BNAV2','BNAV3 NAVPT',
      'SCT GF','SCT IF','SCT NAV','SCT FORM','Night SCT',
    ];

    // FIC syllabus ordered sequence (FIC courses use AIT prefix first, then FIC)
    const FIC_SYLLABUS = [
      'FIC MB1','FIC MB2','FIC FTD1','FIC FTD2',
      'FIC1','FIC2','FIC3','FIC FTD3','FIC4','FIC5','FIC6',
      'FIC FTD4','FIC FTD5',
      'FIC IF1','FIC IF2','FIC IF3','FIC IF4','FIC FTD6',
      'AIT1','AIT2','AIT3','AIT4','AIT5','AIT6','AIT7','AIT8',
    ];

    // Event type classification for generating ScheduleEvent records
    const getEventType = (code) => {
      if (code.includes('FTD') || code.includes('CPT') || code.includes('TUT')) return 'ftd';
      if (code.includes('MB') || code.includes('QUIZ') || code.includes('NAVPT') || code.includes('PERRT')) return 'ground';
      return 'flight';
    };

    const getEventDuration = (code, lmpType) => {
      if (code.includes('MB') || code.includes('TUT') || code.includes('QUIZ') || code.includes('NAVPT')) return 2.0;
      if (code.includes('CPT')) return 1.5;
      // FTD events: 2.0hrs for BPC+IPC and FIC courses
      if (code.includes('FTD')) {
        if (lmpType === 'BPC+IPC' || lmpType === 'FIC') return 2.0;
        return 1.0;
      }
      // Flight events: 1.2hrs for BPC+IPC and FIC courses
      if (lmpType === 'FIC' || lmpType === 'BPC+IPC') return 1.2;
      return 1.3;
    };

    // Deterministic seeded random (no global Math.random side effects on each call)
    const seededRand = (seed) => {
      let s = seed;
      return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return Math.abs(s) / 0xffffffff;
      };
    };

    // Generate consistent UUID-like id from components
    const makeEventId = (traineeId, eventCode, date) =>
      `hist-${traineeId.slice(-8)}-${eventCode.replace(/[^a-z0-9]/gi, '')}-${date}`.toLowerCase();

    const makePt051Id = (eventId, traineeName) =>
      `pt051-${eventId}-${traineeName}`.replace(/\s/g, '_');

    const today = new Date();
    const publishedSchedules = {}; // { date: ScheduleEvent[] }
    const pt051Assessments = {};   // { key: Pt051Assessment }
    const scoreRecords = [];       // { traineeId, event, score, date, instructor, notes }

    // Track completed event IDs per trainee for IndividualLMP upsert
    // Key: trainee.id, Value: { traineeFullName, lmpType, completedEventIds: string[] }
    const traineeCompletedEvents = {}; // { traineeId: Set<string> }

    // PT-051 ALL_ELEMENTS - exact 22 elements matching PT051_STRUCTURE in PT051View.tsx
    // This must match exactly: PT051_STRUCTURE.flatMap(cat => cat.elements)
    const ALL_ELEMENTS = [
      // Core Dimensions
      'Airmanship', 'Preparation', 'Technique',
      // Procedural Framework
      'Pre-Post Flight', 'Walk Around', 'Strap-in', 'Ground Checks', 'Airborne Checks',
      // Takeoff
      'Stationary',
      // Departure
      'Visual',
      // Core Handling Skills
      'Effects of Control', 'Trimming', 'Straight and Level',
      // Turns
      'Level medium Turn', 'Level Steep turn',
      // Recovery
      'Visual - Initial & Pitch',
      // Landing
      'Landing', 'Crosswind',
      // Domestics
      'Radio Comms', 'Situational Awareness', 'Lookout', 'Knowledge',
    ];

    // PT-051 grading: 1-5 scale (no 0 for historical data - all events completed satisfactorily)
    // Weighted: 3 = standard, 4 = above standard, occasional 5, rare 2 (marginal)
    const gradePool = [3, 3, 3, 4, 4, 3, 3, 4, 3, 3, 4, 3, 5, 3, 4]; // weighted 3-4, some 5

    // Element-specific comment pools keyed by element name, then grade (1-5)
    const ELEMENT_COMMENTS = {
      'Airmanship': {
        1: ['Struggled to demonstrate basic airmanship throughout the sortie.', 'Displayed limited awareness of sound airmanship principles.', 'Airmanship was below the expected standard for this stage.', 'Required frequent correction to maintain acceptable airmanship.'],
        2: ['Demonstrated basic airmanship, though inconsistently.', 'Some sound airmanship was evident, but standards varied.', 'Showed developing airmanship with several lapses.', 'Airmanship was adequate at times but lacked consistency.'],
        3: ['Demonstrated satisfactory airmanship for this phase.', 'Airmanship met the expected standard overall.', 'Maintained sound airmanship through most sequences.', 'Showed an acceptable level of airmanship throughout.'],
        4: ['Demonstrated strong airmanship across the sortie.', 'Airmanship was consistently above the expected standard.', 'Displayed a confident and well-rounded approach to airmanship.', 'Maintained a high standard of airmanship throughout.'],
        5: ['Demonstrated excellent airmanship at all times.', 'Airmanship was of an exceptionally high standard.', 'Displayed mature and highly polished airmanship throughout.', 'Set the benchmark for airmanship during the sortie.'],
      },
      'Preparation': {
        1: ['Preparation was incomplete and impacted performance.', 'Displayed poor preparation for the task requirements.', 'Insufficient preparation was evident prior to flight.', 'Preparation fell below the expected standard.'],
        2: ['Basic preparation was completed but lacked depth.', 'Preparation covered some key points but missed important details.', 'Showed partial preparation for the sortie.', 'Preparation was adequate in parts but not thorough.'],
        3: ['Preparation was satisfactory for the planned activity.', 'Demonstrated an acceptable level of preparation.', 'Preparation met the expected standard overall.', 'Showed sound preparation for the sortie requirements.'],
        4: ['Preparation was thorough and well considered.', 'Demonstrated strong preparation for all task elements.', 'Arrived well prepared and ready for the sortie.', 'Preparation supported effective task completion.'],
        5: ['Preparation was outstanding in all respects.', 'Demonstrated exceptional preparation and foresight.', 'Arrived comprehensively prepared for the sortie.', 'Set an excellent standard through superior preparation.'],
      },
      'Technique': {
        1: ['Technique was poor and frequently ineffective.', 'Struggled to apply correct handling technique.', 'Technique was below the required standard.', 'Required repeated correction of basic technique.'],
        2: ['Basic technique was evident but inconsistent.', 'Applied some correct techniques, though with errors.', 'Technique is developing but lacked refinement.', 'Demonstrated uneven application of required technique.'],
        3: ['Technique was satisfactory for this stage of training.', 'Applied the required techniques to an acceptable standard.', 'Demonstrated generally sound technique throughout.', 'Technique met the expected standard overall.'],
        4: ['Technique was strong and consistently effective.', 'Applied correct technique with good precision.', 'Demonstrated well-developed handling technique.', 'Technique was above the expected standard.'],
        5: ['Technique was excellent throughout the sortie.', 'Demonstrated highly polished and precise technique.', 'Applied all required techniques to an exceptional standard.', 'Set the benchmark for technical execution.'],
      },
      'Pre-Post Flight': {
        1: ['Struggled to complete pre- and post-flight actions correctly.', 'Pre- and post-flight procedures were poorly executed.', 'Several key pre- and post-flight steps were missed.', 'Required significant prompting during pre- and post-flight actions.'],
        2: ['Completed pre- and post-flight actions with some errors.', 'Demonstrated basic understanding of pre- and post-flight procedures.', 'Some pre- and post-flight steps were completed correctly.', 'Pre- and post-flight actions lacked consistency.'],
        3: ['Completed pre- and post-flight procedures satisfactorily.', 'Pre- and post-flight actions met the expected standard.', 'Demonstrated sound handling of pre- and post-flight requirements.', 'Managed pre- and post-flight procedures adequately.'],
        4: ['Completed pre- and post-flight actions confidently and accurately.', 'Pre- and post-flight procedures were well managed.', 'Demonstrated strong procedural discipline before and after flight.', 'Pre- and post-flight actions were above standard.'],
        5: ['Executed pre- and post-flight procedures flawlessly.', 'Demonstrated exemplary discipline in all pre- and post-flight actions.', 'Pre- and post-flight actions were completed to an exceptional standard.', 'Set the benchmark for pre- and post-flight procedure execution.'],
      },
      'Walk Around': {
        1: ['Walk around was incomplete and lacked attention to detail.', 'Missed several important items during the walk around.', 'Demonstrated poor discipline during the walk around.', 'Required significant prompting to complete the walk around correctly.'],
        2: ['Walk around was completed with some omissions.', 'Demonstrated basic understanding of walk around requirements.', 'Attention to detail during the walk around was inconsistent.', 'Walk around was adequate but lacked thoroughness.'],
        3: ['Walk around was completed satisfactorily.', 'Demonstrated acceptable attention to detail during the walk around.', 'Completed the walk around to the expected standard.', 'Walk around was methodical and generally accurate.'],
        4: ['Walk around was thorough and well conducted.', 'Demonstrated strong attention to detail during inspection.', 'Completed the walk around confidently and accurately.', 'Walk around standard was above expectations.'],
        5: ['Walk around was exceptionally thorough and disciplined.', 'Demonstrated excellent attention to detail throughout the inspection.', 'Completed the walk around to a benchmark standard.', 'Walk around was conducted with outstanding professionalism.'],
      },
      'Strap-in': {
        1: ['Strap-in procedure was poorly executed.', 'Required repeated prompting during strap-in.', 'Missed key steps during strap-in procedure.', 'Strap-in actions were below the expected standard.'],
        2: ['Strap-in procedure was completed with some errors.', 'Demonstrated basic understanding of strap-in actions.', 'Strap-in was adequate but lacked fluency.', 'Some prompting was required during strap-in.'],
        3: ['Strap-in procedure was completed satisfactorily.', 'Demonstrated acceptable strap-in discipline.', 'Strap-in actions met the expected standard.', 'Completed strap-in with only minor errors.'],
        4: ['Strap-in procedure was completed confidently and accurately.', 'Demonstrated strong discipline during strap-in.', 'Strap-in actions were smooth and above standard.', 'Completed strap-in with good accuracy and flow.'],
        5: ['Strap-in procedure was completed flawlessly.', 'Demonstrated excellent strap-in discipline and accuracy.', 'Strap-in actions were completed to an exceptional standard.', 'Set the benchmark for strap-in procedure execution.'],
      },
      'Ground Checks': {
        1: ['Ground checks were poorly conducted and incomplete.', 'Missed several required items during ground checks.', 'Ground check discipline was below standard.', 'Required frequent prompting during ground checks.'],
        2: ['Ground checks were completed with some omissions.', 'Demonstrated basic understanding of ground check requirements.', 'Ground checks were adequate but inconsistent.', 'Some errors were evident during ground checks.'],
        3: ['Ground checks were completed satisfactorily.', 'Demonstrated acceptable discipline during ground checks.', 'Ground checks met the expected standard.', 'Completed ground checks with minor errors only.'],
        4: ['Ground checks were completed accurately and confidently.', 'Demonstrated strong procedural discipline during ground checks.', 'Ground checks were well conducted and above standard.', 'Completed ground checks with good accuracy and flow.'],
        5: ['Ground checks were completed flawlessly.', 'Demonstrated excellent discipline and accuracy during ground checks.', 'Ground checks were conducted to an exceptional standard.', 'Set the benchmark for ground check execution.'],
      },
      'Airborne Checks': {
        1: ['Airborne checks were poorly managed and incomplete.', 'Missed key items during airborne checks.', 'Required significant prompting to complete airborne checks.', 'Airborne check discipline was below standard.'],
        2: ['Airborne checks were completed with some errors.', 'Demonstrated basic understanding of airborne check requirements.', 'Airborne checks were adequate but lacked consistency.', 'Some omissions were evident during airborne checks.'],
        3: ['Airborne checks were completed satisfactorily.', 'Demonstrated acceptable airborne check discipline.', 'Airborne checks met the expected standard.', 'Completed airborne checks with only minor errors.'],
        4: ['Airborne checks were completed confidently and accurately.', 'Demonstrated strong airborne check discipline.', 'Airborne checks were well managed throughout.', 'Completed airborne checks to a high standard.'],
        5: ['Airborne checks were completed flawlessly.', 'Demonstrated excellent discipline during airborne checks.', 'Airborne checks were executed to an exceptional standard.', 'Set the benchmark for airborne check performance.'],
      },
      'Stationary': {
        1: ['Stationary handling before takeoff was poorly managed.', 'Struggled to maintain correct control while stationary.', 'Demonstrated weak procedure discipline in the stationary phase.', 'Required repeated prompting during stationary takeoff actions.'],
        2: ['Stationary handling was completed with some errors.', 'Demonstrated basic control during the stationary phase.', 'Stationary actions were adequate but inconsistent.', 'Some prompting was required during the stationary phase.'],
        3: ['Stationary takeoff actions were completed satisfactorily.', 'Demonstrated acceptable control and discipline while stationary.', 'Stationary handling met the expected standard.', 'Managed the stationary phase with minor errors only.'],
        4: ['Stationary handling was confident and well controlled.', 'Demonstrated strong discipline in the stationary phase.', 'Completed stationary takeoff actions to a high standard.', 'Stationary control was above the expected standard.'],
        5: ['Stationary handling was excellent throughout.', 'Demonstrated exceptional control and discipline while stationary.', 'Completed stationary takeoff actions flawlessly.', 'Set the benchmark in the stationary takeoff phase.'],
      },
      'Visual': {
        1: ['Visual departure was poorly flown and below standard.', 'Struggled to maintain the correct departure profile.', 'Required frequent correction during the visual departure.', 'Demonstrated limited confidence in the visual departure phase.'],
        2: ['Visual departure was completed with some inconsistencies.', 'Demonstrated basic understanding of the departure profile.', 'Visual departure control was adequate but variable.', 'Some corrections were required during departure.'],
        3: ['Visual departure was flown satisfactorily.', 'Maintained an acceptable visual departure profile.', 'Demonstrated sound handling during the visual departure.', 'Visual departure met the expected standard.'],
        4: ['Visual departure was flown confidently and accurately.', 'Maintained a strong and consistent departure profile.', 'Demonstrated above-standard handling on departure.', 'Visual departure was well managed throughout.'],
        5: ['Visual departure was flown exceptionally well.', 'Demonstrated excellent control and precision on departure.', 'Maintained an outstanding departure profile throughout.', 'Set the benchmark for visual departure execution.'],
      },
      'Effects of Control': {
        1: ['Demonstrated poor understanding of the effects of control.', 'Struggled to recognise and apply control inputs correctly.', 'Effects of control were not understood to the required standard.', 'Required repeated correction when demonstrating control effects.'],
        2: ['Demonstrated basic understanding of the effects of control.', 'Some correct responses were evident, though inconsistent.', 'Effects of control knowledge is developing but incomplete.', 'Applied control inputs with mixed accuracy.'],
        3: ['Demonstrated satisfactory understanding of the effects of control.', 'Recognised and applied control inputs to an acceptable standard.', 'Effects of control were understood at the expected level.', 'Managed control inputs with minor errors only.'],
        4: ['Demonstrated strong understanding of the effects of control.', 'Applied control inputs accurately and with confidence.', 'Showed above-standard awareness of aircraft response.', 'Effects of control were well demonstrated throughout.'],
        5: ['Demonstrated excellent understanding of the effects of control.', 'Applied control inputs with exceptional precision and awareness.', 'Showed an outstanding grasp of aircraft response.', 'Set the benchmark in demonstrating the effects of control.'],
      },
      'Trimming': {
        1: ['Struggled to trim the aircraft correctly.', 'Trimming technique was poor and inconsistent.', 'Required repeated prompting to maintain correct trim.', 'Demonstrated limited understanding of trimming requirements.'],
        2: ['Basic trimming was evident but inconsistent.', 'Demonstrated some understanding of trimming technique.', 'Trimming was adequate at times but lacked accuracy.', 'Required occasional correction when trimming.'],
        3: ['Trimming was completed to a satisfactory standard.', 'Demonstrated acceptable trim technique throughout.', 'Managed aircraft trim with only minor errors.', 'Trimming met the expected standard for this stage.'],
        4: ['Demonstrated strong and accurate trimming technique.', 'Maintained aircraft trim confidently throughout.', 'Trimming was smooth and above standard.', 'Showed good anticipation in trim management.'],
        5: ['Demonstrated excellent trimming technique throughout.', 'Managed trim with exceptional accuracy and finesse.', 'Aircraft was consistently well trimmed in all phases.', 'Set the benchmark for trimming performance.'],
      },
      'Straight and Level': {
        1: ['Struggled to maintain straight and level flight.', 'Control in straight and level was below standard.', 'Frequent deviations occurred in attitude and altitude.', 'Required continuous correction in straight and level.'],
        2: ['Straight and level flight was maintained inconsistently.', 'Demonstrated basic ability in straight and level.', 'Some acceptable control was evident, though variable.', 'Minor to moderate deviations were common.'],
        3: ['Maintained straight and level flight satisfactorily.', 'Demonstrated acceptable control in straight and level.', 'Straight and level performance met the expected standard.', 'Only minor deviations were evident.'],
        4: ['Maintained straight and level flight accurately and confidently.', 'Demonstrated strong control in straight and level.', 'Straight and level performance was above standard.', 'Held attitude and altitude with good precision.'],
        5: ['Maintained excellent straight and level flight throughout.', 'Demonstrated exceptional precision and control.', 'Straight and level performance was of benchmark standard.', 'Held the aircraft steadily and accurately at all times.'],
      },
      'Level medium Turn': {
        1: ['Struggled to maintain control in level medium turns.', 'Level medium turns were poorly executed.', 'Significant deviations occurred during the turn.', 'Required repeated correction throughout level medium turns.'],
        2: ['Level medium turns were completed with some errors.', 'Demonstrated basic understanding of the manoeuvre.', 'Control during level medium turns was inconsistent.', 'Some deviations were evident in altitude and balance.'],
        3: ['Level medium turns were flown satisfactorily.', 'Demonstrated acceptable control throughout the manoeuvre.', 'Level medium turns met the expected standard.', 'Minor deviations only during execution.'],
        4: ['Level medium turns were flown confidently and accurately.', 'Demonstrated strong control and coordination in the turn.', 'Level medium turns were above the expected standard.', 'Maintained good precision throughout the manoeuvre.'],
        5: ['Level medium turns were flown exceptionally well.', 'Demonstrated excellent coordination and precision.', 'Executed level medium turns to a benchmark standard.', 'Maintained outstanding control throughout the manoeuvre.'],
      },
      'Level Steep turn': {
        1: ['Struggled significantly during level steep turns.', 'Level steep turns were below the required standard.', 'Control and accuracy in steep turns were poor.', 'Required substantial correction during steep turns.'],
        2: ['Demonstrated basic ability in level steep turns.', 'Steep turns were completed with several inconsistencies.', 'Control during steep turns was variable.', 'Some understanding was evident, but accuracy was limited.'],
        3: ['Level steep turns were completed satisfactorily.', 'Demonstrated acceptable control during steep turns.', 'Steep turn performance met the expected standard.', 'Only minor deviations were evident.'],
        4: ['Level steep turns were flown confidently and accurately.', 'Demonstrated strong control and coordination in steep turns.', 'Steep turns were above the expected standard.', 'Maintained good precision throughout the manoeuvre.'],
        5: ['Level steep turns were flown exceptionally well.', 'Demonstrated excellent precision, balance and control.', 'Executed steep turns to a benchmark standard.', 'Maintained outstanding accuracy throughout the manoeuvre.'],
      },
      'Visual - Initial & Pitch': {
        1: ['Recovery actions were poorly executed.', 'Struggled to apply correct initial and pitch recovery actions.', 'Recovery technique was below standard.', 'Required repeated prompting during the recovery sequence.'],
        2: ['Demonstrated basic recovery technique with errors.', 'Initial and pitch recovery actions were inconsistent.', 'Some correct actions were evident, though not reliable.', 'Recovery performance requires further development.'],
        3: ['Recovery actions were completed satisfactorily.', 'Demonstrated acceptable initial and pitch recovery technique.', 'Recovery performance met the expected standard.', 'Minor errors only during the recovery sequence.'],
        4: ['Recovery actions were completed confidently and accurately.', 'Demonstrated strong technique in initial and pitch recovery.', 'Recovery performance was above the expected standard.', 'Managed the recovery sequence with good precision.'],
        5: ['Recovery actions were executed exceptionally well.', 'Demonstrated excellent technique throughout the recovery sequence.', 'Initial and pitch recovery were completed to a benchmark standard.', 'Recovery performance was precise, confident and highly effective.'],
      },
      'Landing': {
        1: ['Landing performance was below the required standard.', 'Struggled to manage the landing sequence safely and accurately.', 'Landing technique was poor and inconsistent.', 'Required significant assistance during landing.'],
        2: ['Landing was completed with some errors.', 'Demonstrated basic landing technique, though inconsistently.', 'Control during landing was adequate at times.', 'Landing performance requires further refinement.'],
        3: ['Landing was completed to a satisfactory standard.', 'Demonstrated acceptable landing technique overall.', 'Landing performance met the expected standard.', 'Minor errors only during the landing sequence.'],
        4: ['Landing was completed confidently and accurately.', 'Demonstrated strong landing technique and control.', 'Landing performance was above the expected standard.', 'Managed the landing sequence smoothly and effectively.'],
        5: ['Landing was executed exceptionally well.', 'Demonstrated excellent judgment, control and technique.', 'Landing performance was of benchmark standard.', 'Completed the landing sequence with outstanding precision.'],
      },
      'Crosswind': {
        1: ['Struggled significantly with crosswind landing technique.', 'Crosswind control was below the required standard.', 'Demonstrated poor correction for crosswind conditions.', 'Required significant assistance during crosswind landing.'],
        2: ['Demonstrated basic crosswind technique with inconsistencies.', 'Some correct crosswind inputs were evident.', 'Crosswind landing performance was adequate but variable.', 'Requires further development in crosswind control.'],
        3: ['Managed crosswind conditions to a satisfactory standard.', 'Demonstrated acceptable crosswind landing technique.', 'Crosswind performance met the expected standard.', 'Applied appropriate corrections with minor errors only.'],
        4: ['Managed crosswind conditions confidently and accurately.', 'Demonstrated strong crosswind correction and control.', 'Crosswind landing performance was above standard.', 'Applied appropriate inputs smoothly and effectively.'],
        5: ['Demonstrated excellent crosswind landing technique throughout.', 'Managed crosswind conditions with exceptional control.', 'Crosswind performance was of benchmark standard.', 'Applied precise and confident corrections at all times.'],
      },
      'Radio Comms': {
        1: ['Radio calls were unclear and below standard.', 'Struggled to make correct and timely radio calls.', 'Radio communication required frequent correction.', 'Demonstrated poor radio discipline.'],
        2: ['Basic radio calls were made, though inconsistently.', 'Demonstrated partial understanding of required phraseology.', 'Radio communications were adequate at times.', 'Some calls lacked clarity or timeliness.'],
        3: ['Radio communications were satisfactory overall.', 'Demonstrated acceptable phraseology and timing.', 'Radio calls met the expected standard.', 'Communicated effectively with only minor errors.'],
        4: ['Radio communications were clear and well timed.', 'Demonstrated strong radio discipline and phraseology.', 'Radio calls were above the expected standard.', 'Communicated confidently and effectively throughout.'],
        5: ['Radio communications were excellent throughout.', 'Demonstrated exceptional clarity, timing and discipline.', 'Radio calls were of benchmark standard.', 'Communicated professionally and precisely at all times.'],
      },
      'Situational Awareness': {
        1: ['Situational awareness was poor throughout the sortie.', 'Struggled to maintain awareness of the overall situation.', 'Frequently lost awareness of aircraft state and environment.', 'Required repeated prompting to regain situational awareness.'],
        2: ['Demonstrated basic situational awareness, though inconsistently.', 'Awareness of aircraft state and environment was variable.', 'Some important cues were missed during the sortie.', 'Situational awareness requires further development.'],
        3: ['Maintained satisfactory situational awareness overall.', 'Demonstrated acceptable awareness of aircraft state and environment.', 'Situational awareness met the expected standard.', 'Minor lapses only, with timely recovery.'],
        4: ['Maintained strong situational awareness throughout.', 'Demonstrated good awareness of aircraft state, position and threats.', 'Situational awareness was above the expected standard.', 'Anticipated developments well during the sortie.'],
        5: ['Situational awareness was excellent at all times.', 'Demonstrated exceptional awareness of the full operating picture.', 'Anticipated changes and threats with maturity and confidence.', 'Set the benchmark for situational awareness.'],
      },
      'Lookout': {
        1: ['Lookout was ineffective and below standard.', 'Failed to maintain an adequate visual scan.', 'Demonstrated poor lookout discipline throughout.', 'Required repeated prompting to maintain lookout.'],
        2: ['Demonstrated basic lookout, though inconsistently.', 'Visual scan was present but not sustained.', 'Lookout discipline requires further development.', 'Some threats or cues were not detected promptly.'],
        3: ['Maintained satisfactory lookout throughout most phases.', 'Demonstrated acceptable visual scan discipline.', 'Lookout met the expected standard overall.', 'Minor lapses only in scan effectiveness.'],
        4: ['Maintained a strong and consistent lookout.', 'Demonstrated good visual scan discipline throughout.', 'Lookout was above the expected standard.', 'Detected and responded to cues effectively.'],
        5: ['Lookout was excellent throughout the sortie.', 'Demonstrated exceptional visual scan discipline and awareness.', 'Maintained continuous and highly effective lookout.', 'Set the benchmark for lookout performance.'],
      },
      'Knowledge': {
        1: ['Knowledge level was below the required standard.', 'Demonstrated significant gaps in required knowledge.', 'Struggled to answer basic knowledge questions.', 'Knowledge deficiencies affected task performance.'],
        2: ['Demonstrated basic knowledge, though with some gaps.', 'Some understanding was evident, but application was inconsistent.', 'Knowledge was adequate in parts only.', 'Requires further consolidation of key knowledge areas.'],
        3: ['Demonstrated satisfactory knowledge for this stage.', 'Knowledge met the expected standard overall.', 'Showed sound understanding of key concepts.', 'Applied knowledge adequately during the sortie.'],
        4: ['Demonstrated strong knowledge throughout.', 'Showed good understanding and application of key concepts.', 'Knowledge was above the expected standard.', 'Applied knowledge confidently and effectively.'],
        5: ['Demonstrated excellent knowledge in all assessed areas.', 'Showed exceptional understanding and application throughout.', 'Knowledge was of benchmark standard.', 'Applied knowledge with confidence, accuracy and depth.'],
      },
    };

    // Helper: pick a random comment for a given element and grade
    const getElementComment = (element, grade, randFn) => {
      const pool = (ELEMENT_COMMENTS[element] && ELEMENT_COMMENTS[element][grade]) || [];
      if (pool.length === 0) return 'Standard met.';
      return pool[Math.floor(randFn() * pool.length)];
    };

    // Track marginal events per course per date (at most one per course per day)
    // Key: `${course}-${dateStr}`, value: true if marginal already assigned for that course+day
    const marginalUsed = {};

    // Process each trainee
    for (const trainee of trainees) {
      const course = trainee.course;
      const config = courseConfig[course];
      if (!config) continue; // Skip courses not in config (ADF304, ADF305, IFF6 etc)

      const syllabus = config.lmpType === 'FIC' ? FIC_SYLLABUS : BPC_IPC_SYLLABUS;

      // Each trainee gets a unique seed based on their id/idNumber
      const seedVal = trainee.idNumber ? parseInt(String(trainee.idNumber).replace(/\D/g, '') || '0') : parseInt(trainee.id.slice(-8), 16);
      const rand = seededRand(isNaN(seedVal) ? 42 : seedVal);

      // Determine the last syllabus index for this trainee
      let traineeLastIdx;

      if (config.progressRange) {
        // Range-based progress: randomly pick an index within [rangeStartIdx, rangeEndIdx]
        const [rangeStartEvent, rangeEndEvent] = config.progressRange;
        const rangeStartIdx = syllabus.indexOf(rangeStartEvent);
        const rangeEndIdx = syllabus.indexOf(rangeEndEvent);

        if (rangeStartIdx === -1) {
          console.warn(`⚠️ Range start event '${rangeStartEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }
        if (rangeEndIdx === -1) {
          console.warn(`⚠️ Range end event '${rangeEndEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }

        const rangeSize = rangeEndIdx - rangeStartIdx + 1;
        traineeLastIdx = rangeStartIdx + Math.floor(rand() * rangeSize);
        console.log(`📍 ${trainee.fullName} (${course}): progress at index ${traineeLastIdx} → '${syllabus[traineeLastIdx]}' (range: '${rangeStartEvent}' to '${rangeEndEvent}')`);
      } else {
        // FIC courses: use centreEvent ± 3 logic (unchanged)
        const centreIdx = syllabus.indexOf(config.centreEvent);
        if (centreIdx === -1) {
          console.warn(`⚠️ Centre event '${config.centreEvent}' not found in ${config.lmpType} syllabus for course ${course}`);
          continue;
        }
        const progressOffset = Math.floor(rand() * 7) - 3; // -3 to +3
        traineeLastIdx = Math.max(0, Math.min(syllabus.length - 1, centreIdx + progressOffset));
      }

      const eventsToGenerate = syllabus.slice(0, traineeLastIdx + 1);

      if (eventsToGenerate.length === 0) continue;

      // Date spread: from course start to today
      const startDate = new Date(config.startDate);
      const endDate = new Date(today);
      // Each trainee's last event is 0-14 days ago (± 2 weeks spread)
      const trailingDays = Math.floor(rand() * 15); // 0-14 days ago
      endDate.setDate(endDate.getDate() - trailingDays);
      const totalDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
      const eventCount = eventsToGenerate.length;

      // ±14 day overall schedule offset per trainee
      const dateOffsetDays = Math.floor(rand() * 29) - 14;

      // Pick 3-4 instructors to use for this trainee (realistic - not all instructors every time)
      const shuffledInstructors = [...qfiInstructors].sort(() => rand() - 0.5);
      const traineeInstructors = shuffledInstructors.slice(0, 3 + Math.floor(rand() * 2));

      // Initialise completed events tracker for this trainee
      if (!traineeCompletedEvents[trainee.id]) {
        traineeCompletedEvents[trainee.id] = {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType: config.lmpType,
          completedIds: new Set(),
        };
      }

      for (let i = 0; i < eventsToGenerate.length; i++) {
        const code = eventsToGenerate[i];
        const eventType = getEventType(code);
        const duration = getEventDuration(code, config.lmpType);

        // Calculate date for this event (evenly distributed across the course date range)
        const progressFraction = eventCount > 1 ? i / (eventCount - 1) : 0;
        const dayOffset = Math.floor(progressFraction * totalDays);
        const eventDate = new Date(startDate);
        eventDate.setDate(eventDate.getDate() + dayOffset + dateOffsetDays);

        // Clamp to valid range
        if (eventDate > today) eventDate.setTime(today.getTime() - 24 * 60 * 60 * 1000);
        if (eventDate < startDate) eventDate.setTime(startDate.getTime());

        // Skip weekends
        while (eventDate.getDay() === 0 || eventDate.getDay() === 6) {
          eventDate.setDate(eventDate.getDate() + 1);
        }

        const dateStr = eventDate.toISOString().split('T')[0];
        const instructor = traineeInstructors[i % traineeInstructors.length];

        // Start time: 8am-14pm range, in 0.5hr increments
        const startHour = 8 + Math.floor(rand() * 6);
        const startTime = startHour + (rand() > 0.5 ? 0.5 : 0);

        const eventId = makeEventId(trainee.id, code, dateStr);

        // Build ScheduleEvent (training record)
        const scheduleEvent = {
          id: eventId,
          date: dateStr,
          type: eventType,
          instructor: instructor.name,
          student: trainee.fullName,
          flightNumber: code,
          eventCode: code,
          duration: duration,
          startTime: startTime,
          resourceId: eventType === 'flight' ? 'aircraft-hist' : (eventType === 'ftd' ? 'ftd-1' : 'ground-1'),
          color: '#4CAF50',
          flightType: 'Dual',
          locationType: 'Local',
          origin: 'YMES',
          destination: 'YMES',
          traineeId: trainee.idNumber,
          isHistoricalSeed: true,
        };

        // Add to publishedSchedules
        if (!publishedSchedules[dateStr]) publishedSchedules[dateStr] = [];
        publishedSchedules[dateStr].push(scheduleEvent);

        // Generate logbook entry for ALL flying events (flight type only)
        if (eventType === 'flight') {
          const logbookId = `logbook-${eventId}`;
          const logbookEntry = {
            id: logbookId,
            date: dateStr,
            type: 'logbook',
            instructor: instructor.name,
            student: trainee.fullName,
            flightNumber: code,
            eventCode: code,
            duration: duration,
            startTime: startTime,
            resourceId: 'aircraft-hist',
            color: '#2196F3',
            flightType: 'Dual',
            locationType: 'Local',
            origin: 'YMES',
            destination: 'YMES',
            traineeId: trainee.idNumber,
            isHistoricalSeed: true,
            isLogbook: true,
            parentEventId: eventId,
          };
          // Logbook entries stored under same date key with logbook flag
          publishedSchedules[dateStr].push(logbookEntry);
        }

        // Generate PT-051 for ALL event types
        // Flight/FTD: full assessment with graded elements and element-specific comments
        // Ground/other: DCO-only record (no element scores required)
        if (eventType === 'flight' || eventType === 'ftd') {
          const pt051Key = `pt051-${eventId}-${trainee.fullName}`;
          const marginalKey = `${course}-${dateStr}`;

          // One marginal (grade 2) event allowed per course per day
          // ~15% probability - only if not already used for this course+day
          const canBeMarginal = !marginalUsed[marginalKey] && rand() < 0.15;
          const isMarginalEvent = canBeMarginal;
          if (isMarginalEvent) marginalUsed[marginalKey] = true;

          // Overall grade: 3-5 normally, 2 if marginal
          let overallGrade;
          if (isMarginalEvent) {
            overallGrade = 2;
          } else {
            // Weighted: mostly 3-4, occasionally 5
            const overallPool = [3, 3, 3, 4, 4, 4, 3, 4, 3, 5, 3, 4, 3, 3, 4];
            overallGrade = overallPool[Math.floor(rand() * overallPool.length)];
          }

          // Generate scores for all 22 elements with element-specific comments
          // Grade scale: 1=Unsatisfactory, 2=Marginal, 3=Satisfactory, 4=Above Standard, 5=Exceptional
          const scores = ALL_ELEMENTS.map(element => {
            let grade;
            if (isMarginalEvent) {
              // Marginal event: mix of 2s and 3s, no 1s (clean progression)
              const marginalPool = [2, 2, 3, 2, 3, 3, 2, 3, 2, 3];
              grade = marginalPool[Math.floor(rand() * marginalPool.length)];
            } else if (overallGrade >= 4) {
              // Above-standard event: 3s, 4s, and 5s
              const highPool = [3, 4, 4, 4, 5, 4, 3, 4, 4, 5, 4, 3, 4, 4, 5];
              grade = highPool[Math.floor(rand() * highPool.length)];
            } else {
              // Standard event: 3s and 4s
              grade = gradePool[Math.floor(rand() * gradePool.length)];
            }
            // Use element-specific comment matching the assigned grade
            const comment = getElementComment(element, grade, rand);
            return { element, grade, comment };
          });

          // Overall result: P/F reflects trainee performance; DCO reflects duty carried out
          const overallResult = overallGrade >= 2 ? 'P' : 'F';

          pt051Assessments[pt051Key] = {
            id: pt051Key,
            traineeFullName: trainee.fullName,
            eventId: eventId,
            flightNumber: code,
            date: dateStr,
            instructorName: instructor.name,
            overallGrade,
            overallResult,
            dcoResult: 'DCO',
            overallComments: overallGrade >= 5 ? 'Exceptional performance throughout. All elements met or exceeded.' :
                             overallGrade === 4 ? 'Strong performance. Standards consistently met and exceeded.' :
                             overallGrade === 3 ? 'Satisfactory performance. All required standards achieved.' :
                             'Performance met minimum standard. Consolidation required on some elements.',
            startTime,
            duration,
            endTime: startTime + duration,
            scores,
            isCompleted: true,
            isHistoricalSeed: true,
          };

          // Mark this event as completed in IndividualLMP (PT-051 exists = completed)
          // Strip asterisks for LMP matching (e.g. 'BIF FTD1*' → 'BIF FTD1')
          const normalizedCode = code.replace('*', '');
          traineeCompletedEvents[trainee.id].completedIds.add(normalizedCode);

        } else {
          // Ground/non-flight events: generate a DCO-only PT-051 record (no element scores)
          const pt051Key = `pt051-${eventId}-${trainee.fullName}`;
          pt051Assessments[pt051Key] = {
            id: pt051Key,
            traineeFullName: trainee.fullName,
            eventId: eventId,
            flightNumber: code,
            date: dateStr,
            instructorName: instructor.name,
            overallGrade: null,
            overallResult: null,
            dcoResult: 'DCO',
            overallComments: '',
            startTime,
            duration,
            endTime: startTime + duration,
            scores: [],
            isCompleted: true,
            isHistoricalSeed: true,
          };

          // Mark ground events as completed in IndividualLMP as well
          const normalizedCode = code.replace('*', '');
          traineeCompletedEvents[trainee.id].completedIds.add(normalizedCode);
        }

        // Add score record for DB persistence
        // Flight/FTD: use the overallGrade value (1-5); ground: percentage (70-100)
        const scoreVal = eventType === 'ground'
          ? 70 + Math.floor(rand() * 31)  // 70-100%
          : 3 + Math.floor(rand() * 3);   // 3-5 (no fails in clean progression)
        scoreRecords.push({
          traineeId: trainee.id,
          event: code,
          score: scoreVal,
          date: eventDate,
          instructor: instructor.name,
          notes: `Historical seed: ${course} - ${code}`,
        });
      }
    }

    // Save scores to DB (scores were cleared above, so no duplicates expected)
    let scoresInserted = 0;
    let scoresSkipped = 0;

    for (const rec of scoreRecords) {
      try {
        await db.score.create({ data: rec });
        scoresInserted++;
      } catch (err) {
        // Fallback: skip if a duplicate somehow exists
        console.warn(`⚠️ Could not insert score for trainee ${rec.traineeId} event ${rec.event}:`, err.message);
        scoresSkipped++;
      }
    }

    // Update IndividualLMP for each processed trainee
    // Set completedEventIds to the set of events that have a PT-051 assessment
    let lmpUpdated = 0;
    let lmpSkipped = 0;

    for (const [traineeId, data] of Object.entries(traineeCompletedEvents)) {
      try {
        const completedEventIds = Array.from(data.completedIds);

        // Apply BIF FTD dependency rules (mirror the lmp-sync + fix-bif-ftd-dependencies logic)
        // Rule 1: If BIF FTD2 is complete, mark BIF FTD1 complete
        if (completedEventIds.includes('BIF FTD2') && !completedEventIds.includes('BIF FTD1')) {
          completedEventIds.push('BIF FTD1');
          console.log(`📍 ${data.traineeFullName}: Auto-marking BIF FTD1 complete (BIF FTD2 is complete)`);
        }
        // Rule 2: If BIF1 is complete, mark BIF FTD3 complete
        if (completedEventIds.includes('BIF1') && !completedEventIds.includes('BIF FTD3')) {
          completedEventIds.push('BIF FTD3');
          console.log(`📍 ${data.traineeFullName}: Auto-marking BIF FTD3 complete (BIF1 is complete)`);
        }
        // Rule 3: Remove asterisk variants if clean versions already present
        const deduplicated = completedEventIds.filter(id => {
          if (id === 'BIF FTD1*' && completedEventIds.includes('BIF FTD1')) return false;
          if (id === 'BIF FTD3*' && completedEventIds.includes('BIF FTD3')) return false;
          return true;
        });

        await db.individualLMP.upsert({
          where: { traineeId },
          update: {
            traineeFullName: data.traineeFullName,
            lmpType: data.lmpType,
            completedEventIds: deduplicated,
            updatedAt: new Date(),
          },
          create: {
            traineeId,
            traineeFullName: data.traineeFullName,
            lmpType: data.lmpType,
            events: [],
            completedEventIds: deduplicated,
          },
        });

        console.log(`✅ IndividualLMP updated for ${data.traineeFullName}: ${deduplicated.length} events completed`);
        lmpUpdated++;
      } catch (err) {
        console.warn(`⚠️ Could not update IndividualLMP for traineeId ${traineeId}:`, err.message);
        lmpSkipped++;
      }
    }

    // ----------------------------------------------------------------
    // POST-SEED: Run BIF FTD dependency fix across ALL active ADF trainees
    // This catches any trainees whose IndividualLMP was not touched by this
    // seed run (e.g. trainees on courses not in courseConfig) but who may
    // already have BIF FTD2 or BIF1 in their completedEventIds from a
    // previous sync or manual entry.
    // ----------------------------------------------------------------
    console.log('🔧 Running BIF FTD dependency fix across all active ADF trainees...');
    try {
      const adfTrainees = await db.trainee.findMany({
        where: { isActive: true, course: { startsWith: 'ADF' } },
        include: { individualLMP: true },
      });

      let ftd1Fixed = 0, ftd3Fixed = 0, asterisksRemoved = 0;

      for (const t of adfTrainees) {
        if (!t.individualLMP) continue;
        const ids = t.individualLMP.completedEventIds || [];
        const updated = [...ids];
        let changed = false;

        if (updated.includes('BIF FTD2') && !updated.includes('BIF FTD1')) {
          updated.push('BIF FTD1');
          changed = true;
          ftd1Fixed++;
          console.log(`🔧 ${t.fullName}: BIF FTD1 marked complete (BIF FTD2 done)`);
        }
        if (updated.includes('BIF1') && !updated.includes('BIF FTD3')) {
          updated.push('BIF FTD3');
          changed = true;
          ftd3Fixed++;
          console.log(`🔧 ${t.fullName}: BIF FTD3 marked complete (BIF1 done)`);
        }

        // Remove asterisk variants
        const filtered = updated.filter(id => {
          if (id === 'BIF FTD1*' && updated.includes('BIF FTD1')) return false;
          if (id === 'BIF FTD3*' && updated.includes('BIF FTD3')) return false;
          return true;
        });
        if (filtered.length !== updated.length) {
          updated.splice(0, updated.length, ...filtered);
          changed = true;
          asterisksRemoved++;
        }

        if (changed) {
          await db.individualLMP.update({
            where: { traineeId: t.id },
            data: { completedEventIds: updated, updatedAt: new Date() },
          });
        }
      }

      console.log(`✅ BIF FTD fix complete: FTD1 fixed=${ftd1Fixed}, FTD3 fixed=${ftd3Fixed}, asterisks removed=${asterisksRemoved}`);
    } catch (bifErr) {
      console.warn('⚠️ BIF FTD post-seed fix encountered an error:', bifErr.message);
    }

    // Save publishedSchedules and pt051Assessments to DataBackup
    await db.dataBackup.create({
      data: { type: 'historical_published_schedules', data: publishedSchedules }
    });

    await db.dataBackup.create({
      data: { type: 'historical_pt051_assessments', data: pt051Assessments }
    });

    const metadata = {
      seededAt: new Date().toISOString(),
      traineeCount: trainees.filter(t => courseConfig[t.course]).length,
      eventCount: Object.values(publishedSchedules).flat().length,
      pt051Count: Object.keys(pt051Assessments).length,
      scoresInserted,
      scoresSkipped,
      lmpUpdated,
      lmpSkipped,
      bifFtdDependenciesApplied: true,
      coursesSeeded: [...new Set(trainees.filter(t => courseConfig[t.course]).map(t => t.course))],
    };

    await db.dataBackup.create({
      data: { type: 'historical_seeding_metadata', data: metadata }
    });

    console.log(`✅ Historical seeding complete:`, metadata);
    res.json({ success: true, ...metadata });

  } catch (error) {
    console.error('❌ POST /api/historical-data/seed error:', error);
    res.status(500).json({ error: 'Failed to seed historical data', details: error.message });
  }
});

// POST /api/historical-data/refresh-dates - Shift all historical dates forward relative to today
// This is the ongoing refresh feature to keep historical data current-looking
app.post('/api/historical-data/refresh-dates', async (req, res) => {
  try {
    const db = await getPrisma();

    // Load current historical data
    const schedulesBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_published_schedules' },
      orderBy: { createdAt: 'desc' }
    });
    const pt051Backup = await db.dataBackup.findFirst({
      where: { type: 'historical_pt051_assessments' },
      orderBy: { createdAt: 'desc' }
    });
    const metaBackup = await db.dataBackup.findFirst({
      where: { type: 'historical_seeding_metadata' },
      orderBy: { createdAt: 'desc' }
    });

    if (!schedulesBackup || !metaBackup) {
      return res.status(400).json({ error: 'No historical data found. Run seeding first.' });
    }

    const publishedSchedules = schedulesBackup.data;
    const pt051Assessments = pt051Backup ? pt051Backup.data : {};
    const metadata = metaBackup.data;

    const seededAt = new Date(metadata.seededAt);
    const today = new Date();
    const daysDrift = Math.floor((today - seededAt) / (1000 * 60 * 60 * 24));

    if (daysDrift <= 0) {
      return res.json({ success: true, message: 'No date refresh needed - data is already current', daysDrift });
    }

    // Shift all event dates forward by daysDrift, preserving sequence and spacing
    const newPublishedSchedules = {};
    const dateMap = {}; // old date -> new date

    for (const [dateStr, events] of Object.entries(publishedSchedules)) {
      const oldDate = new Date(dateStr);
      const newDate = new Date(oldDate);
      newDate.setDate(newDate.getDate() + daysDrift);

      // Clamp to today max
      if (newDate > today) newDate.setTime(today.getTime() - 24 * 60 * 60 * 1000);

      const newDateStr = newDate.toISOString().split('T')[0];
      dateMap[dateStr] = newDateStr;

      if (!newPublishedSchedules[newDateStr]) newPublishedSchedules[newDateStr] = [];
      const updatedEvents = events.map(e => ({ ...e, date: newDateStr }));
      newPublishedSchedules[newDateStr].push(...updatedEvents);
    }

    // Update PT-051 dates
    const newPt051Assessments = {};
    for (const [key, assessment] of Object.entries(pt051Assessments)) {
      const newDate = dateMap[assessment.date] || assessment.date;
      newPt051Assessments[key] = { ...assessment, date: newDate };
    }

    // Update score dates in DB
    const scores = await db.score.findMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    let scoresUpdated = 0;
    for (const score of scores) {
      const oldDateStr = score.date.toISOString().split('T')[0];
      const newDateStr = dateMap[oldDateStr];
      if (newDateStr && newDateStr !== oldDateStr) {
        await db.score.update({
          where: { id: score.id },
          data: { date: new Date(newDateStr) }
        });
        scoresUpdated++;
      }
    }

    // Save refreshed data
    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.create({
      data: { type: 'historical_published_schedules', data: newPublishedSchedules }
    });

    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.create({
      data: { type: 'historical_pt051_assessments', data: newPt051Assessments }
    });

    // Update metadata
    const newMetadata = {
      ...metadata,
      seededAt: new Date().toISOString(),
      lastRefreshed: new Date().toISOString(),
      daysDriftApplied: daysDrift,
    };

    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });
    await db.dataBackup.create({
      data: { type: 'historical_seeding_metadata', data: newMetadata }
    });

    const result = {
      success: true,
      daysDriftApplied: daysDrift,
      datesUpdated: Object.keys(dateMap).length,
      scoresUpdated,
      newEventCount: Object.values(newPublishedSchedules).flat().length,
      newPt051Count: Object.keys(newPt051Assessments).length,
    };

    console.log(`✅ Date refresh complete:`, result);
    res.json(result);

  } catch (error) {
    console.error('❌ POST /api/historical-data/refresh-dates error:', error);
    res.status(500).json({ error: 'Failed to refresh dates', details: error.message });
  }
});

// DELETE /api/historical-data - Clear all seeded historical data
app.delete('/api/historical-data', async (req, res) => {
  try {
    const db = await getPrisma();

    await db.dataBackup.deleteMany({ where: { type: 'historical_published_schedules' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_pt051_assessments' } });
    await db.dataBackup.deleteMany({ where: { type: 'historical_seeding_metadata' } });

    // Delete seeded scores
    const deleted = await db.score.deleteMany({
      where: { notes: { contains: 'Historical seed:' } }
    });

    console.log(`✅ DELETE /api/historical-data - Cleared historical data, deleted ${deleted.count} scores`);
    res.json({ success: true, scoresDeleted: deleted.count });
  } catch (error) {
    console.error('❌ DELETE /api/historical-data error:', error);
    res.status(500).json({ error: 'Failed to clear historical data', details: error.message });
  }
});

// POST /api/scores/bulk - Bulk insert scores (for seeding)
// ============================================================
// DAILY SNAPSHOT TABLE SETUP & ENDPOINTS
// ============================================================

async function ensureDailySnapshotTable(db) {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailySnapshot" (
        "id" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "scheduleEvents" JSONB NOT NULL DEFAULT '[]',
        "staffEvents" JSONB NOT NULL DEFAULT '[]',
        "traineeEvents" JSONB NOT NULL DEFAULT '[]',
        "pt051Assessments" JSONB NOT NULL DEFAULT '{}',
        "traineeProfiles" JSONB NOT NULL DEFAULT '[]',
        "lmpCompletedIds" JSONB NOT NULL DEFAULT '{}',
        "staffCurrency" JSONB NOT NULL DEFAULT '{}',
        "staffLogbook" JSONB NOT NULL DEFAULT '{}',
        "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "savedBy" TEXT,
        CONSTRAINT "DailySnapshot_pkey" PRIMARY KEY ("id")
      );
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailySnapshot_date_key"
      ON "DailySnapshot"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailySnapshot_date_idx"
      ON "DailySnapshot"("date");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailySnapshot_savedAt_idx"
      ON "DailySnapshot"("savedAt");
    `);
    console.log('✅ DailySnapshot table ready');
  } catch (err) {
    console.error('❌ Failed to ensure DailySnapshot table:', err.message);
  }
}

// ============================================================
// INSTRUCTOR ARRAY COLUMN MIGRATION
// ============================================================

async function ensureInstructorArrayColumns(db) {
  try {
    for (const colName of ['primaryInstructor', 'secondaryInstructor']) {
      // Check current column type using pg catalog (handles quoted identifiers properly)
      const colInfo = await db.$queryRawUnsafe(`
        SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'Trainee'
          AND a.attname = $1
          AND a.attnum > 0
          AND NOT a.attisdropped
      `, colName);

      if (!colInfo || colInfo.length === 0) {
        console.log(`Warning: Column "${colName}" not found in Trainee table - skipping`);
        continue;
      }

      const dataType = colInfo[0].data_type;
      console.log(`Info: Trainee."${colName}" current type: ${dataType}`);

      if (!dataType.includes('[]') && !dataType.includes('ARRAY')) {
        console.log(`Migrating Trainee."${colName}" from TEXT to TEXT[]...`);

        await db.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_catalog.pg_attribute a
              JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
              WHERE c.relname = 'Trainee' AND a.attname = '${colName}_arr' AND NOT a.attisdropped
            ) THEN
              ALTER TABLE "Trainee" ADD COLUMN "${colName}_arr" TEXT[] DEFAULT ARRAY[]::TEXT[];
            END IF;

            UPDATE "Trainee"
            SET "${colName}_arr" = CASE
              WHEN "${colName}" IS NOT NULL AND "${colName}" <> ''
              THEN ARRAY["${colName}"]::TEXT[]
              ELSE ARRAY[]::TEXT[]
            END;

            ALTER TABLE "Trainee" DROP COLUMN IF EXISTS "${colName}";

            ALTER TABLE "Trainee" RENAME COLUMN "${colName}_arr" TO "${colName}";
          END $$;
        `);

        console.log(`Migrated "${colName}" to TEXT[]`);
      } else {
        console.log(`"${colName}" is already an array type - no migration needed`);
      }
    }
  } catch (err) {
    console.error('Failed to ensure instructor array columns:', err.message);
    // Don't rethrow - allow server to continue starting up
  }
}

// ============================================================
// TRAINEE REALLOCATION ENDPOINT
// ============================================================

// ============================================================
// REALLOCATION RULES (v2):
//   - Each trainee: exactly 1 primary instructor, min 2 secondary (up to 3)
//   - Each instructor: max 3 primary trainees, max 4 secondary trainees
//   - Same-unit assignments only
// ============================================================

// Shared allocation logic used by both preview and apply
function buildReallocation(trainees, personnel) {
  const units = ['1FTS', '2FTS', 'CFS'];
  const allResults = [];

  // Seeded deterministic shuffle for reproducibility
  const seededRandom = (seed) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  };

  for (const unit of units) {
    const unitTrainees = trainees.filter(t => t.unit === unit);
    const unitStaff = personnel.filter(p => p.unit === unit);

    const MIN_SECONDARY_PER_TRAINEE = 2;

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

    const nTrainees = shuffledTrainees.length;
    const nStaff = shuffledStaff.length;

    // PRIMARY ALLOCATION
    // Distribute nTrainees primary assignments across nStaff as evenly as possible.
    // base = floor(n/s), remainder staff get (base+1), rest get base.
    const primaryLoad = {};
    shuffledStaff.forEach(s => { primaryLoad[s.name] = 0; });

    const primaryMap = {};
    shuffledTrainees.forEach(t => { primaryMap[t.id] = null; });

    const primaryBase = Math.floor(nTrainees / nStaff);
    const primaryRemainder = nTrainees % nStaff;
    // primaryRemainder staff get (primaryBase+1), the rest get primaryBase
    // Staff are assigned caps in shuffledStaff order
    const primaryCap = {};
    shuffledStaff.forEach((s, i) => {
      primaryCap[s.name] = i < primaryRemainder ? primaryBase + 1 : primaryBase;
    });

    // Assign using lowest-load-first: always pick the staff member with
    // fewest assignments who still has capacity. This guarantees perfect balance.
    for (const trainee of shuffledTrainees) {
      const eligible = shuffledStaff
        .filter(s => primaryLoad[s.name] < primaryCap[s.name])
        .sort((a, b) => {
          const diff = primaryLoad[a.name] - primaryLoad[b.name];
          return diff !== 0 ? diff : shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      if (eligible.length > 0) {
        primaryMap[trainee.id] = eligible[0].name;
        primaryLoad[eligible[0].name]++;
      } else {
        // Should never happen if math is correct, but fallback gracefully
        const fallback = shuffledStaff.slice().sort((a,b) => primaryLoad[a.name] - primaryLoad[b.name])[0];
        primaryMap[trainee.id] = fallback.name;
        primaryLoad[fallback.name]++;
        console.log(`Warning: Primary cap overflow for ${trainee.name} (${unit})`);
      }
    }

    // SECONDARY ALLOCATION
    // Distribute (nTrainees * MIN_SECONDARY_PER_TRAINEE) secondary assignments
    // across nStaff as evenly as possible.
    const totalSecondary = nTrainees * MIN_SECONDARY_PER_TRAINEE;
    const secondaryBase = Math.floor(totalSecondary / nStaff);
    const secondaryRemainder = totalSecondary % nStaff;

    const secondaryLoad = {};
    shuffledStaff.forEach(s => { secondaryLoad[s.name] = 0; });

    const secondaryMap = {};
    shuffledTrainees.forEach(t => { secondaryMap[t.id] = []; });

    // Helper: pick best secondary candidate (lowest load, excluding given set)
    const pickSecondary = (excludeSet) => {
      const candidates = shuffledStaff
        .filter(s => !excludeSet.has(s.name))
        .sort((a, b) => {
          const loadDiff = secondaryLoad[a.name] - secondaryLoad[b.name];
          if (loadDiff !== 0) return loadDiff;
          return shuffledStaff.indexOf(a) - shuffledStaff.indexOf(b);
        });
      return candidates.length > 0 ? candidates[0] : null;
    };

    for (let round = 0; round < MIN_SECONDARY_PER_TRAINEE; round++) {
      for (const trainee of shuffledTrainees) {
        const primaryName = primaryMap[trainee.id];
        const alreadyAssigned = new Set(secondaryMap[trainee.id]);

        // Exclude already-assigned secondaries and prefer to exclude primary
        const excludeWithPrimary = new Set([...alreadyAssigned, primaryName].filter(Boolean));
        let pick = pickSecondary(excludeWithPrimary);

        // Fallback: allow primary overlap if no other option
        if (!pick) {
          pick = pickSecondary(alreadyAssigned);
        }

        if (!pick) {
          console.log(`Warning: No secondary available for ${trainee.name} (${unit}) round ${round + 1}`);
          continue;
        }

        secondaryMap[trainee.id].push(pick.name);
        secondaryLoad[pick.name]++;
      }
    }

    // Log distribution for this unit
    const pDist = {};
    const sDist = {};
    Object.values(primaryLoad).forEach(v => { pDist[v] = (pDist[v]||0)+1; });
    Object.values(secondaryLoad).forEach(v => { sDist[v] = (sDist[v]||0)+1; });
    console.log(`${unit} primary dist:`, JSON.stringify(pDist));
    console.log(`${unit} secondary dist:`, JSON.stringify(sDist));

    for (const trainee of shuffledTrainees) {
      allResults.push({
        id: trainee.id,
        name: trainee.name,
        unit: trainee.unit,
        primaryInstructors: primaryMap[trainee.id] ? [primaryMap[trainee.id]] : [],
        secondaryInstructors: secondaryMap[trainee.id]
      });
    }
  }

  return allResults;
}

// GET /api/trainee-reallocation/preview - Preview reallocation without saving
app.get('/api/trainee-reallocation/preview', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const trainees = await prisma.trainee.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true } });
    const personnel = await prisma.personnel.findMany({ select: { id: true, name: true, unit: true, role: true } });

    const allResults = buildReallocation(trainees, personnel);

    const summary = {
      total: allResults.length,
      primary: {
        with1: allResults.filter(r => r.primaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.primaryInstructors.length === 0).length,
      },
      secondary: {
        with3: allResults.filter(r => r.secondaryInstructors.length === 3).length,
        with2: allResults.filter(r => r.secondaryInstructors.length === 2).length,
        with1: allResults.filter(r => r.secondaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.secondaryInstructors.length === 0).length,
      }
    };

    res.json({ success: true, summary, allocations: allResults });
  } catch (error) {
    console.error('Error in trainee-reallocation preview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/trainee-reallocation/apply - Apply reallocation to database
app.post('/api/trainee-reallocation/apply', async (req, res) => {
  try {
    const prisma = await getPrisma();
    const trainees = await prisma.trainee.findMany({ where: { isActive: true }, select: { id: true, name: true, unit: true } });
    const personnel = await prisma.personnel.findMany({ select: { id: true, name: true, unit: true, role: true } });

    const allResults = buildReallocation(trainees, personnel);

    console.log(`🔄 Applying reallocation for ${allResults.length} trainees...`);
    let updated = 0;
    const errors = [];

    for (const result of allResults) {
      try {
        await prisma.$executeRawUnsafe(`
          UPDATE "Trainee"
          SET "primaryInstructor" = $1::TEXT[],
              "secondaryInstructor" = $2::TEXT[],
              "updatedAt" = NOW()
          WHERE id = $3
        `, result.primaryInstructors, result.secondaryInstructors, result.id);
        updated++;
      } catch (err) {
        errors.push({ traineeId: result.id, name: result.name, error: err.message });
      }
    }

    console.log(`✅ Reallocation complete: ${updated} updated, ${errors.length} errors`);

    const summary = {
      total: allResults.length,
      updated,
      errors: errors.length,
      primary: {
        with1: allResults.filter(r => r.primaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.primaryInstructors.length === 0).length,
      },
      secondary: {
        with3: allResults.filter(r => r.secondaryInstructors.length === 3).length,
        with2: allResults.filter(r => r.secondaryInstructors.length === 2).length,
        with1: allResults.filter(r => r.secondaryInstructors.length === 1).length,
        with0: allResults.filter(r => r.secondaryInstructors.length === 0).length,
      }
    };

    res.json({ success: true, summary, errorDetails: errors });
  } catch (error) {
    console.error('Error in trainee-reallocation apply:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/daily-snapshot/save - Save a full daily snapshot when schedule is published
app.post('/api/daily-snapshot/save', async (req, res) => {
  try {
    const db = await getPrisma();
    const {
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
    } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // Guard: reject if any event has isHistoricalSeed = true (never save seed data)
    const allEvents = [...(scheduleEvents || []), ...(staffEvents || []), ...(traineeEvents || [])];
    const hasSeedData = allEvents.some(e => e.isHistoricalSeed === true);
    if (hasSeedData) {
      console.log(`⚠️ POST /api/daily-snapshot/save - Rejected seed data for date ${date}`);
      return res.status(400).json({ error: 'Seed data cannot be saved as a real snapshot' });
    }

    // Upsert: update if date exists, create if not
    const existing = await db.$queryRawUnsafe(
      `SELECT id FROM "DailySnapshot" WHERE date = $1 LIMIT 1`,
      date
    );

    const { cuid } = await import('@paralleldrive/cuid2').catch(() => ({ cuid: () => Math.random().toString(36).slice(2) }));
    const id = (existing && existing.length > 0) ? existing[0].id : (typeof cuid === 'function' ? cuid() : `snap_${Date.now()}`);

    if (existing && existing.length > 0) {
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
          "savedBy" = $9
        WHERE date = $10
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
      console.log(`✅ POST /api/daily-snapshot/save - Updated snapshot for ${date}, ${(scheduleEvents||[]).length} events`);
    } else {
      await db.$executeRawUnsafe(`
        INSERT INTO "DailySnapshot"
          ("id", "date", "scheduleEvents", "staffEvents", "traineeEvents",
           "pt051Assessments", "traineeProfiles", "lmpCompletedIds",
           "staffCurrency", "staffLogbook", "savedAt", "savedBy")
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, NOW(), $11)
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
      console.log(`✅ POST /api/daily-snapshot/save - Created snapshot for ${date}, ${(scheduleEvents||[]).length} events`);
    }

    res.json({ success: true, date, eventCount: (scheduleEvents||[]).length });
  } catch (error) {
    console.error('❌ POST /api/daily-snapshot/save error:', error);
    res.status(500).json({ error: 'Failed to save daily snapshot', details: error.message });
  }
});

// GET /api/daily-snapshot/dates - Return all dates that have snapshots (for calendar dropdown)
app.get('/api/daily-snapshot/dates', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT date, "savedAt", "savedBy" FROM "DailySnapshot" ORDER BY date DESC`
    );
    const dates = (rows || []).map(r => ({
      date: r.date,
      savedAt: r.savedAt,
      savedBy: r.savedBy
    }));
    console.log(`✅ GET /api/daily-snapshot/dates - ${dates.length} snapshot dates`);
    res.json({ dates });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot/dates error:', error);
    res.status(500).json({ error: 'Failed to load snapshot dates', details: error.message });
  }
});

// GET /api/daily-snapshot - Load last 5 days of snapshots
app.get('/api/daily-snapshot', async (req, res) => {
  try {
    const db = await getPrisma();
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "DailySnapshot" ORDER BY date DESC LIMIT 5`
    );
    console.log(`✅ GET /api/daily-snapshot - Loaded ${(rows||[]).length} recent snapshots`);
    res.json({ snapshots: rows || [] });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot error:', error);
    res.status(500).json({ error: 'Failed to load daily snapshots', details: error.message });
  }
});

// GET /api/daily-snapshot/:date - Load a single date snapshot on demand
app.get('/api/daily-snapshot/:date', async (req, res) => {
  try {
    const db = await getPrisma();
    const { date } = req.params;
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "DailySnapshot" WHERE date = $1 LIMIT 1`,
      date
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: `No snapshot found for date ${date}` });
    }
    console.log(`✅ GET /api/daily-snapshot/${date} - Loaded snapshot`);
    res.json({ snapshot: rows[0] });
  } catch (error) {
    console.error('❌ GET /api/daily-snapshot/:date error:', error);
    res.status(500).json({ error: 'Failed to load snapshot', details: error.message });
  }
});

// DELETE /api/daily-snapshot/seed-cleanup - Delete all seed DataBackup records
app.delete('/api/daily-snapshot/seed-cleanup', async (req, res) => {
  try {
    const db = await getPrisma();
    // Delete all historical seed DataBackup records
    const deletedSchedules = await db.dataBackup.deleteMany({
      where: { type: 'historical_published_schedules' }
    });
    const deletedPt051 = await db.dataBackup.deleteMany({
      where: { type: 'historical_pt051_assessments' }
    });
    const deletedMeta = await db.dataBackup.deleteMany({
      where: { type: 'historical_seeding_metadata' }
    });
    const total = deletedSchedules.count + deletedPt051.count + deletedMeta.count;
    console.log(`✅ DELETE /api/daily-snapshot/seed-cleanup - Deleted ${total} seed DataBackup records`);
    res.json({
      success: true,
      deleted: {
        schedules: deletedSchedules.count,
        pt051: deletedPt051.count,
        metadata: deletedMeta.count,
        total
      }
    });
  } catch (error) {
    console.error('❌ DELETE /api/daily-snapshot/seed-cleanup error:', error);
    res.status(500).json({ error: 'Failed to clean up seed data', details: error.message });
  }
});

app.post('/api/scores/bulk', async (req, res) => {
  try {
    const db = await getPrisma();
    const { scores } = req.body;
    if (!scores || !Array.isArray(scores)) {
      return res.status(400).json({ error: 'scores array required' });
    }
    let inserted = 0, skipped = 0;
    for (const s of scores) {
      const existing = await db.score.findFirst({
        where: { traineeId: s.traineeId, event: s.event }
      });
      if (!existing) {
        await db.score.create({ data: { ...s, date: new Date(s.date) } });
        inserted++;
      } else {
        skipped++;
      }
    }
    res.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error('❌ POST /api/scores/bulk error:', error);
    res.status(500).json({ error: 'Failed to bulk insert scores', details: error.message });
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
  console.log(`🚀 DFP-NEO V2 Server running on port ${PORT} [theme-system-v1 build:${new Date().toISOString()}]`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
});