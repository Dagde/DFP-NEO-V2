import { NextRequest, NextResponse } from 'next/server';

let prisma: any = null;

async function getPrisma() {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    await prisma.$connect();
  }
  return prisma;
}

// GET /api/courses - Fetch all courses
export async function GET(request: NextRequest) {
  try {
    const db = await getPrisma();
    const { searchParams } = new URL(request.url);
    const school = searchParams.get('school') || 'ESL';

    const courses = await db.course.findMany({
      where: { location: school },
      orderBy: { name: 'asc' }
    });

    // If no courses in DB, return empty array (frontend will use defaults)
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('GET /api/courses error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/courses - Update a course
export async function PUT(request: NextRequest) {
  try {
    const db = await getPrisma();
    const body = await request.json();
    const { name, startDate, endDate, color, raafCount, navyCount, armyCount, unit } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Course name is required' },
        { status: 400 }
      );
    }

    // Find course by name (or code)
    const existingCourse = await db.course.findFirst({
      where: {
        OR: [
          { name },
          { code: name }
        ]
      }
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    // Update course
    const updatedCourse = await db.course.update({
      where: { id: existingCourse.id },
      data: {
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(color && { color }),
        ...(raafCount !== undefined && { raafCount }),
        ...(navyCount !== undefined && { navyCount }),
        ...(armyCount !== undefined && { armyCount }),
        ...(unit && { unit })
      }
    });

    console.log(`✅ PUT /api/courses - updated course: ${updatedCourse.name}`);
    return NextResponse.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.error('PUT /api/courses error:', error);
    return NextResponse.json(
      { error: 'Failed to update course', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}