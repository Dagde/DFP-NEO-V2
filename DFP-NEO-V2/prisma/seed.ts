import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seeding...')

  // Create default capabilities
  const capabilities = await Promise.all([
    prisma.capability.upsert({
      where: { name: 'view_dashboard' },
      update: {},
      create: {
        name: 'view_dashboard',
        description: 'View admin dashboard',
      },
    }),
    prisma.capability.upsert({
      where: { name: 'manage_users' },
      update: {},
      create: {
        name: 'manage_users',
        description: 'Create, edit, and delete users',
      },
    }),
    prisma.capability.upsert({
      where: { name: 'manage_roles' },
      update: {},
      create: {
        name: 'manage_roles',
        description: 'Manage user roles and permissions',
      },
    }),
    prisma.capability.upsert({
      where: { name: 'view_audit_logs' },
      update: {},
      create: {
        name: 'view_audit_logs',
        description: 'View system audit logs',
      },
    }),
    prisma.capability.upsert({
      where: { name: 'view_flights' },
      update: {},
      create: {
        name: 'view_flights',
        description: 'View flight data and analytics',
      },
    }),
  ])

  // Create default roles
  const adminRole = await prisma.permissionsRole.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'System administrator with full access',
      capabilities: {
        connect: capabilities,
      },
    },
  })

  const userRole = await prisma.permissionsRole.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user with limited access',
      capabilities: {
        connect: [capabilities[4]], // Only view_flights
      },
    },
  })

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const adminUser = await prisma.user.upsert({
    where: { userId: 'ADMIN001' },
    update: {},
    create: {
      userId: 'ADMIN001',
      email: 'admin@dfpneo.com',
      password: hashedPassword,
      name: 'System Administrator',
      status: 'active',
      role: {
        connect: { id: adminRole.id },
      },
    },
  })

  // Create a test user
  const testUserPassword = await bcrypt.hash('user123', 10)
  await prisma.user.upsert({
    where: { userId: 'USER001' },
    update: {},
    create: {
      userId: 'USER001',
      email: 'user@dfpneo.com',
      password: testUserPassword,
      name: 'Test User',
      status: 'active',
      role: {
        connect: { id: userRole.id },
      },
    },
  })

  console.log('Database seeding completed!')
  console.log('Admin credentials:')
  console.log('  User ID: ADMIN001')
  console.log('  Password: admin123')
  console.log('  User credentials:')
  console.log('  User ID: USER001')
  console.log('  Password: user123')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })