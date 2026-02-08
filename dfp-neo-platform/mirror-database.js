const { PrismaClient } = require('@prisma/client');

async function mirrorDatabase() {
  const v2DatabaseUrl = 'postgresql://postgres:azuWoBZbZMZwaambfUOKxTEoOFPmEOOe@postgres.railway.internal:5432/railway';
  const originalDatabaseUrl = 'postgresql://postgres:WxMnHCNEfpTRYbVOTgOXjMykwHNhCqFw@postgres.railway.internal:5432/railway';

  console.log('🔄 Starting database mirroring...\n');

  // Create Prisma clients for both databases
  const v2Prisma = new PrismaClient({
    datasources: { db: { url: v2DatabaseUrl } }
  });

  const originalPrisma = new PrismaClient({
    datasources: { db: { url: originalDatabaseUrl } }
  });

  const tables = [
    { name: 'User', model: 'user' },
    { name: 'Session', model: 'session' },
    { name: 'Personnel', model: 'personnel' },
    { name: 'Trainee', model: 'trainee' },
    { name: 'Aircraft', model: 'aircraft' },
    { name: 'Schedule', model: 'schedule' },
    { name: 'FlightSchedule', model: 'flightSchedule' },
    { name: 'Score', model: 'score' },
    { name: 'Course', model: 'course' },
    { name: 'UserSettings', model: 'userSettings' },
    { name: 'CancellationHistory', model: 'cancellationHistory' },
    { name: 'AuditLog', model: 'auditLog' },
  ];

  const results = {};

  try {
    for (const table of tables) {
      console.log(`📋 Mirroring ${table.name}...`);
      
      const originalData = await originalPrisma[table.model].findMany();
      console.log(`   Found ${originalData.length} records in original database`);
      
      let upsertCount = 0;
      for (const record of originalData) {
        try {
          await v2Prisma[table.model].upsert({
            where: { id: record.id },
            update: record,
            create: record,
          });
          upsertCount++;
        } catch (error) {
          console.error(`   ❌ Error upserting record ${record.id}:`, error.message);
        }
      }
      
      results[table.name] = upsertCount;
      console.log(`✅ ${table.name}: ${upsertCount} records mirrored\n`);
    }

    console.log('🎉 Database mirroring completed!');
    console.log('\n📊 Results:');
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('❌ Error during mirroring:', error);
  } finally {
    await v2Prisma.$disconnect();
    await originalPrisma.$disconnect();
  }
}

mirrorDatabase();