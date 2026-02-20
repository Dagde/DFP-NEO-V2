import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sessions } from '../direct-login/route';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.headers.get('x-session-token') || '';

    if (!token) {
      return NextResponse.json({ success: true, message: 'Already logged out' });
    }

    // Remove from memory
    sessions.delete(token);

    // Remove from database
    try {
      await prisma.session.delete({
        where: { sessionToken: token },
      });
    } catch {
      // Session may not exist in DB, that's fine
    }

    return NextResponse.json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    console.error('Direct logout error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}