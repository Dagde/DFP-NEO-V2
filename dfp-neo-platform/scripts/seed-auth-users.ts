/**
 * Seed script to create initial auth users in the PostgreSQL database
 * Run with: npx tsx scripts/seed-auth-users.ts
 * 
 * Users created:
 * - superadmin / Bathurst063371526 (SUPER_ADMIN)
 * - alexander.burns / Burns8201112 (INSTRUCTOR)
 */

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding auth users...\n');

  // Hash passwords
  const superAdminHash = await bcrypt.hash('Bathurst063371526', 12);
  const burnsHash = await bcrypt.hash('Burns8201112', 12);

  // Create SuperAdmin
  const superAdmin = await prisma.user.upsert({
    where: { userId: 'superadmin' },
    update: {
      password: superAdminHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      email: 'lifeofiron2015@gmail.com',
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
    },
    create: {
      userId: 'superadmin',
      username: 'superadmin',
      email: 'lifeofiron2015@gmail.com',
      password: superAdminHash,
      role: Role.SUPER_ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });
  console.log(`✅ SuperAdmin: ${superAdmin.userId} (${superAdmin.role})`);

  // Create Alexander Burns
  const burns = await prisma.user.upsert({
    where: { userId: 'alexander.burns' },
    update: {
      password: burnsHash,
      role: Role.INSTRUCTOR,
      isActive: true,
      email: 'burns.alexander@sample.com.au',
      firstName: 'Alexander',
      lastName: 'Burns',
      username: 'alexander.burns',
    },
    create: {
      userId: 'alexander.burns',
      username: 'alexander.burns',
      email: 'burns.alexander@sample.com.au',
      password: burnsHash,
      role: Role.INSTRUCTOR,
      firstName: 'Alexander',
      lastName: 'Burns',
      isActive: true,
    },
  });
  console.log(`✅ Alexander Burns: ${burns.userId} (${burns.role})`);

  console.log('\n✅ Auth users seeded successfully!');
  console.log('\nCredentials:');
  console.log('  SuperAdmin: superadmin / Bathurst063371526');
  console.log('  Alexander Burns: alexander.burns / Burns8201112');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());