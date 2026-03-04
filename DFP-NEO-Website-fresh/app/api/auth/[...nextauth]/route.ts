import { NextResponse } from 'next/server';

// NextAuth is no longer used - authentication is handled by /api/auth/direct-login
export async function GET() {
  return NextResponse.json({ message: 'Auth endpoint deprecated' }, { status: 404 });
}

export async function POST() {
  return NextResponse.json({ message: 'Auth endpoint deprecated' }, { status: 404 });
}