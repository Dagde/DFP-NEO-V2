import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/aircraft-availability-current
 * Returns the most recent aircraft availability event (any date).
 * Used on app startup to restore persisted availability across hard refreshes.
 */
export async function GET(_request: NextRequest) {
  try {
    const latest = await prisma.aircraftAvailabilityEvent.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) {
      return NextResponse.json(
        { success: true, availableCount: 15, isDefault: true, message: 'No events found, using default' },
        { headers: CORS_HEADERS }
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
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[AV-CURRENT] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current availability', details: String(error) },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}