import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    const body = await request.json();
    const { date, reasonId, notes } = body;

    // Validate input
    if (!date || !reasonId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Date and reason ID are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get reason
    const reason = await prisma.unavailabilityReason.findUnique({
      where: { id: reasonId },
    });

    if (!reason || !reason.isActive) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid reason ID' },
        { status: 400 }
      );
    }

    // Create start and end datetime for the full day
    const startDateTime = new Date(`${date}T08:00:00.000Z`);
    const endDateTime = new Date(`${date}T23:00:00.000Z`);

    // Check for conflicts with existing schedule
    const schedule = await prisma.schedule.findFirst({
      where: {
        userId: user!.id,
        date: date,
      },
    });

    let conflicts: string[] = [];
    if (schedule) {
      const scheduleData = schedule.data as any;
      if (scheduleData.events && Array.isArray(scheduleData.events)) {
        conflicts = scheduleData.events
          .filter((event: any) => event.status !== 'Cancelled')
          .map((event: any) => {
            const eventType = event.type || event.eventType || 'Event';
            const startTime = event.startTime || event.start || '';
            const endTime = event.endTime || event.end || '';
            return `${eventType} at ${startTime}-${endTime}`;
          });
      }
    }

    // If there are conflicts, return conflict error
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Unavailability conflicts with scheduled events',
          conflicts,
        },
        { status: 409 }
      );
    }

    // Determine status based on approval requirement
    const status = reason.requiresApproval ? 'Pending' : 'Approved';

    // Create unavailability record
    const unavailability = await prisma.unavailability.create({
      data: {
        userId: user!.id,
        reasonId: reason.id,
        startDateTime,
        endDateTime,
        status,
        notes: notes || null,
        reviewedAt: status === 'Approved' ? new Date() : null,
      },
      include: {
        reason: true,
      },
    });

    const message = status === 'Approved'
      ? 'Unavailability automatically approved.'
      : 'Unavailability registered. Awaiting supervisor approval.';

    return NextResponse.json({
      id: unavailability.id,
      status: unavailability.status,
      startDateTime: unavailability.startDateTime.toISOString(),
      endDateTime: unavailability.endDateTime.toISOString(),
      reason: {
        id: unavailability.reason.id,
        code: unavailability.reason.code,
        description: unavailability.reason.description,
        requiresApproval: unavailability.reason.requiresApproval,
      },
      notes: unavailability.notes,
      submittedAt: unavailability.submittedAt.toISOString(),
      message,
    });
  } catch (error) {
    console.error('Submit quick unavailability error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while submitting unavailability' },
      { status: 500 }
    );
  }
}