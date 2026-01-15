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
        
        // Check specifically for Alexander Burns
        const alexanderBurns = await prisma.personnel.findFirst({
            where: {
                idNumber: 8201112
            }
        });
        if (alexanderBurns) {
            console.log("🎯 [API TRACKING] Found Alexander Burns in database:", {
                id: alexanderBurns.id,
                idNumber: alexanderBurns.idNumber,
                name: alexanderBurns.name,
                rank: alexanderBurns.rank,
                role: alexanderBurns.role,
                isQFI: alexanderBurns.isQFI,
                isOFI: alexanderBurns.isOFI,
                userId: alexanderBurns.userId
            });
        } else {
            console.log("⚠️ [API TRACKING] Alexander Burns NOT found in database!");
        }
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
// POST /api/personnel - Create new personnel record
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      console.log('❌ [API POST] Unauthorized - No session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔍 [API POST] Creating new personnel record');
    
    const body = await request.json();
    console.log('🔍 [API POST] Request body:', JSON.stringify(body, null, 2));
      console.log('🔗 [AUTO-LINK] Checking for existing User record with matching PMKEYS...');
      
      // Auto-link to existing User by PMKEYS/userId
      let linkedUserId = null;
      if (body.idNumber) {
        const existingUser = await prisma.user.findFirst({
          where: { 
            userId: body.idNumber.toString()
          }
        });

        if (existingUser) {
          console.log('✅ [AUTO-LINK] Found User record:', existingUser.username);
          console.log('🔗 [AUTO-LINK] Linking Personnel to User...');
          linkedUserId = existingUser.id;
        } else {
          console.log('ℹ️  [AUTO-LINK] No existing User record found for PMKEYS:', body.idNumber);
        }
      } else {
        console.log('⚠️  [AUTO-LINK] No idNumber provided, cannot link to User');
      }

      // Create new personnel record
      // IMPORTANT: Link to the User who matches the PMKEYS, not the creator

    // Create new personnel record
    const newPersonnel = await prisma.personnel.create({
      data: {
        name: body.name || '',
        rank: body.rank || null,
        role: body.role || null,
        category: body.category || null,
        unit: body.unit || null,
        location: body.location || null,
        idNumber: body.idNumber || null,
        callsignNumber: body.callsignNumber || null,
        email: body.email || null,
        phoneNumber: body.phoneNumber || null,
        seatConfig: body.seatConfig || null,
        isQFI: body.isQFI || false,
        isOFI: body.isOFI || false,
        isCFI: body.isCFI || false,
        isExecutive: body.isExecutive || false,
        isFlyingSupervisor: body.isFlyingSupervisor || false,
        isIRE: body.isIRE || false,
        isCommandingOfficer: body.isCommandingOfficer || false,
        isTestingOfficer: body.isTestingOfficer || false,
        isContractor: body.isContractor || false,
        isAdminStaff: body.isAdminStaff || false,
        isActive: true,
          // CRITICAL: Always set userId from authenticated session to identify as real database staff
          userId: linkedUserId,
      }
    });

    console.log('✅ [API POST] New personnel created successfully');
    console.log('✅ [API POST] Personnel ID:', newPersonnel.id);
    console.log('✅ [API POST] Personnel Name:', newPersonnel.name);
    console.log('✅ [API POST] Personnel userId:', newPersonnel.userId);
      if (linkedUserId) {
        console.log("✅ [AUTO-LINK] Successfully linked Personnel to User");
        console.log(`   User ID: ${linkedUserId}`);
        console.log(`   Personnel ID: ${newPersonnel.id} (${newPersonnel.name})`);
      }

    return NextResponse.json({ 
      success: true,
      personnel: newPersonnel 
    });
  } catch (error) {
    console.error('❌ [API POST] Error creating personnel:', error);
    return NextResponse.json(
      { error: 'Failed to create personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
