import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import * as bcrypt from 'bcryptjs';

// This endpoint creates or resets the admin user

export async function POST(request: NextRequest) {
  try {
    // Get admin credentials from environment or use defaults
    const adminUserId = process.env.INITIAL_ADMIN_USERID || 'admin';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@dfpneo.com';

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { userId: adminUserId },
    });

    if (existingAdmin) {
      // Update existing admin password
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { password: hashedPassword, isActive: true },
      });

      return NextResponse.json({
        message: 'Admin user password reset successfully',
        userId: adminUserId,
        password: adminPassword,
        note: 'Please change the password after login',
      });
    }

    // Find the admin role
    let adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });

    // If no role table, try to handle without role
    // Create admin user
    const admin = await prisma.user.create({
      data: {
        userId: adminUserId,
        username: 'admin',
        firstName: 'System',
        lastName: 'Administrator',
        email: adminEmail,
        password: hashedPassword,
        isActive: true,
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
      { error: 'Failed to create admin user', details: String(error) },
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
      },
    });

    if (!admin) {
      return NextResponse.json({
        exists: false,
        message: 'Admin user does not exist. Use POST /api/admin/setup to create one.',
        defaultCredentials: {
          userId: adminUserId,
          password: process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe123!',
        }
      });
    }

    return NextResponse.json({
      exists: true,
      admin: {
        userId: admin.userId,
        username: admin.username,
        name: `${admin.firstName} ${admin.lastName}`,
        email: admin.email,
        isActive: admin.isActive,
      },
      message: 'Admin user exists. Use POST /api/admin/setup to reset password.',
      currentCredentials: {
        userId: admin.userId,
        password: 'Use POST /api/admin/setup to reset to default password',
      },
    });
  } catch (error) {
    console.error('Admin status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check admin status', details: String(error) },
      { status: 500 }
    );
  }
}