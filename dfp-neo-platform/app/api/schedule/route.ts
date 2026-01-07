import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/schedule - Get schedules with optional filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

// POST /api/schedule - Create or update a schedule
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
    });
  } catch (error) {
    console.error('Error saving schedule:', error);
    return NextResponse.json(
      { error: 'Failed to save schedule' },
      { status: 500 }
    );
  }
}