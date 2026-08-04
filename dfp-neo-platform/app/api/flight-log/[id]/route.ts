import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();

// GET /api/flight-log/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await prisma.flightLogEntry.findUnique({ where: { id } });

    if (!entry) {
      return NextResponse.json({ error: 'Flight log entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('[FlightLog GET/:id] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch flight log entry' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/flight-log/:id — partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('training:manage');

    const { id } = await params;
    const body = await request.json();

    const entry = await prisma.flightLogEntry.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error('[FlightLog PATCH/:id] Error:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to update flight log entries' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update flight log entry', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/flight-log/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('training:manage');

    const { id } = await params;
    await prisma.flightLogEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[FlightLog DELETE/:id] Error:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete flight log entries' },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: 'Failed to delete flight log entry' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
