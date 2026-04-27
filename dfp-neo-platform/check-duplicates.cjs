const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDuplicates() {
  console.log('Checking for duplicate userIds in Personnel table...\n');
  
  const duplicates = await prisma.$queryRaw`
    SELECT "userId", COUNT(*) as count
    FROM "Personnel"
    GROUP BY "userId"
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `;
  
  console.log('Duplicate userIds found:', duplicates.length);
  
  if (duplicates.length > 0) {
    console.log('\nDuplicate userIds:');
    duplicates.forEach(d => {
      console.log(`  - ${d.userId}: ${d.count} records`);
    });
    
    console.log('\n\nDetailed records:');
    for (const d of duplicates) {
      const records = await prisma.personnel.findMany({
        where: { userId: d.userId }
      });
      console.log(`\n${d.userId} (${d.count} records):`);
      records.forEach((r, i) => {
        console.log(`  ${i + 1}. ID: ${r.id}, Name: ${r.name}, Rank: ${r.rank}`);
      });
    }
  } else {
    console.log('✅ No duplicates found!');
  }
  
  await prisma.$disconnect();
}

checkDuplicates().catch(console.error);