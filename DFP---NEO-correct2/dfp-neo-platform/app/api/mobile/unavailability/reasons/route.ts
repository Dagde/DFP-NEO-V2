import { NextRequest, NextResponse } from 'next/server';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    // Return static unavailability reasons (temporary solution until database is updated)
    const reasons = [
      {
        id: 'reason1',
        code: 'SICK',
        description: 'Sick Leave',
        requiresApproval: true,
      },
      {
        id: 'reason2',
        code: 'LEAVE',
        description: 'Annual Leave',
        requiresApproval: true,
      },
      {
        id: 'reason3',
        code: 'MEDICAL',
        description: 'Medical Appointment',
        requiresApproval: false,
      },
      {
        id: 'reason4',
        code: 'PERSONAL',
        description: 'Personal Reasons',
        requiresApproval: true,
      },
      {
        id: 'reason5',
        code: 'FAMILY',
        description: 'Family Emergency',
        requiresApproval: true,
      },
      {
        id: 'reason6',
        code: 'TRAINING',
        description: 'External Training',
        requiresApproval: false,
      },
    ];

    return NextResponse.json({ reasons });
  } catch (error) {
    console.error('Get unavailability reasons error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while fetching reasons' },
      { status: 500 }
    );
  }
}