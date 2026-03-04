import { NextRequest, NextResponse } from 'next/server';
import { validateInviteToken } from '@/lib/password';

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

    const validation = await validateInviteToken(token);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Validate invite token error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
