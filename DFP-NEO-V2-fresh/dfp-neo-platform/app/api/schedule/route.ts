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

// GET /api/schedule - Get schedules with optional filtering
// Note: Auth check removed - page-level auth (login page) protects access
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ schedules }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/schedule - Create or update a schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date, data } = body;

    if (!userId || !date || !data) {
      return NextResponse.json(
        { error: 'userId, date, and data are required' },
        { status: 400 }
      );
    }

    // Check if schedule exists for this user and date
    const existingSchedule = await prisma.schedule.findFirst({
      where: {
        userId,
        date: date,
      },
    });

    let schedule;

    if (existingSchedule) {
      // Update existing schedule
      schedule = await prisma.schedule.update({
        where: { id: existingSchedule.id },
        data: {
          data,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new schedule
      schedule = await prisma.schedule.create({
        data: {
          userId,
          date: date,
          data,
        },
      });
    }

    return NextResponse.json({ 
      success: true,
      schedule 
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json(
      { error: 'Failed to save schedule' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}