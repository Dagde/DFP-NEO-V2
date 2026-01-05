import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, UserStatus } from '@prisma/client';
import { createPasswordResetToken } from '@/lib/password';
import { createAuditLog } from '@/lib/audit';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier } = body;

    if (!identifier) {
      return NextResponse.json(
        { error: 'User ID or email is required' },
        { status: 400 }
      );
    }

    // Always return success for security (don't reveal if user exists)
    // But actually send email if user exists and has email

    const normalizedIdentifier = identifier.trim().toUpperCase();

    // Try to find user by userId or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { userId: { equals: normalizedIdentifier } },
          { email: { equals: identifier.trim() } },
        ],
        status: UserStatus.active,
      },
    });

    if (user && user.email) {
      // Create reset token
      const token = await createPasswordResetToken(user.id, 30); // 30 minutes

      // TODO: Send email with reset link
      // For now, just log it (in production, integrate with email service)
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
      console.log(`Password reset link for ${user.userId}: ${resetUrl}`);

      // Log the request
      await createAuditLog({
        actionType: 'password_reset_requested',
        targetUserId: user.id,
        metadata: {
          hasEmail: true,
        },
      });
    } else if (user && !user.email) {
      // User exists but has no email - log for admin assistance
      await createAuditLog({
        actionType: 'password_reset_requested',
        targetUserId: user.id,
        metadata: {
          hasEmail: false,
          requiresAdminAssistance: true,
        },
      });
    }

    // Always return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    // Still return success for security
    return NextResponse.json({ success: true });
  }
}
