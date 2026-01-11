import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const role = searchParams.get('role');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { userId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        personnel: true,
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Transform to match expected format
    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.personnel?.name || `${user.lastName || ''}, ${user.firstName || ''}`.trim(),
      email: user.email || 'No email',
      pmkeysId: user.userId || 'N/A',
      role: user.role,
      createdAt: user.createdAt.toISOString().split('T')[0],
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}


