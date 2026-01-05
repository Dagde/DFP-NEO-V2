import { NextRequest, NextResponse } from 'next/server';

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

    // Create start and end datetime for the full day
    const startDateTime = new Date(`${date}T08:00:00.000Z`);
    const endDateTime = new Date(`${date}T23:00:00.000Z`);

    // Check for conflicts with existing schedule (simplified for now)
    // In a real implementation, you would check against the user's schedule
    let conflicts: string[] = [];
    
    // For now, we'll assume no conflicts
    const status = reason.requiresApproval ? 'Pending' : 'Approved';

    // For now, return a success response without storing in database
    // The actual database creation will be added after schema migration
    const unavailability = {
      id: `unavail-${Date.now()}`,
      status,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      reason: {
        id: reason.id,
        code: reason.code,
        description: reason.description,
        requiresApproval: reason.requiresApproval,
      },
      notes: notes || null,
      submittedAt: new Date().toISOString(),
    };

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