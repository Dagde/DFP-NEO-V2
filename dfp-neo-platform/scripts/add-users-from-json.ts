// Add users from GitHub JSON config
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface UserConfig {
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'PILOT' | 'INSTRUCTOR' | 'USER';
  firstName: string;
  lastName: string;
  temporaryPassword: string;
}

interface UserConfigFile {
  newUsers: UserConfig[];
}

async function addUsersFromJson() {
  try {
    console.log('📖 Reading user config from GitHub...');
    
    // Read the JSON config file
    const configPath = path.join(process.cwd(), 'config/users.json');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config: UserConfigFile = JSON.parse(configContent);
    
    if (!config.newUsers || config.newUsers.length === 0) {
      console.log('❌ No users found in config file');
      console.log('💡 Please add users to config/users.json');
      return;
    }
    
    console.log(`👥 Found ${config.newUsers.length} users to add...\n`);
    
    for (const userConfig of config.newUsers) {
      console.log(`🔧 Processing: ${userConfig.username}`);
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userConfig.username }
      });
      
      if (existingUser) {
        console.log(`⚠️  User ${userConfig.username} already exists - skipping`);
        continue;
      }
      
      // Hash the temporary password
      const hashedPassword = await bcrypt.hash(userConfig.temporaryPassword, 12);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          username: userConfig.username,
          email: userConfig.email,
          role: userConfig.role,
          firstName: userConfig.firstName,
          lastName: userConfig.lastName,
          password: hashedPassword,
          isActive: true,
        }
      });
      
      console.log(`✅ Created user: ${user.username}`);
      console.log(`🔑 Temporary Password: ${userConfig.temporaryPassword}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Role: ${user.role}\n`);
    }
    
    console.log('🎉 User creation complete!');
    console.log('💡 Tell users to change their passwords on first login');
    console.log('🧹 Clear the newUsers array in config/users.json after processing');
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addUsersFromJson();