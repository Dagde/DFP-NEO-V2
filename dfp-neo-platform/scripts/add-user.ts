// Add a single user script
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addUser(userData: {
  username: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'PILOT' | 'INSTRUCTOR' | 'USER';
  firstName: string;
  lastName: string;
}) {
  try {
    console.log(`🔧 Adding user: ${userData.username}`);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: userData.username }
    });
    
    if (existingUser) {
      console.log(`⚠️  User ${userData.username} already exists!`);
      console.log('❌ Use a different username or update existing user.');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
        isActive: true,
      }
    });
    
    console.log(`✅ Successfully created user: ${user.username}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`👤 Role: ${user.role}`);
    console.log(`🔑 Password: ${userData.password}`);
    
  } catch (error) {
    console.error('❌ Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get user data from command line arguments
const args = process.argv.slice(2);

if (args.length !== 6) {
  console.log(`
📋 Usage: npx tsx scripts/add-user.ts <username> <email> <password> <role> <firstName> <lastName>

🎯 Example: npx tsx scripts/add-user.ts "mike.pilot" "mike@dfp-neo.com "Pilot2024!Secure" "PILOT" "Mike" "Johnson"

🔐 Available Roles: SUPER_ADMIN, ADMIN, PILOT, INSTRUCTOR, USER
`);
  process.exit(1);
}

const [username, email, password, role, firstName, lastName] = args;

addUser({
  username,
  email,
  password,
  role: role as any,
  firstName,
  lastName,
});