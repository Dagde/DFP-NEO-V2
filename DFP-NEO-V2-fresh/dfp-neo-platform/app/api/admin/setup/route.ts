import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as bcrypt from 'bcryptjs';

// This endpoint creates or resets the admin user
// Access at: https://dfp-neo.com/api/admin/setup

export async function POST(request: NextRequest) {
  try {
    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@dfp-neo.com';

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
        password: adminPassword,
        note: 'Please change the password after login',
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
      password: adminPassword,
      note: 'Please change the password after first login',
    });
  } catch (error) {
    console.error('Admin setup error:', error);
    return NextResponse.json(
      { error: 'Failed to create/reset admin user', details: String(error) },
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
        message: 'Admin user does not exist. Use POST /api/admin/setup to create one.',
      });
    }

    return NextResponse.json({
      exists: true,
      admin,
      message: 'Admin user exists. Use POST /api/admin/setup to reset password.',
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', details: String(error) },
      { status: 500 }
    );
  }
}