import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getSession, isSessionExpired } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

/**
 * Validate the Bearer token:
 * 1. Try in-memory session (fast path)
 * 2. Try DB Session table (survives server restarts)
 * 3. Try X-User-Id header as last resort - look up user directly in DB
 *    (used when session token predates DB session persistence)
 */
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

  // 3. Fallback: if userId hint provided, verify user exists and is admin
  // Then persist the session to DB for future requests
  if (userIdHint) {
    try {
      const user = await prisma.user.findUnique({ where: { userId: userIdHint } });
      if (user && user.isActive && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
        // Persist session to DB so future requests use path 2
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
 * GET /api/admin/direct-users
 * List all users - requires ADMIN or SUPER_ADMIN role
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized - No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const userIdHint = request.headers.get('x-user-id');
    const user = await validateAdmin(token, userIdHint);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized - Invalid or expired session. Please log out and log back in.' }, { status: 401 });
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ message: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const transformedUsers = users.map(u => ({
      ...u,
      lastLoginAt: u.lastLogin ? u.lastLogin.toISOString() : null,
      mustChangePassword: false,
      permissionsRoleId: null,
      displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.userId,
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error('GET /api/admin/direct-users error:', error);
    return NextResponse.json({ message: 'Failed to fetch users', details: String(error) }, { status: 500 });
  }
}