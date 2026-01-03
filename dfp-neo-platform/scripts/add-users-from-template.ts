// Add users from GitHub template
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface UserTemplate {
  username: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'PILOT' | 'INSTRUCTOR' | 'USER';
  firstName: string;
  lastName: string;
  notes?: string;
}

async function addUsersFromTemplate() {
  try {
    console.log('📖 Reading user templates from GitHub...');
    
    // Read the template file
    const templatePath = path.join(process.cwd(), 'templates/user-templates.md');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Extract YAML-like user entries
    const userEntries: UserTemplate[] = [];
    const lines = templateContent.split('\n');
    let currentUser: Partial<UserTemplate> = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('- username:')) {
        if (currentUser.username) {
          userEntries.push(currentUser as UserTemplate);
        }
        currentUser = {
          username: trimmedLine.split('"')[1],
        };
      } else if (trimmedLine.startsWith('email:')) {
        currentUser.email = trimmedLine.split('"')[1];
      } else if (trimmedLine.startsWith('role:')) {
        currentUser.role = trimmedLine.split('"')[1] as any;
      } else if (trimmedLine.startsWith('firstName:')) {
        currentUser.firstName = trimmedLine.split('"')[1];
      } else if (trimmedLine.startsWith('lastName:')) {
        currentUser.lastName = trimmedLine.split('"')[1];
      }
    }
    
    // Add the last user
    if (currentUser.username) {
      userEntries.push(currentUser as UserTemplate);
    }
    
    if (userEntries.length === 0) {
      console.log('❌ No users found in template file');
      console.log('💡 Please add users to templates/user-templates.md');
      return;
    }
    
    console.log(`👥 Found ${userEntries.length} users to add...\n`);
    
    for (const userTemplate of userEntries) {
      console.log(`🔧 Processing: ${userTemplate.username}`);
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userTemplate.username }
      });
      
      if (existingUser) {
        console.log(`⚠️  User ${userTemplate.username} already exists - skipping`);
        continue;
      }
      
      // Generate secure password
      const password = `Default2024!${Math.random().toString(36).slice(-6)}`;
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          ...userTemplate,
          password: hashedPassword,
          isActive: true,
        }
      });
      
      console.log(`✅ Created user: ${user.username}`);
      console.log(`🔑 Password: ${password}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Role: ${user.role}\n`);
    }
    
    console.log('🎉 User creation complete!');
    console.log('💡 Tell users to change their passwords on first login');
    
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addUsersFromTemplate();