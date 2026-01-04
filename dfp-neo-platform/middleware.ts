import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth';

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/set-password',
];

// Routes that require admin capability
const adminRoutes = [
  '/admin',
];

// Routes that are accessible even with mustChangePassword
const passwordChangeRoutes = [
  '/change-password',
  '/set-password',
  '/api/auth',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow NextAuth API routes
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Get session
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user must change password
  if (session.user.mustChangePassword) {
    // Allow access to password change routes
    if (passwordChangeRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Redirect to change password page
    const changePasswordUrl = new URL('/change-password', request.url);
    return NextResponse.redirect(changePasswordUrl);
  }

  // Check admin routes
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    // Check if user has admin capability
    // Note: We'll do a more thorough check in the actual page/API route
    // This is just a basic check based on role name
    if (session.user.permissionsRole.name !== 'Administrator') {
      return NextResponse.redirect(new URL('/launch', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};