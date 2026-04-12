import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://dfp-neo-v2-production.up.railway.app',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/aircraft-availability-debug
 * Diagnostic endpoint to verify database connectivity and table status
 */
export async function GET(request: NextRequest) {
  const requestId = `debug_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-DEBUG] 🔍 Diagnostic request ${requestId}`);
  
  const results: any = {
    requestId,
    timestamp: new Date().toISOString(),
    checks: {},
    errors: []
  };

  // Check 1: Database URL configuration
  console.log('[AV-DEBUG] Check 1: Database URL configuration');
  try {
    const dbUrl = process.env.DATABASE_URL;
    results.checks.databaseUrl = {
      configured: !!dbUrl,
      // Don't log the actual URL for security, just if it exists
      length: dbUrl ? dbUrl.length : 0,
      prefix: dbUrl ? dbUrl.substring(0, 20) + '...' : 'not set'
    };
  } catch (e) {
    results.errors.push({ check: 'databaseUrl', error: String(e) });
  }

  // Check 2: Prisma client status
  console.log('[AV-DEBUG] Check 2: Prisma client status');
  try {
    results.checks.prismaClient = {
      exists: !!prisma,
      hasAircraftAvailabilityEvent: typeof prisma.aircraftAvailabilityEvent === 'object',
      hasAircraftAvailabilityHistory: typeof prisma.aircraftAvailabilityHistory === 'object',
    };
  } catch (e) {
    results.errors.push({ check: 'prismaClient', error: String(e) });
  }

  // Check 3: Count records in AircraftAvailabilityEvent
  console.log('[AV-DEBUG] Check 3: Count AircraftAvailabilityEvent records');
  try {
    const eventCount = await prisma.aircraftAvailabilityEvent.count();
    results.checks.eventTable = {
      accessible: true,
      count: eventCount
    };
    console.log(`[AV-DEBUG] ✅ Event table accessible, ${eventCount} records`);
  } catch (e: any) {
    results.checks.eventTable = { accessible: false };
    results.errors.push({ 
      check: 'eventTable', 
      error: e?.message || String(e),
      errorCode: e?.code,
      errorMeta: e?.meta 
    });
    console.error('[AV-DEBUG] ❌ Event table error:', e);
  }

  // Check 4: Count records in AircraftAvailabilityHistory
  console.log('[AV-DEBUG] Check 4: Count AircraftAvailabilityHistory records');
  try {
    const historyCount = await prisma.aircraftAvailabilityHistory.count();
    results.checks.historyTable = {
      accessible: true,
      count: historyCount
    };
    console.log(`[AV-DEBUG] ✅ History table accessible, ${historyCount} records`);
  } catch (e: any) {
    results.checks.historyTable = { accessible: false };
    results.errors.push({ 
      check: 'historyTable', 
      error: e?.message || String(e),
      errorCode: e?.code,
      errorMeta: e?.meta 
    });
    console.error('[AV-DEBUG] ❌ History table error:', e);
  }

  // Check 5: Get latest event
  console.log('[AV-DEBUG] Check 5: Get latest event');
  try {
    const latestEvent = await prisma.aircraftAvailabilityEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    results.checks.latestEvent = latestEvent ? {
      exists: true,
      id: latestEvent.id,
      date: latestEvent.date,
      availableCount: latestEvent.availableCount,
      changeType: latestEvent.changeType,
      timestamp: latestEvent.timestamp.toISOString()
    } : { exists: false };
  } catch (e: any) {
    results.errors.push({ 
      check: 'latestEvent', 
      error: e?.message || String(e),
      errorCode: e?.code 
    });
  }

  // Check 6: Get latest history
  console.log('[AV-DEBUG] Check 6: Get latest history');
  try {
    const latestHistory = await prisma.aircraftAvailabilityHistory.findFirst({
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    results.checks.latestHistory = latestHistory ? {
      exists: true,
      id: latestHistory.id,
      date: latestHistory.date,
      dailyAverage: latestHistory.dailyAverage,
      plannedCount: latestHistory.plannedCount
    } : { exists: false };
  } catch (e: any) {
    results.errors.push({ 
      check: 'latestHistory', 
      error: e?.message || String(e),
      errorCode: e?.code 
    });
  }

  // Check 7: Raw SQL to verify table exists
  console.log('[AV-DEBUG] Check 7: Raw SQL table verification');
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%aircraft%'
    `;
    results.checks.databaseTables = tables;
    console.log('[AV-DEBUG] 📋 Tables found:', tables);
  } catch (e: any) {
    results.errors.push({ 
      check: 'rawSqlTables', 
      error: e?.message || String(e),
      errorCode: e?.code 
    });
  }

  // Check 8: Try a simple insert and rollback (test write capability)
  console.log('[AV-DEBUG] Check 8: Test write capability');
  try {
    // Use a unique test ID that won't conflict
    const testDate = `TEST-${Date.now()}`;
    
    // First, try to insert a test event
    const testEvent = await prisma.aircraftAvailabilityEvent.create({
      data: {
        timestamp: new Date(),
        date: testDate,
        availableCount: 999,
        totalAircraft: 999,
        changeType: 'debug_test',
        recordedBy: 'debug_endpoint',
        notes: 'This is a test record - will be deleted'
      }
    });
    
    results.checks.writeTest = {
      success: true,
      insertedId: testEvent.id,
      testDate: testDate
    };
    console.log(`[AV-DEBUG] ✅ Write test successful, ID: ${testEvent.id}`);
    
    // Clean up the test record
    await prisma.aircraftAvailabilityEvent.delete({
      where: { id: testEvent.id }
    });
    results.checks.writeTest.cleanup = 'deleted';
    
  } catch (e: any) {
    results.checks.writeTest = { success: false };
    results.errors.push({ 
      check: 'writeTest', 
      error: e?.message || String(e),
      errorCode: e?.code,
      errorMeta: e?.meta 
    });
    console.error('[AV-DEBUG] ❌ Write test failed:', e);
  }

  console.log(`[AV-DEBUG] 🔍 Diagnostic complete ${requestId}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return NextResponse.json(results, { headers: CORS_HEADERS });
}

/**
 * POST /api/aircraft-availability-debug
 * Force insert a test record and verify the full flow
 */
export async function POST(request: NextRequest) {
  const requestId = `debug_post_${Date.now()}`;
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[AV-DEBUG] 🧪 Force insert test ${requestId}`);
  
  try {
    const body = await request.json().catch(() => ({}));
    const testDate = body.date || new Date().toISOString().split('T')[0];
    
    console.log(`[AV-DEBUG] Test date: ${testDate}`);
    
    // Force insert an event
    const event = await prisma.aircraftAvailabilityEvent.create({
      data: {
        timestamp: new Date(),
        date: testDate,
        availableCount: body.availableCount ?? 15,
        totalAircraft: body.totalAircraft ?? 15,
        changeType: 'debug_force_insert',
        recordedBy: 'debug_endpoint',
        notes: `Force insert test at ${new Date().toISOString()}`
      }
    });
    
    console.log(`[AV-DEBUG] ✅ Event inserted: ${event.id}`);
    
    // Force insert/update a history record
    const history = await prisma.aircraftAvailabilityHistory.upsert({
      where: { date: testDate },
      update: {
        dailyAverage: body.availableCount ?? 15,
        plannedCount: body.availableCount ?? 15,
        actualCount: body.availableCount ?? 15,
        totalAircraft: body.totalAircraft ?? 15,
        availabilityPct: 100,
        lastCalculatedAt: new Date()
      },
      create: {
        date: testDate,
        dailyAverage: body.availableCount ?? 15,
        plannedCount: body.availableCount ?? 15,
        actualCount: body.availableCount ?? 15,
        totalAircraft: body.totalAircraft ?? 15,
        availabilityPct: 100,
        lastCalculatedAt: new Date()
      }
    });
    
    console.log(`[AV-DEBUG] ✅ History upserted: ${history.id}`);
    
    // Verify the records exist
    const verifyEvent = await prisma.aircraftAvailabilityEvent.findUnique({
      where: { id: event.id }
    });
    
    const verifyHistory = await prisma.aircraftAvailabilityHistory.findUnique({
      where: { id: history.id }
    });
    
    console.log(`[AV-DEBUG] 🔍 Verification - Event exists: ${!!verifyEvent}, History exists: ${!!verifyHistory}`);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: true,
      requestId,
      event: {
        id: event.id,
        date: event.date,
        availableCount: event.availableCount
      },
      history: {
        id: history.id,
        date: history.date,
        dailyAverage: history.dailyAverage
      },
      verification: {
        eventExists: !!verifyEvent,
        historyExists: !!verifyHistory
      }
    }, { headers: CORS_HEADERS });
    
  } catch (error: any) {
    console.error(`[AV-DEBUG] ❌ Force insert failed:`, error);
    console.log(`${'='.repeat(80)}\n`);
    
    return NextResponse.json({
      success: false,
      requestId,
      error: {
        message: error?.message,
        code: error?.code,
        meta: error?.meta,
        stack: error?.stack
      }
    }, { status: 500, headers: CORS_HEADERS });
  }
}