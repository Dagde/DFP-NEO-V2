import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { revokeAllUserSessions } from '@/lib/password';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireCapability('users:manage');

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: params.id },
      data: {
        mustChangePassword: true,
      },
    });

    await revokeAllUserSessions(params.id, session.user.id);

    await createAuditLog({
      actionType: 'password_reset_forced',
      actorUserId: session.user.id,
      targetUserId: params.id,
      metadata: {
        userId: user.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Force password reset error:', error);
    
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage users' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
