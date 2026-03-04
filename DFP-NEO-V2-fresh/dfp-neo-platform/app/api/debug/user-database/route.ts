import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [DEBUG] Querying User Database...');

    // Get all users
    const allUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        userId: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        // Count related records (only array relations)
        _count: {
          select: {
            aircraft: true,
            flightSchedules: true,
            AuditLog: true,
          }
        }
      }
    });

    // Get users by role
    const usersByRole = allUsers.reduce((acc, user) => {
      const role = user.role;
      if (!acc[role]) {
        acc[role] = [];
      }
      acc[role].push(user);
      return acc;
    }, {} as Record<string, typeof allUsers>);

    // Get active vs inactive counts
    const activeUsers = allUsers.filter(u => u.isActive).length;
    const inactiveUsers = allUsers.filter(u => !u.isActive).length;

    // Personnel and trainee are singular relations, cannot be counted with _count

    const result = {
      summary: {
        totalUsers: allUsers.length,
        activeUsers,
        inactiveUsers,
        uniqueRoles: Object.keys(usersByRole).length,
        usersLinkedToPersonnel: 0,
        roles: Object.keys(usersByRole).map(role => ({
          role,
          count: usersByRole[role].length
        }))
      },
      allUsers: allUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        userId: user.userId,
        role: user.role,
        displayName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasLinkedPersonnel: false,
        hasLinkedTrainee: false,
        aircraftCount: user._count.aircraft,
        flightScheduleCount: user._count.flightSchedules,
        auditLogCount: user._count.AuditLog,
      })),
      usersByRole: Object.keys(usersByRole).reduce((acc, role) => {
        acc[role] = usersByRole[role].map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          userId: user.userId,
          displayName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
        }));
        return acc;
      }, {} as Record<string, any[]>),
    };

    console.log('✅ [DEBUG] User database query successful');
    console.log(`📊 [DEBUG] Total Users: ${result.summary.totalUsers}, Active: ${result.summary.activeUsers}, Roles: ${result.summary.uniqueRoles}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [DEBUG] Error querying user database:', error);
    return NextResponse.json(
      { error: 'Failed to query user database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}