import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
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

const isUsablePersonnelIdNumber = (value: any): boolean => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
};

const findPersonnelIdNumberConflict = async (idNumber: number, options: { excludePersonnelId?: string; excludeTraineeId?: string } = {}) => {
  const personnelWhere: any = { idNumber };
  if (options.excludePersonnelId) personnelWhere.id = { not: options.excludePersonnelId };
  const traineeWhere: any = { idNumber };
  if (options.excludeTraineeId) traineeWhere.id = { not: options.excludeTraineeId };
  const [personnel, trainee] = await Promise.all([
    prisma.personnel.findFirst({
      where: personnelWhere,
      select: { id: true, idNumber: true, name: true, rank: true, role: true, unit: true, isActive: true },
    }),
    prisma.trainee.findFirst({
      where: traineeWhere,
      select: { id: true, idNumber: true, name: true, fullName: true, rank: true, course: true, unit: true, isActive: true },
    }),
  ]);
  if (personnel) return { type: 'staff', record: personnel };
  if (trainee) return { type: 'trainee', record: trainee };
  return null;
};

const personnelIdConflictResponse = (request: NextRequest, conflict: any) => {
  const record = conflict?.record || {};
  const label = conflict?.type === 'trainee' ? 'trainee' : 'staff/personnel';
  return NextResponse.json(
    {
      error: `Personnel ID is already assigned to an existing ${label} record`,
      conflict: {
        type: conflict?.type || 'unknown',
        id: record.id || null,
        idNumber: record.idNumber || null,
        name: record.fullName || record.name || null,
        rank: record.rank || null,
        role: record.role || null,
        course: record.course || null,
        unit: record.unit || null,
        isActive: record.isActive ?? null,
      },
    },
    { status: 409, headers: getCorsHeaders(request) }
  );
};

// Handle OPTIONS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/personnel - Get all personnel with optional filtering
// Note: Auth check removed - page-level auth (login page) protects access
export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({ personnel }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personnel' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/personnel - Create new personnel record
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders(request) }
      );
    }
    await requireCapability('personnel:manage');

    console.log('🔍 [API POST] Creating new personnel record');
    
    const body = normalisePersonnelPayload(await request.json());
    console.log('🔍 [API POST] Request body:', JSON.stringify(body, null, 2));
    if (!isUsablePersonnelIdNumber(body.idNumber)) {
      return NextResponse.json(
        { error: 'Personnel ID is required' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }
    const idNumber = Number(body.idNumber);
    const idConflict = await findPersonnelIdNumberConflict(idNumber);
    if (idConflict) {
      return personnelIdConflictResponse(request, idConflict);
    }
    console.log('🔗 [AUTO-LINK] Checking for existing User record with matching Personnel ID...');
    
    // Auto-link to existing User by Personnel ID/userId
    let linkedUserId = null;
    const existingUser = await prisma.user.findFirst({
      where: {
        userId: idNumber.toString()
      }
    });

    if (existingUser) {
      console.log('✅ [AUTO-LINK] Found User record:', existingUser.username);
      linkedUserId = existingUser.id;
    } else {
      console.log('ℹ️  [AUTO-LINK] No existing User record found for Personnel ID:', idNumber);
    }

    const preferences = {
      ...asJsonObject(body.preferences),
      ...(body.callsign !== undefined ? { callsign: body.callsign || null } : {}),
      ...(body.secondaryCallsign !== undefined ? { secondaryCallsign: body.secondaryCallsign || null } : {}),
      ...(body.crew !== undefined ? { crew: body.crew || null } : {}),
    };

    // Create new personnel record
    const newPersonnel = await prisma.personnel.create({
      data: {
        name: body.name || '',
        rank: body.rank || null,
        role: body.role || null,
        category: body.category || null,
        unit: body.unit || null,
        flight: body.flight || null,
        location: body.location || null,
        idNumber,
        callsignNumber: body.callsignNumber || null,
        service: body.service || null,
        email: body.email || null,
        phoneNumber: body.phoneNumber || null,
        permissions: Array.isArray(body.permissions) ? body.permissions : [],
        unavailability: body.unavailability || [],
        priorExperience: body.priorExperience || null,
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
        preferences,
        userId: linkedUserId,
      }
    });

    console.log('✅ [API POST] New personnel created successfully:', newPersonnel.name);

    return NextResponse.json({ 
      success: true,
      personnel: newPersonnel 
    }, { headers: getCorsHeaders(request) });
  } catch (error: any) {
    console.error('❌ [API POST] Error creating personnel:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to create personnel' },
        { status: 403, headers: getCorsHeaders(request) }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create personnel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  } finally {
    await prisma.$disconnect();
  }
}
