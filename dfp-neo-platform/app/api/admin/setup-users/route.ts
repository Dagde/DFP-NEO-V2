/**
 * One-time setup endpoint to create initial auth users
 * Protected by a setup key to prevent unauthorized access
 * 
 * POST /api/admin/setup-users
 * Body: { setupKey: "DFP-NEO-SETUP-2026" }
 * 
 * This creates:
 * - superadmin / Bathurst063371526 (SUPER_ADMIN)
 * - alexander.burns / Burns8201112 (INSTRUCTOR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Setup key to protect this endpoint
const SETUP_KEY = process.env.SETUP_KEY || 'DFP-NEO-SETUP-2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupKey } = body;

    if (setupKey !== SETUP_KEY) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid setup key' },
        { status: 403 }
      );
    }

    console.log('🌱 Setting up initial auth users...');

    // Hash passwords
    const superAdminHash = await bcrypt.hash('Bathurst063371526', 12);
    const burnsHash = await bcrypt.hash('Burns8201112', 12);

    const results = [];

    // Create/update SuperAdmin
    try {
      const superAdmin = await prisma.user.upsert({
        where: { userId: 'superadmin' },
        update: {
          password: superAdminHash,
          role: Role.SUPER_ADMIN,
          isActive: true,
          email: 'lifeofiron2015@gmail.com',
          firstName: 'Super',
          lastName: 'Admin',
          username: 'superadmin',
          updatedAt: new Date(),
        },
        create: {
          userId: 'superadmin',
          username: 'superadmin',
          email: 'lifeofiron2015@gmail.com',
          password: superAdminHash,
          role: Role.SUPER_ADMIN,
          firstName: 'Super',
          lastName: 'Admin',
          isActive: true,
        },
      });
      results.push({ userId: 'superadmin', status: 'created/updated', role: superAdmin.role });
      console.log(`✅ SuperAdmin: ${superAdmin.userId} (${superAdmin.role})`);
    } catch (err: any) {
      results.push({ userId: 'superadmin', status: 'error', error: err.message });
      console.error('❌ SuperAdmin error:', err.message);
    }

    // Create/update Alexander Burns
    try {
      const burns = await prisma.user.upsert({
        where: { userId: 'alexander.burns' },
        update: {
          password: burnsHash,
          role: Role.INSTRUCTOR,
          isActive: true,
          email: 'burns.alexander@sample.com.au',
          firstName: 'Alexander',
          lastName: 'Burns',
          username: 'alexander.burns',
          updatedAt: new Date(),
        },
        create: {
          userId: 'alexander.burns',
          username: 'alexander.burns',
          email: 'burns.alexander@sample.com.au',
          password: burnsHash,
          role: Role.INSTRUCTOR,
          firstName: 'Alexander',
          lastName: 'Burns',
          isActive: true,
        },
      });
      results.push({ userId: 'alexander.burns', status: 'created/updated', role: burns.role });
      console.log(`✅ Alexander Burns: ${burns.userId} (${burns.role})`);
    } catch (err: any) {
      results.push({ userId: 'alexander.burns', status: 'error', error: err.message });
      console.error('❌ Alexander Burns error:', err.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Initial users setup complete',
      results,
      credentials: {
        superAdmin: { userId: 'superadmin', password: 'Bathurst063371526', role: 'SUPER_ADMIN' },
        alexanderBurns: { userId: 'alexander.burns', password: 'Burns8201112', role: 'INSTRUCTOR' },
      },
    });

  } catch (error: any) {
    console.error('Setup users error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// Also allow GET to check if users exist
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const setupKey = authHeader?.replace('Bearer ', '') || '';
    
    if (setupKey !== SETUP_KEY) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: {
        userId: { in: ['superadmin', 'alexander.burns'] },
      },
      select: {
        userId: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}