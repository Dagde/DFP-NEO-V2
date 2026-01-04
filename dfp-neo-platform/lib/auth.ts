import NextAuth, { DefaultSession, User as NextAuthUser } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createAuditLog } from './audit';

const prisma = new PrismaClient();

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      userId: string;
      displayName: string | null;
      email: string | null;
      status: UserStatus;
      permissionsRole: {
        id: string;
        name: string;
      };
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    userId: string;
    displayName: string | null;
    email: string | null;
    status: UserStatus;
    permissionsRole: {
      id: string;
      name: string;
    };
    mustChangePassword: boolean;
  }
}

// Rate limiting store (in-memory for now, use Redis in production)
const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function checkRateLimit(identifier: string): { allowed: boolean; lockedUntil?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (attempts?.lockedUntil && attempts.lockedUntil > now) {
    return { allowed: false, lockedUntil: attempts.lockedUntil };
  }

  if (attempts?.lockedUntil && attempts.lockedUntil <= now) {
    // Lock expired, reset
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedAttempt(identifier: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier) || { count: 0 };
  
  attempts.count += 1;

  // Lock for 15 minutes after 10 failed attempts
  if (attempts.count >= 10) {
    attempts.lockedUntil = now + 15 * 60 * 1000; // 15 minutes
    attempts.count = 0; // Reset count
  }

  loginAttempts.set(identifier, attempts);
}

function resetAttempts(identifier: string) {
  loginAttempts.delete(identifier);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.userId || !credentials?.password) {
          return null;
        }

        const userId = (credentials.userId as string).trim().toUpperCase();
        const password = credentials.password as string;

        // Get IP address for rate limiting
        const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown';
        const ipString = Array.isArray(ip) ? ip[0] : ip;
        const rateLimitKey = `${userId}:${ipString}`;

        // Check rate limit
        const rateLimit = checkRateLimit(rateLimitKey);
        if (!rateLimit.allowed) {
          const minutesLeft = Math.ceil((rateLimit.lockedUntil! - Date.now()) / 60000);
          await createAuditLog({
            actionType: 'login_rate_limited',
            metadata: {
              userId,
              ipAddress: ipString,
              minutesLeft,
            },
            ipAddress: ipString,
            userAgent: req.headers?.['user-agent'] || undefined,
          });
          return null;
        }

        try {
          // Find user by userId (case-insensitive)
          const user = await prisma.user.findFirst({
            where: {
              userId: {
                equals: userId,
                mode: 'insensitive',
              },
            },
            include: {
              permissionsRole: true,
            },
          });

          // Generic error message - don't reveal which part failed
          if (!user) {
            recordFailedAttempt(rateLimitKey);
            await createAuditLog({
              actionType: 'login_failure',
              metadata: {
                userId,
                reason: 'user_not_found',
              },
              ipAddress: ipString,
              userAgent: req.headers?.['user-agent'] || undefined,
            });
            return null;
          }

          // Check if user is active
          if (user.status !== UserStatus.active) {
            recordFailedAttempt(rateLimitKey);
            await createAuditLog({
              actionType: 'login_failure',
              targetUserId: user.id,
              metadata: {
                userId,
                reason: 'user_not_active',
                status: user.status,
              },
              ipAddress: ipString,
              userAgent: req.headers?.['user-agent'] || undefined,
            });
            return null;
          }

          // Check if password is set
          if (!user.passwordHash) {
            recordFailedAttempt(rateLimitKey);
            await createAuditLog({
              actionType: 'login_failure',
              targetUserId: user.id,
              metadata: {
                userId,
                reason: 'password_not_set',
              },
              ipAddress: ipString,
              userAgent: req.headers?.['user-agent'] || undefined,
            });
            return null;
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.passwordHash);
          if (!isValidPassword) {
            recordFailedAttempt(rateLimitKey);
            await createAuditLog({
              actionType: 'login_failure',
              targetUserId: user.id,
              metadata: {
                userId,
                reason: 'invalid_password',
              },
              ipAddress: ipString,
              userAgent: req.headers?.['user-agent'] || undefined,
            });
            return null;
          }

          // Success! Reset rate limit attempts
          resetAttempts(rateLimitKey);

          // Update last login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // Log successful login
          await createAuditLog({
            actionType: 'login_success',
            actorUserId: user.id,
            targetUserId: user.id,
            metadata: {
              userId: user.userId,
            },
            ipAddress: ipString,
            userAgent: req.headers?.['user-agent'] || undefined,
          });

          // Return user object for session
          return {
            id: user.id,
            userId: user.userId,
            displayName: user.displayName,
            email: user.email,
            status: user.status,
            permissionsRole: {
              id: user.permissionsRole.id,
              name: user.permissionsRole.name,
            },
            mustChangePassword: user.mustChangePassword,
          };
        } catch (error) {
          console.error('Login error:', error);
          recordFailedAttempt(rateLimitKey);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.userId = user.userId;
        token.displayName = user.displayName;
        token.email = user.email;
        token.status = user.status;
        token.permissionsRole = user.permissionsRole;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.userId = token.userId as string;
        session.user.displayName = token.displayName as string | null;
        session.user.email = token.email as string | null;
        session.user.status = token.status as UserStatus;
        session.user.permissionsRole = token.permissionsRole as { id: string; name: string };
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await createAuditLog({
          actionType: 'logout',
          actorUserId: token.id as string,
          targetUserId: token.id as string,
          metadata: {
            userId: token.userId as string,
          },
        });
      }
    },
  },
});