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

/**
 * Resolve the User.id (cuid primary key) from either:
 *   - User.userId  (the custom login/SSO field passed by the client)
 *   - User.id      (the cuid — accepted directly if it looks like one)
 * UserSettings.userId is a FK to User.id, so we always need the cuid.
 */
async function resolveUserCuid(userIdParam: string): Promise<string | null> {
  try {
    // Try direct match on User.id first (in case client already sends the cuid)
    const byId = await (prisma as any).user.findUnique({
      where: { id: userIdParam },
      select: { id: true },
    });
    if (byId) return byId.id;

    // Fall back to User.userId (the custom login/SSO field)
    const byUserId = await (prisma as any).user.findUnique({
      where: { userId: userIdParam },
      select: { id: true },
    });
    if (byUserId) return byUserId.id;

    return null;
  } catch {
    return null;
  }
}

// GET /api/user-preferences?userId=<id>
// Returns the stored JSON preferences for a user, or {} if none exist.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    if (!userIdParam) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const userCuid = await resolveUserCuid(userIdParam);
    if (!userCuid) {
      console.warn('[UserPreferences] GET: could not resolve user for userId:', userIdParam);
      return NextResponse.json({ preferences: {} }, { headers: CORS_HEADERS });
    }

    const record = await (prisma as any).userSettings.findUnique({
      where: { userId: userCuid },
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
// Merges `value` into the stored preferences under `key`.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId: userIdParam, key, value } = body;

    if (!userIdParam || !key) {
      return NextResponse.json(
        { error: 'userId and key are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const userCuid = await resolveUserCuid(userIdParam);
    if (!userCuid) {
      console.warn('[UserPreferences] PUT: could not resolve user for userId:', userIdParam);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Load existing settings
    const existing = await (prisma as any).userSettings.findUnique({
      where: { userId: userCuid },
    });

    const currentSettings: Record<string, any> =
      (existing?.settings as Record<string, any>) ?? {};

    // Merge the new key/value
    const updatedSettings = { ...currentSettings, [key]: value };

    // Upsert using the resolved cuid
    await (prisma as any).userSettings.upsert({
      where: { userId: userCuid },
      update: { settings: updatedSettings, updatedAt: new Date() },
      create: { userId: userCuid, settings: updatedSettings },
    });

    console.log('[UserPreferences] Saved key:', key, 'for userCuid:', userCuid);
    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[UserPreferences] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to save user preferences' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}