import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/trainees/[id]/lmp
// Returns the stored IndividualLMP for a trainee (by DB id or fullName)
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    // Try by traineeId first, then by traineeFullName (URL-decoded)
    let lmp = await (prisma as any).individualLMP.findFirst({
      where: {
        OR: [
          { traineeId: id },
          { traineeFullName: decodeURIComponent(id) },
        ],
      },
    });

    if (!lmp) {
      return NextResponse.json({ lmp: null }, { headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ lmp }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[LMP GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LMP' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

// PUT /api/trainees/[id]/lmp
// Upsert the IndividualLMP for a trainee
// Body: { traineeFullName, lmpType, events, completedEventIds }
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id: traineeId } = await params;
    const body = await request.json();
    const { traineeFullName, lmpType, events, completedEventIds } = body;

    if (!traineeFullName || !lmpType || !events) {
      return NextResponse.json(
        { error: 'Missing required fields: traineeFullName, lmpType, events' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const decodedId = decodeURIComponent(traineeId);
    const trainee = await (prisma as any).trainee.findFirst({
      where: {
        OR: [
          { id: traineeId },
          { fullName: traineeFullName },
          { fullName: decodedId },
        ],
      },
    });

    if (!trainee) {
      return NextResponse.json(
        { error: `Trainee not found for LMP save: ${traineeFullName}` },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const resolvedTraineeId = trainee.id;
    const lmp = await (prisma as any).individualLMP.upsert({
      where: { traineeId: resolvedTraineeId },
      update: {
        traineeFullName,
        lmpType,
        events,
        completedEventIds: completedEventIds || [],
        updatedAt: new Date(),
      },
      create: {
        traineeId: resolvedTraineeId,
        traineeFullName,
        lmpType,
        events,
        completedEventIds: completedEventIds || [],
      },
    });

    return NextResponse.json({ success: true, lmp }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[LMP PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save LMP' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
