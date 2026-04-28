import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting migration: Renaming username to userId...\n');

  try {
    // Step 1: Check current data
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
      }
    });

    console.log(`📊 Found ${users.length} users in database:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.email})`);
    });
    console.log();

    // Step 2: Create userId column (we'll do this via raw SQL for safety)
    console.log('⚙️  Creating userId column...');
    await prisma.$executeRaw`
      ALTER TABLE "User" 
      ADD COLUMN "userId" TEXT;
    `;
    console.log('✅ Created userId column\n');

    // Step 3: Copy username values to userId
    console.log('⚙️  Copying username values to userId...');
    await prisma.$executeRaw`
      UPDATE "User" 
      SET "userId" = "username";
    `;
    console.log('✅ Copied all username values to userId\n');

    // Step 4: Make userId unique and not null
    console.log('⚙️  Making userId unique and required...');
    await prisma.$executeRaw`
      ALTER TABLE "User" 
      ALTER COLUMN "userId" SET NOT NULL,
      ADD CONSTRAINT "User_userId_key" UNIQUE ("userId");
    `;
    console.log('✅ Made userId unique and required\n');

    // Step 5: Verify the migration
    const updatedUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        userId: true,
        email: true,
      }
    });

    console.log('📊 Migration results:');
    updatedUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. userId: ${user.userId} (was username: ${user.username})`);
    });
    console.log();

    // Step 6: Drop the old username column (optional - can keep for now)
    console.log('⚠️  Old username column is still present for rollback safety.');
    console.log('    Drop it manually after verifying everything works:\n');
    console.log('    ALTER TABLE "User" DROP COLUMN "username";\n');

    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update Prisma schema to use userId instead of username');
    console.log('2. Run prisma db pull to sync schema');
    console.log('3. Update any code that references username to use userId');
    console.log('4. Test the application');
    console.log('5. If everything works, drop the old username column');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());