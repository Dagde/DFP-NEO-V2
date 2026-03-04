import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedUnavailabilityReasons() {
  console.log('Seeding unavailability reasons...');

  const reasons = [
    {
      code: 'SICK',
      description: 'Sick Leave',
      requiresApproval: true,
    },
    {
      code: 'LEAVE',
      description: 'Annual Leave',
      requiresApproval: true,
    },
    {
      code: 'MEDICAL',
      description: 'Medical Appointment',
      requiresApproval: false,
    },
    {
      code: 'PERSONAL',
      description: 'Personal Reasons',
      requiresApproval: true,
    },
    {
      code: 'FAMILY',
      description: 'Family Emergency',
      requiresApproval: true,
    },
    {
      code: 'TRAINING',
      description: 'External Training',
      requiresApproval: false,
    },
  ];

  for (const reason of reasons) {
    await prisma.unavailabilityReason.upsert({
      where: { code: reason.code },
      update: reason,
      create: reason,
    });
    console.log(`✓ Created/Updated reason: ${reason.code}`);
  }

  console.log('Unavailability reasons seeded successfully!');
}

seedUnavailabilityReasons()
  .catch((e) => {
    console.error('Error seeding unavailability reasons:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });