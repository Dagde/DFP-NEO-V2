import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function queryDatabase() {
  console.log('🔍 Querying Railway PostgreSQL Database...\n');

  // Get all personnel
  const allPersonnel = await prisma.personnel.findMany({
    orderBy: { name: 'asc' }
  });

  console.log(`📊 Total personnel records: ${allPersonnel.length}`);

  // Get real database staff (with userId)
  const realStaff = await prisma.personnel.findMany({
    where: {
      userId: { not: null }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`✅ Real database staff (with userId): ${realStaff.length}`);

  // Get mockdata (without userId)
  const mockData = await prisma.personnel.findMany({
    where: {
      userId: null
    },
    orderBy: { name: 'asc' }
  });

  console.log(`🎭 Mockdata (without userId): ${mockData.length}\n`);

  // Display real staff details
  if (realStaff.length > 0) {
    console.log('👥 REAL DATABASE STAFF:\n');
    console.log('┌────────────────────────────┬──────────────────┬──────────────┬──────────┬─────────────┐');
    console.log('│ NAME                       │ RANK             │ UNIT         │ PMKEYS    │ USER ID     │');
    console.log('├────────────────────────────┼──────────────────┼──────────────┼──────────┼─────────────┤');
    
    for (const staff of realStaff) {
      const name = staff.name.padEnd(26).substring(0, 26);
      const rank = (staff.rank || 'N/A').padEnd(16).substring(0, 16);
      const unit = (staff.unit || 'N/A').padEnd(12).substring(0, 12);
      const pmkeys = (staff.idNumber || 'N/A').toString().padEnd(8).substring(0, 8);
      const userId = (staff.userId || 'N/A').toString().padEnd(11).substring(0, 11);
      console.log(`│ ${name} │ ${rank} │ ${unit} │ ${pmkeys} │ ${userId} │`);
    }
    console.log('└────────────────────────────┴──────────────────┴──────────────┴──────────┴─────────────┘\n');
  } else {
    console.log('⚠️  No real database staff found.\n');
  }

  // Display sample mockdata (first 5)
  if (mockData.length > 0) {
    console.log('🎭 SAMPLE MOCKDATA (first 5):\n');
    console.log('┌────────────────────────────┬──────────────────┬──────────────┬──────────┐');
    console.log('│ NAME                       │ RANK             │ UNIT         │ PMKEYS    │');
    console.log('├────────────────────────────┼──────────────────┼──────────────┼──────────┤');
    
    for (let i = 0; i < Math.min(5, mockData.length); i++) {
      const staff = mockData[i];
      const name = staff.name.padEnd(26).substring(0, 26);
      const rank = (staff.rank || 'N/A').padEnd(16).substring(0, 16);
      const unit = (staff.unit || 'N/A').padEnd(12).substring(0, 12);
      const pmkeys = (staff.idNumber || 'N/A').toString().padEnd(8).substring(0, 8);
      console.log(`│ ${name} │ ${rank} │ ${unit} │ ${pmkeys} │`);
    }
    console.log(`└────────────────────────────┴──────────────────┴──────────────┴──────────┘`);
    console.log(`(and ${mockData.length - 5} more mockdata records)\n`);
  }

  await prisma.$disconnect();
}

queryDatabase().catch(console.error);
