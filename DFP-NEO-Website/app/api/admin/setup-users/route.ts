import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SETUP_KEY = process.env.SETUP_KEY || 'DFP-NEO-SETUP-2026';

/**
 * One-time setup endpoint to create initial users
 * POST /api/admin/setup-users
 * Body: { setupKey: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupKey } = body;

    if (setupKey !== SETUP_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid setup key' },
        { status: 401 }
      );
    }

    const results = [];

    // Create SuperAdmin user
    const superAdminPassword = await bcrypt.hash('Bathurst063371526', 12);
    const superAdmin = await prisma.user.upsert({
      where: { userId: 'superadmin' },
      update: {
        password: superAdminPassword,
        isActive: true,
      },
      create: {
        userId: 'superadmin',
        username: 'superadmin',
        password: superAdminPassword,
        firstName: 'Super',
        lastName: 'Admin',
        email: 'lifeofiron2015@gmail.com',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    results.push({ userId: 'superadmin', status: 'created/updated', role: 'SUPER_ADMIN' });

    // Create Alexander Burns user
    const burnsPassword = await bcrypt.hash('Burns8201112', 12);
    const burns = await prisma.user.upsert({
      where: { userId: 'alexander.burns' },
      update: {
        password: burnsPassword,
        isActive: true,
      },
      create: {
        userId: 'alexander.burns',
        username: 'alexander.burns',
        password: burnsPassword,
        firstName: 'Alexander',
        lastName: 'Burns',
        email: 'lifeofiron2015@gmail.com',
        role: 'INSTRUCTOR',
        isActive: true,
      },
    });
    results.push({ userId: 'alexander.burns', status: 'created/updated', role: 'INSTRUCTOR' });

    return NextResponse.json({
      message: 'Users created/updated successfully',
      users: results,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}