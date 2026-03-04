import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/aircraft/:id - Get specific aircraft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const aircraft = await prisma.aircraft.findUnique({
      where: { id },
    });

    if (!aircraft) {
      return NextResponse.json(
        { error: 'Aircraft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ aircraft });
  } catch (error) {
    console.error('Error fetching aircraft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aircraft' },
      { status: 500 }
    );
  }
}