import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/personnel/:id - Get specific personnel
export async function GET(
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

    const personnel = await prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ personnel });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/personnel/:id - Delete personnel record
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

    console.log(`🗑️ [DELETE] Attempting to delete personnel with ID: ${id}`);

    // First, get the personnel record to see what we're deleting
    const personnel = await prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      console.log(`⚠️ [DELETE] Personnel not found with ID: ${id}`);
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    console.log(`📋 [DELETE] Found personnel: ${personnel.name}, Rank: ${personnel.rank}, ID: ${id}`);

    // Delete the personnel record
    const deletedPersonnel = await prisma.personnel.delete({
      where: { id },
    });

    console.log(`✅ [DELETE] Successfully deleted personnel: ${deletedPersonnel.name}`);

    return NextResponse.json({ 
      success: true,
      message: 'Personnel deleted successfully',
      deleted: {
        id: deletedPersonnel.id,
        name: deletedPersonnel.name,
        rank: deletedPersonnel.rank,
        idNumber: deletedPersonnel.idNumber
      }
    });
  } catch (error) {
    console.error('❌ [DELETE] Error deleting personnel:', error);
    return NextResponse.json(
      { error: 'Failed to delete personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/personnel/:id - Update personnel record
export async function PATCH(
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

    console.log(`✏️ [PATCH] Updating personnel with ID: ${id}`, body);

    const updatedPersonnel = await prisma.personnel.update({
      where: { id },
      data: body,
    });

    console.log(`✅ [PATCH] Successfully updated personnel: ${updatedPersonnel.name}`);

    return NextResponse.json({ 
      success: true,
      message: 'Personnel updated successfully',
      personnel: updatedPersonnel
    });
  } catch (error) {
    console.error('❌ [PATCH] Error updating personnel:', error);
    return NextResponse.json(
      { error: 'Failed to update personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}