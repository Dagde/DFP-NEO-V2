import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    }
  });

  console.log('Users in database:');
  console.log('===================');
  users.forEach((user, index) => {
    console.log(`\nUser ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  UserId: ${user.userId}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  First Name: ${user.firstName}`);
    console.log(`  Last Name: ${user.lastName}`);
    console.log(`  Role: ${user.role}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());