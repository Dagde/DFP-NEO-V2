import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    return NextResponse.json({
      user: {
        internalId: user.id,
        displayUserId: user.userId,
        displayName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      message: "User debug information retrieved successfully"
    });
  } catch (error) {
    console.error('Debug user error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while fetching user info' },
      { status: 500 }
    );
  }
}