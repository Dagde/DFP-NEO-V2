import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// DELETE /api/users/:id - Delete a user (personnel/trainee record and associated user account)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    await requireCapability('users:manage');

    const { id } = await params;

    // Check if password is provided in body
    const body = await request.json();
    if (!body.password) {
      return NextResponse.json(
        { error: 'Password is required to delete a user' },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, isActive: true },
    });
    const passwordValid = Boolean(
      currentUser?.isActive &&
      currentUser.password &&
      await bcrypt.compare(String(body.password), currentUser.password)
    );
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Password was not accepted' },
        { status: 403 }
      );
    }

    // Try to find as personnel first
    try {
      const personnel = await prisma.personnel.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (personnel?.userId) {
        // Delete the user account
        await prisma.user.delete({
          where: { id: personnel.userId },
        });
      }

      // Delete the personnel record
      await prisma.personnel.delete({
        where: { id },
      });
    } catch (personnelError) {
      // If not personnel, try as trainee
      try {
        const trainee = await prisma.trainee.findUnique({
          where: { id },
          select: { userId: true },
        });

        if (trainee?.userId) {
          // Delete the user account
          await prisma.user.delete({
            where: { id: trainee.userId },
          });
        }

        // Delete the trainee record
        await prisma.trainee.delete({
          where: { id },
        });
      } catch (traineeError) {
        throw new Error('Record not found');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete users' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

// PUT endpoint is no longer needed - edits go to Staff/Trainee profile pages
