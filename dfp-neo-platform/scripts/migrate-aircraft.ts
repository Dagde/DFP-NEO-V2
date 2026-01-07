import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting aircraft migration...\n');

  // Get users for userId assignment
  const adminUser = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminUser) {
    console.error('❌ Admin user not found. Please run migrate-users.ts first.');
    process.exit(1);
  }

  // Aircraft configuration based on ESL and PEA data
  const aircraftConfig = [
    // ESL Aircraft (15 PC-21s)
    { location: 'ESL', count: 15, type: 'PC-21', startNumber: 1 },
    // PEA Aircraft (12 PC-21s) - start from 016 to avoid conflict
    { location: 'PEA', count: 12, type: 'PC-21', startNumber: 16 },
  ];

  let totalAircraft = 0;

  for (const config of aircraftConfig) {
    console.log(`📝 Creating ${config.count} ${config.type} aircraft for ${config.location}...`);

    for (let i = 0; i < config.count; i++) {
      const aircraftNumber = (config.startNumber + i).toString().padStart(3, '0');

      try {
        await prisma.aircraft.create({
          data: {
            userId: adminUser.id,
            aircraftNumber,
            type: config.type,
            status: 'available',
            configuration: {
              location: config.location,
            } as any,
            maintenanceLog: [] as any,
            isActive: true,
          },
        });

        totalAircraft++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`  ⚠️  Aircraft ${aircraftNumber} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log(`  ✓ Created ${totalAircraft} total aircraft`);
  }

  console.log(`\n✅ Aircraft migration completed! Created ${totalAircraft} aircraft.`);
}

main()
  .catch((e) => {
    console.error('❌ Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });