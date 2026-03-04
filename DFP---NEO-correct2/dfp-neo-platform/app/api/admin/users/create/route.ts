import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import crypto from 'crypto';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, email, displayName, firstName, lastName, role, password, temporaryPassword, method } = body;

    // Handle displayName - split into firstName and lastName if provided
    let fName = firstName;
    let lName = lastName;
    
    if (displayName && (!fName || !lName)) {
      const names = displayName.trim().split(' ');
      fName = names[0] || '';
      lName = names.slice(1).join(' ') || '';
    }

    // Validate required fields (email is now optional)
    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    // Handle password methods
    const pwd = password || temporaryPassword;
    const userMethod = method || 'temporary';
    
    // Handle invite link method - generate secure random password
    let generatedPassword = null;
    let finalPwd = pwd;
    
    if (userMethod === 'invite' && !pwd) {
      // Generate a secure random temporary password
      generatedPassword = crypto.randomBytes(16).toString('hex');
      finalPwd = generatedPassword;
      console.log('🔐 [CREATE USER] Generated temporary password for invite link');
    }
    
    // Validate password is provided
    if (!finalPwd) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Normalize userId
    const normalizedUserId = userId.trim().toUpperCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        userId: {
          equals: normalizedUserId,
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User ID already exists' },
        { status: 400 }
      );
    }

    // Check if email already exists (if provided)
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim() },
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'ADMIN', 'PILOT', 'INSTRUCTOR', 'USER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(finalPwd);
    console.log('🔐 [CREATE USER] Password hashed successfully');
    console.log(`   Method: ${userMethod}`);
    console.log(`   Generated Password: ${generatedPassword ? 'Yes (invite link)' : 'No (provided)'}`);

    // Create user
    const user = await prisma.user.create({
      data: {
        userId: normalizedUserId,
        username: normalizedUserId,
        email: (email && email.trim()) ? email.trim() : null,
        firstName: fName ? fName.trim() : null,
        lastName: lName ? lName.trim() : null,
        role,
        isActive: true,
        password: passwordHash,
      },
    });

    console.log('🔗 [AUTO-LINK] Checking for existing Personnel record with matching PMKEYS...');
    
    // Auto-link to existing Personnel by PMKEYS/idNumber
    const existingPersonnel = await prisma.personnel.findFirst({
      where: { 
        idNumber: parseInt(normalizedUserId) || 0
      }
    });

    if (existingPersonnel) {
      console.log('✅ [AUTO-LINK] Found Personnel record:', existingPersonnel.name);
      console.log('🔗 [AUTO-LINK] Linking User to Personnel...');
      
      await prisma.personnel.update({
        where: { id: existingPersonnel.id },
        data: { userId: user.id }
      });
      
      console.log('✅ [AUTO-LINK] Successfully linked User to Personnel');
      console.log(`   User ID: ${user.id} (${normalizedUserId})`);
      console.log(`   Personnel ID: ${existingPersonnel.id} (${existingPersonnel.name})`);
    } else {
      console.log('ℹ️  [AUTO-LINK] No existing Personnel record found for PMKEYS:', normalizedUserId);
    }

    // Log user creation
    await createAuditLog({
      action: 'user_created',
      userId: session.user.id,
      entityType: 'user',
      entityId: user.id,
      changes: {
        userId: user.userId,
        role,
        method: 'admin_created',
      },
    });

    // Prepare response
    const responseData: any = {
      success: true,
      userId: user.id,
      username: user.username,
      userPmkeys: user.userId,
    };

    // If invite link method, return the generated password
    if (userMethod === 'invite' && generatedPassword) {
      responseData.invitePassword = generatedPassword;
      responseData.message = 'User created with invite password. Share this securely with the user.';
      console.log('📧 [CREATE USER] Invite link response prepared with generated password');
    } else {
      responseData.message = 'User created successfully';
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Create user error:', error);
    
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage users' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}