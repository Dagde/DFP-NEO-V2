import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Setting Burns profile photo...');

  const personnel = await prisma.personnel.findFirst({
    where: {
      name: { contains: 'Burns', mode: 'insensitive' }
    }
  });

  if (!personnel) {
    console.log('⚠️  Burns not found in database - skipping photo seed');
    return;
  }

  const updated = await prisma.personnel.update({
    where: { id: personnel.id },
    data: { photoUrl: '/burns-profile.png' }
  });

  console.log(`✅ Photo set for ${updated.name}: ${updated.photoUrl}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());