import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '@/lib/password';

const prisma = new PrismaClient();


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// POST /api/auth/verify-password
// Verifies the current user's password — used for destructive action confirmations
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.userId) {
      return NextResponse.json({ valid: false, error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders(request) });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ valid: false, error: 'Password required' }, { status: 400, headers: getCorsHeaders(request) });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.userId },
      select: { password: true },
    });

    if (!user?.password) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 404, headers: getCorsHeaders(request) });
    }

    const valid = await comparePassword(password, user.password);
    return NextResponse.json({ valid }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('❌ Error verifying password:', error);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500, headers: getCorsHeaders(request) });
  }
}
