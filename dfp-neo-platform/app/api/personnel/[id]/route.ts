import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();

const asJsonObject = (value: any): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const addStaffQualificationToPreferences = (preferences: any = {}, qualificationId = ''): Record<string, any> => {
  const source = asJsonObject(preferences);
  const existing = Array.isArray(source.qualifications) ? source.qualifications : [];
  const key = String(qualificationId || '').trim();
  if (!key) return source;
  const hasQualification = existing.some((value: any) => String(value || '').trim().toLowerCase() === key.toLowerCase());
  return {
    ...source,
    qualifications: hasQualification ? existing : [...existing, key],
  };
};

const normalisePersonnelPayload = (body: any = {}): any => {
  const roleCode = String(body.role || '').trim().toUpperCase().replace(/[\s-]+/g, ' ');
  if (roleCode === 'QFI' || roleCode === 'INSTRUCTOR') {
    return {
      ...body,
      role: 'Pilot',
      isQFI: body.isQFI ?? true,
      preferences: addStaffQualificationToPreferences(body.preferences, 'qfi'),
    };
  }
  if (roleCode === 'SIM IP' || roleCode === 'CONTRACTOR STAFF') {
    return {
      ...body,
      role: 'Pilot',
      isQFI: false,
      isContractor: true,
      preferences: addStaffQualificationToPreferences(body.preferences, 'contractor'),
    };
  }
  return body;
};

const PERSONNEL_UPDATE_FIELDS = [
  'name',
  'rank',
  'role',
  'availability',
  'isActive',
  'callsignNumber',
  'category',
  'email',
  'flight',
  'idNumber',
  'isAdminStaff',
  'isCFI',
  'isCommandingOfficer',
  'isContractor',
  'isDeputyFlightCommander',
  'isExecutive',
  'isFlyingSupervisor',
  'isIRE',
  'isOFI',
  'isQFI',
  'isTestingOfficer',
  'location',
  'permissions',
  'phoneNumber',
  'priorExperience',
  'seatConfig',
  'service',
  'unavailability',
  'unit',
  'photoUrl',
] as const;

// GET /api/personnel/:id - Get specific personnel
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
    await requireCapability('users:manage');

    const { id } = await params;

    const personnel = await prisma.personnel.findUnique({
      where: { id },
    });

    if (!personnel) {
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ personnel });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/personnel/:id - Delete personnel record
export async function DELETE(
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

    console.log(`🔧 [DELETE] Attempting to delete personnel with ID/IDNumber: ${id}`);

    // Try to find by id first (UUID), then by idNumber (PMKEYS)
    let personnel = await prisma.personnel.findUnique({
      where: { id },
    });

    // If not found by id, try idNumber (for backward compatibility)
    if (!personnel) {
      const idNumber = parseInt(id);
      if (!isNaN(idNumber)) {
        personnel = await prisma.personnel.findFirst({
          where: { idNumber },
        });
      }
    }

    if (!personnel) {
      console.log(`⚠️ [DELETE] Personnel not found with ID/IDNumber: ${id}`);
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    console.log(`📋 [DELETE] Found personnel: ${personnel.name}, Rank: ${personnel.rank}, ID: ${personnel.id}`);

    // Delete the personnel record
    const deletedPersonnel = await prisma.personnel.delete({
      where: { id: personnel.id },
    });

    console.log(`✅ [DELETE] Successfully deleted personnel: ${deletedPersonnel.name}`);

    return NextResponse.json({ 
      success: true,
      message: 'Personnel deleted successfully',
      deleted: {
        id: deletedPersonnel.id,
        name: deletedPersonnel.name,
        rank: deletedPersonnel.rank,
        idNumber: deletedPersonnel.idNumber
      }
    });
  } catch (error: any) {
    console.error('❌ [DELETE] Error deleting personnel:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to delete personnel' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/personnel/:id - Update personnel record
export async function PATCH(
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
    await requireCapability('personnel:manage');

    const { id } = await params;
    const body = normalisePersonnelPayload(await request.json());

    console.log(`📝 [PATCH] Updating personnel with ID: ${id}`, body);

    const existingPersonnel = await prisma.personnel.findUnique({
      where: { id },
      select: { preferences: true, qualifications: true },
    });

    if (!existingPersonnel) {
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    const data: any = {};
    PERSONNEL_UPDATE_FIELDS.forEach((field) => {
      if (body[field] !== undefined) data[field] = body[field];
    });

    if (body.callsign !== undefined || body.secondaryCallsign !== undefined || body.crew !== undefined || body.preferences !== undefined) {
      data.preferences = {
        ...asJsonObject(existingPersonnel.preferences),
        ...asJsonObject(body.preferences),
        ...(body.callsign !== undefined ? { callsign: body.callsign || null } : {}),
        ...(body.secondaryCallsign !== undefined ? { secondaryCallsign: body.secondaryCallsign || null } : {}),
        ...(body.crew !== undefined ? { crew: body.crew || null } : {}),
      };
    }

    if (body.currencyStatus !== undefined || body.qualifications !== undefined) {
      data.qualifications = {
        ...asJsonObject(existingPersonnel.qualifications),
        ...asJsonObject(body.qualifications),
        ...(body.currencyStatus !== undefined ? { currencyStatus: body.currencyStatus || [] } : {}),
      };
    }

    const updatedPersonnel = await prisma.personnel.update({
      where: { id },
      data,
    });

    console.log(`✅ [PATCH] Successfully updated personnel: ${updatedPersonnel.name}`);

    return NextResponse.json({ 
      success: true,
      message: 'Personnel updated successfully',
      personnel: updatedPersonnel
    });
  } catch (error: any) {
    console.error('❌ [PATCH] Error updating personnel:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to update personnel' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
