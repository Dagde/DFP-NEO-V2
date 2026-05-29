import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCorsHeaders, rejectDisallowedCorsOrigin } from '@/lib/cors';

export async function middleware(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/');

  if (isApiRequest) {
    const rejected = rejectDisallowedCorsOrigin(request);
    if (rejected) return rejected;

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
    }
  }

  const response = NextResponse.next();

  if (isApiRequest) {
    const corsHeaders = getCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') response.headers.set(key, value);
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
