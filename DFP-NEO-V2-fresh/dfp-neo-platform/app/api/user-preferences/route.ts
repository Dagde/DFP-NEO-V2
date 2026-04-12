import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/user-preferences?userId=<id>
// Returns the stored JSON preferences for a user, or {} if none exist.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const record = await (prisma as any).userSettings.findUnique({
      where: { userId },
    });

    const preferences = record?.settings ?? {};
    return NextResponse.json({ preferences }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[UserPreferences] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load user preferences' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// PUT /api/user-preferences
// Body: { userId: string, key: string, value: any }
// Merges `value` into the stored preferences under `key` (shallow merge at top level).
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, key, value } = body;

    if (!userId || !key) {
      return NextResponse.json(
        { error: 'userId and key are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Load existing settings
    const existing = await (prisma as any).userSettings.findUnique({
      where: { userId },
    });

    const currentSettings: Record<string, any> = (existing?.settings as Record<string, any>) ?? {};

    // Merge the new key/value
    const updatedSettings = { ...currentSettings, [key]: value };

    // Upsert
    await (prisma as any).userSettings.upsert({
      where: { userId },
      update: { settings: updatedSettings, updatedAt: new Date() },
      create: { userId, settings: updatedSettings },
    });

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[UserPreferences] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to save user preferences' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}