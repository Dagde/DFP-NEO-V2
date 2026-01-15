import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No active session' },
        { status: 401 }
      );
    }

    // Fetch rank from Personnel table instead of User table
    // This ensures the rank comes from the Staff Database where it's properly set
    let userRole = session.user.role || 'UNKNOWN';
    
    try {
      const personnel = await prisma.personnel.findFirst({
        where: {
          userId: session.user.userId
        },
        select: {
          rank: true
        }
      });
      
      if (personnel && personnel.rank) {
        userRole = personnel.rank;
        console.log('[SESSION API] Found rank from Personnel table:', userRole);
      } else {
        console.log('[SESSION API] Personnel record not found or has no rank, using User table role:', session.user.role);
      }
    } catch (error) {
      console.error('[SESSION API] Error fetching personnel:', error);
      console.log('[SESSION API] Using User table role:', session.user.role);
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        userId: session.user.userId,
        username: session.user.username,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        role: userRole, // Use rank from Personnel table
      }
    });
  } catch (error) {
    console.error('[SESSION API] Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'An error occurred' },
      { status: 500 }
    );
  }
}