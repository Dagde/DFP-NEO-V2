import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    let originalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL;
    
    if (!originalDatabaseUrl) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ORIGINAL_DATABASE_URL environment variable not configured' 
        },
        { status: 500 }
      );
    }

    // Note: Do NOT convert proxy URL to internal URL
    // We're connecting between different Railway projects, so proxy URL is required
    console.log('🔍 Original database URL type:', originalDatabaseUrl.includes('proxy.rlwy.net') ? 'PROXY' : 'INTERNAL');
    console.log('ℹ️ Using proxy URL as-is (required for inter-project connections)');

    // Create a separate Prisma client for the original database
    const originalPrisma = new PrismaClient({
      datasources: {
        db: {
          url: originalDatabaseUrl,
        },
      },
    });

    console.log('🔄 Starting database mirroring...');
    const results: Record<string, number> = {};

    // Define tables to mirror in order (respecting foreign key dependencies)
    const tables = [
      { name: 'User', model: 'user' },
      { name: 'Session', model: 'session' },
      { name: 'Personnel', model: 'personnel' },
      { name: 'Trainee', model: 'trainee' },
      { name: 'Aircraft', model: 'aircraft' },
      { name: 'Schedule', model: 'schedule' },
      { name: 'FlightSchedule', model: 'flightSchedule' },
      { name: 'Score', model: 'score' },
      { name: 'Course', model: 'course' },
      { name: 'UserSettings', model: 'userSettings' },
      { name: 'CancellationHistory', model: 'cancellationHistory' },
      { name: 'AuditLog', model: 'auditLog' },
    ];

    // Mirror each table using upsert
    const errors: Record<string, string[]> = {};
    
    for (const table of tables) {
      console.log(`📋 Mirroring ${table.name}...`);
      
      try {
        // Get all data from original database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const originalData: any[] = await (originalPrisma as any)[table.model].findMany();
        console.log(`📥 Found ${originalData.length} records in ${table.name}`);
        
        let upsertCount = 0;
        
        // Upsert each record into V2 database
        for (const record of originalData) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma as any)[table.model].upsert({
              where: { id: record.id },
              update: record,
              create: record,
            });
            upsertCount++;
          } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.error(`❌ Error upserting ${table.name} record ${record.id}:`, errorMsg);
            if (!errors[table.name]) errors[table.name] = [];
            errors[table.name].push(`Record ${record.id}: ${errorMsg.substring(0, 100)}`);
          }
        }
        
        results[table.name] = upsertCount;
        console.log(`✅ ${table.name}: ${upsertCount} records mirrored`);
      } catch (error: any) {
        console.error(`❌ Error fetching ${table.name}:`, error.message);
        results[table.name] = -1; // Error fetching
        if (!errors[table.name]) errors[table.name] = [];
        errors[table.name].push(`Fetch error: ${error.message}`);
      }
    }

    // Clean up
    await originalPrisma.$disconnect();

    console.log('🎉 Database mirroring completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Database mirroring completed successfully',
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('❌ Error during database mirroring:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}