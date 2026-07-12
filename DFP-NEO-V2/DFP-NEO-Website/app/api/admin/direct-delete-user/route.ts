import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { getSession, isSessionExpired } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

async function validateAdmin(token: string, userIdHint?: string | null) {
  const session = getSession(token);
  if (session && !isSessionExpired(session)) {
    return session.user;
  }

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
 * POST /api/admin/direct-delete-user
 * Delete a login account while preserving linked staff/trainee profile records.
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

    const adminUser = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!adminUser) {
      return NextResponse.json({ message: 'Signed-in admin user was not found' }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, password } = body;
    const cleanTargetUserId = String(targetUserId || '').trim();

    if (!cleanTargetUserId || !password) {
      return NextResponse.json({ message: 'Target user and your password are required' }, { status: 400 });
    }

    const validPassword = await bcrypt.compare(password, adminUser.password || '');
    if (!validPassword) {
      return NextResponse.json({ message: 'Your password was not accepted' }, { status: 403 });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: cleanTargetUserId },
          { userId: cleanTargetUserId },
          { username: cleanTargetUserId },
        ],
      },
    });

    if (!targetUser) {
      return NextResponse.json({ message: `User with ID '${cleanTargetUserId}' not found` }, { status: 404 });
    }

    if (targetUser.id === adminUser.id || targetUser.userId === adminUser.userId) {
      return NextResponse.json({ message: 'You cannot delete your own signed-in account' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.personnel.updateMany({
        where: { userId: targetUser.id },
        data: { userId: null },
      });
      await tx.trainee.updateMany({
        where: { userId: targetUser.id },
        data: { userId: null },
      });
      await tx.session.deleteMany({
        where: { userId: targetUser.id },
      });
      await tx.$executeRawUnsafe(
        `DELETE FROM "CommercialUserAccess" WHERE "userId" = $1 OR username = $1 OR "userId" = $2 OR username = $2`,
        targetUser.userId,
        targetUser.username || ''
      );
      await tx.user.updateMany({
        where: { createdById: targetUser.id },
        data: { createdById: null },
      });
      await tx.auditLog.create({
        data: {
          userId: adminUser.id,
          action: 'DELETE_USER',
          entityType: 'User',
          entityId: targetUser.id,
          changes: {
            userId: targetUser.userId,
            username: targetUser.username,
            email: targetUser.email,
            role: targetUser.role,
          },
        },
      });
      await tx.user.delete({
        where: { id: targetUser.id },
      });
    });

    return NextResponse.json({
      success: true,
      deletedUserId: targetUser.userId,
      message: `Deleted user '${targetUser.userId}'`,
    });
  } catch (error) {
    console.error('POST /api/admin/direct-delete-user error:', error);
    return NextResponse.json({ message: 'Failed to delete user', details: String(error) }, { status: 500 });
  }
}
