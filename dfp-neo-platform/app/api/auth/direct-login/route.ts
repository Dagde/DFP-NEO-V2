import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { setSession, deleteSession, getSession, isSessionExpired } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

/**
 * Direct login endpoint - authenticates user and returns session token
 * POST /api/auth/direct-login
 * 
 * Body: { userId, password }
 * Returns: { token, user }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password } = body;

    if (!userId || !password) {
      return NextResponse.json(
        { error: 'Missing credentials', message: 'User ID and password are required' },
        { status: 400 }
      );
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { userId: userId as string },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Invalid credentials', message: 'Invalid User ID or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password as string, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials', message: 'Invalid User ID or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account inactive', message: 'Your account has been deactivated' },
        { status: 403 }
      );
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    // Store session
    setSession(token, {
      userId: user.userId,
      user: {
        id: user.id,
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      expiresAt,
    });

    // Log login event
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      sessionToken: token,
      expires: new Date(expiresAt).toISOString(),
      user: {
        id: user.id,
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}

/**
 * Get current session
 * GET /api/auth/direct-login
 * 
 * Headers: Authorization: Bearer <token>
 * Returns: { user }
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = getSession(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'Session not found' },
        { status: 401 }
      );
    }

    // Check if session expired
    if (isSessionExpired(session)) {
      deleteSession(token);
      return NextResponse.json(
        { error: 'Token expired', message: 'Session has expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: session.user });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to get session' },
      { status: 500 }
    );
  }
}

/**
 * Logout
 * DELETE /api/auth/direct-login
 * 
 * Headers: Authorization: Bearer <token>
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const session = getSession(token);

    if (session) {
      // Log logout event
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: session.user.id,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });

      deleteSession(token);
    }

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to logout' },
      { status: 500 }
    );
  }
}