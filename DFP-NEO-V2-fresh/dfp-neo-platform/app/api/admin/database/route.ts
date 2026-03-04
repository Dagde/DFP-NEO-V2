import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// Helper: Check if user is admin
async function isAdmin(session: any) {
  if (!session?.user) return false;
  
  const user = await prisma.user.findUnique({
    where: { userId: session.user.userId },
    select: { role: true }
  });
  
  return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
}

// GET /api/admin/database - Get database statistics and queries
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || !(await isAdmin(session))) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const table = searchParams.get('table');

    // If a SQL query is provided, execute it (READ-ONLY queries only)
    if (query) {
      // Security: Only allow SELECT queries
      const trimmedQuery = query.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT')) {
        return NextResponse.json(
          { error: 'Only SELECT queries are allowed for security' },
          { status: 403 }
        );
      }

      try {
        const result = await prisma.$queryRawUnsafe(query);
        return NextResponse.json({
          success: true,
          type: 'query',
          query: query,
          results: result,
          rowCount: Array.isArray(result) ? result.length : 1
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Query execution failed', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    // Get database statistics
    const [userCount, personnelCount, traineeCount, scheduleCount, aircraftCount, scoreCount] = await Promise.all([
      prisma.user.count(),
      prisma.personnel.count(),
      prisma.trainee.count(),
      prisma.schedule.count(),
      prisma.aircraft.count(),
      prisma.score.count()
    ]);

    // Get recent activity
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    const recentPersonnel = await prisma.personnel.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        rank: true,
        idNumber: true,
        userId: true,
        createdAt: true
      }
    });

    // Find duplicate Personnel records
    const duplicateCheck = await prisma.$queryRaw`
      SELECT idNumber, COUNT(*) as count, 
             STRING_AGG(name, ', ') as names
      FROM "Personnel" 
      WHERE idNumber IS NOT NULL 
      GROUP BY idNumber 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `;

    // Personnel without userId (not linked)
    const unlinkedPersonnel = await prisma.personnel.count({
      where: { userId: null }
    });

    return NextResponse.json({
      success: true,
      type: 'stats',
      statistics: {
        users: userCount,
        personnel: personnelCount,
        trainees: traineeCount,
        schedules: scheduleCount,
        aircraft: aircraftCount,
        scores: scoreCount,
        unlinkedPersonnel
      },
      duplicates: duplicateCheck,
      recentUsers,
      recentPersonnel
    });
  } catch (error) {
    console.error('❌ [ADMIN DATABASE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch database info', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}