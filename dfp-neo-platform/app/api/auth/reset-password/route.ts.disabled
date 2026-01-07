import { NextRequest, NextResponse } from 'next/server';
import { validatePasswordResetToken, markPasswordResetTokenUsed, changeUserPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate token
    const validation = await validatePasswordResetToken(token);
    if (!validation.valid || !validation.userId) {
      return NextResponse.json(
        { error: validation.error || 'Invalid token' },
        { status: 400 }
      );
    }

    // Reset password
    const result = await changeUserPassword(validation.userId, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.join(', ') || 'Failed to reset password' },
        { status: 400 }
      );
    }

    // Mark token as used
    await markPasswordResetTokenUsed(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
