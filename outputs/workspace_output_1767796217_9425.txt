// Mobile App JWT Authentication Utilities
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './db/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
);

const ACCESS_TOKEN_EXPIRY = '1h'; // 1 hour
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface MobileTokenPayload {
  userId: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Generate access token for mobile app
 */
export async function generateAccessToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Generate refresh token for mobile app
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
  
  return token;
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<MobileTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Validate that the payload has the required fields
    if (
      typeof payload.userId === 'string' &&
      (payload.type === 'access' || payload.type === 'refresh')
    ) {
      return payload as unknown as MobileTokenPayload;
    }
    
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Get user from access token
 */
export async function getUserFromToken(token: string) {
  const payload = await verifyToken(token);
  
  if (!payload || payload.type !== 'access') {
    return null;
  }
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      permissionsRole: true,
    },
  });
  
  return user;
}

/**
 * Format user data for mobile API response
 */
export function formatUserForMobile(user: any) {
  return {
    id: user.id,
    userId: user.userId,
    displayName: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.userId,
    email: user.email,
    status: user.status,
    permissionsRole: {
      id: user.permissionsRole.id,
      name: user.permissionsRole.name,
    },
    mustChangePassword: user.mustChangePassword,
  };
}