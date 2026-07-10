import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RouteContext = { params: Promise<{ id: string }> };

const summariseReportLmpItems = (events: any) => {
  const items = Array.isArray(events) ? events : [];
  const reportItems = items.filter(item =>
    item?.trainingReportSourceAssessmentId ||
    item?.trainingReportSourceEventId ||
    item?.trainingReportNextEventExtensions ||
    item?.trainingReportLastExtendedByAssessmentId ||
    item?.isRemedial === true ||
    item?.lmpSource === 'remedial'
  );
  return {
    eventCount: items.length,
    reportItemCount: reportItems.length,
    reportItems: reportItems.slice(0, 12).map(item => ({
      id: item?.id,
      code: item?.code,
      type: item?.type,
      lmpSource: item?.lmpSource,
      isRemedial: item?.isRemedial,
      masterEventId: item?.masterEventId,
      anchorAfterMasterEventId: item?.anchorAfterMasterEventId,
      anchorBeforeMasterEventId: item?.anchorBeforeMasterEventId,
      flightOrSimHours: item?.flightOrSimHours,
      duration: item?.duration,
      totalEventHours: item?.totalEventHours,
      trainingReportSourceAssessmentId: item?.trainingReportSourceAssessmentId,
      trainingReportSourceEventId: item?.trainingReportSourceEventId,
      trainingReportNextEventExtensions: item?.trainingReportNextEventExtensions,
      trainingReportLastExtendedByAssessmentId: item?.trainingReportLastExtendedByAssessmentId,
    })),
  };
};

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
      console.log('[LMP GET DIAG]', {
        id,
        status: 'not-found',
      });
      return NextResponse.json({ lmp: null }, { headers: getCorsHeaders(request) });
    }

    console.log('[LMP GET DIAG]', {
      id,
      traineeFullName: lmp.traineeFullName,
      lmpType: lmp.lmpType,
      completedEventIds: Array.isArray(lmp.completedEventIds) ? lmp.completedEventIds.length : null,
      ...summariseReportLmpItems(lmp.events),
    });

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
    console.log('[LMP PUT DIAG] request', {
      requestedId: traineeId,
      resolvedTraineeId,
      traineeFullName,
      lmpType,
      completedEventIds: Array.isArray(completedEventIds) ? completedEventIds.length : null,
      ...summariseReportLmpItems(events),
    });
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

    console.log('[LMP PUT DIAG] saved', {
      requestedId: traineeId,
      resolvedTraineeId,
      traineeFullName: lmp.traineeFullName,
      lmpType: lmp.lmpType,
      completedEventIds: Array.isArray(lmp.completedEventIds) ? lmp.completedEventIds.length : null,
      ...summariseReportLmpItems(lmp.events),
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
