import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// PATCH /api/trainees/fix-lmp-type
// Fixes lmpType for trainees whose course implies a specific lmpType but have the wrong value.
// E.g. FIC course trainees should have lmpType='FIC', not 'BPC+IPC'.
export async function PATCH(request: NextRequest) {
  try {
    // Define course → lmpType mappings
    const courseLmpMappings: Record<string, string> = {
      'FIC': 'FIC',
      'OFI': 'OFI',
      'WSO': 'WSO',
      'FIC(I)': 'FIC(I)',
      'PLT CONV': 'PLT CONV',
      'QFI CONV': 'QFI CONV',
      'PLT Refresh': 'PLT Refresh',
      'Staff CAT': 'Staff CAT',
    };

    let totalFixed = 0;
    const results: { course: string; lmpType: string; count: number }[] = [];

    for (const [course, lmpType] of Object.entries(courseLmpMappings)) {
      const result = await prisma.trainee.updateMany({
        where: {
          course,
          NOT: { lmpType },
        },
        data: { lmpType },
      });

      if (result.count > 0) {
        totalFixed += result.count;
        results.push({ course, lmpType, count: result.count });
        console.log(`[fix-lmp-type] Fixed ${result.count} trainees in course "${course}" → lmpType="${lmpType}"`);
      }
    }

    console.log(`[fix-lmp-type] ✅ Total fixed: ${totalFixed}`);

    return NextResponse.json(
      { success: true, count: totalFixed, details: results },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Error in fix-lmp-type:', error);
    return NextResponse.json(
      { error: 'Failed to fix lmpType' },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    await prisma.$disconnect();
  }
}