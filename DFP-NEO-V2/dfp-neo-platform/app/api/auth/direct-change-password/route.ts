import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { getSession, isSessionExpired } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

/**
 * Change password endpoint
 * POST /api/auth/direct-change-password
 * 
 * Headers: Authorization: Bearer <token>
 * Body: { currentPassword, newPassword }
 */
export async function POST(request: NextRequest) {
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

    if (isSessionExpired(session)) {
      return NextResponse.json(
        { error: 'Token expired', message: 'Session has expired' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Missing passwords', message: 'Current and new passwords are required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { userId: session.user.userId },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'User not found', message: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password', message: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { userId: session.user.userId },
      data: { 
        password: hashedPassword,
        mustChangePassword: false,
      },
    });

    // Log password change event
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        entityType: 'User',
        entityId: user.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to change password' },
      { status: 500 }
    );
  }
}