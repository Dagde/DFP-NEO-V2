import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

// Handle OPTIONS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/syllabus - Fetch all active syllabus items (used at app startup)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const course = searchParams.get('course');
    const phase = searchParams.get('phase');
    const type = searchParams.get('type');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (phase) where.phase = phase;
    if (type) where.type = type;
    if (course) where.courses = { has: course };

    console.log('📚 [API] /api/syllabus - Querying database');

    const syllabusItems = await prisma.syllabusItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    console.log(`📚 [API] /api/syllabus - Returning ${syllabusItems.length} items`);
    return NextResponse.json({ syllabusItems }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('❌ Error fetching syllabus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch syllabus configuration', retryAfter: 60 },
      { status: 503, headers: CORS_HEADERS }
    );
  }
}

// POST /api/syllabus - Create a new syllabus item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.code || !body.eventDescription || !body.type) {
      return NextResponse.json(
        { error: 'Missing required fields: code, eventDescription, type' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const existing = await prisma.syllabusItem.findUnique({ where: { code: body.code } });
    if (existing) {
      return NextResponse.json(
        { error: `Syllabus item with code "${body.code}" already exists` },
        { status: 409, headers: CORS_HEADERS }
      );
    }

    let phase = body.phase || 'BGF';
    if (!body.phase) {
      if (body.code.startsWith('BIF')) phase = 'BIF';
      else if (body.code.startsWith('BNF')) phase = 'BNF';
      else if (body.code.startsWith('BNAV')) phase = 'BNAV';
      else if (body.code.startsWith('FIC')) phase = 'FIC';
      else if (body.code.startsWith('AIT')) phase = 'FIC';
      else if (body.code.startsWith('WSO')) phase = 'WSO';
      else if (body.code.startsWith('OFI')) phase = 'OFI';
    }

    const maxOrder = await prisma.syllabusItem.aggregate({ _max: { sortOrder: true } });
    const nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const newItem = await prisma.syllabusItem.create({
      data: {
        code: body.code,
        eventDescription: body.eventDescription,
        phase,
        module: body.module || phase,
        type: body.type,
        sortieType: body.sortieType ?? null,
        dayNight: body.dayNight || 'Day',
        courses: body.courses || ['BPC+IPC'],
        methodOfDelivery: body.methodOfDelivery || [],
        methodOfAssessment: body.methodOfAssessment || ['Practical Assessment', 'Debrief'],
        resourcesPhysical: body.resourcesPhysical || [],
        resourcesHuman: body.resourcesHuman || ['Qualified Flying Instructor', 'Trainee'],
        eventDetailsCommon: body.eventDetailsCommon || [],
        eventDetailsSortie: body.eventDetailsSortie || [],
        flightOrSimHours: body.flightOrSimHours || 0,
        totalEventHours: body.totalEventHours || 0,
        duration: body.duration || 0,
        preFlightTime: body.preFlightTime || 0,
        postFlightTime: body.postFlightTime || 0,
        prerequisites: body.prerequisites || [],
        prerequisitesGround: body.prerequisitesGround || [],
        prerequisitesFlying: body.prerequisitesFlying || [],
        location: body.location || '',
        sortOrder: body.sortOrder ?? nextSortOrder,
        lmpType: body.lmpType ?? null,
        twrDiReqd: body.twrDiReqd ?? null,
        cctOnly: body.cctOnly ?? null,
        isRemedial: body.isRemedial || false,
        isActive: true,
        version: 1,
        createdBy: body.createdBy || 'user',
        notes: body.notes || null,
      },
    });

    await prisma.syllabusHistory.create({
      data: {
        syllabusItemId: newItem.id,
        changeType: 'CREATE',
        changeData: newItem as any,
        changedBy: body.createdBy || 'user',
        changeReason: body.changeReason || 'New syllabus item created',
      },
    });

    console.log(`✅ [API] Created syllabus item: ${newItem.code}`);
    return NextResponse.json({ syllabusItem: newItem }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    console.error('❌ Error creating syllabus item:', error);
    return NextResponse.json({ error: 'Failed to create syllabus item' }, { status: 500, headers: CORS_HEADERS });
  }
}