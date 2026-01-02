const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createSuperAdmin() {
  console.log('\n🔐 DFP-NEO Super Admin Setup\n');
  console.log('This script will create the first super admin user.\n');

  try {
    const username = await question('Enter username: ');
    const password = await question('Enter password: ');
    const email = await question('Enter email (optional): ');
    const firstName = await question('Enter first name (optional): ');
    const lastName = await question('Enter last name (optional): ');

    console.log('\n⏳ Creating super admin user...\n');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    console.log('✅ Super admin user created successfully!\n');
    console.log('User Details:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email || 'Not provided'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  ID: ${user.id}\n`);
    console.log('🎉 You can now login at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    
    if (error.code === 'P2002') {
      console.error('\n⚠️  Username already exists. Please choose a different username.\n');
    }
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createSuperAdmin();