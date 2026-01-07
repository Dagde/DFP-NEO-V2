import { PrismaClient } from '@prisma/client';
import { ESL_DATA, PEA_DATA } from '../dfp-neo-platform/mockData';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting personnel migration...\n');

  // Get users for userId assignment
  const adminUser = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminUser) {
    console.error('❌ Admin user not found. Please run migrate-users.ts first.');
    process.exit(1);
  }

  // Combine instructors and trainees from both locations
  const allPersonnel = [
    ...ESL_DATA.instructors.map((inst) => ({
      ...inst,
      role: 'instructor',
      location: 'ESL',
    })),
    ...ESL_DATA.trainees.map((trainee) => ({
      ...trainee,
      role: 'trainee',
      location: 'ESL',
    })),
    ...PEA_DATA.instructors.map((inst) => ({
      ...inst,
      role: 'instructor',
      location: 'PEA',
    })),
    ...PEA_DATA.trainees.map((trainee) => ({
      ...trainee,
      role: 'trainee',
      location: 'PEA',
    })),
  ];

  console.log(`📝 Creating ${allPersonnel.length} personnel records...`);

  let createdCount = 0;
  for (const person of allPersonnel) {
    try {
      await prisma.personnel.create({
        data: {
          userId: adminUser.id,
          name: person.name,
          rank: person.rank,
          role: person.role === 'instructor' ? 'QFI' : 'Trainee',
          qualifications: {
            role: person.role,
            category: person.category,
            isExecutive: person.isExecutive,
            isFlyingSupervisor: person.isFlyingSupervisor,
            isTestingOfficer: person.isTestingOfficer,
            isIRE: person.isIRE,
            isCommandingOfficer: person.isCommandingOfficer,
            isCFI: person.isCFI,
            callsignNumber: person.callsignNumber,
            location: person.location,
            unit: person.unit,
            flight: person.flight,
            service: person.service,
            phoneNumber: person.phoneNumber,
            email: person.email,
            course: person.course,
            seatConfig: person.seatConfig,
            primaryInstructor: person.primaryInstructor,
            secondaryInstructor: person.secondaryInstructor,
            traineeCallsign: person.traineeCallsign,
            lastEventDate: person.lastEventDate,
            lastFlightDate: person.lastFlightDate,
          } as any,
          availability: {
            isPaused: person.isPaused,
            unavailability: person.unavailability || [],
          } as any,
          preferences: {
            location: person.location,
          } as any,
          isActive: !person.isPaused,
        },
      });

      createdCount++;
      if (createdCount % 50 === 0) {
        console.log(`  ✓ Created ${createdCount}/${allPersonnel.length} personnel records...`);
      }
    } catch (error) {
      console.error(`  ⚠️  Failed to create personnel for: ${person.name}`, error);
    }
  }

  console.log(`\n✅ Personnel migration completed! Created ${createdCount} records.`);
}

main()
  .catch((e) => {
    console.error('❌ Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });