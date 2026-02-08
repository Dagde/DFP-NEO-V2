import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const originalDatabaseUrl = process.env.ORIGINAL_DATABASE_URL;
    const currentDatabaseUrl = process.env.DATABASE_URL;
    
    if (!originalDatabaseUrl) {
      return NextResponse.json({
        error: 'ORIGINAL_DATABASE_URL not configured',
        currentDatabaseUrl: currentDatabaseUrl ? 'SET' : 'NOT SET'
      });
    }

    // Check URL type
    const isProxyUrl = originalDatabaseUrl.includes('proxy.rlwy.net');
    const isInternalUrl = originalDatabaseUrl.includes('postgres.railway.internal');
    
    // Extract host from URL
    const hostMatch = originalDatabaseUrl.match(/@([^:]+):/);
    const host = hostMatch ? hostMatch[1] : 'unknown';
    
    return NextResponse.json({
      originalDatabaseUrl: {
        type: isProxyUrl ? 'PROXY' : isInternalUrl ? 'INTERNAL' : 'OTHER',
        host: host,
        fullUrl: originalDatabaseUrl.replace(/:[^:@]+@/, ':***@') // Hide password
      },
      currentDatabaseUrl: {
        host: currentDatabaseUrl ? currentDatabaseUrl.match(/@([^:]+):/)?.[1] : 'not set'
      },
      conversionNeeded: isProxyUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}