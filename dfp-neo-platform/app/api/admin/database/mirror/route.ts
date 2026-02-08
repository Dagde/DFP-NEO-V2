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

    // Railway services cannot connect to other Railway databases via proxy URL
    // Convert proxy URL to internal URL if both are on Railway
    console.log('🔍 Original database URL type:', originalDatabaseUrl.includes('proxy.rlwy.net') ? 'PROXY' : 'INTERNAL');
    
    if (originalDatabaseUrl.includes('proxy.rlwy.net')) {
      console.log('🔄 Converting proxy URL to internal Railway URL...');
      // Extract password from the URL
      const match = originalDatabaseUrl.match(/postgres:\/\/postgres:([^@]+)@/);
      if (match) {
        const password = match[1];
        originalDatabaseUrl = `postgresql://postgres:${password}@postgres.railway.internal:5432/railway`;
        console.log('✅ Using internal URL: postgres.railway.internal:5432');
      }
    } else {
      console.log('ℹ️ Already using internal or non-proxy URL');
    }

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
    for (const table of tables) {
      console.log(`📋 Mirroring ${table.name}...`);
      
      // Get all data from original database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalData: any[] = await (originalPrisma as any)[table.model].findMany();
      
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
        } catch (error) {
          console.error(`❌ Error upserting ${table.name} record ${record.id}:`, error);
        }
      }
      
      results[table.name] = upsertCount;
      console.log(`✅ ${table.name}: ${upsertCount} records mirrored`);
    }

    // Clean up
    await originalPrisma.$disconnect();

    console.log('🎉 Database mirroring completed!');
    
    return NextResponse.json({
      success: true,
      message: 'Database mirroring completed successfully',
      results,
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