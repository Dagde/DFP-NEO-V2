import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, generateAccessToken } from '@/lib/mobile-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    // Validate input
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Verify refresh token
    const payload = await verifyToken(refreshToken);
    
    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Generate new access token
    const accessToken = await generateAccessToken(payload.userId);

    return NextResponse.json({
      accessToken,
      expiresIn: 3600, // 1 hour in seconds
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
      { status: 401 }
    );
  }
}