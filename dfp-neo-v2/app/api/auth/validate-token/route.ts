import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

/**
 * Validate an authentication token from the website
 * This allows single sign-on from the website to the V2 app
 * 
 * GET /api/auth/validate-token?authToken=xxx&userId=xxx
 * 
 * Returns user data if token is valid
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const authToken = searchParams.get('authToken');
    const userId = searchParams.get('userId');

    if (!authToken || !userId) {
      return NextResponse.json(
        { error: 'Bad request', message: 'Missing authToken or userId' },
        { status: 400 }
      );
    }

    // Split token and signature
    const [token, signature] = authToken.split('.');
    
    if (!token || !signature) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'Token format is invalid' },
        { status: 401 }
      );
    }

    // Verify signature
    const secret = process.env.NEXTAUTH_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(token)
      .digest('hex');

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'Token signature is invalid' },
        { status: 401 }
      );
    }

    // Decode token
    let tokenData;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      tokenData = JSON.parse(decoded);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'Failed to decode token' },
        { status: 401 }
      );
    }

    // Check if token has expired
    if (Date.now() > tokenData.expiresAt) {
      return NextResponse.json(
        { error: 'Expired token', message: 'Token has expired' },
        { status: 401 }
      );
    }

    // Verify userId matches
    if (tokenData.userId !== userId) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'User ID does not match' },
        { status: 401 }
      );
    }

    // Return user data
    return NextResponse.json({
      valid: true,
      user: {
        userId: tokenData.userId,
        username: tokenData.username,
        firstName: tokenData.firstName,
        lastName: tokenData.lastName,
        email: tokenData.email,
        role: tokenData.role,
        isActive: tokenData.isActive
      }
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to validate token' },
      { status: 500 }
    );
  }
}