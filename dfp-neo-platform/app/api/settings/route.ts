import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
  'Access-Control-Allow-Credentials': 'true',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/settings - Load app settings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId') || 'default';

    const settings = await (prisma as any).appSettings.findUnique({
      where: { orgId }
    });

    if (!settings) {
      return NextResponse.json({ settings: null }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ settings: settings.data }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// POST /api/settings - Save app settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId = 'default', settings, updatedBy } = body;

    if (!settings) {
      return NextResponse.json(
        { error: 'Missing settings data' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await (prisma as any).appSettings.upsert({
      where: { orgId },
      update: {
        data: settings,
        updatedBy: updatedBy || null,
        updatedAt: new Date(),
      },
      create: {
        orgId,
        data: settings,
        updatedBy: updatedBy || null,
      }
    });

    return NextResponse.json(
      { success: true, id: result.id },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('[Settings] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}