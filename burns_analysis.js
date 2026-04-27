const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyze() {
  console.log('\n=== ALL BURNS USERS ===');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Burns', mode: 'insensitive' } },
        { lastName: { contains: 'Burns', mode: 'insensitive' } },
        { username: { contains: 'burns', mode: 'insensitive' } },
        { firstName: { contains: 'Alexander', mode: 'insensitive' } },
      ]
    },
    select: { id: true, userId: true, username: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true }
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('\n=== ALL BURNS PERSONNEL ===');
  const personnel = await prisma.personnel.findMany({
    where: {
      OR: [
        { name: { contains: 'Burns', mode: 'insensitive' } },
      ]
    },
    select: { id: true, name: true, rank: true, role: true, userId: true, idNumber: true, unit: true, category: true }
  });
  console.log(JSON.stringify(personnel, null, 2));
}

analyze().catch(console.error).finally(() => prisma.$disconnect());
