import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserLinkage() {
  console.log('🔍 Checking User and Personnel linkage for Alexander Burns...\n');

  // Search for User with Alexander Burns
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Alexander' }, lastName: { contains: 'Burns' } },
        { username: { contains: 'burns' } },
        { userId: { contains: '8207938' } },
        { email: { contains: 'burns' } }
      ]
    }
  });

  console.log(`📊 Found ${users.length} User records matching 'Alexander Burns':\n`);

  if (users.length > 0) {
    for (const user of users) {
      console.log('User Record:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Display Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  User ID (PMKEYS): ${user.userId}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Last Login: ${user.lastLogin}`);
      console.log(`  Created: ${user.createdAt}`);
      
      // Check linked personnel
      const linkedPersonnel = await prisma.personnel.findFirst({
        where: { userId: user.id }
      });
      
      if (linkedPersonnel) {
        console.log('\n  ✅ LINKED to Personnel Record:');
        console.log(`     Personnel ID: ${linkedPersonnel.id}`);
        console.log(`     Name: ${linkedPersonnel.name}`);
        console.log(`     Rank: ${linkedPersonnel.rank}`);
        console.log(`     Unit: ${linkedPersonnel.unit}`);
        console.log(`     PMKEYS: ${linkedPersonnel.idNumber}`);
        console.log(`     Role: ${linkedPersonnel.role}`);
      } else {
        console.log('\n  ❌ NOT LINKED to any Personnel Record');
      }
      console.log('\n' + '─'.repeat(80) + '\n');
    }
  } else {
    console.log('❌ No User records found for Alexander Burns\n');
  }

  // Search for Personnel with Alexander Burns
  const personnelList = await prisma.personnel.findMany({
    where: {
      OR: [
        { name: { contains: 'Alexander' } },
        { name: { contains: 'Burns' } },
        { idNumber: 8207938 }
      ]
    }
  });

  console.log(`\n📊 Found ${personnelList.length} Personnel records matching 'Alexander Burns':\n`);

  if (personnelList.length > 0) {
    for (const personnel of personnelList) {
      console.log('Personnel Record:');
      console.log(`  ID: ${personnel.id}`);
      console.log(`  Name: ${personnel.name}`);
      console.log(`  Rank: ${personnel.rank}`);
      console.log(`  Unit: ${personnel.unit}`);
      console.log(`  PMKEYS: ${personnel.idNumber}`);
      console.log(`  Role: ${personnel.role}`);
      console.log(`  Category: ${personnel.category}`);
      console.log(`  Active: ${personnel.isActive}`);
      console.log(`  User ID (link): ${personnel.userId}`);
      
      // Check linked user
      if (personnel.userId) {
        const linkedUser = await prisma.user.findUnique({
          where: { id: personnel.userId }
        });
        
        if (linkedUser) {
          console.log('\n  ✅ LINKED to User Record:');
          console.log(`     User ID: ${linkedUser.id}`);
          console.log(`     Username: ${linkedUser.username}`);
          console.log(`     Display Name: ${linkedUser.firstName} ${linkedUser.lastName}`);
          console.log(`     Email: ${linkedUser.email}`);
        }
      } else {
        console.log('\n  ❌ NOT LINKED to any User Record');
      }
      console.log('\n' + '─'.repeat(80) + '\n');
    }
  } else {
    console.log('❌ No Personnel records found for Alexander Burns\n');
  }

  // Check all personnel with userId (real database staff)
  const realStaff = await prisma.personnel.findMany({
    where: { userId: { not: null } },
    include: {
      user: true
    }
  });

  console.log(`\n📊 Summary: All Real Database Staff (${realStaff.length} records):\n`);
  
  for (const staff of realStaff) {
    console.log(`  • ${staff.name} (${staff.idNumber})`);
    console.log(`    - User ID: ${staff.userId}`);
    if (staff.user) {
      console.log(`    - Linked User: ${staff.user.firstName} ${staff.user.lastName} (${staff.user.username})`);
    } else {
      console.log(`    - ❌ User record not found for userId: ${staff.userId}`);
    }
    console.log();
  }

  await prisma.$disconnect();
}

checkUserLinkage().catch(console.error);
