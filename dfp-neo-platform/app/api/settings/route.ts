import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { auth } from '@/lib/auth';
import { prisma } from '../../../lib/db/prisma';

const canManagePlatformSettings = (role?: string | null): boolean =>
  role === 'SUPER_ADMIN' || role === 'ADMIN';

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication is required to save settings' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }

    if (!canManagePlatformSettings(session.user.role)) {
      return NextResponse.json(
        { error: 'Administrator permission is required to save settings' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }

    const body = await request.json();
    const { orgId = 'default', settings, updatedBy } = body;
    const auditUser = updatedBy || session.user.userId || session.user.username || session.user.id || null;

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
        updatedBy: auditUser,
        updatedAt: new Date(),
      },
      create: {
        orgId,
        data: settings,
        updatedBy: auditUser,
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
