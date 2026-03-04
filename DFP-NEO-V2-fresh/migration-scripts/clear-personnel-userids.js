import { PrismaClient } from '../dfp-neo-platform/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

async function clearPersonnelUserIds() {
  try {
    console.log('Clearing all Personnel userId values to prepare for migration...\n');
    
    // First, drop the unique constraint and foreign key
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Personnel" DROP CONSTRAINT IF EXISTS "Personnel_userId_key";
    `);
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Personnel" DROP CONSTRAINT IF EXISTS "Personnel_userId_fkey";
    `);
    
    console.log('✓ Dropped constraints');
    
    // Make userId nullable
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Personnel" ALTER COLUMN "userId" DROP NOT NULL;
    `);
    
    console.log('✓ Made userId nullable');
    
    // Set all userIds to NULL
    await prisma.$executeRawUnsafe(`
      UPDATE "Personnel" SET "userId" = NULL;
    `);
    
    console.log('✓ Set all userId values to NULL');
    
    // Get count
    const count = await prisma.personnel.count();
    console.log(`\n✓ Updated ${count} Personnel records`);
    
    console.log('\nNow you can run: npx prisma db push');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearPersonnelUserIds();