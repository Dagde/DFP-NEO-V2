import { PrismaClient } from '../dfp-neo-platform/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function checkPersonnelUserIds() {
  try {
    console.log('Checking Personnel userId values...\n');
    
    // Get all personnel records
    const personnel = await prisma.personnel.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        idNumber: true,
      },
      take: 10, // Just show first 10
    });
    
    console.log('First 10 Personnel records:');
    personnel.forEach(p => {
      console.log(`ID: ${p.id}, userId: ${p.userId}, name: ${p.name}, idNumber: ${p.idNumber}`);
    });
    
    // Count unique userIds
    const uniqueUserIds = await prisma.personnel.groupBy({
      by: ['userId'],
      _count: {
        userId: true,
      },
    });
    
    console.log(`\nTotal unique userId values: ${uniqueUserIds.length}`);
    console.log('Unique userId counts:');
    uniqueUserIds.forEach(u => {
      console.log(`  userId: ${u.userId} - Count: ${u._count.userId}`);
    });
    
    // Get total count
    const total = await prisma.personnel.count();
    console.log(`\nTotal Personnel records: ${total}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPersonnelUserIds();