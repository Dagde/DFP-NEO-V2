import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/trainees/[id]/lmp
// Returns the stored IndividualLMP for a trainee (by DB id or fullName)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

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
      return NextResponse.json({ lmp: null }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ lmp }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[LMP GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LMP' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// PUT /api/trainees/[id]/lmp
// Upsert the IndividualLMP for a trainee
// Body: { traineeFullName, lmpType, events, completedEventIds }
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const traineeId = params.id;
    const body = await request.json();
    const { traineeFullName, lmpType, events, completedEventIds } = body;

    if (!traineeFullName || !lmpType || !events) {
      return NextResponse.json(
        { error: 'Missing required fields: traineeFullName, lmpType, events' },
        { status: 400, headers: CORS_HEADERS }
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
        { status: 404, headers: CORS_HEADERS }
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

    return NextResponse.json({ success: true, lmp }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[LMP PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save LMP' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
