import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { debugRoutesDisabledResponse } from '../guard';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const disabled = debugRoutesDisabledResponse();
  if (disabled) return disabled;

  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [DEBUG] Checking User and Personnel linkage...');

    // Search for User with Alexander Burns
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: 'Alexander' }, lastName: { contains: 'Burns' } },
          { username: { contains: 'burns' } },
          { userId: '8207938' },
          { email: { contains: 'burns' } }
        ]
      },
      include: {
        personnel: true
      }
    });

    console.log(`📊 [DEBUG] Found ${users.length} User records for Alexander Burns`);

    const usersResult = users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      userId: user.userId,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      linkedPersonnel: user.personnel ? {
        id: user.personnel.id,
        name: user.personnel.name,
        rank: user.personnel.rank,
        unit: user.personnel.unit,
        personnelId: user.personnel.idNumber,
        role: user.personnel.role
      } : null
    }));

    // Search for Personnel with Alexander Burns
    const personnelList = await prisma.personnel.findMany({
      where: {
        OR: [
          { name: { contains: 'Alexander' } },
          { name: { contains: 'Burns' } },
          { idNumber: 8207938 }
        ]
      },
      include: {
        user: true
      }
    });

    console.log(`📊 [DEBUG] Found ${personnelList.length} Personnel records for Alexander Burns`);

    const personnelResult = personnelList.map(personnel => ({
      id: personnel.id,
      name: personnel.name,
      rank: personnel.rank,
      unit: personnel.unit,
      personnelId: personnel.idNumber,
      role: personnel.role,
      category: personnel.category,
      isActive: personnel.isActive,
      linkedUser: personnel.user ? {
        id: personnel.user.id,
        username: personnel.user.username,
        displayName: `${personnel.user.firstName} ${personnel.user.lastName}`,
        email: personnel.user.email
      } : null
    }));

    // Check all real database staff and their linkage
    const realStaff = await prisma.personnel.findMany({
      where: { userId: { not: null } },
      include: {
        user: true
      }
    });

    const linkageSummary = realStaff.map(staff => ({
      personnelName: staff.name,
      personnelRecordId: staff.id,
      personnelId: staff.idNumber,
      userId: staff.userId,
      linked: !!staff.user,
      linkedUser: staff.user ? {
        username: staff.user.username,
        displayName: `${staff.user.firstName} ${staff.user.lastName}`,
        email: staff.user.email
      } : null
    }));

    const result = {
      summary: {
        totalRealStaff: realStaff.length,
        properlyLinked: realStaff.filter(s => s.user).length,
        brokenLinks: realStaff.filter(s => !s.user).length
      },
      users: usersResult,
      personnel: personnelResult,
      allLinkages: linkageSummary
    };

    console.log('✅ [DEBUG] User linkage check successful');
    console.log(`📊 [DEBUG] Real Staff: ${result.summary.totalRealStaff}, Linked: ${result.summary.properlyLinked}, Broken: ${result.summary.brokenLinks}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ [DEBUG] Error checking user linkage:', error);
    return NextResponse.json(
      { error: 'Failed to check user linkage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
