import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '@/lib/password';
import { verifyToken } from '@/lib/mobile-auth';

const prisma = new PrismaClient();


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// POST /api/auth/verify-password
// Verifies the current user's password — used for destructive action confirmations
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    let userId = session?.user?.id || '';

    if (!userId) {
      const authHeader = request.headers.get('authorization') || '';
      const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
      if (bearerToken) {
        const tokenPayload = await verifyToken(bearerToken);
        if (tokenPayload?.type === 'access') {
          userId = tokenPayload.userId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ valid: false, error: 'Not authenticated' }, { status: 401, headers: getCorsHeaders(request) });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ valid: false, error: 'Password required' }, { status: 400, headers: getCorsHeaders(request) });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
