import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('Checking users in database...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true
      }
    });
    
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach(user => {
      console.log(`Username: ${user.username}`);
      console.log(`User ID: ${user.userId}`);
      console.log(`Email: ${user.email || 'N/A'}`);
      console.log(`Role: ${user.role}`);
      console.log(`Name: ${user.firstName} ${user.lastName}`);
      console.log(`Active: ${user.isActive}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();