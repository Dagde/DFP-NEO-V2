import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { authSessions } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Rate limiting
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

function checkRateLimit(userId: string): { allowed: boolean; message?: string } {
  const key = userId.toLowerCase();
  const attempts = loginAttempts.get(key);
  if (!attempts) return { allowed: true };
  if (attempts.count >= 10) {
    const lockoutEnd = new Date(attempts.lastAttempt.getTime() + 15 * 60 * 1000);
    if (new Date() < lockoutEnd) {
      const remainingMin = Math.ceil((lockoutEnd.getTime() - Date.now()) / 60000);
      return { allowed: false, message: `Account temporarily locked. Try again in ${remainingMin} minute(s).` };
    }
    loginAttempts.delete(key);
  }
  return { allowed: true };
}

function recordFailedAttempt(userId: string) {
  const key = userId.toLowerCase();
  const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: new Date() };
  attempts.count++;
  attempts.lastAttempt = new Date();
  loginAttempts.set(key, attempts);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, password } = body;

    if (!userId || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'userId and password are required' },
        { status: 400 }
      );
    }

    // Rate limit check
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: rateLimit.message },
        { status: 429 }
      );
    }

    // Find user by userId
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user || !user.isActive) {
      recordFailedAttempt(userId);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid user ID or password' },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Password not set. Contact administrator.' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      recordFailedAttempt(userId);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid user ID or password' },
        { status: 401 }
      );
    }

    // Clear failed attempts
    loginAttempts.delete(userId.toLowerCase());

    // Create session token
    const sessionToken = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const sessionUser = {
      id: user.id,
      userId: user.userId,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username,
      mustChangePassword: false,
      permissionsRoleId: null,
    };

    // Store session in shared memory store
    authSessions.set(sessionToken, {
      userId: user.id,
      expires: expires.toISOString(),
      user: sessionUser,
    });

    // Store session in database
    try {
      await prisma.session.create({
        data: {
          sessionToken,
          userId: user.id,
          expires,
        },
      });
    } catch (sessionErr) {
      console.error('Session DB error:', sessionErr);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Log audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    console.log(`✅ Direct login successful: ${userId} (${user.role})`);

    return NextResponse.json({
      sessionToken,
      expires: expires.toISOString(),
      user: sessionUser,
      mustChangePassword: false,
    });

  } catch (error) {
    console.error('Direct login error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Login failed' },
      { status: 500 }
    );
  }
}