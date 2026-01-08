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

    let personnel: any[] = [];

    // If role is INSTRUCTOR, query Personnel table (QFI and SIM IP)
    if (role === 'INSTRUCTOR' || !role) {
      const where: any = {
        isActive: true,
      };

      // Filter by availability if specified
      if (available === 'true') {
        // Check if they have any unavailability records
        where.availability = { isEmpty: true };
      } else if (available === 'false') {
        where.availability = { isEmpty: false };
      }

      // Search functionality
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { rank: { contains: search, mode: 'insensitive' } },
        ];
      }

      const instructors = await prisma.personnel.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      
      personnel = personnel.concat(instructors);
    }

    // If role is PILOT or TRAINEE, query Trainee table
    if (role === 'PILOT' || role === 'TRAINEE' || !role) {
      const where: any = {
        isPaused: false,
      };

      // Search functionality
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { rank: { contains: search, mode: 'insensitive' } },
        ];
      }

      const trainees = await prisma.trainee.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      
      personnel = personnel.concat(trainees);
    }

    return NextResponse.json({ personnel });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel' },
      { status: 500 }
    );
  }
}