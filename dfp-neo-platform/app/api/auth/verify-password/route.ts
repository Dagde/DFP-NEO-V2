import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '@/lib/password';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/auth/verify-password
// Verifies the current user's password — used for destructive action confirmations
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.userId) {
      return NextResponse.json({ valid: false, error: 'Not authenticated' }, { status: 401, headers: CORS_HEADERS });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ valid: false, error: 'Password required' }, { status: 400, headers: CORS_HEADERS });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.userId },
      select: { password: true },
    });

    if (!user?.password) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const valid = await comparePassword(password, user.password);
    return NextResponse.json({ valid }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('❌ Error verifying password:', error);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
