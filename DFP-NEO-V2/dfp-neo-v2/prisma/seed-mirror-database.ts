import { PrismaClient } from '@prisma/client';

// Source database (Original App)
const ORIGINAL_DATABASE_URL = process.env.ORIGINAL_DATABASE_URL;

// Target database (V2 App) - automatically uses DATABASE_URL from .env
const prismaV2 = new PrismaClient();
const prismaOriginal = new PrismaClient({
  datasources: {
    db: {
      url: ORIGINAL_DATABASE_URL,
    },
  },
});

async function main() {
  console.log('🔄 Starting database mirroring from Original to V2...\n');

  try {
    // Step 1: Mirror Users
    console.log('📋 Copying Users...');
    const users = await prismaOriginal.user.findMany();
    console.log(`   Found ${users.length} users in original database`);
    
    for (const user of users) {
      await prismaV2.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          username: user.username,
          email: user.email,
          password: user.password,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          createdById: user.createdById,
          userId: user.userId,
          lastLogin: user.lastLogin,
        },
      });
    }
    console.log(`   ✅ ${users.length} users copied\n`);

    // Step 2: Mirror Personnel
    console.log('📋 Copying Personnel...');
    const personnel = await prismaOriginal.personnel.findMany();
    console.log(`   Found ${personnel.length} personnel records in original database`);
    
    for (const p of personnel) {
      await prismaV2.personnel.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          userId: p.userId,
          name: p.name,
          rank: p.rank,
          role: p.role,
          qualifications: p.qualifications,
          availability: p.availability,
          preferences: p.preferences,
          isActive: p.isActive,
          callsignNumber: p.callsignNumber,
          category: p.category,
          email: p.email,
          flight: p.flight,
          idNumber: p.idNumber,
          isAdminStaff: p.isAdminStaff,
          isCFI: p.isCFI,
          isCommandingOfficer: p.isCommandingOfficer,
          isContractor: p.isContractor,
          isDeputyFlightCommander: p.isDeputyFlightCommander,
          isExecutive: p.isExecutive,
          isFlyingSupervisor: p.isFlyingSupervisor,
          isIRE: p.isIRE,
          isOFI: p.isOFI,
          isQFI: p.isQFI,
          isTestingOfficer: p.isTestingOfficer,
          location: p.location,
          permissions: p.permissions,
          phoneNumber: p.phoneNumber,
          priorExperience: p.priorExperience,
          seatConfig: p.seatConfig,
          service: p.service,
          unavailability: p.unavailability,
          unit: p.unit,
        },
      });
    }
    console.log(`   ✅ ${personnel.length} personnel records copied\n`);

    // Step 3: Mirror Trainees
    console.log('📋 Copying Trainees...');
    const trainees = await prismaOriginal.trainee.findMany();
    console.log(`   Found ${trainees.length} trainees in original database`);
    
    for (const t of trainees) {
      await prismaV2.trainee.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          userId: t.userId,
          idNumber: t.idNumber,
          name: t.name,
          fullName: t.fullName,
          rank: t.rank,
          service: t.service,
          course: t.course,
          lmpType: t.lmpType,
          traineeCallsign: t.traineeCallsign,
          seatConfig: t.seatConfig,
          isPaused: t.isPaused,
          unavailability: t.unavailability,
          unit: t.unit,
          flight: t.flight,
          location: t.location,
          phoneNumber: t.phoneNumber,
          email: t.email,
          primaryInstructor: t.primaryInstructor,
          secondaryInstructor: t.secondaryInstructor,
          lastEventDate: t.lastEventDate,
          lastFlightDate: t.lastFlightDate,
          currencyStatus: t.currencyStatus,
          permissions: t.permissions,
          priorExperience: t.priorExperience,
          isActive: t.isActive,
        },
      });
    }
    console.log(`   ✅ ${trainees.length} trainees copied\n`);

    // Step 4: Mirror Aircraft
    console.log('📋 Copying Aircraft...');
    const aircraft = await prismaOriginal.aircraft.findMany();
    console.log(`   Found ${aircraft.length} aircraft in original database`);
    
    for (const a of aircraft) {
      await prismaV2.aircraft.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          userId: a.userId,
          aircraftNumber: a.aircraftNumber,
          type: a.type,
          status: a.status,
          configuration: a.configuration,
          maintenanceLog: a.maintenanceLog,
          isActive: a.isActive,
        },
      });
    }
    console.log(`   ✅ ${aircraft.length} aircraft copied\n`);

    // Step 5: Mirror Schedules
    console.log('📋 Copying Schedules...');
    const schedules = await prismaOriginal.schedule.findMany();
    console.log(`   Found ${schedules.length} schedules in original database`);
    
    for (const s of schedules) {
      await prismaV2.schedule.upsert({
        where: {
          userId_date_version: {
            userId: s.userId,
            date: s.date,
            version: s.version,
          },
        },
        update: {},
        create: {
          id: s.id,
          userId: s.userId,
          date: s.date,
          data: s.data,
          version: s.version,
        },
      });
    }
    console.log(`   ✅ ${schedules.length} schedules copied\n`);

    // Step 6: Mirror FlightSchedules
    console.log('📋 Copying FlightSchedules...');
    const flightSchedules = await prismaOriginal.flightSchedule.findMany();
    console.log(`   Found ${flightSchedules.length} flight schedules in original database`);
    
    for (const fs of flightSchedules) {
      await prismaV2.flightSchedule.upsert({
        where: { id: fs.id },
        update: {},
        create: {
          id: fs.id,
          userId: fs.userId,
          date: fs.date,
          scheduleData: fs.scheduleData,
          version: fs.version,
        },
      });
    }
    console.log(`   ✅ ${flightSchedules.length} flight schedules copied\n`);

    // Step 7: Mirror Scores
    console.log('📋 Copying Scores...');
    const scores = await prismaOriginal.score.findMany();
    console.log(`   Found ${scores.length} scores in original database`);
    
    for (const score of scores) {
      await prismaV2.score.upsert({
        where: { id: score.id },
        update: {},
        create: {
          id: score.id,
          traineeId: score.traineeId,
          event: score.event,
          score: score.score,
          date: score.date,
          instructor: score.instructor,
          notes: score.notes,
          details: score.details,
        },
      });
    }
    console.log(`   ✅ ${scores.length} scores copied\n`);

    // Step 8: Mirror Courses
    console.log('📋 Copying Courses...');
    const courses = await prismaOriginal.course.findMany();
    console.log(`   Found ${courses.length} courses in original database`);
    
    for (const c of courses) {
      await prismaV2.course.upsert({
        where: { code: c.code },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          code: c.code,
          startDate: c.startDate,
          endDate: c.endDate,
          totalStudents: c.totalStudents,
          raafCount: c.raafCount,
          navyCount: c.navyCount,
          armyCount: c.armyCount,
          location: c.location,
          unit: c.unit,
          status: c.status,
          color: c.color,
        },
      });
    }
    console.log(`   ✅ ${courses.length} courses copied\n`);

    // Step 9: Mirror Sessions
    console.log('📋 Copying Sessions...');
    const sessions = await prismaOriginal.session.findMany();
    console.log(`   Found ${sessions.length} sessions in original database`);
    
    for (const session of sessions) {
      await prismaV2.session.upsert({
        where: { id: session.id },
        update: {},
        create: {
          id: session.id,
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
      });
    }
    console.log(`   ✅ ${sessions.length} sessions copied\n`);

    // Step 10: Mirror UserSettings
    console.log('📋 Copying UserSettings...');
    const userSettings = await prismaOriginal.userSettings.findMany();
    console.log(`   Found ${userSettings.length} user settings in original database`);
    
    for (const us of userSettings) {
      await prismaV2.userSettings.upsert({
        where: { userId: us.userId },
        update: {},
        create: {
          id: us.id,
          userId: us.userId,
          settings: us.settings,
        },
      });
    }
    console.log(`   ✅ ${userSettings.length} user settings copied\n`);

    // Step 11: Mirror CancellationHistory
    console.log('📋 Copying CancellationHistory...');
    const cancellations = await prismaOriginal.cancellationHistory.findMany();
    console.log(`   Found ${cancellations.length} cancellation records in original database`);
    
    for (const ch of cancellations) {
      await prismaV2.cancellationHistory.upsert({
        where: { id: ch.id },
        update: {},
        create: {
          id: ch.id,
          userId: ch.userId,
          scheduleId: ch.scheduleId,
          eventId: ch.eventId,
          eventType: ch.eventType,
          cancellationCode: ch.cancellationCode,
          reason: ch.reason,
          cancelledBy: ch.cancelledBy,
          cancelledAt: ch.cancelledAt,
          originalData: ch.originalData,
        },
      });
    }
    console.log(`   ✅ ${cancellations.length} cancellation records copied\n`);

    // Step 12: Mirror AuditLogs (optional - can be large)
    console.log('📋 Copying AuditLogs...');
    const auditLogs = await prismaOriginal.auditLog.findMany({
      take: 1000, // Limit to last 1000 logs to avoid overwhelming
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   Found ${auditLogs.length} audit logs (last 1000) in original database`);
    
    for (const log of auditLogs) {
      await prismaV2.auditLog.upsert({
        where: { id: log.id },
        update: {},
        create: {
          id: log.id,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          changes: log.changes,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
        },
      });
    }
    console.log(`   ✅ ${auditLogs.length} audit logs copied\n`);

    console.log('========================================');
    console.log('✅ DATABASE MIRRORING COMPLETED SUCCESSFULLY!');
    console.log('========================================\n');
    console.log('Summary:');
    console.log(`  - Users: ${users.length}`);
    console.log(`  - Personnel: ${personnel.length}`);
    console.log(`  - Trainees: ${trainees.length}`);
    console.log(`  - Aircraft: ${aircraft.length}`);
    console.log(`  - Schedules: ${schedules.length}`);
    console.log(`  - FlightSchedules: ${flightSchedules.length}`);
    console.log(`  - Scores: ${scores.length}`);
    console.log(`  - Courses: ${courses.length}`);
    console.log(`  - Sessions: ${sessions.length}`);
    console.log(`  - UserSettings: ${userSettings.length}`);
    console.log(`  - CancellationHistory: ${cancellations.length}`);
    console.log(`  - AuditLogs: ${auditLogs.length}`);
    console.log('\n✨ V2 database now has its own independent copy of the data!');

  } catch (error) {
    console.error('❌ Error during database mirroring:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prismaV2.$disconnect();
    await prismaOriginal.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prismaV2.$disconnect();
    await prismaOriginal.$disconnect();
    process.exit(1);
  });