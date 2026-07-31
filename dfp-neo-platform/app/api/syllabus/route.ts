import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;


// Handle OPTIONS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
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

    const syllabusItems = await db.syllabusItem.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    console.log(`📚 [API] /api/syllabus - Returning ${syllabusItems.length} items`);
    // Return as both 'syllabus' and 'syllabusItems' for compatibility
    return NextResponse.json({ syllabus: syllabusItems, syllabusItems }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('❌ Error fetching syllabus:', error);
    return NextResponse.json(
      { error: 'Failed to fetch syllabus configuration', retryAfter: 60 },
      { status: 503, headers: getCorsHeaders(request) }
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
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const existing = await db.syllabusItem.findUnique({ where: { code: body.code } });
    if (existing) {
      return NextResponse.json(
        { error: `Syllabus item with code "${body.code}" already exists` },
        { status: 409, headers: getCorsHeaders(request) }
      );
    }

    const phase = body.phase || body.module || '';
    const courses = Array.isArray(body.courses)
      ? body.courses
      : (body.lmpType ? [body.lmpType] : []);
    const resourcesHuman = Array.isArray(body.resourcesHuman) ? body.resourcesHuman : [];

    const maxOrder = await db.syllabusItem.aggregate({ _max: { sortOrder: true } });
    const nextSortOrder = (maxOrder._max.sortOrder ?? 0) + 1;

    const newItem = await db.syllabusItem.create({
      data: {
        code: body.code,
        eventDescription: body.eventDescription,
        phase,
        module: body.module || phase,
        type: body.type,
        sortieType: body.sortieType ?? null,
        dayNight: body.dayNight || 'Day',
        courses,
        methodOfDelivery: body.methodOfDelivery || [],
        methodOfAssessment: body.methodOfAssessment || ['Practical Assessment', 'Debrief'],
        resourcesPhysical: body.resourcesPhysical || [],
        resourcesHuman,
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

    await db.syllabusHistory.create({
      data: {
        syllabusItemId: newItem.id,
        changeType: 'CREATE',
        changeData: newItem as any,
        changedBy: body.createdBy || 'user',
        changeReason: body.changeReason || 'New syllabus item created',
      },
    });

    console.log(`✅ [API] Created syllabus item: ${newItem.code}`);
    return NextResponse.json({ syllabusItem: newItem }, { status: 201, headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('❌ Error creating syllabus item:', error);
    return NextResponse.json({ error: 'Failed to create syllabus item' }, { status: 500, headers: getCorsHeaders(request) });
  }
}
