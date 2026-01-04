import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.permissionsRole.name !== 'Administrator') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📋 Fetching users for admin:', session.user.userId);
    
    const users = await prisma.user.findMany({
      include: { permissionsRole: true },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(users);
    
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.permissionsRole.name !== 'Administrator') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, displayName, email, permissionsRoleId } = body;

    if (!userId || !displayName || !permissionsRoleId) {
      return NextResponse.json({ error: 'User ID, display name, and role are required' }, { status: 400 });
    }

    const prisma = new PrismaClient();
    
    const existingUser = await prisma.user.findUnique({
      where: { userId },
    });
    
    if (existingUser) {
      return NextResponse.json({ error: 'User ID already exists' }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        userId,
        displayName,
        email,
        permissionsRole: { connect: { id: permissionsRoleId } },
        status: 'ACTIVE',
        mustChangePassword: true,
      },
      include: { permissionsRole: true },
    });

    console.log('✅ Created new user:', newUser);

    return NextResponse.json(newUser, { status: 201 });
    
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}