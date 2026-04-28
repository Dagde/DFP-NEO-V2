import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    secret: process.env.NEXTAUTH_SECRET || 'default-secret',
    secretLength: (process.env.NEXTAUTH_SECRET || 'default-secret').length
  });
}