import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession } from '@/lib/auth-sessions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Logout endpoint
 * POST /api/auth/direct-logout
 * 
 * Headers: Authorization: Bearer <token>
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