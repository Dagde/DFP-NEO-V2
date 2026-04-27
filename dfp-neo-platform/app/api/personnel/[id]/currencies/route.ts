import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/personnel/:id/currencies
// Returns the currencyStatus array stored inside Personnel.qualifications JSON
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const personnel = await prisma.personnel.findUnique({
      where: { id },
      select: { id: true, name: true, qualifications: true },
    });

    if (!personnel) {
      return NextResponse.json({ error: 'Personnel not found' }, { status: 404 });
    }

    // currencyStatus lives inside the qualifications JSON blob
    const qualifications = (personnel.qualifications as any) || {};
    const currencyStatus = qualifications.currencyStatus || [];

    return NextResponse.json({ currencyStatus });
  } catch (error) {
    console.error('[Personnel Currencies GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch currency status' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/personnel/:id/currencies
// Body: { currencyStatus: PersonCurrencyStatus[] }
// Merges the new currencyStatus into Personnel.qualifications without losing other qualification fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { currencyStatus } = body;

    if (!Array.isArray(currencyStatus)) {
      return NextResponse.json({ error: 'currencyStatus must be an array' }, { status: 400 });
    }

    // Fetch existing qualifications to merge (don't overwrite other fields)
    const personnel = await prisma.personnel.findUnique({
      where: { id },
      select: { id: true, name: true, qualifications: true },
    });

    if (!personnel) {
      return NextResponse.json({ error: 'Personnel not found' }, { status: 404 });
    }

    const existingQualifications = (personnel.qualifications as any) || {};
    const updatedQualifications = {
      ...existingQualifications,
      currencyStatus,
    };

    const updated = await prisma.personnel.update({
      where: { id },
      data: { qualifications: updatedQualifications },
    });

    console.log(`[Personnel Currencies PATCH] ✅ Updated currencies for ${personnel.name}: ${currencyStatus.length} records`);
    return NextResponse.json({ success: true, currencyStatus });
  } catch (error) {
    console.error('[Personnel Currencies PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update currency status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}