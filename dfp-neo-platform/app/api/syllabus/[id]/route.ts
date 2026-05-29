import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/syllabus/[id] - Get a single syllabus item by id or code
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    let item = await db.syllabusItem.findUnique({ where: { id } });
    if (!item) item = await db.syllabusItem.findUnique({ where: { code: id } });

    if (!item) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: getCorsHeaders(request) });
    }
    return NextResponse.json({ syllabusItem: item }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('❌ Error fetching syllabus item:', error);
    return NextResponse.json({ error: 'Failed to fetch syllabus item' }, { status: 500, headers: getCorsHeaders(request) });
  }
}

// PUT /api/syllabus/[id] - Update a syllabus item
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const previous = await db.syllabusItem.findUnique({ where: { id } });
    if (!previous) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: getCorsHeaders(request) });
    }

    const { id: _id, createdAt, createdBy, ...updateData } = body;

    const updated = await db.syllabusItem.update({
      where: { id },
      data: { ...updateData, version: { increment: 1 }, updatedAt: new Date() },
    });

    await db.syllabusHistory.create({
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
    return NextResponse.json({ syllabusItem: updated }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('❌ Error updating syllabus item:', error);
    return NextResponse.json({ error: 'Failed to update syllabus item' }, { status: 500, headers: getCorsHeaders(request) });
  }
}

// DELETE /api/syllabus/[id] - Soft delete (retire) a syllabus item
// Sets isActive: false - preserves data integrity for existing scores
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const previous = await db.syllabusItem.findUnique({ where: { id } });
    if (!previous) {
      return NextResponse.json({ error: `Syllabus item not found: ${id}` }, { status: 404, headers: getCorsHeaders(request) });
    }

    const retired = await db.syllabusItem.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    });

    await db.syllabusHistory.create({
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
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('❌ Error retiring syllabus item:', error);
    return NextResponse.json({ error: 'Failed to retire syllabus item' }, { status: 500, headers: getCorsHeaders(request) });
  }
}
