import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// DELETE /api/users/:id - Delete a user (personnel record and associated user account)
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

    // Get the personnel record to find associated user account
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
