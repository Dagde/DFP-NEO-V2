import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();

// GET /api/trainees/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('personnel:manage');

    const { id } = await params;

    const trainee = await prisma.trainee.findUnique({ where: { id } });
    if (!trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    return NextResponse.json({ trainee });
  } catch (error) {
    console.error('[Trainee GET/:id] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch trainee' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/trainees/:id — update trainee fields
// Accepts any subset of the Trainee model fields including priorExperience and currencyStatus
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    console.log(`[Trainee PATCH/:id] Updating trainee ${id}`, Object.keys(body));

    // Build update payload — only include fields that were provided
    const updateData: any = {};

    const scalarFields = [
      'name', 'fullName', 'rank', 'course', 'lmpType', 'academicLmpType',
      'unit', 'flight', 'location', 'service', 'seatConfig', 'isPaused',
      'traineeCallsign', 'primaryInstructor', 'secondaryInstructor',
      'phoneNumber', 'email', 'isActive', 'lastEventDate', 'lastFlightDate',
    ];

    for (const field of scalarFields) {
      if (field in body) updateData[field] = body[field];
    }

    // JSON fields
    if ('priorExperience'  in body) updateData.priorExperience  = body.priorExperience;
    if ('currencyStatus'   in body) updateData.currencyStatus   = body.currencyStatus;
    if ('unavailability'   in body) updateData.unavailability   = body.unavailability;
    if ('permissions'      in body) updateData.permissions      = body.permissions;

    const trainee = await prisma.trainee.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Trainee PATCH/:id] ✅ Updated trainee: ${trainee.name}`);
    return NextResponse.json({ success: true, trainee });
  } catch (error: any) {
    console.error('[Trainee PATCH/:id] Error:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to update trainees' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update trainee', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/trainees/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('users:manage');

    const { id } = await params;

    const trainee = await prisma.trainee.findUnique({ where: { id } });
    if (!trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    await prisma.trainee.delete({ where: { id } });

    console.log(`[Trainee DELETE/:id] ✅ Deleted trainee: ${trainee.name}`);
    return NextResponse.json({ success: true, message: 'Trainee deleted successfully' });
  } catch (error: any) {
    console.error('[Trainee DELETE/:id] Error:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete trainees' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'Failed to delete trainee' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
