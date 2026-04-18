import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// PATCH /api/trainees/bulk-unit - Update unit for all trainees in a course
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseNumber, newUnit } = body;

    if (!courseNumber || !newUnit) {
      return NextResponse.json(
        { error: 'courseNumber and newUnit are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await prisma.trainee.updateMany({
      where: { course: courseNumber },
      data: { unit: newUnit },
    });

    console.log(`✅ bulk-unit: Updated ${result.count} trainees in course "${courseNumber}" to unit "${newUnit}"`);

    return NextResponse.json(
      { success: true, count: result.count },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Error in bulk-unit update:', error);
    return NextResponse.json(
      { error: 'Failed to update unit' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}