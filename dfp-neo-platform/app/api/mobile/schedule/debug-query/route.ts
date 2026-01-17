import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const range = searchParams.get('range') === 'true';

    // Get user's internal ID
    const userId = user!.id;

    if (!dateParam && !range) {
      return NextResponse.json({
        error: 'Bad Request',
        message: 'Provide either "date" parameter or "range=true" for date range query'
      }, { status: 400 });
    }

    let schedules;

    if (range) {
      // Query for date range: 2026-01-17 through 2026-01-20
      const startDate = '2026-01-17';
      const endDate = '2026-01-20';

      schedules = await prisma.schedule.findMany({
        where: {
          userId: userId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
    } else {
      // Query for specific date
      schedules = await prisma.schedule.findMany({
        where: {
          userId: userId,
          date: dateParam,
        },
        select: {
          id: true,
          userId: true,
          date: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          date: 'asc',
        },
      });
    }

    return NextResponse.json({
      debugInfo: {
        internalUserId: userId,
        displayUserId: user!.userId,
        queryType: range ? 'date_range_2026-01-17_to_2026-01-20' : 'specific_date',
        dateParam: dateParam,
      },
      schedules: schedules,
      count: schedules.length,
      message: schedules.length > 0 
        ? `Found ${schedules.length} schedule(s)` 
        : `No schedules found${dateParam ? ` for ${dateParam}` : ' in date range'}`
    });
  } catch (error) {
    console.error('Debug schedule query error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while querying schedules' },
      { status: 500 }
    );
  }
}