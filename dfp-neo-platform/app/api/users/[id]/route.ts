import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

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

    const { id } = await params;

    // Check if password is provided in body
    const body = await request.json();
    if (!body.password) {
      return NextResponse.json(
        { error: 'Password is required to delete a user' },
        { status: 400 }
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
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

// PUT endpoint is no longer needed - edits go to Staff/Trainee profile pages
