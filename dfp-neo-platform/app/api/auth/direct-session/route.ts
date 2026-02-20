import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authSessions } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
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

    // Check in-memory sessions first
    const memSession = authSessions.get(token);
    if (memSession && new Date() < new Date(memSession.expires)) {
      return NextResponse.json({
        user: memSession.user,
        expires: memSession.expires,
      });
    }

    // Fall back to database session
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    });

    if (!dbSession || new Date() > dbSession.expires) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const user = dbSession.user;
    const sessionUser = {
      id: user.id,
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username,
      mustChangePassword: false,
      permissionsRoleId: null,
    };

    // Restore to memory cache
    authSessions.set(token, {
      userId: user.id,
      expires: dbSession.expires.toISOString(),
      user: sessionUser,
    });

    return NextResponse.json({
      user: sessionUser,
      expires: dbSession.expires.toISOString(),
    });

  } catch (error) {
    console.error('Direct session error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}