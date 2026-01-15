import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session' },
        { status: 401 }
      );
    }

    console.log('[SESSION API] Session user role:', session.user.role);
    console.log('[SESSION API] Session user:', session.user);
    return NextResponse.json({
      user: {
        id: session.user.id,
        userId: session.user.userId,
        username: session.user.username,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        role: session.user.role,
      }
    });
  } catch (error) {
    console.error('[SESSION API] Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred' },
      { status: 500 }
    );
  }
}