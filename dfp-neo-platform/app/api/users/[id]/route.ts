import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// DELETE /api/users/:id - Delete a user
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

    // TODO: Verify user's password (would need to implement password verification)
    // For now, just delete the user
    await prisma.user.delete({
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

// PUT /api/users/:id - Update a user
export async function PUT(
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
    const body = await request.json();

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email: body.email,
        role: body.role,
        firstName: body.firstName,
        lastName: body.lastName,
      },
      include: {
        personnel: true,
      },
    });

    // Transform to match expected format
    const transformedUser = {
      id: updatedUser.id,
      name: updatedUser.personnel?.name || `${updatedUser.lastName || ''}, ${updatedUser.firstName || ''}`.trim(),
      email: updatedUser.email || 'No email',
      pmkeysId: updatedUser.userId || 'N/A',
      role: updatedUser.role,
      createdAt: updatedUser.createdAt.toISOString().split('T')[0],
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
    };

    return NextResponse.json(transformedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
