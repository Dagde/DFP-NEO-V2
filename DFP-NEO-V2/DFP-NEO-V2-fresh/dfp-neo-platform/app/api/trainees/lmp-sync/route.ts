import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/cors';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

// GET /api/trainees/lmp-sync
// Returns all IndividualLMPs (just traineeFullName + completedEventIds for fast load)
export async function GET(request: NextRequest) {
  try {
    const lmps = await (prisma as any).individualLMP.findMany({
      select: {
        traineeId: true,
        traineeFullName: true,
        lmpType: true,
        completedEventIds: true,
        updatedAt: true,
      },
      orderBy: { traineeFullName: 'asc' },
    });

    return NextResponse.json({ lmps, count: lmps.length }, { headers: getCorsHeaders(request) });
  } catch (error) {
    console.error('[LMP Sync GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LMP completions' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

// POST /api/trainees/lmp-sync
// Syncs PT-051 Score records → IndividualLMP completedEventIds for ALL trainees.
// For each trainee: reads their Score.event values, marks those events complete in LMP.
// Body: { syllabusData: Record<string, SyllabusItemDetail[]> }
//   syllabusData is keyed by lmpType (e.g. "BPC+IPC", "FIC") and contains the master syllabus items.
//   The frontend sends this because the backend has no knowledge of the syllabus structure.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { syllabusData } = body as {
      syllabusData: Record<string, any[]>; // lmpType → SyllabusItemDetail[]
    };

    if (!syllabusData || Object.keys(syllabusData).length === 0) {
      return NextResponse.json(
        { error: 'Missing syllabusData in request body' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Fetch all active trainees with their scores and existing LMP
    const trainees = await prisma.trainee.findMany({
      where: { isActive: true },
      include: {
        scores: {
          select: { event: true, date: true, score: true },
          orderBy: { date: 'asc' },
        },
        individualLMP: true,
      },
    });

    console.log(`[LMP Sync] Processing ${trainees.length} trainees...`);

    const results: {
      traineeFullName: string;
      lmpType: string;
      totalEvents: number;
      completedCount: number;
      newlyMarked: string[];
      status: 'created' | 'updated' | 'unchanged' | 'no_syllabus';
    }[] = [];

    for (const trainee of trainees) {
      // Determine LMP type - check lmpType field, fall back to detecting from course
      let lmpType = (trainee as any).lmpType || 'BPC+IPC';
      if (lmpType === 'BPC+IPC' && trainee.course) {
        if (trainee.course.toUpperCase().startsWith('FIC')) {
          lmpType = 'FIC';
        }
      }

      // Get the master syllabus for this LMP type
      let masterSyllabus = syllabusData[lmpType];
      if (!masterSyllabus || masterSyllabus.length === 0) {
        // Try BPC+IPC as fallback
        masterSyllabus = syllabusData['BPC+IPC'] || [];
      }
      if (!masterSyllabus || masterSyllabus.length === 0) {
        results.push({
          traineeFullName: trainee.fullName,
          lmpType,
          totalEvents: 0,
          completedCount: 0,
          newlyMarked: [],
          status: 'no_syllabus',
        });
        continue;
      }

      // Build set of completed event IDs from PT-051 Score records
      const completedFromScores = new Set<string>(
        trainee.scores.map((s: any) => s.event as string)
      );

      const completedEventIds = Array.from(completedFromScores);

      // Build the full LMP events array with completion status
      const lmpEvents = masterSyllabus.map((item: any) => ({
        ...item,
        completedAt: completedFromScores.has(item.id || item.code)
          ? trainee.scores.find(
              (s: any) => s.event === (item.id || item.code)
            )?.date?.toISOString() || null
          : null,
      }));

      // Check if LMP already exists and what it contains
      const existing = (trainee as any).individualLMP;
      const existingCompleted = existing
        ? (existing.completedEventIds as string[])
        : [];

      const newlyMarked = completedEventIds.filter(
        (id) => !existingCompleted.includes(id)
      );

      // Upsert the IndividualLMP
      await (prisma as any).individualLMP.upsert({
        where: { traineeId: trainee.id },
        update: {
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
          updatedAt: new Date(),
        },
        create: {
          traineeId: trainee.id,
          traineeFullName: trainee.fullName,
          lmpType,
          events: lmpEvents,
          completedEventIds,
        },
      });

      results.push({
        traineeFullName: trainee.fullName,
        lmpType,
        totalEvents: masterSyllabus.length,
        completedCount: completedEventIds.length,
        newlyMarked,
        status: !existing ? 'created' : newlyMarked.length > 0 ? 'updated' : 'unchanged',
      });

      console.log(
        `[LMP Sync] ${trainee.fullName} (${lmpType}): ${completedEventIds.length}/${masterSyllabus.length} events complete` +
          (newlyMarked.length > 0 ? ` — newly marked: ${newlyMarked.join(', ')}` : '')
      );
    }

    const created = results.filter((r) => r.status === 'created').length;
    const updated = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    const noSyllabus = results.filter((r) => r.status === 'no_syllabus').length;

    console.log(
      `[LMP Sync] ✅ Done — ${created} created, ${updated} updated, ${unchanged} unchanged, ${noSyllabus} skipped (no syllabus)`
    );

    return NextResponse.json(
      {
        success: true,
        summary: { created, updated, unchanged, noSyllabus, total: trainees.length },
        results,
      },
      { headers: getCorsHeaders(request) }
    );
  } catch (error) {
    console.error('[LMP Sync POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync LMPs', details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}