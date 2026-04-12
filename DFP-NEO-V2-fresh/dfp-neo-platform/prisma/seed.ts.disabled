import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // 1. Create Permission Capabilities
  // ============================================================================
  console.log('📋 Creating permission capabilities...');
  
  const capabilities = [
    { key: 'launch:access', description: 'Access to the Launch page' },
    { key: 'admin:access_panel', description: 'Access to Administrator Panel' },
    { key: 'users:manage', description: 'Create, edit, and manage users' },
    { key: 'audit:read', description: 'View audit logs' },
    { key: 'training:manage', description: 'Manage training schedules and activities' },
    { key: 'maintenance:edit', description: 'Edit maintenance records' },
    { key: 'developer:tools_access', description: 'Access to developer tools' },
    { key: 'schedule:create', description: 'Create flight schedules' },
    { key: 'schedule:edit', description: 'Edit flight schedules' },
    { key: 'schedule:delete', description: 'Delete flight schedules' },
    { key: 'personnel:manage', description: 'Manage personnel records' },
    { key: 'aircraft:manage', description: 'Manage aircraft records' },
  ];

  const createdCapabilities: Record<string, any> = {};
  
  for (const cap of capabilities) {
    const capability = await prisma.permissionCapability.upsert({
      where: { key: cap.key },
      update: { description: cap.description },
      create: cap,
    });
    createdCapabilities[cap.key] = capability;
    console.log(`  ✓ Created capability: ${cap.key}`);
  }

  // ============================================================================
  // 2. Create Permissions Roles
  // ============================================================================
  console.log('\n👥 Creating permissions roles...');
  
  const roles = [
    {
      name: 'Administrator',
      description: 'Full system access with all capabilities',
      capabilities: [
        'launch:access',
        'admin:access_panel',
        'users:manage',
        'audit:read',
        'training:manage',
        'maintenance:edit',
        'developer:tools_access',
        'schedule:create',
        'schedule:edit',
        'schedule:delete',
        'personnel:manage',
        'aircraft:manage',
      ],
    },
    {
      name: 'Instructor',
      description: 'Instructor with training management capabilities',
      capabilities: [
        'launch:access',
        'training:manage',
        'schedule:create',
        'schedule:edit',
        'personnel:manage',
      ],
    },
    {
      name: 'Trainee',
      description: 'Trainee with basic access',
      capabilities: [
        'launch:access',
      ],
    },
    {
      name: 'Programmer',
      description: 'Developer with programming tools access',
      capabilities: [
        'launch:access',
        'developer:tools_access',
        'schedule:create',
        'schedule:edit',
      ],
    },
    {
      name: 'Maintenance',
      description: 'Maintenance personnel with aircraft management',
      capabilities: [
        'launch:access',
        'maintenance:edit',
        'aircraft:manage',
      ],
    },
  ];

  for (const roleData of roles) {
    const role = await prisma.permissionsRole.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: {
        name: roleData.name,
        description: roleData.description,
      },
    });

    // Map capabilities to role
    for (const capKey of roleData.capabilities) {
      const capability = createdCapabilities[capKey];
      if (capability) {
        await prisma.permissionsRoleCapability.upsert({
          where: {
            roleId_capabilityId: {
              roleId: role.id,
              capabilityId: capability.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            capabilityId: capability.id,
          },
        });
      }
    }
    
    console.log(`  ✓ Created role: ${roleData.name} with ${roleData.capabilities.length} capabilities`);
  }

  // ============================================================================
  // 3. Create Initial Administrator User
  // ============================================================================
  console.log('\n👤 Creating initial administrator user...');
  
  const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || null;
  
  const adminRole = await prisma.permissionsRole.findUnique({
    where: { name: 'Administrator' },
  });

  if (!adminRole) {
    throw new Error('Administrator role not found');
  }

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { userId: adminUserId },
  });

  if (existingAdmin) {
    console.log(`  ⚠️  Admin user '${adminUserId}' already exists, skipping creation`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    const admin = await prisma.user.create({
      data: {
        userId: adminUserId,
        email: adminEmail,
        displayName: 'System Administrator',
        passwordHash: passwordHash,
        status: UserStatus.active,
        permissionsRoleId: adminRole.id,
        mustChangePassword: true, // Force password change on first login
        passwordSetAt: new Date(),
      },
    });

    console.log(`  ✓ Created admin user: ${adminUserId}`);
    console.log(`  ⚠️  IMPORTANT: Default password is '${adminPassword}'`);
    console.log(`  ⚠️  User MUST change password on first login`);
    
    // Log the admin creation
    await prisma.auditLog.create({
      data: {
        actionType: 'user_created',
        targetUserId: admin.id,
        metadata: {
          createdBy: 'system_seed',
          role: 'Administrator',
        },
      },
    });
  }

  // ============================================================================
  // 4. Create Sample Users (Optional - for testing)
  // ============================================================================
  if (process.env.CREATE_SAMPLE_USERS === 'true') {
    console.log('\n👥 Creating sample users...');
    
    const sampleUsers = [
      {
        userId: 'instructor001',
        displayName: 'John Instructor',
        email: 'instructor@example.com',
        roleName: 'Instructor',
      },
      {
        userId: 'trainee001',
        displayName: 'Jane Trainee',
        email: 'trainee@example.com',
        roleName: 'Trainee',
      },
      {
        userId: 'programmer001',
        displayName: 'Bob Developer',
        email: 'dev@example.com',
        roleName: 'Programmer',
      },
      {
        userId: 'maintenance001',
        displayName: 'Alice Maintenance',
        email: 'maintenance@example.com',
        roleName: 'Maintenance',
      },
    ];

    for (const userData of sampleUsers) {
      const role = await prisma.permissionsRole.findUnique({
        where: { name: userData.roleName },
      });

      if (!role) {
        console.log(`  ⚠️  Role '${userData.roleName}' not found, skipping user ${userData.userId}`);
        continue;
      }

      const existing = await prisma.user.findUnique({
        where: { userId: userData.userId },
      });

      if (existing) {
        console.log(`  ⚠️  User '${userData.userId}' already exists, skipping`);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          userId: userData.userId,
          email: userData.email,
          displayName: userData.displayName,
          status: UserStatus.pending, // Pending until they set password
          permissionsRoleId: role.id,
          mustChangePassword: true,
          passwordHash: null, // No password set yet
        },
      });

      console.log(`  ✓ Created sample user: ${userData.userId} (${userData.roleName})`);
    }
  }

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📝 Summary:');
  console.log(`   - ${capabilities.length} capabilities created`);
  console.log(`   - ${roles.length} roles created`);
  console.log(`   - Initial admin user created (userId: ${adminUserId})`);
  if (process.env.CREATE_SAMPLE_USERS === 'true') {
    console.log(`   - Sample users created for testing`);
  }
  console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
  console.log('   1. Change the admin password immediately after first login');
  console.log('   2. Set strong passwords for all users');
  console.log('   3. Review and adjust role capabilities as needed');
  console.log('   4. Enable rate limiting in production');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });