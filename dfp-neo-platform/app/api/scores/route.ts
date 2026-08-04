import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/permissions';

const prisma = new PrismaClient();

// GET /api/scores - Get all scores, optionally filtered by trainee
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const traineeId = searchParams.get('traineeId');
    const traineeFullName = searchParams.get('traineeFullName');

    const where: any = {};

    if (traineeId) {
      where.traineeId = traineeId;
    } else if (traineeFullName) {
      // Find trainee by fullName first
      const trainee = await prisma.trainee.findFirst({
        where: { fullName: traineeFullName }
      });
      if (trainee) {
        where.traineeId = trainee.id;
      } else {
        return NextResponse.json({ scores: [], count: 0 });
      }
    }

    const scores = await prisma.score.findMany({
      where,
      include: {
        trainee: {
          select: {
            id: true,
            fullName: true,
            course: true
          }
        }
      },
      orderBy: [
        { trainee: { fullName: 'asc' } },
        { date: 'asc' }
      ]
    });

    // Convert to the format expected by the frontend (Map<string, Score[]>)
    const scoresByTrainee = new Map();
    scores.forEach(score => {
      const fullName = score.trainee.fullName;
      if (!scoresByTrainee.has(fullName)) {
        scoresByTrainee.set(fullName, []);
      }
      // OPTIMIZED: Only return essential fields to reduce response size
      scoresByTrainee.get(fullName).push({
        event: score.event,
        score: score.score,
        date: score.date.toISOString().split('T')[0]
      });
    });

    // Convert Map to Array for JSON serialization
    const scoresArray = Array.from(scoresByTrainee.entries());

    return NextResponse.json({
      scores: scoresArray,
      count: scores.length
    });

  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scores' },
      { status: 500 }
    );
  }
}

// POST /api/scores - Create or update one trainee score
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requireCapability('training:manage');

    const body = await request.json();
    const { traineeId, traineeFullName, event, score, date, instructor, notes, details } = body;

    let resolvedTraineeId = traineeId;
    if (!resolvedTraineeId && traineeFullName) {
      const trainee = await prisma.trainee.findFirst({
        where: { fullName: traineeFullName }
      });
      if (!trainee) {
        return NextResponse.json(
          { error: `Trainee not found: ${traineeFullName}` },
          { status: 404 }
        );
      }
      resolvedTraineeId = trainee.id;
    }

    if (!resolvedTraineeId) {
      return NextResponse.json(
        { error: 'traineeId or traineeFullName required' },
        { status: 400 }
      );
    }
    if (!event) {
      return NextResponse.json({ error: 'event is required' }, { status: 400 });
    }

    const existing = await prisma.score.findFirst({
      where: { traineeId: resolvedTraineeId, event }
    });

    const scoreRecord = existing
      ? await prisma.score.update({
          where: { id: existing.id },
          data: {
            score: score !== undefined ? parseInt(score, 10) : existing.score,
            date: date ? new Date(date) : existing.date,
            instructor: instructor || existing.instructor,
            notes: notes || existing.notes,
            details: details !== undefined ? details : existing.details,
          },
        })
      : await prisma.score.create({
          data: {
            traineeId: resolvedTraineeId,
            event,
            score: score !== undefined ? parseInt(score, 10) : 3,
            date: date ? new Date(date) : new Date(),
            instructor: instructor || 'DCO',
            notes: notes || '',
            details: details || null,
          },
        });

    try {
      const lmp = await (prisma as any).individualLMP.findFirst({
        where: { traineeId: resolvedTraineeId }
      });
      if (lmp) {
        const existingIds = lmp.completedEventIds || [];
        const updatedIds = Array.from(new Set([...existingIds, event]));
        if (updatedIds.length !== existingIds.length) {
          await (prisma as any).individualLMP.update({
            where: { id: lmp.id },
            data: { completedEventIds: updatedIds, updatedAt: new Date() },
          });
        }
      }
    } catch (lmpError) {
      console.warn('[Scores POST] Could not update IndividualLMP:', lmpError);
    }

    return NextResponse.json({ success: true, score: scoreRecord });
  } catch (error: any) {
    console.error('Error creating score:', error);
    if (error.message?.includes('Missing required capability')) {
      return NextResponse.json(
        { error: 'You do not have permission to save scores' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create score' },
      { status: 500 }
    );
  }
}
