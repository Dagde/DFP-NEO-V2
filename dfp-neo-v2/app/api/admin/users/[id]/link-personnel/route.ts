import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { createAuditLog } from '@/lib/audit';

const prisma = new PrismaClient();

// POST /api/admin/users/[id]/link-personnel - Manual User-Personnel linking
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { personnelId } = body;

    console.log('🔗 [MANUAL-LINK] Attempting to link User:', id, 'to Personnel:', personnelId);

    if (!personnelId) {
      return NextResponse.json(
        { error: 'Personnel ID is required' },
        { status: 400 }
      );
    }

    // Get User
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get Personnel
    const personnel = await prisma.personnel.findUnique({
      where: { id: personnelId }
    });

    if (!personnel) {
      return NextResponse.json(
        { error: 'Personnel record not found' },
        { status: 404 }
      );
    }

    // Check if already linked
    if (personnel.userId) {
      const existingLinkedUser = await prisma.user.findUnique({
        where: { id: personnel.userId }
      });

      return NextResponse.json(
        { 
          error: 'Personnel already linked to another user',
          personnelId,
          personnelName: personnel.name,
          linkedTo: existingLinkedUser?.username || 'Unknown user'
        },
        { status: 400 }
      );
    }

    // Verify PMKEYS match
    if (user.userId && personnel.idNumber) {
      if (user.userId !== personnel.idNumber.toString()) {
        console.log('⚠️  [MANUAL-LINK] PMKEYS mismatch!');
        console.log(`   User PMKEYS: ${user.userId}`);
        console.log(`   Personnel PMKEYS: ${personnel.idNumber}`);
        
        return NextResponse.json(
          { 
            error: 'PMKEYS mismatch between User and Personnel',
            userPmkeys: user.userId,
            personnelPmkeys: personnel.idNumber,
            warning: 'PMKEYS do not match - are you sure you want to link these records?'
          },
          { status: 400 }
        );
      }
    }

    // Perform the link
    await prisma.personnel.update({
      where: { id: personnelId },
      data: { userId: user.id }
    });

    console.log('✅ [MANUAL-LINK] Successfully linked User to Personnel');
    console.log(`   User: ${user.username} (${user.userId})`);
    console.log(`   Personnel: ${personnel.name} (${personnel.idNumber})`);

    // Log the linkage
    await createAuditLog({
      action: 'personnel_linked',
      userId: session.user.id,
      entityType: 'user',
      entityId: user.id,
      changes: {
        personnelId: personnel.id,
        personnelName: personnel.name,
        linkedBy: session.user.username
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully linked User to Personnel',
      user: {
        id: user.id,
        username: user.username,
        displayName: `${user.firstName} ${user.lastName}`.trim() || user.username
      },
      personnel: {
        id: personnel.id,
        name: personnel.name,
        rank: personnel.rank,
        unit: personnel.unit,
        idNumber: personnel.idNumber
      }
    });
  } catch (error) {
    console.error('❌ [MANUAL-LINK] Error linking user to personnel:', error);
    return NextResponse.json(
      { error: 'Failed to link user to personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}