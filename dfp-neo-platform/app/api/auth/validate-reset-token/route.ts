import { NextRequest, NextResponse } from 'next/server';
import { validatePasswordResetToken } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    const validation = await validatePasswordResetToken(token);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Validate reset token error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
