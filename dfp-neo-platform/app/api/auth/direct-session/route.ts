import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSessionExpired, deleteSession } from '@/lib/auth-sessions';

/**
 * Validate session token
 * GET /api/auth/direct-session
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
    console.error('Session validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to validate session' },
      { status: 500 }
    );
  }
}