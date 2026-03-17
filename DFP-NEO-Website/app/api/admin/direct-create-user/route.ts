import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { getSession, isSessionExpired } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

async function validateAdmin(token: string, userIdHint?: string | null) {
  // 1. Try in-memory session first
  const session = getSession(token);
  if (session && !isSessionExpired(session)) {
    return session.user;
  }

  // 2. Try DB session table
  try {
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });
    if (dbSession && dbSession.expires > new Date()) {
      return {
        id: dbSession.user.id,
        userId: dbSession.user.userId,
        username: dbSession.user.username,
        firstName: dbSession.user.firstName,
        lastName: dbSession.user.lastName,
        email: dbSession.user.email,
        role: dbSession.user.role,
        isActive: dbSession.user.isActive,
      };
    }
  } catch (e) {
    console.error('DB session lookup failed:', e);
  }

  // 3. Fallback: look up user directly by userId hint
  if (userIdHint) {
    try {
      const user = await prisma.user.findUnique({ where: { userId: userIdHint } });
      if (user && user.isActive && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
        await prisma.session.upsert({
          where: { sessionToken: token },
          update: { expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          create: {
            sessionToken: token,
            userId: user.id,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        return {
          id: user.id,
          userId: user.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        };
      }
    } catch (e) {
      console.error('User lookup fallback failed:', e);
    }
  }

  return null;
}

/**
 * POST /api/admin/direct-create-user
 * Create a new user - requires ADMIN or SUPER_ADMIN role
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const userIdHint = request.headers.get('x-user-id');
    const sessionUser = await validateAdmin(token, userIdHint);

    if (!sessionUser) {
      return NextResponse.json({ message: 'Unauthorized - Invalid or expired session' }, { status: 401 });
    }

    if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, password, email, firstName, lastName, role, mustChangePassword } = body;

    if (!userId || !password) {
      return NextResponse.json({ message: 'User ID and password are required' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { userId } });
    if (existingUser) {
      return NextResponse.json({ message: `User with ID '${userId}' already exists` }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        userId,
        username: userId,
        email: email || null,
        firstName: firstName || null,
        lastName: lastName || null,
        password: hashedPassword,
        role: role || 'USER',
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User '${userId}' created successfully`,
      user: {
        id: newUser.id,
        userId: newUser.userId,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/direct-create-user error:', error);
    return NextResponse.json({ message: 'Failed to create user', details: String(error) }, { status: 500 });
  }
}