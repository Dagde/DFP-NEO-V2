import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    // Get all active unavailability reasons
    const reasons = await prisma.unavailabilityReason.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        code: 'asc',
      },
    });

    return NextResponse.json({
      reasons: reasons.map((reason) => ({
        id: reason.id,
        code: reason.code,
        description: reason.description,
        requiresApproval: reason.requiresApproval,
      })),
    });
  } catch (error) {
    console.error('Get unavailability reasons error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while fetching reasons' },
      { status: 500 }
    );
  }
}