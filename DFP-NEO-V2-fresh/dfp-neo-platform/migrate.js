const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('🔄 Starting migration: Renaming username to userId...\n');

    // Step 1: Create userId column
    console.log('⚙️  Creating userId column...');
    await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN "userId" TEXT`;
    console.log('✅ Created userId column\n');

    // Step 2: Copy username values to userId
    console.log('⚙️  Copying username values to userId...');
    await prisma.$executeRaw`UPDATE "User" SET "userId" = "username"`;
    console.log('✅ Copied all username values to userId\n');

    // Step 3: Make userId not null
    console.log('⚙️  Making userId required...');
    await prisma.$executeRaw`ALTER TABLE "User" ALTER COLUMN "userId" SET NOT NULL`;
    console.log('✅ Made userId required\n');

    // Step 4: Make userId unique
    console.log('⚙️  Making userId unique...');
    await prisma.$executeRaw`ALTER TABLE "User" ADD CONSTRAINT "User_userId_key" UNIQUE ("userId")`;
    console.log('✅ Made userId unique\n');

    // Step 5: Verify
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        userId: true,
        email: true,
      }
    });

    console.log('📊 Migration results:');
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. userId: ${user.userId} (was username: ${user.username})`);
    });
    console.log();

    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update Prisma schema to use userId instead of username');
    console.log('2. Run: npx prisma db pull');
    console.log('3. Update code references from username to userId');
    console.log('4. Test the application');
    console.log('5. If verified, drop old username column manually');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();