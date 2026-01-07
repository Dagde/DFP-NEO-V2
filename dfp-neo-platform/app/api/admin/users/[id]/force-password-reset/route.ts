import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Reset password to force user to change it
    await prisma.user.update({
      where: { id: id },
      data: {
        password: 'TEMP_PASSWORD_NEEDS_CHANGE', // This will trigger password reset
      },
    });

    // Revoke all sessions
    await prisma.session.deleteMany({
      where: { userId: id },
    });

    await createAuditLog({
      action: 'password_reset_forced',
      userId: session.user.id,
      entityType: 'user',
      entityId: id,
      changes: {
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
