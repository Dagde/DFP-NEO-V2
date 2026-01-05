import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { comparePassword } from '@/lib/password';
import { generateAccessToken, generateRefreshToken, formatUserForMobile } from '@/lib/mobile-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password } = body;

    // Validate input
    if (!userId || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'User ID and password are required' },
        { status: 400 }
      );
    }

    // Find user by userId
    const user = await prisma.user.findUnique({
      where: { userId },
      include: {
        permissionsRole: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid user ID or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Account is not active' },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Password not set. Please use the web portal to set your password.' },
        { status: 401 }
      );
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid user ID or password' },
        { status: 401 }
      );
    }

    // Generate tokens
    const accessToken = await generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Return success response
    return NextResponse.json({
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
      user: formatUserForMobile(user),
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}