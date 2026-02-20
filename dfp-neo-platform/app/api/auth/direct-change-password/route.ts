import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { sessions } from '../direct-login/route';

const prisma = new PrismaClient();

function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  return errors;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.headers.get('x-session-token') || '';

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No session token' },
        { status: 401 }
      );
    }

    // Verify session
    const memSession = sessions.get(token);
    let userId: string | null = null;

    if (memSession && new Date() < new Date(memSession.expires)) {
      userId = memSession.userId;
    } else {
      // Check database
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken: token },
      });
      if (!dbSession || new Date() > dbSession.expires) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Invalid or expired session' },
          { status: 401 }
        );
      }
      userId = dbSession.userId;
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'currentPassword and newPassword are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    const errors = validatePasswordStrength(newPassword);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Password too weak', errors },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found' },
        { status: 401 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHash, updatedAt: new Date() },
    });

    // Invalidate all other sessions for this user
    const userSessions = await prisma.session.findMany({
      where: { userId },
    });
    userSessions.forEach(s => {
      if (s.sessionToken !== token) {
        sessions.delete(s.sessionToken);
      }
    });
    await prisma.session.deleteMany({
      where: { userId, NOT: { sessionToken: token } },
    });

    // Update current session user
    const currentSession = sessions.get(token);
    if (currentSession) {
      currentSession.user.mustChangePassword = false;
      sessions.set(token, currentSession);
    }

    // Log audit
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGE',
          entityType: 'User',
          entityId: userId,
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    return NextResponse.json({ success: true, message: 'Password changed successfully' });

  } catch (error) {
    console.error('Direct change password error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}