import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { sessions } from '../../auth/direct-login/route';

const prisma = new PrismaClient();

async function verifyAdminSession(token: string): Promise<{ userId: string; role: string; user: any } | null> {
  const memSession = sessions.get(token);
  if (memSession && new Date() < new Date(memSession.expires)) {
    const role = memSession.user.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return { userId: memSession.userId, role, user: memSession.user };
    }
    return null;
  }

  const dbSession = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!dbSession || new Date() > dbSession.expires) return null;
  const role = dbSession.user.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return null;
  return { userId: dbSession.userId, role, user: dbSession.user };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { targetUserId, newPassword, mustChangePassword = true } = body;

    if (!targetUserId || !newPassword) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'targetUserId and newPassword are required' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { userId: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Not Found', message: 'User not found' }, { status: 404 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { userId: targetUserId },
      data: { password: newHash, updatedAt: new Date() },
    });

    // Invalidate all sessions for target user
    const userSessions = await prisma.session.findMany({
      where: { userId: targetUser.id },
    });
    userSessions.forEach(s => sessions.delete(s.sessionToken));
    await prisma.session.deleteMany({ where: { userId: targetUser.id } });

    // Log audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: admin.userId,
          action: 'ADMIN_PASSWORD_RESET',
          entityType: 'User',
          entityId: targetUser.id,
          changes: { resetBy: admin.user?.userId || admin.userId, targetUser: targetUserId },
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    return NextResponse.json({ success: true, message: `Password reset for ${targetUserId}` });

  } catch (error) {
    console.error('Direct reset password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}