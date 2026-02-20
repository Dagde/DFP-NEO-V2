import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { authSessions } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

async function verifyAdminSession(token: string): Promise<{ userId: string; role: string; adminUser: any } | null> {
  const memSession = authSessions.get(token);
  if (memSession && new Date() < new Date(memSession.expires)) {
    const role = memSession.user.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return { userId: memSession.userId, role, adminUser: memSession.user };
    }
    return null;
  }

  const dbSession = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!dbSession || new Date() > dbSession.expires) return null;
  const role = dbSession.user.role;
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return null;
  return { userId: dbSession.userId, role, adminUser: dbSession.user };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await verifyAdminSession(token);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden', message: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, password, email, firstName, lastName, role = 'USER' } = body;

    if (!userId || !password) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'userId and password are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { userId } });
    if (existing) {
      return NextResponse.json(
        { error: 'Conflict', message: 'User ID already exists' },
        { status: 409 }
      );
    }

    const newHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        userId,
        username: userId,
        email: email || null,
        password: newHash,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role as Role,
        isActive: true,
        createdById: admin.userId,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          userId: admin.userId,
          action: 'CREATE_USER',
          entityType: 'User',
          entityId: newUser.id,
          changes: { createdBy: admin.adminUser?.userId || admin.userId, newUser: userId },
        },
      });
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `User ${userId} created successfully`,
      user: { id: newUser.id, userId, email, firstName, lastName, role },
    }, { status: 201 });

  } catch (error) {
    console.error('Direct create user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}