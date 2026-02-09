import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const env = {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  };

  return NextResponse.json({
    environment: env,
    timestamp: new Date().toISOString()
  });
}