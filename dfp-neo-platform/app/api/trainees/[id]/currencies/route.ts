import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

// GET /api/trainees/:id/currencies
// Returns the currencyStatus JSON array stored directly on the Trainee model
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

    const trainee = await prisma.trainee.findUnique({
      where: { id },
      select: { id: true, name: true, currencyStatus: true },
    });

    if (!trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    const currencyStatus = (trainee.currencyStatus as any[]) || [];
    return NextResponse.json({ currencyStatus });
  } catch (error) {
    console.error('[Trainee Currencies GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch currency status' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH /api/trainees/:id/currencies
// Body: { currencyStatus: PersonCurrencyStatus[] }
// Replaces the Trainee.currencyStatus JSON field
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

    const trainee = await prisma.trainee.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!trainee) {
      return NextResponse.json({ error: 'Trainee not found' }, { status: 404 });
    }

    await prisma.trainee.update({
      where: { id },
      data: { currencyStatus },
    });

    console.log(`[Trainee Currencies PATCH] ✅ Updated currencies for ${trainee.name}: ${currencyStatus.length} records`);
    return NextResponse.json({ success: true, currencyStatus });
  } catch (error) {
    console.error('[Trainee Currencies PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update currency status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}