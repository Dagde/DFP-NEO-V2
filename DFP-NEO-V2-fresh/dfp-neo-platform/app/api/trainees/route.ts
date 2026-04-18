import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/trainees - Get all active trainees
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const course = searchParams.get('course');
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const where: any = {};

    if (!includeArchived) {
      where.isActive = true;
    }

    if (course) {
      where.course = course;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }

    const trainees = await prisma.trainee.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        scores: true,
        individualLMP: true,
      },
    });

    // Transform to match the Trainee interface expected by the frontend
    const transformedTrainees = trainees.map((t: any) => ({
      id: t.id,
      idNumber: t.idNumber,
      name: t.name,
      fullName: t.fullName,
      rank: t.rank || '',
      course: t.course || '',
      lmpType: t.lmpType || 'BPC+IPC',
      seatConfig: t.seatConfig || 'Dual',
      isPaused: t.isPaused || false,
      unit: t.unit || '',
      flight: t.flight || '',
      location: t.location || '',
      service: t.service || 'RAAF',
      unavailability: Array.isArray(t.unavailability) ? t.unavailability : [],
      lastEventDate: t.lastEventDate ? t.lastEventDate.toISOString().split('T')[0] : undefined,
      lastFlightDate: t.lastFlightDate ? t.lastFlightDate.toISOString().split('T')[0] : undefined,
      currencyStatus: Array.isArray(t.currencyStatus) ? t.currencyStatus : [],
      phoneNumber: t.phoneNumber || '',
      email: t.email || '',
      primaryInstructor: t.primaryInstructor || '',
      secondaryInstructor: t.secondaryInstructor || '',
      traineeCallsign: t.traineeCallsign || '',
      permissions: Array.isArray(t.permissions) ? t.permissions : [],
      priorExperience: t.priorExperience || null,
      isActive: t.isActive,
    }));

    return NextResponse.json({ trainees: transformedTrainees }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error fetching trainees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trainees' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/trainees - Create a new trainee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const trainee = await prisma.trainee.create({
      data: {
        idNumber: body.idNumber,
        name: body.name,
        fullName: body.fullName || body.name,
        rank: body.rank || '',
        course: body.course || '',
        lmpType: body.lmpType || 'BPC+IPC',
        seatConfig: body.seatConfig || 'Dual',
        isPaused: body.isPaused || false,
        unit: body.unit || '',
        flight: body.flight || '',
        location: body.location || '',
        service: body.service || 'RAAF',
        unavailability: body.unavailability || [],
        phoneNumber: body.phoneNumber || '',
        email: body.email || '',
        primaryInstructor: body.primaryInstructor || '',
        secondaryInstructor: body.secondaryInstructor || '',
        traineeCallsign: body.traineeCallsign || '',
        permissions: body.permissions || [],
        isActive: true,
      },
    });

    return NextResponse.json({ trainee }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error creating trainee:', error);
    return NextResponse.json(
      { error: 'Failed to create trainee' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}