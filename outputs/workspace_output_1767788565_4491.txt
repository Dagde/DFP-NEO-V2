import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from './mobile-auth';

/**
 * Middleware to authenticate mobile API requests
 * Returns user if authenticated, or error response if not
 */
export async function authenticateMobileRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const user = await getUserFromToken(token);
  
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}