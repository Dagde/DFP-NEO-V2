import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/password';

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
    const { userId, email, firstName, lastName, role, password } = body;

    // Validate required fields
    if (!userId || !email || !role || !password) {
      return NextResponse.json(
        { error: 'User ID, email, role, and password are required' },
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
    if (email) {
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
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        userId: normalizedUserId,
        username: normalizedUserId,
        email: email ? email.trim() : null,
        firstName: firstName ? firstName.trim() : null,
        lastName: lastName ? lastName.trim() : null,
        role,
        isActive: true,
        password: passwordHash,
      },
    });

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

    return NextResponse.json({
      success: true,
      userId: user.id,
    });
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