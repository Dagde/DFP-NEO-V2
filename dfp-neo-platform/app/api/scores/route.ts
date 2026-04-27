import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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