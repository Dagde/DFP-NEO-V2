// Production user setup script
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const productionUsers = [
  {
    username: 'admin',
    email: 'admin@dfp-neo.com',
    password: 'Admin2024!Secure',
    role: 'ADMIN',
    firstName: 'System',
    lastName: 'Administrator',
  },
  {
    username: 'john.pilot',
    email: 'john.pilot@dfp-neo.com', 
    password: 'Pilot2024!Secure',
    role: 'PILOT',
    firstName: 'John',
    lastName: 'Smith',
  },
  {
    username: 'jane.instructor',
    email: 'jane.instructor@dfp-neo.com',
    password: 'Instructor2024!Secure', 
    role: 'INSTRUCTOR',
    firstName: 'Jane',
    lastName: 'Wilson',
  }
];

async function createProductionUsers() {
  try {
    console.log('🔧 Setting up production users...');
    
    for (const user of productionUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      await prisma.user.upsert({
        where: { username: user.username },
        update: {
          password: hashedPassword,
          isActive: true,
        },
        create: {
          ...user,
          password: hashedPassword,
          isActive: true,
        }
      });
      
      console.log(`✅ Created user: ${user.username}`);
    }
    
    console.log('🎉 Production users setup complete!');
    console.log('\n📋 Login Credentials:');
    console.log('========================');
    productionUsers.forEach(user => {
      console.log(`👤 ${user.username}`);
      console.log(`🔑 Password: ${user.password}`);
      console.log(`📧 Email: ${user.email}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createProductionUsers();