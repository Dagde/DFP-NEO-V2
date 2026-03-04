import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

const prisma = new PrismaClient();

export async function PATCH(
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

    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, role, status } = body;

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

    // Check if email already exists (if changed)
    if (email && email !== user.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim() },
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        firstName: firstName ? firstName.trim() : null,
        lastName: lastName ? lastName.trim() : null,
        email: email ? email.trim() : null,
        role,
        isActive: status === 'active',
      },
    });

    await createAuditLog({
      action: 'user_updated',
      userId: session.user.id,
      entityType: 'user',
      entityId: updatedUser.id,
      changes: { firstName, lastName, email, role, status },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Update user error:', error);
    
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

export async function DELETE(
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

    // Prevent deleting yourself
    if (user.id === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: id },
    });

    await createAuditLog({
      action: 'user_deleted',
      userId: session.user.id,
      entityType: 'user',
      entityId: user.id,
      changes: {
        deletedUserId: user.id,
        deletedUserUserId: user.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    
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
