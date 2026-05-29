import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { prisma } from '../../../lib/db/prisma';


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
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
      return NextResponse.json({ settings: null }, { headers: getCorsHeaders(request) });
    }

    return NextResponse.json({ settings: settings.data }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[Settings] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500, headers: getCorsHeaders(request) }
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
        { status: 400, headers: getCorsHeaders(request) }
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
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('[Settings] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}