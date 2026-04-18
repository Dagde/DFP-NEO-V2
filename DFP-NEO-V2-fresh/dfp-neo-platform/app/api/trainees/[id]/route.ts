import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/trainees/[id] - Get a single trainee by DB id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trainee = await prisma.trainee.findUnique({
      where: { id: params.id },
      include: {
        scores: true,
        individualLMP: true,
      },
    });

    if (!trainee) {
      return NextResponse.json(
        { error: 'Trainee not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const transformed = {
      id: trainee.id,
      idNumber: trainee.idNumber,
      name: trainee.name,
      fullName: trainee.fullName,
      rank: trainee.rank || '',
      course: trainee.course || '',
      lmpType: trainee.lmpType || 'BPC+IPC',
      seatConfig: trainee.seatConfig || 'Dual',
      isPaused: trainee.isPaused || false,
      unit: trainee.unit || '',
      flight: trainee.flight || '',
      location: trainee.location || '',
      service: trainee.service || 'RAAF',
      unavailability: Array.isArray(trainee.unavailability) ? trainee.unavailability : [],
      lastEventDate: trainee.lastEventDate ? trainee.lastEventDate.toISOString().split('T')[0] : undefined,
      lastFlightDate: trainee.lastFlightDate ? trainee.lastFlightDate.toISOString().split('T')[0] : undefined,
      currencyStatus: Array.isArray(trainee.currencyStatus) ? trainee.currencyStatus : [],
      phoneNumber: trainee.phoneNumber || '',
      email: trainee.email || '',
      primaryInstructor: trainee.primaryInstructor || '',
      secondaryInstructor: trainee.secondaryInstructor || '',
      traineeCallsign: trainee.traineeCallsign || '',
      permissions: Array.isArray(trainee.permissions) ? trainee.permissions : [],
      isActive: trainee.isActive,
    };

    return NextResponse.json({ trainee: transformed }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error fetching trainee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trainee' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/trainees/[id] - Update a trainee
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Build update data - only include fields that are provided
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.rank !== undefined) updateData.rank = body.rank;
    if (body.course !== undefined) updateData.course = body.course;
    if (body.lmpType !== undefined) updateData.lmpType = body.lmpType;
    if (body.unit !== undefined) updateData.unit = body.unit;
    if (body.flight !== undefined) updateData.flight = body.flight;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.service !== undefined) updateData.service = body.service;
    if (body.seatConfig !== undefined) updateData.seatConfig = body.seatConfig;
    if (body.isPaused !== undefined) updateData.isPaused = body.isPaused;
    if (body.traineeCallsign !== undefined) updateData.traineeCallsign = body.traineeCallsign;
    if (body.primaryInstructor !== undefined) updateData.primaryInstructor = body.primaryInstructor;
    if (body.secondaryInstructor !== undefined) updateData.secondaryInstructor = body.secondaryInstructor;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.unavailability !== undefined) updateData.unavailability = body.unavailability;
    if (body.currencyStatus !== undefined) updateData.currencyStatus = body.currencyStatus;
    if (body.lastEventDate !== undefined) {
      updateData.lastEventDate = body.lastEventDate ? new Date(body.lastEventDate) : null;
    }
    if (body.lastFlightDate !== undefined) {
      updateData.lastFlightDate = body.lastFlightDate ? new Date(body.lastFlightDate) : null;
    }
    if (body.permissions !== undefined) updateData.permissions = body.permissions;
    if (body.priorExperience !== undefined) updateData.priorExperience = body.priorExperience;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const trainee = await prisma.trainee.update({
      where: { id: params.id },
      data: updateData,
    });

    console.log(`✅ Updated trainee: ${trainee.name} (id: ${trainee.id})`);

    return NextResponse.json({ trainee }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('Error updating trainee:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Trainee not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update trainee' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/trainees/[id] - Archive (soft delete) a trainee
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const trainee = await prisma.trainee.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    console.log(`🗑️ Archived trainee: ${trainee.name} (id: ${trainee.id})`);

    return NextResponse.json({ success: true, trainee }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('Error archiving trainee:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Trainee not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { error: 'Failed to archive trainee' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}