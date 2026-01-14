import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/personnel - Get all personnel with optional filtering
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
    const role = searchParams.get('role');
    const available = searchParams.get('available');
    const search = searchParams.get('search');

    // Build where clause
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (available === 'true') {
      where.isAvailable = true;
    } else if (available === 'false') {
      where.isAvailable = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { rank: { contains: search, mode: 'insensitive' } },
      ];
    }

    
      console.log('🔍 [API TRACKING] /api/personnel - Querying database');
      console.log('🔍 [API TRACKING] Where clause:', where);

const personnel = await prisma.personnel.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    
      console.log('🔍 [API TRACKING] /api/personnel - Returning', personnel.length, 'records');
      console.log('🔍 [API TRACKING] Sample records:', personnel.slice(0, 3).map(p => ({ id: p.idNumber, name: p.name, userId: p.userId })));

return NextResponse.json({ personnel });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel' },
      { status: 500 }
    );
  }
}