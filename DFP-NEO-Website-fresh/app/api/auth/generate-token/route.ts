import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { getSession, isSessionExpired } from '@/lib/auth-sessions';

/**
 * Generate an authentication token for the V2 app
 * This allows single sign-on from the website to the V2 app
 * 
 * GET /api/auth/generate-token
 * Headers: Authorization: Bearer <session-token>
 * 
 * Returns a signed token containing user data that the V2 app can validate
 */
export async function GET(request: NextRequest) {
  try {
    // Get the session token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session' },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7);
    const session = getSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session not found' },
        { status: 401 }
      );
    }

    if (isSessionExpired(session)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session has expired' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Generate a token with user data (expires in 5 minutes)
    const tokenData = {
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      timestamp: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    // Create a base64 encoded token
    const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    
    // Add a signature to prevent tampering
    const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('hex');
    
    const signedToken = `${token}.${signature}`;

    return NextResponse.json({
      token: signedToken,
      user: {
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      }
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to generate token' },
      { status: 500 }
    );
  }
}