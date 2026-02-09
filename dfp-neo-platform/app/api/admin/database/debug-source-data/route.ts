import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const originalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL;
    
    if (!originalDatabaseUrl) {
      return NextResponse.json({
        error: 'ORIGINAL_DATABASE_URL not configured'
      }, { status: 500 });
    }

    console.log('🔍 Connecting to source database...');
    
    // Connect to the original database
    const sourcePrisma = new PrismaClient({
      datasources: {
        db: {
          url: originalDatabaseUrl,
        },
      },
    });

    // Test connection and count records
    const results: Record<string, number> = {};
    const tables = ['user', 'session', 'personnel', 'trainee', 'aircraft', 'schedule', 'flightSchedule', 'score', 'course', 'userSettings', 'cancellationHistory', 'auditLog'];
    
    for (const table of tables) {
      try {
        // @ts-ignore - dynamic table access
        const count = await sourcePrisma[table].count();
        results[table] = count;
      } catch (error: any) {
        results[table] = -1; // Error accessing table
      }
    }

    await sourcePrisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      sourceDatabase: {
        host: originalDatabaseUrl.match(/@([^:]+):/)?.[1] || 'unknown',
        tableCounts: results
      }
    });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}