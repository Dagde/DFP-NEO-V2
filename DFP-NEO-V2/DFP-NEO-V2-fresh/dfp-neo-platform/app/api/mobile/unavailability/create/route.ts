import { NextRequest, NextResponse } from 'next/server';

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

    // Get reason from static list (temporary solution until database is updated)
    const staticReasons = [
      { id: 'reason1', code: 'SICK', description: 'Sick Leave', requiresApproval: true },
      { id: 'reason2', code: 'LEAVE', description: 'Annual Leave', requiresApproval: true },
      { id: 'reason3', code: 'MEDICAL', description: 'Medical Appointment', requiresApproval: false },
      { id: 'reason4', code: 'PERSONAL', description: 'Personal Reasons', requiresApproval: true },
      { id: 'reason5', code: 'FAMILY', description: 'Family Emergency', requiresApproval: true },
      { id: 'reason6', code: 'TRAINING', description: 'External Training', requiresApproval: false },
    ];

    const reason = staticReasons.find(r => r.id === reasonId);

    if (!reason) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid reason ID' },
        { status: 400 }
      );
    }

    // Check for conflicts with existing schedule (simplified for now)
    // In a real implementation, you would check against the user's schedule
    let conflicts: string[] = [];
    let status = reason.requiresApproval ? 'Pending' : 'Approved';

    // For now, return a success response without storing in database
    // The actual database creation will be added after schema migration
    const unavailability = {
      id: `unavail-${Date.now()}`,
      status,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      reason: {
        id: reason.id,
        code: reason.code,
        description: reason.description,
        requiresApproval: reason.requiresApproval,
      },
      notes: notes || null,
      submittedAt: new Date().toISOString(),
    };

    let message = 'Unavailability automatically approved.';
    if (status === 'Pending') {
      message = 'Unavailability registered. Awaiting supervisor approval.';
    } else if (status === 'Conflicted') {
      message = 'Unavailability conflicts with scheduled events. Supervisor review required.';
    }

    return NextResponse.json({
      id: unavailability.id,
      status: unavailability.status,
      startDateTime: unavailability.startDateTime,
      endDateTime: unavailability.endDateTime,
      reason: {
        id: unavailability.reason.id,
        code: unavailability.reason.code,
        description: unavailability.reason.description,
        requiresApproval: unavailability.reason.requiresApproval,
      },
      notes: unavailability.notes,
      submittedAt: unavailability.submittedAt,
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