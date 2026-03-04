import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import crypto from 'crypto';

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

    // Generate a secure random temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    console.log('🔐 [FORCE RESET] Generated temporary password for user:', user.userId);
    
    // Hash and set the temporary password
    const passwordHash = await hashPassword(tempPassword);
    
    await prisma.user.update({
      where: { id: id },
      data: {
        password: passwordHash,
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

    return NextResponse.json({ 
        success: true,
        temporaryPassword: tempPassword,
        message: 'Password reset successfully. Share the temporary password securely with the user.'
      });
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
