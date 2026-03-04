import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { events, includeCancelled = false, includeSTBY = false } = await request.json();
    
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: 'Events must be an array' }, { status: 400 });
    }

    // Filter events based on requirements
    const filteredEvents = events.filter(event => {
      // Handle cancelled events
      const isCancelled = event.status === 'CANCELLED' || 
                         event.isCancelled === true || 
                         event.isDeleted === true ||
                         event.cancelled === true;

      // Handle STBY events
      const isSTBY = event.type === 'STBY' || 
                   event.eventType === 'STBY' ||
                   event.category === 'STBY' ||
                   (event.title && event.title.includes('STBY'));

      // Include logic:
      // - Always include cancelled events in display (with red X) unless explicitly excluded
      // - Never include STBY events in schedules unless explicitly included
      // - For conflict/duty validation: exclude cancelled events
      // - For schedule display: exclude STBY events
      
      if (isCancelled && !includeCancelled) {
        return false; // Exclude cancelled from calculations
      }
      
      if (isSTBY && !includeSTBY) {
        return false; // Exclude STBY from schedules
      }
      
      return true;
    });

    // Separate events for different purposes
    const displayEvents = filteredEvents.filter(event => {
      const isSTBY = event.type === 'STBY' || 
                   event.eventType === 'STBY' ||
                   event.category === 'STBY' ||
                   (event.title && event.title.includes('STBY'));
      return !isSTBY; // Never include STBY in display
    });

    const calculationEvents = filteredEvents.filter(event => {
      const isCancelled = event.status === 'CANCELLED' || 
                         event.isCancelled === true || 
                         event.isDeleted === true ||
                         event.cancelled === true;
      return !isCancelled; // Exclude cancelled from calculations
    });

    return NextResponse.json({
      filteredEvents,
      displayEvents,    // For UI display (no STBY)
      calculationEvents, // For duty/conflict calculations (no cancelled)
      summary: {
        total: events.length,
        filtered: filteredEvents.length,
        cancelled: events.filter(e => 
          e.status === 'CANCELLED' || e.isCancelled || e.isDeleted || e.cancelled
        ).length,
        stby: events.filter(e => 
          e.type === 'STBY' || e.eventType === 'STBY' || e.category === 'STBY' || 
          (e.title && e.title.includes('STBY'))
        ).length
      }
    });

  } catch (error) {
    console.error('Schedule filter error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return filter documentation
  return NextResponse.json({
    description: 'DFP-NEO Schedule Event Filter API',
    rules: {
      cancelledEvents: {
        display: 'Visible with red X indicator',
        calculations: 'Excluded from duty hours and conflict validation',
        reasoning: 'Cancelled events no longer exist for operational purposes'
      },
      stbyEvents: {
        display: 'Hidden from trainee and staff schedules',
        calculations: 'Excluded from all processing',
        reasoning: 'STBY events are administrative, not operational'
      }
    },
    endpoints: {
      'POST /api/schedule/filter': {
        description: 'Filter events according to DFP-NEO rules',
        parameters: {
          events: 'Array of event objects',
          includeCancelled: 'Optional: Include cancelled events (default: false)',
          includeSTBY: 'Optional: Include STBY events (default: false)'
        }
      }
    }
  });
}