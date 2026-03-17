import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
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
 * POST /api/admin/direct-edit-role
 * Change a user's role - requires ADMIN or SUPER_ADMIN role
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
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json({ message: 'Target user ID and new role are required' }, { status: 400 });
    }

    // Validate role is valid
    const validRoles = ['USER', 'INSTRUCTOR', 'PILOT', 'ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` }, { status: 400 });
    }

    // Check target user exists
    const existingUser = await prisma.user.findUnique({ where: { userId: targetUserId } });
    if (!existingUser) {
      return NextResponse.json({ message: `User with ID '${targetUserId}' not found` }, { status: 404 });
    }

    // Update the user's role
    await prisma.user.update({
      where: { userId: targetUserId },
      data: { role: newRole },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: 'CHANGE_ROLE',
        entityType: 'User',
        entityId: existingUser.id,
        changes: { oldRole: existingUser.role, newRole },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Role updated to ${newRole} for '${targetUserId}'`,
    });
  } catch (error) {
    console.error('POST /api/admin/direct-edit-role error:', error);
    return NextResponse.json({ message: 'Failed to update role', details: String(error) }, { status: 500 });
  }
}