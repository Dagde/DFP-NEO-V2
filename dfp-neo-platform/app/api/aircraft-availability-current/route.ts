import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { prisma } from '../../../lib/db/prisma';


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

/**
 * GET /api/aircraft-availability-current
 * Returns the most recent aircraft availability event (any date).
 * Used on app startup to restore persisted availability across hard refreshes.
 */
export async function GET(request: NextRequest) {
  try {
    const latest = await prisma.aircraftAvailabilityEvent.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) {
      return NextResponse.json(
        { success: true, availableCount: 15, isDefault: true, message: 'No events found, using default' },
        { headers: getCorsHeaders(request) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        availableCount: latest.availableCount,
        totalAircraft: latest.totalAircraft,
        date: latest.date,
        timestamp: latest.timestamp,
        changeType: latest.changeType,
        isDefault: false,
      },
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('[AV-CURRENT] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current availability', details: String(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}
