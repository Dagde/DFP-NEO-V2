import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateMobileRequest } from '@/lib/mobile-middleware';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { user, error } = await authenticateMobileRequest(request);
    if (error) return error;

    // Get date from query parameters
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Date parameter is required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Find schedule for the user and date
    const schedule = await prisma.schedule.findUnique({
      where: {
        userId_date_version: {
          userId: user!.id,
          date: dateParam,
          version: "flight-school",
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({
        schedule: null,
        message: `No schedule found for ${dateParam}`,
        debugVersionQuery: true,
      });
    }

    // Parse schedule data
    const scheduleData = schedule.data as any;

    // Check if schedule is published
    if (!scheduleData.isPublished) {
      return NextResponse.json({
        schedule: null,
        message: `Schedule for ${dateParam} has not been published yet`,
      });
    }

    // Format events for mobile API
    const events = formatEventsForMobile(scheduleData.events || []);

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        date: dateParam,
        isPublished: true,
        serverTime: new Date().toISOString(),
        events,
      },
      message: null,
      debugVersionQuery: true,
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred while fetching schedule' },
      { status: 500 }
    );
  }
}

/**
 * Format schedule events for mobile API response
 */
function formatEventsForMobile(events: any[]): any[] {
  return events.map((event) => ({
    id: event.id || `event-${Math.random().toString(36).substr(2, 9)}`,
    startTime: event.startTime || event.start,
    endTime: event.endTime || event.end,
    eventType: mapEventType(event.type || event.eventType),
    location: event.location || event.venue || null,
    role: mapRole(event.role),
    status: mapStatus(event.status),
    aircraft: event.aircraft || event.aircraftId || null,
    instructor: event.instructor || event.instructorName || null,
    notes: event.notes || event.description || null,
  }));
}

/**
 * Map internal event types to mobile API event types
 */
function mapEventType(type: string): string {
  const typeMap: Record<string, string> = {
    flight: 'Flight',
    ftd: 'FTD',
    simulator: 'Simulator',
    brief: 'Brief',
    briefing: 'Brief',
    duty: 'Duty',
    ground: 'Ground',
    other: 'Other',
  };
  
  return typeMap[type?.toLowerCase()] || 'Other';
}

/**
 * Map internal roles to mobile API roles
 */
function mapRole(role: string): string {
  const roleMap: Record<string, string> = {
    student: 'Student',
    trainee: 'Student',
    instructor: 'Instructor',
    crew: 'Crew',
    observer: 'Observer',
    pilot: 'Pilot',
    'co-pilot': 'Co-Pilot',
    copilot: 'Co-Pilot',
  };
  
  return roleMap[role?.toLowerCase()] || 'Student';
}

/**
 * Map internal status to mobile API status
 */
function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    published: 'Published',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    amended: 'Amended',
    tentative: 'Tentative',
  };
  
  return statusMap[status?.toLowerCase()] || 'Published';
}