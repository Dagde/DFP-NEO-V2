const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function queryStaffCount() {
  try {
    console.log('Connecting to Railway Postgres database...');
    
    // Query STAFF records (those with userId)
    const staffWithUserId = await prisma.personnel.count({
      where: {
        userId: {
          not: null
        }
      }
    });
    
    console.log(`\n=== STAFF Records in Railway Postgres ===`);
    console.log(`Total STAFF records (userId is not null): ${staffWithUserId}`);
    
    // Get one example record
    const exampleStaff = await prisma.personnel.findFirst({
      where: {
        userId: {
          not: null
        }
      },
      select: {
        id: true,
        userId: true,
        name: true,
        rank: true,
        role: true,
        category: true,
        idNumber: true,
        isActive: true,
        createdAt: true
      }
    });
    
    if (exampleStaff) {
      console.log(`\n=== Example STAFF Record ===`);
      console.log(`Field Names: ${Object.keys(exampleStaff).join(', ')}`);
      console.log(`Example Data:`);
      console.log(JSON.stringify(exampleStaff, null, 2));
    } else {
      console.log(`\n❌ NO STAFF RECORDS FOUND in database`);
      console.log(`Issue: No Personnel records with userId (real staff data)`);
    }
    
    // Also check total personnel count
    const totalPersonnel = await prisma.personnel.count();
    console.log(`\n=== Total Personnel Records ===`);
    console.log(`Total (including mockdata): ${totalPersonnel}`);
    console.log(`Real staff (with userId): ${staffWithUserId}`);
    console.log(`Mockdata (without userId): ${totalPersonnel - staffWithUserId}`);
    
  } catch (error) {
    console.error('Error querying database:', error);
    console.error('\n⚠️  Unable to connect to Railway Postgres database');
    console.error('This may be because:');
    console.error('1. DATABASE_URL is not configured in Railway environment');
    console.error('2. Railway database is not accessible from this environment');
    console.error('3. Database credentials are invalid');
  } finally {
    await prisma.$disconnect();
  }
}

queryStaffCount();