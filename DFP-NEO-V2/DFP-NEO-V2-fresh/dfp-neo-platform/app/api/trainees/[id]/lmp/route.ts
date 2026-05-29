import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
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
  { params }: { params: { id: string } }
) {
  try {
    const traineeId = params.id;
    const body = await request.json();
    const { traineeFullName, lmpType, events, completedEventIds } = body;

    if (!traineeFullName || !lmpType || !events) {
      return NextResponse.json(
        { error: 'Missing required fields: traineeFullName, lmpType, events' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const lmp = await (prisma as any).individualLMP.upsert({
      where: { traineeId },
      update: {
        traineeFullName,
        lmpType,
        events,
        completedEventIds: completedEventIds || [],
        updatedAt: new Date(),
      },
      create: {
        traineeId,
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