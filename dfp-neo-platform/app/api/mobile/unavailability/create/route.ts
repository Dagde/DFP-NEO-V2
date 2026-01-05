import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    const body = await request.json();
    const { startDateTime, endDateTime, reasonId, notes } = body;

    // Validate input
    if (!startDateTime || !endDateTime || !reasonId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Start datetime, end datetime, and reason ID are required' },
        { status: 400 }
      );
    }

    // Parse and validate datetimes
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid datetime format. Use ISO 8601 format' },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'End date must be after start date' },
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

    // Check for conflicts with existing schedule
    // Extract date from start datetime
    const dateStr = start.toISOString().split('T')[0];
    
    const schedule = await prisma.schedule.findFirst({
      where: {
        userId: user!.id,
        date: dateStr,
      },
    });

    let conflicts: string[] = [];
    if (schedule) {
      const scheduleData = schedule.data as any;
      if (scheduleData.events && Array.isArray(scheduleData.events)) {
        // Check if unavailability overlaps with any events
        conflicts = scheduleData.events
          .filter((event: any) => {
            if (event.status === 'Cancelled') return false;
            
            // Simple time overlap check
            const eventStart = event.startTime || event.start || '';
            const eventEnd = event.endTime || event.end || '';
            
            // This is a simplified check - in production you'd want more robust time comparison
            return true; // For now, assume potential conflict
          })
          .map((event: any) => {
            const eventType = event.type || event.eventType || 'Event';
            const startTime = event.startTime || event.start || '';
            const endTime = event.endTime || event.end || '';
            return `${eventType} at ${startTime}-${endTime}`;
          });
      }
    }

    // Determine status based on approval requirement and conflicts
    let status = reason.requiresApproval ? 'Pending' : 'Approved';
    if (conflicts.length > 0) {
      status = 'Conflicted';
    }

    // Create unavailability record
    const unavailability = await prisma.unavailability.create({
      data: {
        userId: user!.id,
        reasonId: reason.id,
        startDateTime: start,
        endDateTime: end,
        status,
        notes: notes || null,
        conflicts: conflicts.length > 0 ? conflicts : null,
        reviewedAt: status === 'Approved' ? new Date() : null,
      },
      include: {
        reason: true,
      },
    });

    let message = 'Unavailability automatically approved.';
    if (status === 'Pending') {
      message = 'Unavailability registered. Awaiting supervisor approval.';
    } else if (status === 'Conflicted') {
      message = 'Unavailability conflicts with scheduled events. Supervisor review required.';
    }

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
    console.error('Create unavailability error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while creating unavailability' },
      { status: 500 }
    );
  }
}