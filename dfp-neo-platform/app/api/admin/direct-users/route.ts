import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authSessions } from '@/lib/auth-sessions';

const prisma = new PrismaClient();

async function verifyAdminSession(token: string): Promise<{ userId: string; role: string } | null> {
  const memSession = authSessions.get(token);
  if (memSession && new Date() < new Date(memSession.expires)) {
    const role = memSession.user.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return { userId: memSession.userId, role };
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
  return { userId: dbSession.userId, role };
}

export async function GET(request: NextRequest) {
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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        userId: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedUsers = users.map(u => ({
      ...u,
      displayName: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username,
      mustChangePassword: false,
      permissionsRoleId: null,
      lastLoginAt: u.lastLogin,
    }));

    return NextResponse.json({ users: formattedUsers });

  } catch (error) {
    console.error('Direct users error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}