import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requiredSeedPassword(envName: string) {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(`${envName} must be set before running user migration`);
  }
  return value;
}

async function main() {
  console.log('🚀 Starting user migration...\n');

  // Users from lib/auth/auth.config.ts
  const users = [
    {
      username: 'admin',
      email: 'admin@dfp-neo.com',
      password: requiredSeedPassword('DFP_SEED_ADMIN_PASSWORD'),
      role: 'SUPER_ADMIN',
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
    {
      username: 'john.pilot',
      email: 'john.pilot@dfp-neo.com',
      password: requiredSeedPassword('DFP_SEED_PILOT_PASSWORD'),
      role: 'PILOT',
      firstName: 'John',
      lastName: 'Smith',
      isActive: true,
    },
    {
      username: 'jane.instructor',
      email: 'jane.instructor@dfp-neo.com',
      password: requiredSeedPassword('DFP_SEED_INSTRUCTOR_PASSWORD'),
      role: 'INSTRUCTOR',
      firstName: 'Jane',
      lastName: 'Wilson',
      isActive: true,
    },
    {
      username: 'mike.pilot',
      email: 'mike@dfp-neo.com',
      password: requiredSeedPassword('DFP_SEED_SECOND_PILOT_PASSWORD'),
      role: 'PILOT',
      firstName: 'Mike',
      lastName: 'Johnson',
      isActive: true,
    },
    {
      username: 'sarah.instructor',
      email: 'sarah@dfp-neo.com',
      password: requiredSeedPassword('DFP_SEED_SECOND_INSTRUCTOR_PASSWORD'),
      role: 'INSTRUCTOR',
      firstName: 'Sarah',
      lastName: 'Davis',
      isActive: true,
    },
  ];

  console.log(`📝 Creating ${users.length} users...`);

  for (const user of users) {
    // Hash password
    const hashedPassword = await bcrypt.hash(user.password, 10);

    // Create user
    await prisma.user.create({
      data: {
        username: user.username,
        email: user.email,
        password: hashedPassword,
        role: user.role as any,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
    });

    console.log(`  ✓ Created user: ${user.username} (${user.role})`);
  }

  console.log('\n✅ User migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
