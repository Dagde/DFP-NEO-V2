import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as bcrypt from 'bcryptjs';

// This endpoint creates or resets the admin user
// Access at: https://dfp-neo.com/api/admin/setup
const isAdminSetupEnabled = (): boolean => process.env.DFP_ENABLE_ADMIN_SETUP === 'true';

const getAdminSetupSecret = (): string => process.env.DFP_ADMIN_SETUP_SECRET?.trim() || '';

const hasValidSetupSecret = (request: NextRequest): boolean => {
  const configuredSecret = getAdminSetupSecret();
  if (!configuredSecret) return false;

  const suppliedSecret =
    request.headers.get('x-dfp-admin-setup-secret') ||
    request.headers.get('x-admin-setup-secret') ||
    new URL(request.url).searchParams.get('setupSecret') ||
    '';

  return suppliedSecret === configuredSecret;
};

export async function POST(request: NextRequest) {
  try {
    if (!isAdminSetupEnabled()) {
      return NextResponse.json(
        { error: 'Admin setup is not enabled for this deployment' },
        { status: 404 }
      );
    }

    if (!getAdminSetupSecret()) {
      return NextResponse.json(
        { error: 'Admin setup secret is not configured' },
        { status: 503 }
      );
    }

    if (!hasValidSetupSecret(request)) {
      return NextResponse.json(
        { error: 'Admin setup secret is required' },
        { status: 403 }
      );
    }

    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@dfp-neo.com';

    if (!adminPassword) {
      return NextResponse.json(
        { error: 'Initial admin password is not configured' },
        { status: 503 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { userId: adminUserId },
    });

    if (existingAdmin) {
      // Reset existing admin password and ensure ADMIN role
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          password: hashedPassword,
          isActive: true,
          role: 'ADMIN',
        },
      });

      return NextResponse.json({
        message: 'Admin user password reset successfully',
        userId: adminUserId,
        note: 'Initial admin password was read from deployment configuration and is not returned by this endpoint',
      });
    }

    // Create new admin user
    await prisma.user.create({
      data: {
        userId: adminUserId,
        username: adminUserId,
        firstName: 'System',
        lastName: 'Administrator',
        email: adminEmail,
        password: hashedPassword,
        isActive: true,
        role: 'ADMIN',
      },
    });

    return NextResponse.json({
      message: 'Admin user created successfully',
      userId: adminUserId,
      note: 'Initial admin password was read from deployment configuration and is not returned by this endpoint',
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    return NextResponse.json(
      { error: 'Failed to create/reset admin user' },
      { status: 500 }
    );
  }
}

// Get admin status
export async function GET() {
  try {
    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';

    const admin = await prisma.user.findUnique({
      where: { userId: adminUserId },
      select: {
        userId: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        role: true,
      },
    });

    if (!admin) {
      return NextResponse.json({
        exists: false,
        setupEnabled: isAdminSetupEnabled(),
        message: isAdminSetupEnabled()
          ? 'Admin user does not exist. Admin setup requires the deployment setup secret.'
          : 'Admin user does not exist. Admin setup is not enabled for this deployment.',
      });
    }

    return NextResponse.json({
      exists: true,
      admin,
      setupEnabled: isAdminSetupEnabled(),
      message: isAdminSetupEnabled()
        ? 'Admin user exists. Password reset requires the deployment setup secret.'
        : 'Admin user exists. Admin setup is not enabled for this deployment.',
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status' },
      { status: 500 }
    );
  }
}
