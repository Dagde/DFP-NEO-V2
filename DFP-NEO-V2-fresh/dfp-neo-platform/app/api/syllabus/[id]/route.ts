import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/syllabus/[id] - Get a single syllabus item by id or code
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let item = await prisma.syllabusItem.findUnique({ where: { id } });
    if (!item) item = await prisma.syllabusItem.findUnique({ where: { code: id } });

    if (!item) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: CORS_HEADERS });
    }
    return NextResponse.json({ syllabusItem: item }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('❌ Error fetching syllabus item:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabus item' }, { status: 500, headers: CORS_HEADERS });
  }
}

// PUT /api/syllabus/[id] - Update a syllabus item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const previous = await prisma.syllabusItem.findUnique({ where: { id } });
    if (!previous) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: CORS_HEADERS });
    }

    const { id: _id, createdAt, createdBy, ...updateData } = body;

    const updated = await prisma.syllabusItem.update({
      where: { id },
      data: { ...updateData, version: { increment: 1 }, updatedAt: new Date() },
    });

    await prisma.syllabusHistory.create({
      data: {
        syllabusItemId: id,
        changeType: 'UPDATE',
        changeData: updated as any,
        previousData: previous as any,
        changedBy: body.updatedBy || 'user',
        changeReason: body.changeReason || 'Syllabus item updated',
      },
    });

    console.log(`✅ [API] Updated syllabus item: ${updated.code}`);
    return NextResponse.json({ syllabusItem: updated }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('❌ Error updating syllabus item:', error);
    return NextResponse.json({ error: 'Failed to update syllabus item' }, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE /api/syllabus/[id] - Soft delete (retire) a syllabus item
// Sets isActive: false - preserves data integrity for existing scores
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));

    const previous = await prisma.syllabusItem.findUnique({ where: { id } });
    if (!previous) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: CORS_HEADERS });
    }

    const retired = await prisma.syllabusItem.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    await prisma.syllabusHistory.create({
      data: {
        syllabusItemId: id,
        changeType: 'DELETE',
        changeData: retired as any,
        previousData: previous as any,
        changedBy: body.deletedBy || 'user',
        changeReason: body.changeReason || 'Syllabus item retired',
      },
    });

    console.log(`⚠️ [API] Retired syllabus item: ${retired.code}`);
    return NextResponse.json(
      { success: true, message: `Syllabus item ${retired.code} retired`, syllabusItem: retired },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('❌ Error retiring syllabus item:', error);
    return NextResponse.json({ error: 'Failed to retire syllabus item' }, { status: 500, headers: CORS_HEADERS });
  }
}